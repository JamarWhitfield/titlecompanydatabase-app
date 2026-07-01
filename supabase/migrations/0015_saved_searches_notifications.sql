-- ============================================================
-- Migration: 0015_saved_searches_notifications.sql
-- Description: Saved searches over the Shared Network + in-app
--              notifications when a newly shared record matches a
--              saved search from ANOTHER company.
--
-- MATCHING MODEL (MVP, intentionally simple):
--   * A company saves a search term (query_text) from the Shared Network.
--   * When a record becomes shared (is_shared false -> true, or it is
--     inserted already shared), a SECURITY DEFINER trigger checks the
--     record's full-text vector against every OTHER company's saved
--     searches using the SAME websearch_to_tsquery() used by the network
--     search UI.
--   * Each matching saved search produces one in-app notification for the
--     owning company of that saved search.
--
-- PERMISSION MODEL:
--   * Private records never run the matcher (the trigger only fires when
--     a record is shared), so private data never reaches another company.
--   * The matcher never notifies the company that OWNS the record.
--   * RLS scopes saved_searches and notifications to the owning company,
--     so companies only ever see their own. The cross-company read of
--     saved_searches happens ONLY inside the trusted SECURITY DEFINER
--     function, never via a user-facing query.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- saved_searches
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  query_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_company
  ON public.saved_searches (company_id);

-- ────────────────────────────────────────────────────────────
-- notifications
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  saved_search_id UUID REFERENCES public.saved_searches(id) ON DELETE SET NULL,
  record_id       UUID REFERENCES public.company_records(id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimised for "unread first, newest first" within a company.
CREATE INDEX IF NOT EXISTS idx_notifications_company
  ON public.notifications (company_id, read_at, created_at DESC);

-- ============================================================
-- MATCHER — fires when a record is shared to the network.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_saved_searches()
RETURNS TRIGGER AS $$
DECLARE
  _became_shared BOOLEAN;
BEGIN
  -- Only act when the record is (now) shared AND it just transitioned into
  -- the shared state. INSERT-already-shared also counts.
  IF TG_OP = 'INSERT' THEN
    _became_shared := NEW.is_shared;
  ELSE
    _became_shared := NEW.is_shared = TRUE AND OLD.is_shared = FALSE;
  END IF;

  IF NOT _became_shared THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications
    (company_id, user_id, saved_search_id, record_id, message)
  SELECT
    ss.company_id,
    ss.user_id,
    ss.id,
    NEW.id,
    'New shared record matches your saved search "' || ss.name || '": ' || NEW.title
  FROM public.saved_searches ss
  WHERE
    -- Never notify the company that owns the record.
    ss.company_id <> NEW.company_id
    -- Match using the same full-text query the network search UI uses.
    AND NEW.fts @@ websearch_to_tsquery('english', ss.query_text)
    -- Idempotent: don't double-notify the same saved search for the same
    -- record (e.g. if it is unshared then re-shared).
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.saved_search_id = ss.id
        AND n.record_id = NEW.id
    );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_saved_searches
  AFTER INSERT OR UPDATE OF is_shared ON public.company_records
  FOR EACH ROW EXECUTE FUNCTION public.notify_saved_searches();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- saved_searches: a company only sees/manages its own.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "saved_searches: read own company"
  ON public.saved_searches FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "saved_searches: insert own"
  ON public.saved_searches FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "saved_searches: delete own or admin"
  ON public.saved_searches FOR DELETE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND (user_id = auth.uid() OR public.get_my_role() = 'admin')
  );

-- ────────────────────────────────────────────────────────────
-- notifications: a company only sees/manages its own. Rows are created
-- exclusively by the SECURITY DEFINER matcher (no INSERT policy → users
-- cannot fabricate notifications). Users may mark their company's
-- notifications as read.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "notifications: read own company"
  ON public.notifications FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "notifications: update own company"
  ON public.notifications FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "notifications: delete own company"
  ON public.notifications FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());
