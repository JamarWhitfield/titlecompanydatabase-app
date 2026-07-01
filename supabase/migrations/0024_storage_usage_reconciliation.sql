-- ============================================================
-- Migration: 0024_storage_usage_reconciliation.sql
-- Description: Company storage usage + owner-only storage drift check.
--
-- ── BILLING ACCURACY / STORAGE RECONCILIATION ──────────────────────
--
-- Company storage usage is calculated from `record_files.size` (database
-- metadata), NOT by inspecting the Supabase Storage bucket directly. This is
-- deliberate:
--
--   * Usage = SUM(record_files.size) for the company. This is Casetra's
--     BILLABLE, application-level storage — the bytes the app knowingly wrote
--     on the company's behalf, one row per attachment.
--
--   * Supabase PROJECT-level storage may differ slightly. The Supabase number
--     includes every object in every bucket plus internal/project-level
--     overhead (thumbnails, other buckets, placeholder folder markers), so it
--     is not a like-for-like figure and should not be used for billing.
--
--   * If a file exists in Supabase Storage but has NO `record_files` row, it is
--     NOT counted toward company usage. Application-level billing only bills
--     for what the application tracks.
--
--   * If a `record_files` row exists but the underlying storage object was
--     deleted manually outside the app, the row still counts toward usage
--     until it is cleaned up. Metadata is the source of truth for billing.
--
-- These two functions let an owner MONITOR both realities without ever
-- reconciling destructively:
--   1. get_company_storage_usage()   — the billable number (metadata only).
--   2. check_company_storage_drift()  — a read-only report of mismatches
--                                        between metadata and storage objects.
--
-- Neither function deletes anything. Automatic billing, overage charges, plan
-- enforcement, and cleanup are intentionally out of scope.
--
-- Idempotent: CREATE OR REPLACE throughout, safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. get_company_storage_usage()
--    Billable, application-level storage for the caller's company, computed
--    entirely from `record_files.size` (database metadata). No bucket calls.
--    SECURITY DEFINER + company scoping means a caller only ever sees their
--    own company's total; RLS on record_files is the database-level backstop.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_company_storage_usage()
RETURNS TABLE (
  total_bytes BIGINT,
  file_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(rf.size), 0)::BIGINT AS total_bytes,
    COUNT(*)::BIGINT                  AS file_count
  FROM public.record_files rf
  WHERE rf.company_id = public.get_my_company_id();
$$;

GRANT EXECUTE ON FUNCTION public.get_company_storage_usage() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. check_company_storage_drift()
--    OWNER-ONLY (company admin) read-only reconciliation report. Compares the
--    `record_files` metadata against the actual objects in the `record-files`
--    bucket for THIS company only, and returns the mismatches:
--
--      issue_type = 'missing_object'  → a record_files row whose storage
--                                        object is gone (still billed until
--                                        cleaned up).
--      issue_type = 'orphaned_object' → a storage object under the company's
--                                        prefix with no record_files row (not
--                                        billed; safe to review/clean later).
--
--    This function REPORTS ONLY. It never deletes a row or an object. Any
--    cleanup must be an explicit, separate, human-initiated action.
--
--    Storage layout in the bucket is {company_id}/{record_id}/{file}, so a
--    company's objects are exactly those whose name starts with its id. The
--    Supabase-managed ".emptyFolderPlaceholder" markers are ignored as noise.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_company_storage_drift()
RETURNS TABLE (
  issue_type  TEXT,
  object_path TEXT,
  file_id     UUID,
  record_id   UUID,
  file_name   TEXT,
  size_bytes  BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company UUID;
BEGIN
  _company := public.get_my_company_id();

  -- Owner-only: mirror the UI guard in the database so a forged API call
  -- cannot run the reconciliation against another company or without admin.
  IF _company IS NULL OR public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only company admins can run storage reconciliation.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- (a) record_files rows whose storage object is missing.
  RETURN QUERY
  SELECT
    'missing_object'::TEXT,
    rf.path,
    rf.id,
    rf.record_id,
    rf.name,
    rf.size
  FROM public.record_files rf
  LEFT JOIN storage.objects o
    ON o.bucket_id = 'record-files'
   AND o.name = rf.path
  WHERE rf.company_id = _company
    AND o.id IS NULL;

  -- (b) storage objects under this company's prefix with no metadata row.
  RETURN QUERY
  SELECT
    'orphaned_object'::TEXT,
    o.name,
    NULL::UUID,
    NULL::UUID,
    o.name,
    COALESCE((o.metadata ->> 'size')::BIGINT, 0)
  FROM storage.objects o
  LEFT JOIN public.record_files rf
    ON rf.path = o.name
   AND rf.company_id = _company
  WHERE o.bucket_id = 'record-files'
    AND o.name LIKE _company::TEXT || '/%'
    AND o.name NOT LIKE '%/.emptyFolderPlaceholder'
    AND rf.id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_company_storage_drift() TO authenticated;
