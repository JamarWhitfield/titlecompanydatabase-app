-- ============================================================
-- Migration: 0028_feedback_reports.sql
-- Description: In-app "Send Feedback" system — lets authenticated company
--              users submit bug reports, feature requests, confusing-UX
--              reports, data/import issues, and general feedback from inside
--              the dashboard, and lets PLATFORM ADMINS triage and manage every
--              report across all companies.
--
-- THREE TABLES
--   * feedback_reports        — one row per submitted report (with optional
--                               screenshot + browser/context metadata).
--   * feedback_status_history — append-only trail of every status change.
--   * feedback_internal_notes — platform-admin-only private notes.
--
-- SECURITY MODEL (preserves Casetra's existing tenant isolation)
--   * A report always belongs to the SUBMITTER's company. A normal user may
--     only insert reports for their OWN company and may only read reports they
--     personally submitted. They can NEVER update status, delete reports, read
--     another company's reports, or read internal notes.
--   * Cross-tenant visibility + all management flows through the EXISTING
--     platform-admin system (public.is_platform_admin()). No broad
--     `USING (true)` policy is added to any table, and no existing RLS is
--     weakened.
--   * Company scoping reuses public.get_my_company_id() (0003). Platform
--     authorization reuses public.is_platform_admin() (0023).
--   * The initial "open" status-history row is written by a SECURITY DEFINER
--     trigger, so normal users never insert status history directly.
--   * Screenshots live in a PRIVATE storage bucket; there is no public read
--     path. Platform admins view them only via short-lived signed URLs minted
--     server-side with the service-role client.
--
-- Idempotent where practical (IF NOT EXISTS / DROP POLICY IF EXISTS / ON
-- CONFLICT DO NOTHING) so any environment converges to the same state.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- TABLE 1: feedback_reports
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,

  feedback_type TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  severity      TEXT NOT NULL DEFAULT 'low',
  status        TEXT NOT NULL DEFAULT 'open',

  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  expected_behavior TEXT,

  -- Context the client captured about where the feedback was filed. The
  -- related_* references use ON DELETE SET NULL so a report survives the
  -- deletion of the record/file it pointed at.
  page_url             TEXT,
  pathname             TEXT,
  related_resource_url TEXT,
  related_record_id    UUID REFERENCES public.company_records(id) ON DELETE SET NULL,
  related_file_id      UUID REFERENCES public.record_files(id)    ON DELETE SET NULL,

  browser_user_agent TEXT,
  browser_language   TEXT,
  browser_platform   TEXT,
  screen_width       INTEGER,
  screen_height      INTEGER,
  viewport_width     INTEGER,
  viewport_height    INTEGER,

  -- Optional screenshot metadata. The object itself lives in the private
  -- 'feedback-screenshots' bucket at {company_id}/{feedback_report_id}/{file}.
  screenshot_storage_path       TEXT,
  screenshot_original_filename  TEXT,
  screenshot_mime_type          TEXT,
  screenshot_size_bytes         BIGINT,

  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Controlled-value check constraints ──────────────────────────
  CONSTRAINT feedback_reports_feedback_type_check CHECK (
    feedback_type IN (
      'bug', 'feature_request', 'confusing_ux', 'data_import_issue', 'other'
    )
  ),
  CONSTRAINT feedback_reports_category_check CHECK (
    category IN (
      'general', 'search_issue', 'upload_issue', 'permission_issue',
      'file_download_issue', 'record_issue', 'network_sharing_issue',
      'data_import_issue', 'feature_request', 'confusing_ui', 'other'
    )
  ),
  CONSTRAINT feedback_reports_severity_check CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT feedback_reports_status_check CHECK (
    status IN (
      'open', 'in_review', 'in_progress', 'fixed', 'closed',
      'wont_fix', 'need_more_info'
    )
  )
);

CREATE INDEX IF NOT EXISTS feedback_reports_company_id_idx
  ON public.feedback_reports (company_id);
CREATE INDEX IF NOT EXISTS feedback_reports_reporter_id_idx
  ON public.feedback_reports (reporter_id);
