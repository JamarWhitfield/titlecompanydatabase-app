-- ============================================================
-- Migration: 0018_search_ranking_metadata.sql
-- Description: Upgrade own-company full-text search to return relevance
--              ranking and "why did this match?" metadata, so the UI can
--              explain matches (à la Google Drive / Notion) — including
--              matches found INSIDE an uploaded document.
--
-- BACKGROUND
--   * Full-text search already exists (0005): company_records.fts and
--     record_files.fts are STORED generated tsvectors, each backed by a GIN
--     index (idx_company_records_fts, idx_record_files_fts). Those indexes
--     remain the primary access path here — the added ranking/metadata is
--     computed only over the already-filtered candidate rows.
--   * content_text (0005) is populated on upload for PDF / DOCX / TXT (and
--     OCR for images). has_text (0009) reflects whether extraction produced
--     text.
--
-- WHAT CHANGES
--   search_company_records() now also returns:
--     - match_source      : 'title' | 'description' | 'location' | 'document'
--     - matched_file_name : the attached file that matched (document matches)
--     - relevance_rank    : REAL, higher = better; title > description >
--                           location > document
--
-- SECURITY
--   Unchanged. SECURITY INVOKER (default) so RLS still applies, plus the
--   explicit company_id = get_my_company_id() scope. Company A can never see
--   Company B's private records or their file text through this function.
--
-- COMPAT
--   The original 13 record columns are returned first and unchanged, so
--   existing callers/filters (record_type, is_shared, state) keep working;
--   the 3 new columns are appended.
-- ============================================================

-- The GIN indexes from 0005 already exist; (re)assert them so this migration
-- is self-contained and safe to run against a fresh database.
CREATE INDEX IF NOT EXISTS idx_company_records_fts
  ON public.company_records USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_record_files_fts
  ON public.record_files USING GIN (fts);

-- Drop first: the RETURNS TABLE signature is changing (new columns), which
-- CREATE OR REPLACE cannot do in-place.
DROP FUNCTION IF EXISTS public.search_company_records(TEXT);

CREATE FUNCTION public.search_company_records(search_query TEXT)
RETURNS TABLE (
  id                UUID,
  company_id        UUID,
  created_by        UUID,
  title             TEXT,
  description       TEXT,
  record_type       TEXT,
  data              JSONB,
  county            TEXT,
  state             TEXT,
  is_shared         BOOLEAN,
  shared_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  match_source      TEXT,
  matched_file_name TEXT,
  relevance_rank    REAL
)
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT
      btrim(coalesce(search_query, ''))                    AS trimmed,
      websearch_to_tsquery('english', coalesce(search_query, '')) AS tsq
  ),
  -- Candidate rows. Uses the GIN indexes on r.fts / f.fts for the filter so
  -- this stays index-backed even over millions of rows. Scoped to the
  -- caller's company (RLS is the backstop; this is defence in depth).
  base AS (
    SELECT r.*
    FROM public.company_records r
    CROSS JOIN q
    WHERE r.company_id = public.get_my_company_id()
      AND (
        q.trimmed = ''
        OR r.fts @@ q.tsq
        OR EXISTS (
          SELECT 1
          FROM public.record_files f
          WHERE f.record_id = r.id
            AND f.fts @@ q.tsq
        )
      )
  ),
  -- Best-matching attached file per record (name + its own ts_rank). Only
  -- evaluated for a non-empty query. DISTINCT ON keeps one row per record.
  file_match AS (
    SELECT DISTINCT ON (f.record_id)
      f.record_id,
      f.name                    AS file_name,
      ts_rank(f.fts, q.tsq)     AS file_rank
    FROM public.record_files f
    JOIN base b ON b.id = f.record_id
    CROSS JOIN q
    WHERE q.trimmed <> ''
      AND f.fts @@ q.tsq
    ORDER BY f.record_id, ts_rank(f.fts, q.tsq) DESC
  )
  SELECT
    b.id, b.company_id, b.created_by, b.title, b.description,
    b.record_type, b.data, b.county, b.state, b.is_shared,
    b.shared_at, b.created_at, b.updated_at,
    -- Which field explains the match? Priority: title > description >
    -- location (county/state) > document. NULL when browsing (empty query).
    CASE
      WHEN q.trimmed = '' THEN NULL
      WHEN to_tsvector('english', coalesce(b.title, '')) @@ q.tsq
        THEN 'title'
      WHEN to_tsvector('english', coalesce(b.description, '')) @@ q.tsq
        THEN 'description'
      WHEN to_tsvector(
             'english',
             coalesce(b.county, '') || ' ' || coalesce(b.state, '')
           ) @@ q.tsq
        THEN 'location'
      WHEN fm.record_id IS NOT NULL
        THEN 'document'
      ELSE NULL
    END AS match_source,
    -- Only surface a file name when the record matched *because of* a
    -- document (i.e. no metadata field matched).
    CASE
      WHEN q.trimmed <> ''
        AND fm.record_id IS NOT NULL
        AND NOT (to_tsvector('english', coalesce(b.title, '')) @@ q.tsq)
        AND NOT (to_tsvector('english', coalesce(b.description, '')) @@ q.tsq)
        AND NOT (
          to_tsvector(
            'english',
            coalesce(b.county, '') || ' ' || coalesce(b.state, '')
          ) @@ q.tsq
        )
      THEN fm.file_name
      ELSE NULL
    END AS matched_file_name,
    -- Composite relevance: base ts_rank over all metadata, plus weighted
    -- boosts so title > description > location > document ordering holds.
    CASE
      WHEN q.trimmed = '' THEN 0::REAL
      ELSE (
        ts_rank(b.fts, q.tsq)
        + CASE WHEN to_tsvector('english', coalesce(b.title, '')) @@ q.tsq
               THEN 1.0 ELSE 0 END
        + CASE WHEN to_tsvector('english', coalesce(b.description, '')) @@ q.tsq
               THEN 0.5 ELSE 0 END
        + CASE WHEN to_tsvector(
                      'english',
                      coalesce(b.county, '') || ' ' || coalesce(b.state, '')
                    ) @@ q.tsq
               THEN 0.25 ELSE 0 END
        + coalesce(fm.file_rank, 0) * 0.1
      )::REAL
    END AS relevance_rank
  FROM base b
  CROSS JOIN q
  LEFT JOIN file_match fm ON fm.record_id = b.id
  -- Empty query → rank is 0 for all, so it falls through to newest-first.
  ORDER BY relevance_rank DESC, b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_company_records(TEXT) TO authenticated;
