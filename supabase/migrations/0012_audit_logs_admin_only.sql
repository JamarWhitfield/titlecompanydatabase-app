-- ============================================================
-- Migration: 0012_audit_logs_admin_only.sql
-- Description: Restrict audit-log visibility to COMPANY ADMINS of the
--              owning company. Members can no longer read audit logs,
--              and no company can ever read another company's logs.
--
-- This enforces the /dashboard/audit access rule at the database level
-- (not just in the UI): even a direct Supabase call from the browser
-- console returns nothing unless the caller is an admin of that company.
--
-- Idempotent: safe to run on a database that already has the original
-- "audit_logs: read own company" policy from 0001.
-- ============================================================

-- Helper: the caller's role, resolved safely inside RLS policies.
-- SECURITY DEFINER + fixed search_path avoids recursing through the
-- profiles RLS policies (mirrors get_my_company_id() from 0003).
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Replace the member-readable policy with an admin-only one.
DROP POLICY IF EXISTS "audit_logs: read own company" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs: read own company admins" ON public.audit_logs;

CREATE POLICY "audit_logs: read own company admins"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- audit_logs remains write-only via the SECURITY DEFINER trigger
-- functions; there is intentionally no INSERT/UPDATE/DELETE policy.
