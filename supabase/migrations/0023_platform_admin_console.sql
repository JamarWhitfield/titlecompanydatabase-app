-- ============================================================
-- Migration: 0023_platform_admin_console.sql
-- Description: Secure Platform Admin Console for internal SaaS operators.
--
--   This is intentionally NOT a "sudo account". Platform admin status lives
--   in its own table (platform_admins), completely separate from the per-
--   company admin/member role. Cross-tenant reads happen ONLY through
--   narrowly-scoped SECURITY DEFINER RPCs that (a) check is_platform_admin()
--   and (b) audit sensitive access. No broad `USING (true)` policy is ever
--   added to a tenant table, and no existing company-scoped RLS is weakened.
--
--   Three platform roles:
--     owner   — full platform control incl. managing platform admins.
--     support — read companies + start audited break-glass support sessions.
--     auditor — read-only visibility into companies + audit logs; NO support.
--
--   Break-glass "support sessions" gate any look at private tenant data
--   behind an explicit reason + expiry + per-action audit logging.
--
-- Idempotent where practical (IF NOT EXISTS / CREATE OR REPLACE / DROP..IF).
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- TABLES
-- ════════════════════════════════════════════════════════════

-- platform_admins: who may operate the platform, and at what level.
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'support', 'auditor')),
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_enabled_role
  ON public.platform_admins (enabled, role);

-- platform_audit_logs: append-only trail of every privileged platform action.
-- FKs use ON DELETE SET NULL so history survives tenant/user deletion without
-- ever being user-mutable (there are no UPDATE/DELETE policies).
CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,
  target_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  target_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_record_id  UUID REFERENCES public.company_records(id) ON DELETE SET NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_created_at
  ON public.platform_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_actor
  ON public.platform_audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_company
  ON public.platform_audit_logs (target_company_id);

