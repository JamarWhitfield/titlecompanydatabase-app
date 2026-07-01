-- ============================================================
-- Migration: 0017_remove_member.sql
-- Description: Admin-only RPC to remove (kick) a member from the
--              caller's company. Companion to set_member_role (0016).
--
-- FLOW
--   1. A company ADMIN calls remove_member(target_user). The RPC verifies
--      the caller is an admin and that the target belongs to the SAME
--      company, then deletes the target's profile row.
--   2. Company-owned data the departing member authored (company_records,
--      record_notes) is reassigned to the acting admin so it stays with the
--      company — those columns are NOT NULL with restricting FKs to
--      profiles, so they must be re-pointed before the profile is deleted.
--   3. A 'member_removed' row is written to audit_logs for the trail.
--
-- SECURITY MODEL
--   * remove_member() is a SECURITY DEFINER mutator granted only to
--     authenticated. Every guard is enforced in SQL, independent of the UI:
--       - caller must be an admin;
--       - target must be in the caller's own company (cross-company
--         isolation — an admin can never touch another company's members);
--       - the last remaining admin can never be removed (covers both
--         "remove another admin" and "remove yourself" cases uniformly,
--         so a company can never be orphaned without an admin).
--   * Self-removal is permitted ONLY when it would not strip the company of
--     its last admin — handled by the same last-admin guard.
--
-- NOTE
--   Deleting the profile row removes the user from the company. The
--   underlying auth.users row is managed by Supabase Auth and is not
--   touched here; fully revoking the login requires the Auth admin API and
--   is intentionally out of scope for this database-level operation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.remove_member(target_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller         UUID := auth.uid();
  _caller_company UUID;
  _caller_role    TEXT;
  _target_role    TEXT;
  _admin_count    INT;
BEGIN
  SELECT company_id, role INTO _caller_company, _caller_role
  FROM public.profiles WHERE id = _caller;

  IF _caller_company IS NULL THEN
    RAISE EXCEPTION 'You do not belong to a company';
  END IF;

  IF _caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only company admins can remove members';
  END IF;

  -- Company isolation: the target must live in the caller's own company.
  -- A row outside the company is invisible here and reads back as NULL.
  SELECT role INTO _target_role
  FROM public.profiles
  WHERE id = target_user AND company_id = _caller_company;

  IF _target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found in your company';
  END IF;

  -- Last-admin guard: never let the company end up with zero admins. This
  -- single check protects both removing another admin and self-removal.
  IF _target_role = 'admin' THEN
    SELECT COUNT(*) INTO _admin_count
    FROM public.profiles
    WHERE company_id = _caller_company AND role = 'admin';

    IF _admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last admin of the company';
    END IF;
  END IF;

  -- Reassign company-owned data authored by the departing member to the
  -- acting admin. company_records.created_by and record_notes.user_id are
  -- NOT NULL with restricting FKs to profiles, so the profile cannot be
  -- deleted while they still reference it. Scoped to the company for safety.
  UPDATE public.company_records
  SET created_by = _caller
  WHERE created_by = target_user AND company_id = _caller_company;

  UPDATE public.record_notes
  SET user_id = _caller
  WHERE user_id = target_user AND company_id = _caller_company;

  -- Audit the removal. Written before the DELETE so the snapshot is intact.
  INSERT INTO public.audit_logs
    (company_id, user_id, action, table_name, record_id, old_data)
  VALUES (
    _caller_company,
    _caller,
    'member_removed',
    'profiles',
    target_user,
    jsonb_build_object('removed_user', target_user, 'removed_role', _target_role)
  );

  -- Remaining FKs to this profile are safe: company_invitations.invited_by
  -- is ON DELETE SET NULL; saved_searches and notifications are ON DELETE
  -- CASCADE. Deleting the profile completes the removal.
  DELETE FROM public.profiles
  WHERE id = target_user AND company_id = _caller_company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_member(UUID) TO authenticated;