CREATE INDEX IF NOT EXISTS feedback_reports_status_idx
  ON public.feedback_reports (status);
CREATE INDEX IF NOT EXISTS feedback_reports_severity_idx
  ON public.feedback_reports (severity);
CREATE INDEX IF NOT EXISTS feedback_reports_feedback_type_idx
  ON public.feedback_reports (feedback_type);
CREATE INDEX IF NOT EXISTS feedback_reports_category_idx
  ON public.feedback_reports (category);
CREATE INDEX IF NOT EXISTS feedback_reports_created_at_idx
  ON public.feedback_reports (created_at DESC);

-- ════════════════════════════════════════════════════════════
-- TABLE 2: feedback_status_history
-- Append-only: one row per status transition. old_status is NULL for the
-- initial creation row (written by the trigger below).
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.feedback_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  feedback_report_id UUID NOT NULL
    REFERENCES public.feedback_reports(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  old_status TEXT,
  new_status TEXT NOT NULL,
  note       TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT feedback_status_history_old_status_check CHECK (
    old_status IS NULL OR old_status IN (
      'open', 'in_review', 'in_progress', 'fixed', 'closed',
      'wont_fix', 'need_more_info'
    )
  ),
  CONSTRAINT feedback_status_history_new_status_check CHECK (
    new_status IN (
      'open', 'in_review', 'in_progress', 'fixed', 'closed',
      'wont_fix', 'need_more_info'
    )
  )
);

CREATE INDEX IF NOT EXISTS feedback_status_history_report_id_idx
  ON public.feedback_status_history (feedback_report_id);
CREATE INDEX IF NOT EXISTS feedback_status_history_created_at_idx
  ON public.feedback_status_history (created_at DESC);

-- ════════════════════════════════════════════════════════════
-- TABLE 3: feedback_internal_notes  (platform-admin only)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.feedback_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  feedback_report_id UUID NOT NULL
    REFERENCES public.feedback_reports(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  note TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_internal_notes_report_id_idx
  ON public.feedback_internal_notes (feedback_report_id);
CREATE INDEX IF NOT EXISTS feedback_internal_notes_created_at_idx
  ON public.feedback_internal_notes (created_at DESC);

-- ════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Keep updated_at fresh (reuses public.set_updated_at() from 0001).
DROP TRIGGER IF EXISTS trg_feedback_reports_updated_at ON public.feedback_reports;
CREATE TRIGGER trg_feedback_reports_updated_at
  BEFORE UPDATE ON public.feedback_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_feedback_internal_notes_updated_at ON public.feedback_internal_notes;
CREATE TRIGGER trg_feedback_internal_notes_updated_at
  BEFORE UPDATE ON public.feedback_internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Log the initial status as the first status-history row. Runs as a
-- SECURITY DEFINER trigger so the write succeeds even though normal users are
-- NOT allowed to insert status history directly (see RLS below).
CREATE OR REPLACE FUNCTION public.feedback_log_initial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.feedback_status_history (
    feedback_report_id, changed_by, old_status, new_status, note
  ) VALUES (
    NEW.id, NEW.reporter_id, NULL, NEW.status, 'Report submitted'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_reports_initial_status ON public.feedback_reports;
CREATE TRIGGER trg_feedback_reports_initial_status
  AFTER INSERT ON public.feedback_reports
  FOR EACH ROW EXECUTE FUNCTION public.feedback_log_initial_status();

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- All three tables: RLS ENABLED + FORCED (so even the table owner is subject
-- to policies). Every SECURITY DEFINER function above is owned by the
-- migration superuser and bypasses RLS as intended.
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.feedback_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_reports        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.feedback_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_status_history FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.feedback_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_internal_notes FORCE  ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- feedback_reports policies
-- ────────────────────────────────────────────────────────────

-- INSERT: a user may only file a report for their OWN company and must stamp
-- themselves as the reporter. This blocks company-id spoofing at the DB layer.
DROP POLICY IF EXISTS "feedback_reports: insert own company" ON public.feedback_reports;
CREATE POLICY "feedback_reports: insert own company"
  ON public.feedback_reports FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND reporter_id = auth.uid()
  );

-- SELECT: the reporter sees only their own reports; platform admins see all.
DROP POLICY IF EXISTS "feedback_reports: read own or platform" ON public.feedback_reports;
CREATE POLICY "feedback_reports: read own or platform"
  ON public.feedback_reports FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.is_platform_admin()
  );