-- platform_support_sessions: time-boxed break-glass access to one company.
CREATE TABLE IF NOT EXISTS public.platform_support_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_actor
  ON public.platform_support_sessions (actor_user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_support_sessions_company
  ON public.platform_support_sessions (company_id, expires_at);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- All three tables are locked down. Direct client writes are impossible;
-- every mutation flows through a SECURITY DEFINER RPC below.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.platform_admins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_support_sessions FORCE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════
-- CORE HELPERS
-- ════════════════════════════════════════════════════════════

-- is_platform_admin(required_roles) — true iff the caller is an ENABLED
-- platform admin, optionally restricted to one of required_roles. Returns
-- false for anon (auth.uid() IS NULL yields no match).
CREATE OR REPLACE FUNCTION public.is_platform_admin(required_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
      AND pa.enabled = TRUE
      AND (required_roles IS NULL OR pa.role = ANY (required_roles))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(TEXT[]) TO authenticated;

-- platform_current_role() — the caller's platform role, or NULL. Used by the
-- server to decide whether to show the Platform nav + gate routes.
CREATE OR REPLACE FUNCTION public.platform_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.platform_admins
  WHERE user_id = auth.uid() AND enabled = TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.platform_current_role() TO authenticated;

-- log_platform_action(...) — append a row to the platform audit trail. Only
-- callable by an authenticated, enabled platform admin. Returns the new id.
CREATE OR REPLACE FUNCTION public.log_platform_action(
  action            TEXT,
  target_company_id UUID  DEFAULT NULL,
  target_user_id    UUID  DEFAULT NULL,
  target_record_id  UUID  DEFAULT NULL,
  metadata          JSONB DEFAULT '{}'::jsonb,
  reason            TEXT  DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.platform_audit_logs (
    actor_user_id, action, target_company_id, target_user_id,
    target_record_id, metadata, reason
  )
  VALUES (
    auth.uid(), action, target_company_id, target_user_id,
    target_record_id, COALESCE(metadata, '{}'::jsonb), reason
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_platform_action(TEXT, UUID, UUID, UUID, JSONB, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- RLS POLICIES (read-only, defense in depth; writes are RPC-only)
-- ════════════════════════════════════════════════════════════

-- platform_admins: only owners may read the roster directly. Everyone else
-- (including support/auditor) learns their own role via platform_current_role().
DROP POLICY IF EXISTS "platform_admins: owners read" ON public.platform_admins;
CREATE POLICY "platform_admins: owners read"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (public.is_platform_admin(ARRAY['owner']));

-- platform_audit_logs: owners and auditors may read. No write policies at all,
-- so the table is append-only from any client — inserts happen only inside the
-- SECURITY DEFINER helpers above.
DROP POLICY IF EXISTS "platform_audit_logs: owner/auditor read" ON public.platform_audit_logs;
CREATE POLICY "platform_audit_logs: owner/auditor read"
  ON public.platform_audit_logs FOR SELECT TO authenticated
  USING (public.is_platform_admin(ARRAY['owner', 'auditor']));

-- platform_support_sessions: a platform admin may read their own sessions;
-- owners may read all. No client write policies (RPC-only lifecycle).
DROP POLICY IF EXISTS "support_sessions: own or owner read" ON public.platform_support_sessions;
CREATE POLICY "support_sessions: own or owner read"
  ON public.platform_support_sessions FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    AND (actor_user_id = auth.uid() OR public.is_platform_admin(ARRAY['owner']))
  );

-- ════════════════════════════════════════════════════════════
-- READ RPCs (console)
-- ════════════════════════════════════════════════════════════

-- platform_get_stats() — high-level platform-wide counters.
CREATE OR REPLACE FUNCTION public.platform_get_stats()
RETURNS TABLE (
  total_companies       BIGINT,
  total_users           BIGINT,
  total_records         BIGINT,
  total_shared_records  BIGINT,
  total_files           BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.companies),
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.company_records),
    (SELECT count(*) FROM public.company_records WHERE is_shared),
    (SELECT count(*) FROM public.record_files);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_get_stats() TO authenticated;

-- platform_list_companies() — every company with rollup counts.
CREATE OR REPLACE FUNCTION public.platform_list_companies()
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  slug         TEXT,
  created_at   TIMESTAMPTZ,
  member_count BIGINT,
  record_count BIGINT,
  shared_count BIGINT,
  file_count   BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.name, c.slug, c.created_at,
    (SELECT count(*) FROM public.profiles p        WHERE p.company_id = c.id),
    (SELECT count(*) FROM public.company_records r  WHERE r.company_id = c.id),
    (SELECT count(*) FROM public.company_records r  WHERE r.company_id = c.id AND r.is_shared),
    (SELECT count(*) FROM public.record_files f     WHERE f.company_id = c.id)
  FROM public.companies c
  ORDER BY c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_companies() TO authenticated;

-- platform_get_company_details(company_id) — metadata + counts for one company.
-- Logs the cross-tenant view.
CREATE OR REPLACE FUNCTION public.platform_get_company_details(p_company_id UUID)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  slug         TEXT,
  created_at   TIMESTAMPTZ,
  member_count BIGINT,
  record_count BIGINT,
  shared_count BIGINT,
  private_count BIGINT,
  file_count   BIGINT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.log_platform_action('view_company_details', p_company_id);

  RETURN QUERY
  SELECT
    c.id, c.name, c.slug, c.created_at,
    (SELECT count(*) FROM public.profiles p        WHERE p.company_id = c.id),
    (SELECT count(*) FROM public.company_records r  WHERE r.company_id = c.id),
    (SELECT count(*) FROM public.company_records r  WHERE r.company_id = c.id AND r.is_shared),
    (SELECT count(*) FROM public.company_records r  WHERE r.company_id = c.id AND NOT r.is_shared),
    (SELECT count(*) FROM public.record_files f     WHERE f.company_id = c.id)
  FROM public.companies c
  WHERE c.id = p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_get_company_details(UUID) TO authenticated;

-- platform_list_company_members(company_id) — members of a company (PII), logged.
CREATE OR REPLACE FUNCTION public.platform_list_company_members(p_company_id UUID)
RETURNS TABLE (
  user_id    UUID,
  full_name  TEXT,
  email      TEXT,
  role       TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.log_platform_action('view_company_members', p_company_id);

  RETURN QUERY
  SELECT p.id, p.full_name, u.email::TEXT, p.role, p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.company_id = p_company_id
  ORDER BY p.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_company_members(UUID) TO authenticated;

-- platform_list_company_audit_logs(company_id) — a company's own audit trail,
-- with actor names resolved. Logged.
CREATE OR REPLACE FUNCTION public.platform_list_company_audit_logs(p_company_id UUID)
RETURNS TABLE (
  id         UUID,
  action     TEXT,
  actor_name TEXT,
  record_id  UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.log_platform_action('view_company_audit', p_company_id);

  RETURN QUERY
  SELECT a.id, a.action, p.full_name, a.record_id, a.created_at
  FROM public.audit_logs a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.company_id = p_company_id
  ORDER BY a.created_at DESC
  LIMIT 250;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_company_audit_logs(UUID) TO authenticated;

-- platform_list_platform_audit_logs() — the platform-level audit trail.
-- Owner + auditor only. Not itself logged (would be self-referential noise).
CREATE OR REPLACE FUNCTION public.platform_list_platform_audit_logs()
RETURNS TABLE (
  id                UUID,
  actor_user_id     UUID,
  actor_name        TEXT,
  action            TEXT,
  target_company_id UUID,
  target_company    TEXT,
  target_user_id    UUID,
  target_record_id  UUID,
  metadata          JSONB,
  reason            TEXT,
  created_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(ARRAY['owner', 'auditor']) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.actor_user_id, p.full_name, l.action,
    l.target_company_id, c.name, l.target_user_id, l.target_record_id,
    l.metadata, l.reason, l.created_at
  FROM public.platform_audit_logs l
  LEFT JOIN public.profiles p  ON p.id = l.actor_user_id
  LEFT JOIN public.companies c ON c.id = l.target_company_id
  ORDER BY l.created_at DESC
  LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_platform_audit_logs() TO authenticated;

-- ════════════════════════════════════════════════════════════
-- PLATFORM ADMIN MANAGEMENT RPCs (owner-only, all logged)
-- ════════════════════════════════════════════════════════════

-- platform_list_admins() — the platform admin roster (owner-only).
CREATE OR REPLACE FUNCTION public.platform_list_admins()
RETURNS TABLE (
  user_id    UUID,
  email      TEXT,
  full_name  TEXT,
  role       TEXT,
  enabled    BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(ARRAY['owner']) THEN
    RAISE EXCEPTION 'Only platform owners can view platform admins'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT pa.user_id, u.email::TEXT, p.full_name, pa.role, pa.enabled, pa.created_at
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
  LEFT JOIN public.profiles p ON p.id = pa.user_id
  ORDER BY pa.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_admins() TO authenticated;

-- platform_add_admin(email, role) — grant platform access by email (owner-only).
-- Upserts: re-granting a disabled admin re-enables them. Logged.
CREATE OR REPLACE FUNCTION public.platform_add_admin(target_email TEXT, target_role TEXT)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID;
BEGIN
  IF NOT public.is_platform_admin(ARRAY['owner']) THEN
    RAISE EXCEPTION 'Only platform owners can add platform admins'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF target_role NOT IN ('owner', 'support', 'auditor') THEN
    RAISE EXCEPTION 'Invalid platform role: %', target_role;
  END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(btrim(target_email));
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No user found with that email';
  END IF;

  INSERT INTO public.platform_admins (user_id, role, enabled, created_by)
  VALUES (_uid, target_role, TRUE, auth.uid())
  ON CONFLICT (user_id)
  DO UPDATE SET role = EXCLUDED.role, enabled = TRUE;

  PERFORM public.log_platform_action(
    'platform_admin_added', NULL, _uid, NULL,
    jsonb_build_object('role', target_role)
  );

  RETURN _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_add_admin(TEXT, TEXT) TO authenticated;

-- platform_set_admin_role(user, role) — change a platform admin's role
-- (owner-only). Refuses to strip the last enabled owner. Logged.
CREATE OR REPLACE FUNCTION public.platform_set_admin_role(target_user UUID, new_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_role TEXT;
  _owner_count  INT;
BEGIN
  IF NOT public.is_platform_admin(ARRAY['owner']) THEN
    RAISE EXCEPTION 'Only platform owners can change platform roles'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF new_role NOT IN ('owner', 'support', 'auditor') THEN
    RAISE EXCEPTION 'Invalid platform role: %', new_role;
  END IF;

  SELECT role INTO _current_role FROM public.platform_admins WHERE user_id = target_user;
  IF _current_role IS NULL THEN
    RAISE EXCEPTION 'That user is not a platform admin';
  END IF;

  -- Never leave the platform without an enabled owner.
  IF _current_role = 'owner' AND new_role <> 'owner' THEN
    SELECT count(*) INTO _owner_count
    FROM public.platform_admins WHERE role = 'owner' AND enabled = TRUE;
    IF _owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last platform owner';
    END IF;
  END IF;

  UPDATE public.platform_admins SET role = new_role WHERE user_id = target_user;

  PERFORM public.log_platform_action(
    'platform_admin_role_changed', NULL, target_user, NULL,
    jsonb_build_object('from', _current_role, 'to', new_role)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_set_admin_role(UUID, TEXT) TO authenticated;

-- platform_set_admin_enabled(user, enabled) — disable/re-enable platform
-- access (owner-only). Refuses to disable the last enabled owner. Logged.
CREATE OR REPLACE FUNCTION public.platform_set_admin_enabled(target_user UUID, new_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_role TEXT;
  _owner_count  INT;
BEGIN
  IF NOT public.is_platform_admin(ARRAY['owner']) THEN
    RAISE EXCEPTION 'Only platform owners can disable platform admins'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role INTO _current_role FROM public.platform_admins WHERE user_id = target_user;
  IF _current_role IS NULL THEN
    RAISE EXCEPTION 'That user is not a platform admin';
  END IF;

  IF new_enabled = FALSE AND _current_role = 'owner' THEN
    SELECT count(*) INTO _owner_count
    FROM public.platform_admins WHERE role = 'owner' AND enabled = TRUE;
    IF _owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot disable the last platform owner';
    END IF;
  END IF;

  UPDATE public.platform_admins SET enabled = new_enabled WHERE user_id = target_user;

  PERFORM public.log_platform_action(
    CASE WHEN new_enabled THEN 'platform_admin_enabled' ELSE 'platform_admin_disabled' END,
    NULL, target_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_set_admin_enabled(UUID, BOOLEAN) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- SUPPORT SESSION (break-glass) RPCs
-- ════════════════════════════════════════════════════════════

-- Internal guard: validate a support session for the caller and return the
-- session's company_id, or raise. Not granted to clients (definer-internal).
CREATE OR REPLACE FUNCTION public.platform_support_session_company(p_session_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company UUID;
  _actor   UUID;
  _exp     TIMESTAMPTZ;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT company_id, actor_user_id, expires_at
    INTO _company, _actor, _exp
  FROM public.platform_support_sessions
  WHERE id = p_session_id;

  IF _company IS NULL THEN
    RAISE EXCEPTION 'Support session not found';
  END IF;
  IF _actor <> auth.uid() AND NOT public.is_platform_admin(ARRAY['owner']) THEN
    RAISE EXCEPTION 'Not your support session' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _exp <= NOW() THEN
    RAISE EXCEPTION 'Support session has expired';
  END IF;

  RETURN _company;
END;
$$;

-- platform_start_support_session(company_id, reason) — owner/support only.
-- Requires a non-empty reason; 30-minute expiry; logged. Returns session id.
CREATE OR REPLACE FUNCTION public.platform_start_support_session(p_company_id UUID, p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session_id UUID;
  _reason     TEXT := btrim(COALESCE(p_reason, ''));
BEGIN
  IF NOT public.is_platform_admin(ARRAY['owner', 'support']) THEN
    RAISE EXCEPTION 'Only owner or support can start a support session'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _reason = '' THEN
    RAISE EXCEPTION 'A reason is required to start support access';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  INSERT INTO public.platform_support_sessions (actor_user_id, company_id, reason, expires_at)
  VALUES (auth.uid(), p_company_id, _reason, NOW() + INTERVAL '30 minutes')
  RETURNING id INTO _session_id;

  PERFORM public.log_platform_action(
    'support_session_start', p_company_id, NULL, NULL,
    jsonb_build_object('session_id', _session_id), _reason
  );

  RETURN _session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_start_support_session(UUID, TEXT) TO authenticated;

-- platform_get_support_session(session_id) — session metadata for the caller.
CREATE OR REPLACE FUNCTION public.platform_get_support_session(p_session_id UUID)
RETURNS TABLE (
  id            UUID,
  actor_user_id UUID,
  company_id    UUID,
  company_name  TEXT,
  reason        TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ,
  active        BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT s.id, s.actor_user_id, s.company_id, c.name, s.reason,
         s.expires_at, s.created_at, (s.expires_at > NOW())
  FROM public.platform_support_sessions s
  JOIN public.companies c ON c.id = s.company_id
  WHERE s.id = p_session_id
    AND (s.actor_user_id = auth.uid() OR public.is_platform_admin(ARRAY['owner']));
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_get_support_session(UUID) TO authenticated;

-- platform_list_my_support_sessions() — the caller's recent sessions.
CREATE OR REPLACE FUNCTION public.platform_list_my_support_sessions()
RETURNS TABLE (
  id           UUID,
  company_id   UUID,
  company_name TEXT,
  reason       TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ,
  active       BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT s.id, s.company_id, c.name, s.reason, s.expires_at, s.created_at,
         (s.expires_at > NOW())
  FROM public.platform_support_sessions s
  JOIN public.companies c ON c.id = s.company_id
  WHERE s.actor_user_id = auth.uid()
  ORDER BY s.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_my_support_sessions() TO authenticated;

-- platform_end_support_session(session_id) — expire a session immediately.
CREATE OR REPLACE FUNCTION public.platform_end_support_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor   UUID;
  _company UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT actor_user_id, company_id INTO _actor, _company
  FROM public.platform_support_sessions WHERE id = p_session_id;
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Support session not found';
  END IF;
  IF _actor <> auth.uid() AND NOT public.is_platform_admin(ARRAY['owner']) THEN
    RAISE EXCEPTION 'Not your support session' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.platform_support_sessions
  SET expires_at = NOW()
  WHERE id = p_session_id AND expires_at > NOW();

  PERFORM public.log_platform_action(
    'support_session_end', _company, NULL, NULL,
    jsonb_build_object('session_id', p_session_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_end_support_session(UUID) TO authenticated;

-- platform_support_list_records(session_id) — read-only record list for the
-- session's company (no document content). Requires an active session.
CREATE OR REPLACE FUNCTION public.platform_support_list_records(p_session_id UUID)
RETURNS TABLE (
  id          UUID,
  title       TEXT,
  record_type TEXT,
  county      TEXT,
  state       TEXT,
  is_shared   BOOLEAN,
  created_at  TIMESTAMPTZ,
  file_count  BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company UUID;
BEGIN
  _company := public.platform_support_session_company(p_session_id);

  RETURN QUERY
  SELECT r.id, r.title, r.record_type, r.county, r.state, r.is_shared, r.created_at,
         (SELECT count(*) FROM public.record_files f WHERE f.record_id = r.id)
  FROM public.company_records r
  WHERE r.company_id = _company
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_support_list_records(UUID) TO authenticated;

-- platform_support_get_record(session_id, record_id) — one record's fields.
-- Logs the specific record view (break-glass). Read-only.
CREATE OR REPLACE FUNCTION public.platform_support_get_record(p_session_id UUID, p_record_id UUID)
RETURNS TABLE (
  id          UUID,
  title       TEXT,
  description TEXT,
  record_type TEXT,
  county      TEXT,
  state       TEXT,
  is_shared   BOOLEAN,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company UUID;
BEGIN
  _company := public.platform_support_session_company(p_session_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.company_records r
    WHERE r.id = p_record_id AND r.company_id = _company
  ) THEN
    RAISE EXCEPTION 'Record not found in this company';
  END IF;

  PERFORM public.log_platform_action(
    'support_view_record', _company, NULL, p_record_id,
    jsonb_build_object('session_id', p_session_id)
  );

  RETURN QUERY
  SELECT r.id, r.title, r.description, r.record_type, r.county, r.state,
         r.is_shared, r.created_at, r.updated_at
  FROM public.company_records r
  WHERE r.id = p_record_id AND r.company_id = _company;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_support_get_record(UUID, UUID) TO authenticated;

-- platform_support_list_files(session_id, record_id) — file metadata only
-- (never content or storage path). Requires an active session.
CREATE OR REPLACE FUNCTION public.platform_support_list_files(p_session_id UUID, p_record_id UUID)
RETURNS TABLE (
  id         UUID,
  name       TEXT,
  size       BIGINT,
  mime_type  TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company UUID;
BEGIN
  _company := public.platform_support_session_company(p_session_id);

  RETURN QUERY
  SELECT f.id, f.name, f.size, f.mime_type, f.created_at
  FROM public.record_files f
  WHERE f.record_id = p_record_id AND f.company_id = _company
  ORDER BY f.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_support_list_files(UUID, UUID) TO authenticated;

-- platform_support_authorize_download(session_id, file_id) — validate a
-- break-glass file download, LOG it, and return the storage path so the
-- server (service role) can mint a short-lived signed URL. The path is never
-- exposed to the browser; only the resulting signed URL is.
CREATE OR REPLACE FUNCTION public.platform_support_authorize_download(p_session_id UUID, p_file_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company   UUID;
  _path      TEXT;
  _name      TEXT;
  _record_id UUID;
BEGIN
  _company := public.platform_support_session_company(p_session_id);

  SELECT f.path, f.name, f.record_id
    INTO _path, _name, _record_id
  FROM public.record_files f
  WHERE f.id = p_file_id AND f.company_id = _company;

  IF _path IS NULL THEN
    RAISE EXCEPTION 'File not found in this company';
  END IF;

  PERFORM public.log_platform_action(
    'support_download_file', _company, NULL, _record_id,
    jsonb_build_object('session_id', p_session_id, 'file_id', p_file_id, 'file_name', _name)
  );

  RETURN _path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_support_authorize_download(UUID, UUID) TO authenticated;
