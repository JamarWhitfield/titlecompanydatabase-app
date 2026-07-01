-- ============================================================
-- Migration: 0013_record_audit_trail_rpc.sql
-- Description: Per-record audit trail for the record detail page.
--
-- The audit_logs table itself is admin-only (0012) for the company-wide
-- audit page. The record detail page needs a narrower, record-scoped slice
-- that ANY member of the owning company can see, plus (read-only) visibility
-- for OTHER companies on SHARED records — while never leaking the history of
-- a PRIVATE record to another company.
--
-- A SECURITY DEFINER function is used so it can read audit_logs past the
-- admin-only table policy, but it enforces its own record-level permission
-- check before returning anything.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_record_audit_trail(p_record_id UUID)
RETURNS TABLE (
  id         UUID,
  action     TEXT,
  user_id    UUID,
  actor_name TEXT,
  created_at TIMESTAMPTZ,
  detail     TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_company UUID;
  _rec_company    UUID;
  _is_shared      BOOLEAN;
BEGIN
  -- Must be an authenticated user.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  _caller_company := public.get_my_company_id();

  SELECT r.company_id, r.is_shared
    INTO _rec_company, _is_shared
  FROM public.company_records r
  WHERE r.id = p_record_id;

  -- Unknown record → nothing.
  IF _rec_company IS NULL THEN
    RETURN;
  END IF;

  -- Permission: the owning company always; other companies ONLY when the
  -- record is shared. A private record's history never leaves its company.
  IF _caller_company IS DISTINCT FROM _rec_company
     AND COALESCE(_is_shared, FALSE) = FALSE THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      a.id,
      a.action,
      a.user_id,
      p.full_name AS actor_name,
      a.created_at,
      COALESCE(a.new_data->>'name', a.old_data->>'name') AS detail
    FROM public.audit_logs a
    LEFT JOIN public.profiles p ON p.id = a.user_id
    WHERE a.record_id = p_record_id
    ORDER BY a.created_at ASC;
END;
$$;

-- Authenticated users may call it; the function's own checks scope the result.
REVOKE ALL ON FUNCTION public.get_record_audit_trail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_record_audit_trail(UUID) TO authenticated;
