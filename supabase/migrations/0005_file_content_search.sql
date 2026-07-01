-- ============================================================
-- Migration: 0005_file_content_search.sql
-- Description: Full-text search across record metadata AND the text
--              contents of attached files (extracted PDF text / OCR output).
-- ============================================================

-- 1. Store the extracted text of each uploaded file.
--    Populated by the upload action (PDF text extraction + OCR for scans).
ALTER TABLE public.record_files
  ADD COLUMN IF NOT EXISTS content_text TEXT;

-- 2. Auto-maintained search vector over the file's extracted text.
ALTER TABLE public.record_files
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_record_files_fts
  ON public.record_files USING GIN (fts);

-- 3. Auto-maintained search vector over the record's own fields.
ALTER TABLE public.company_records
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(county, '') || ' ' ||
      coalesce(state, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_company_records_fts
  ON public.company_records USING GIN (fts);

-- 4. RPC: search the caller's own records by metadata OR attached file text.
--    Runs as SECURITY INVOKER (default) so RLS still scopes access; the
--    explicit company_id check keeps results limited to the user's own
--    records (the shared-network view is searched separately on its page).
--    Returns the exact company_records column shape (excludes the fts column).
CREATE OR REPLACE FUNCTION public.search_company_records(search_query TEXT)
RETURNS TABLE (
  id          UUID,
  company_id  UUID,
  created_by  UUID,
  title       TEXT,
  description TEXT,
  record_type TEXT,
  data        JSONB,
  county      TEXT,
  state       TEXT,
  is_shared   BOOLEAN,
  shared_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.id, r.company_id, r.created_by, r.title, r.description,
    r.record_type, r.data, r.county, r.state, r.is_shared,
    r.shared_at, r.created_at, r.updated_at
  FROM public.company_records r
  WHERE r.company_id = public.get_my_company_id()
    AND (
      btrim(coalesce(search_query, '')) = ''
      OR r.fts @@ websearch_to_tsquery('english', search_query)
      OR EXISTS (
        SELECT 1
        FROM public.record_files f
        WHERE f.record_id = r.id
          AND f.fts @@ websearch_to_tsquery('english', search_query)
      )
    )
  ORDER BY r.created_at DESC;
$$;
