-- ============================================================
-- Migration: 0029_feedback_platform_console.sql
-- Description: Read RPC powering the platform-admin Feedback dashboard at
--              /dashboard/platform/bugs.
--
--   Platform admins are NOT members of the reporting companies, so they cannot
--   join feedback_reports to companies / profiles / auth.users under normal
--   tenant RLS. This SECURITY DEFINER function resolves the company name and
--   reporter name/email in one call, gated by is_platform_admin() (0023) — the
--   same narrow, audited-console pattern used by platform_list_companies etc.
--
--   It deliberately returns NO screenshot storage paths and NO internal notes,
--   so the list surface can never leak those.
--
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.platform_list_feedback()
RETURNS TABLE (
  id             UUID,
  company_id     UUID,
  company_name   TEXT,
  reporter_id    UUID,
  reporter_name  TEXT,
  reporter_email TEXT,
  feedback_type  TEXT,
  category       TEXT,
  severity       TEXT,
  status         TEXT,
  title          TEXT,
  page_url       TEXT,
  pathname       TEXT,
  has_screenshot BOOLEAN,
  created_at     TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ
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
    fr.id,
    fr.company_id,
    c.name,
    fr.reporter_id,
    p.full_name,
    u.email::TEXT,
    fr.feedback_type,
    fr.category,
    fr.severity,
    fr.status,
    fr.title,
    fr.page_url,
    fr.pathname,
    (fr.screenshot_storage_path IS NOT NULL),
    fr.created_at,
    fr.updated_at
  FROM public.feedback_reports fr
  LEFT JOIN public.companies c ON c.id = fr.company_id
  LEFT JOIN public.profiles  p ON p.id = fr.reporter_id
  LEFT JOIN auth.users       u ON u.id = fr.reporter_id
  ORDER BY fr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_feedback() TO authenticated;
