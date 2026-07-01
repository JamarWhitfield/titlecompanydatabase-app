-- ============================================================
-- Migration: 0014_record_notes.sql
-- Description: Internal collaboration notes on company records.
--
-- PERMISSION MODEL — "company-private notes":
--   * A note always belongs to the AUTHOR's company (company_id).
--   * A note is visible ONLY to members of that company. No company ever
--     sees another company's notes, so nothing leaks across tenants.
--   * You may add a note to any record you can VIEW: your own company's
--     records, OR a record another company has shared to the network. The
--     note is stored under YOUR company and stays private to your company.
--     -> No cross-company write access; the shared record itself is never
--        modified, only annotated privately.
--   * You can edit/delete your OWN notes; company admins can manage any of
--     their OWN company's notes.
-- ============================================================

CREATE TABLE public.record_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id  UUID NOT NULL REFERENCES public.company_records(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id),
  note_text  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_record_notes_record ON public.record_notes (record_id, created_at);

-- Keep updated_at fresh (reuses the set_updated_at() function from 0001).
CREATE TRIGGER trg_record_notes_updated_at
  BEFORE UPDATE ON public.record_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.record_notes ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- SELECT: a note is visible only to its own company.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "record_notes: read own company"
  ON public.record_notes FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- ────────────────────────────────────────────────────────────
-- INSERT: the note must belong to the caller (own company + own user_id),
-- AND the caller must be allowed to view the parent record (own record OR a
-- shared record). This is what permits annotating a shared record while
-- keeping the note private to the annotator's company.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "record_notes: insert on viewable records"
  ON public.record_notes FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.company_records r
      WHERE r.id = record_notes.record_id
        AND (
          r.company_id = public.get_my_company_id()
          OR r.is_shared = TRUE
        )
    )
  );

-- ────────────────────────────────────────────────────────────
-- UPDATE: own note, or a company admin managing their company's note.
-- WITH CHECK prevents reassigning the note to another company.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "record_notes: update own or admin"
  ON public.record_notes FOR UPDATE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND (user_id = auth.uid() OR public.get_my_role() = 'admin')
  )
  WITH CHECK (company_id = public.get_my_company_id());

-- ────────────────────────────────────────────────────────────
-- DELETE: own note, or a company admin managing their company's note.
-- ────────────────────────────────────────────────────────────
CREATE POLICY "record_notes: delete own or admin"
  ON public.record_notes FOR DELETE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND (user_id = auth.uid() OR public.get_my_role() = 'admin')
  );
