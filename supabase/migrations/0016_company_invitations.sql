-- ============================================================
-- Migration: 0016_company_invitations.sql
-- Description: Team management — invite teammates to an existing
--              company and let admins manage member roles.
--
-- FLOW
--   1. A company ADMIN creates an invitation (email + role). A random,
--      unguessable token is generated. The admin shares the link
--      /register?invite=<token> with the invitee.
--   2. The invitee opens the link and registers. The handle_new_user
--      trigger (redefined below) detects the invite token in the new
--      user's metadata and, if it is valid + unexpired + the email
--      matches, places the new user into the inviting company with the
--      invited role instead of creating a brand-new company.
--   3. Admins can promote/demote members (set_member_role) and revoke
--      pending invitations.
--
-- SECURITY MODEL
--   * RLS scopes company_invitations so only ADMINS of the owning company
--     can read/create/revoke them — no company can ever see another's.
--   * Acceptance happens ONLY inside the SECURITY DEFINER trigger, which
--     verifies the invite email matches the signing-up user's email. A
--     stolen token used with a different email simply falls back to the
--     normal "create your own company" path — it can never join a company
--     it was not issued for.
--   * get_invitation_by_token() is a SECURITY DEFINER reader granted to
--     anon so the public /register page can show the inviting company name
--     and lock the email field. It returns nothing for invalid/expired
--     tokens and never exposes any other company data.
--   * set_member_role() is a SECURITY DEFINER mutator that only an admin of
--     the same company may call, and it refuses to demote the last admin.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- company_invitations
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  -- 64 hex chars of entropy; generated server-side, no pgcrypto required.
  token       TEXT NOT NULL UNIQUE
                DEFAULT REPLACE(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', ''),
  invited_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_invitations_company
  ON public.company_invitations (company_id);

-- At most one PENDING invite per (company, email). Accepted/expired rows are
-- ignored so a previously-used address can be re-invited later if needed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_invitations_pending
  ON public.company_invitations (company_id, LOWER(email))
  WHERE accepted_at IS NULL;

ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invitations FORCE ROW LEVEL SECURITY;

-- Admins of the owning company can read its invitations.
DROP POLICY IF EXISTS "invitations: read own company admins" ON public.company_invitations;
CREATE POLICY "invitations: read own company admins"
  ON public.company_invitations FOR SELECT TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- Admins can create invitations for their own company only.
DROP POLICY IF EXISTS "invitations: insert own company admins" ON public.company_invitations;
CREATE POLICY "invitations: insert own company admins"
  ON public.company_invitations FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- Admins can revoke (delete) their own company's pending invitations.
DROP POLICY IF EXISTS "invitations: delete own company admins" ON public.company_invitations;
CREATE POLICY "invitations: delete own company admins"
  ON public.company_invitations FOR DELETE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- Acceptance is performed by the SECURITY DEFINER trigger only — there is
-- intentionally no UPDATE policy.

-- ────────────────────────────────────────────────────────────
-- get_invitation_by_token — public reader for the /register page.
-- Returns the inviting company name, target email and role for a VALID
-- (pending + unexpired) token, or no rows otherwise. Exposes nothing
-- beyond the single matching invitation.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(invite_token TEXT)
RETURNS TABLE (company_name TEXT, email TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name, i.email, i.role
  FROM public.company_invitations i
  JOIN public.companies c ON c.id = i.company_id
  WHERE i.token = invite_token
    AND i.accepted_at IS NULL
    AND i.expires_at > NOW()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- set_member_role — admin-only role change within the caller's company.
-- Guards: caller must be an admin; target must be in the same company;
-- the last remaining admin cannot be demoted.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_member_role(target_user UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_company UUID;
  _caller_role    TEXT;
  _target_role    TEXT;
  _admin_count    INT;
BEGIN
  IF new_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  SELECT company_id, role INTO _caller_company, _caller_role
  FROM public.profiles WHERE id = auth.uid();

  IF _caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only company admins can change member roles';
  END IF;

  SELECT role INTO _target_role
  FROM public.profiles
  WHERE id = target_user AND company_id = _caller_company;

  IF _target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found in your company';
  END IF;

  -- Don't strip the company of its last admin.
  IF _target_role = 'admin' AND new_role = 'member' THEN
    SELECT COUNT(*) INTO _admin_count
    FROM public.profiles
    WHERE company_id = _caller_company AND role = 'admin';

    IF _admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last admin of the company';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = new_role
  WHERE id = target_user AND company_id = _caller_company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_member_role(UUID, TEXT) TO authenticated;

-- ============================================================
-- handle_new_user — redefined to consume a valid invitation.
-- Mirrors 0002 but joins an existing company when the signing-up user
-- carries a valid invite token whose email matches their own.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _company_id    UUID;
  _company_name  TEXT;
  _full_name     TEXT;
  _base_slug     TEXT;
  _slug          TEXT;
  _invite_token  TEXT;
  _invite        public.company_invitations%ROWTYPE;
BEGIN
  _full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NEW.email
  );
  _invite_token := NULLIF(TRIM(NEW.raw_user_meta_data->>'invite_token'), '');

  -- ── Invited path: join the inviting company if the token is valid AND
  --    the invite was issued to this exact email address. ──────────────
  IF _invite_token IS NOT NULL THEN
    SELECT * INTO _invite
    FROM public.company_invitations
    WHERE token = _invite_token
      AND accepted_at IS NULL
      AND expires_at > NOW()
      AND LOWER(email) = LOWER(NEW.email)
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.profiles (id, company_id, full_name, role)
      VALUES (NEW.id, _invite.company_id, _full_name, _invite.role);

      UPDATE public.company_invitations
      SET accepted_at = NOW()
      WHERE id = _invite.id;

      RETURN NEW;
    END IF;
  END IF;

  -- ── Default path: create a brand-new company (original 0002 behavior). ──
  _company_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    'My Company'
  );

  _base_slug := LOWER(REGEXP_REPLACE(TRIM(_company_name), '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := _base_slug || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);

  INSERT INTO public.companies (name, slug)
  VALUES (_company_name, _slug)
  RETURNING id INTO _company_id;

  INSERT INTO public.profiles (id, company_id, full_name, role)
  VALUES (NEW.id, _company_id, _full_name, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
