-- ============================================================
-- Migration: 0030_feedback_platform_detail.sql
-- Description: Read RPCs powering the platform-admin feedback DETAIL page at
--              /dashboard/platform/bugs/[id] — the single report, its status
--              history, and its internal notes, each with the actor's
--              name/email resolved.
--
--   Same rationale as 0029: platform admins are not members of the reporting
--   company, so they cannot join across tenant tables under RLS. Every
--   function is SECURITY DEFINER and gated by is_platform_admin() (0023).
--   None of these expose the screenshot STORAGE PATH — the detail page mints a
--   signed URL separately via the service role (app/actions/feedback.ts).
--
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

-- platform_get_feedback(id) — one report with company + reporter resolved.
CREATE OR REPLACE FUNCTION public.platform_get_feedback(p_id UUID)
RETURNS TABLE (
  id                           UUID,
  company_id                   UUID,
  company_name                 TEXT,
  reporter_id                  UUID,
  reporter_name                TEXT,
  reporter_email               TEXT,
  feedback_type                TEXT,
  category                     TEXT,
  severity                     TEXT,
  status                       TEXT,
  title                        TEXT,
  description                  TEXT,
  expected_behavior            TEXT,
  page_url                     TEXT,
  pathname                     TEXT,
  related_resource_url         TEXT,
  related_record_id            UUID,
  related_file_id              UUID,
  browser_user_agent           TEXT,
  browser_language             TEXT,
  browser_platform             TEXT,
  screen_width                 INTEGER,
  screen_height                INTEGER,
  viewport_width               INTEGER,
  viewport_height              INTEGER,
  has_screenshot               BOOLEAN,
  screenshot_original_filename TEXT,
  screenshot_mime_type         TEXT,
  screenshot_size_bytes        BIGINT,
  resolved_at                  TIMESTAMPTZ,
  resolved_by                  UUID,
  resolved_by_name             TEXT,
  created_at                   TIMESTAMPTZ,
  updated_at                   TIMESTAMPTZ
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
    rp.full_name,
    ru.email::TEXT,
    fr.feedback_type,
    fr.category,
    fr.severity,
    fr.status,
    fr.title,
    fr.description,
    fr.expected_behavior,
    fr.page_url,
    fr.pathname,
    fr.related_resource_url,
    fr.related_record_id,
    fr.related_file_id,
    fr.browser_user_agent,
    fr.browser_language,
    fr.browser_platform,
    fr.screen_width,
    fr.screen_height,
    fr.viewport_width,
    fr.viewport_height,
    (fr.screenshot_storage_path IS NOT NULL),
    fr.screenshot_original_filename,
    fr.screenshot_mime_type,
    fr.screenshot_size_bytes,
    fr.resolved_at,
    fr.resolved_by,
    sp.full_name,
    fr.created_at,
    fr.updated_at
  FROM public.feedback_reports fr
  LEFT JOIN public.companies c  ON c.id = fr.company_id
  LEFT JOIN public.profiles  rp ON rp.id = fr.reporter_id
  LEFT JOIN auth.users       ru ON ru.id = fr.reporter_id
  LEFT JOIN public.profiles  sp ON sp.id = fr.resolved_by
  WHERE fr.id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_get_feedback(UUID) TO authenticated;

-- platform_list_feedback_history(id) — status transitions, oldest first.
CREATE OR REPLACE FUNCTION public.platform_list_feedback_history(p_id UUID)
RETURNS TABLE (
  id                 UUID,
  old_status         TEXT,
  new_status         TEXT,
  note               TEXT,
  changed_by         UUID,
  changed_by_name    TEXT,
  changed_by_email   TEXT,
  created_at         TIMESTAMPTZ
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
    h.id, h.old_status, h.new_status, h.note,
    h.changed_by, p.full_name, u.email::TEXT, h.created_at
  FROM public.feedback_status_history h
  LEFT JOIN public.profiles p ON p.id = h.changed_by
  LEFT JOIN auth.users      u ON u.id = h.changed_by
  WHERE h.feedback_report_id = p_id
  ORDER BY h.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_feedback_history(UUID) TO authenticated;

-- platform_list_feedback_notes(id) — internal notes, newest first.
CREATE OR REPLACE FUNCTION public.platform_list_feedback_notes(p_id UUID)
RETURNS TABLE (
  id            UUID,
  note          TEXT,
  author_id     UUID,
  author_name   TEXT,
  author_email  TEXT,
  created_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
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
    n.id, n.note, n.author_id, p.full_name, u.email::TEXT,
    n.created_at, n.updated_at
  FROM public.feedback_internal_notes n
  LEFT JOIN public.profiles p ON p.id = n.author_id
  LEFT JOIN auth.users      u ON u.id = n.author_id
  WHERE n.feedback_report_id = p_id
  ORDER BY n.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_feedback_notes(UUID) TO authenticated;