-- UPDATE: platform admins only (status triage, resolution, etc.). Normal
-- users have no UPDATE policy, so their updates match 0 rows and are rejected.
DROP POLICY IF EXISTS "feedback_reports: update platform only" ON public.feedback_reports;
CREATE POLICY "feedback_reports: update platform only"
  ON public.feedback_reports FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- (No DELETE policy: reports are never deletable through the API.)

-- ────────────────────────────────────────────────────────────
-- feedback_status_history policies
-- ────────────────────────────────────────────────────────────

-- SELECT: platform admins see everything; a reporter may read the history of
-- reports they submitted (so they can see status progress on their own items).
DROP POLICY IF EXISTS "feedback_status_history: read own or platform" ON public.feedback_status_history;
CREATE POLICY "feedback_status_history: read own or platform"
  ON public.feedback_status_history FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.feedback_reports fr
      WHERE fr.id = feedback_status_history.feedback_report_id
        AND fr.reporter_id = auth.uid()
    )
  );

-- INSERT: platform admins only, and only stamping themselves as changed_by.
-- (The initial 'open' row is written by the SECURITY DEFINER trigger, not by
-- a normal user.)
DROP POLICY IF EXISTS "feedback_status_history: insert platform only" ON public.feedback_status_history;
CREATE POLICY "feedback_status_history: insert platform only"
  ON public.feedback_status_history FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    AND changed_by = auth.uid()
  );

-- (No UPDATE/DELETE: history is append-only.)

-- ────────────────────────────────────────────────────────────
-- feedback_internal_notes policies  (platform-admin only, all operations)
-- ────────────────────────────────────────────────────────────

-- SELECT: platform admins only. Normal users can NEVER read internal notes.
DROP POLICY IF EXISTS "feedback_internal_notes: read platform only" ON public.feedback_internal_notes;
CREATE POLICY "feedback_internal_notes: read platform only"
  ON public.feedback_internal_notes FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- INSERT: platform admins only, stamping themselves as the author.
DROP POLICY IF EXISTS "feedback_internal_notes: insert platform only" ON public.feedback_internal_notes;
CREATE POLICY "feedback_internal_notes: insert platform only"
  ON public.feedback_internal_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    AND author_id = auth.uid()
  );

-- UPDATE: a platform admin may edit their OWN note.
DROP POLICY IF EXISTS "feedback_internal_notes: update own platform" ON public.feedback_internal_notes;
CREATE POLICY "feedback_internal_notes: update own platform"
  ON public.feedback_internal_notes FOR UPDATE TO authenticated
  USING (public.is_platform_admin() AND author_id = auth.uid())
  WITH CHECK (public.is_platform_admin() AND author_id = auth.uid());

-- (No DELETE policy.)

-- ════════════════════════════════════════════════════════════
-- STORAGE: private 'feedback-screenshots' bucket
-- Objects live at {company_id}/{feedback_report_id}/{filename}, so the first
-- path segment is always the owning company's id.
-- ════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', FALSE)
ON CONFLICT (id) DO NOTHING;

-- INSERT: a user may upload a screenshot only into their OWN company's folder.
DROP POLICY IF EXISTS "feedback screenshots: insert own company" ON storage.objects;
CREATE POLICY "feedback screenshots: insert own company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- No SELECT / UPDATE / DELETE policies for the authenticated role: screenshots
-- are never client-readable. Platform admins retrieve them exclusively through
-- short-lived signed URLs minted server-side with the service-role client
-- (which bypasses RLS), mirroring the break-glass download flow in
-- app/actions/platform.ts. The bucket is private, so no public URL exists.
