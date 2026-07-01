-- ============================================================
-- Migration: 0011_security_hardening_rls.sql
-- Description: SECURITY HARDENING — re-assert tenant isolation on
--              company_records and record_files at the database level.
--
-- Root cause of the reported leak was an UNSCOPED "My Records" query
-- (fixed in the app). This migration makes the database the enforced
-- backstop so private records can NEVER cross companies, even if a
-- client calls Supabase directly from the browser console.
--
-- Every statement here is idempotent (DROP ... IF EXISTS before CREATE)
-- so it is safe to run on a database that already has the 0001/0003/0006
-- policies. The resulting policies are identical in intent to those
-- migrations — this file simply guarantees the live database matches.
-- ============================================================

-- 0. RLS must be ON (denies everything until a policy allows it).
ALTER TABLE public.company_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_files    ENABLE ROW LEVEL SECURITY;

-- Force RLS so even the table owner is subject to policies.
ALTER TABLE public.company_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.record_files    FORCE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- company_records — visibility = own company OR explicitly shared;
--                   writes = own company only.
-- ────────────────────────────────────────────────────────────

-- SELECT (own company)
DROP POLICY IF EXISTS "records: read own company records" ON public.company_records;
CREATE POLICY "records: read own company records"
  ON public.company_records FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- SELECT (shared to the network — read-only for other companies)
DROP POLICY IF EXISTS "records: read shared records from other companies" ON public.company_records;
CREATE POLICY "records: read shared records from other companies"
  ON public.company_records FOR SELECT TO authenticated
  USING (is_shared = TRUE);

-- INSERT (own company only)
DROP POLICY IF EXISTS "records: insert own company" ON public.company_records;
CREATE POLICY "records: insert own company"
  ON public.company_records FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

-- UPDATE (own company only — covers share / unshare / edit)
DROP POLICY IF EXISTS "records: update own company" ON public.company_records;
CREATE POLICY "records: update own company"
  ON public.company_records FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- DELETE (own company only)
DROP POLICY IF EXISTS "records: delete own company" ON public.company_records;
CREATE POLICY "records: delete own company"
  ON public.company_records FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ────────────────────────────────────────────────────────────
-- record_files — attachment visibility follows the parent record:
--   read  = own company OR parent record is shared
--   write = own company only
-- ────────────────────────────────────────────────────────────

-- SELECT (own company files)
DROP POLICY IF EXISTS "record_files: read own company" ON public.record_files;
CREATE POLICY "record_files: read own company"
  ON public.record_files FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- SELECT (files belonging to a shared record)
DROP POLICY IF EXISTS "record_files: read shared records" ON public.record_files;
CREATE POLICY "record_files: read shared records"
  ON public.record_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_records r
      WHERE r.id = record_files.record_id
        AND r.is_shared = TRUE
    )
  );

-- INSERT (own company only)
DROP POLICY IF EXISTS "record_files: insert own company" ON public.record_files;
CREATE POLICY "record_files: insert own company"
  ON public.record_files FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

-- DELETE (own company only)
DROP POLICY IF EXISTS "record_files: delete own company" ON public.record_files;
CREATE POLICY "record_files: delete own company"
  ON public.record_files FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ────────────────────────────────────────────────────────────
-- shared_records_network view — defense in depth.
-- Run the view with the INVOKER's privileges so the underlying
-- company_records RLS is applied to the querying user as well. The
-- view already filters is_shared = TRUE, so it can only ever expose
-- shared records — this just removes any reliance on the view owner.
-- (Requires PostgreSQL 15+, which Supabase uses.)
-- ────────────────────────────────────────────────────────────
ALTER VIEW public.shared_records_network SET (security_invoker = true);
