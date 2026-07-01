-- ============================================================
-- Migration: 0019_trgm_content_search.sql
-- Description: Replace FTS on record_files.content_text with a
--              pg_trgm trigram index so that alphanumeric index
--              numbers, parcel IDs, deed references and similar
--              structured codes can be found by partial substring
--              match — the primary real-world search pattern for
--              title company abstracts.
--
-- WHY TRIGRAM INSTEAD OF FTS FOR DOCUMENT CONTENT
--   Full-text search (tsvector / websearch_to_tsquery) is optimised
--   for natural language: it stems words, ignores stop-words, and
--   tokenises on whitespace. That works well for titles and
--   descriptions but poorly for index numbers:
--     • "2024-001234" may be split into "2024" and "001234", so a
--       search for "001234" might not hit the right token.
--     • "APN-0042" normalised by English stemming produces "apn"
--       and "0042" — a search for "APN-004" finds nothing.
--     • Partial lookups ("0042" to locate "APN-0042") are not
--       supported by FTS at all.
--   pg_trgm stores character tri-grams of the raw text and indexes
--   them in a GIN structure. An ILIKE '%APN-0042%' or even
--   '%0042%' scan hits this index, not the table, making partial
--   index-number searches fast at any scale.
--
-- HYBRID STRATEGY (unchanged for metadata fields)
--   • record_files.content_text → trigram ILIKE  (this migration)
--   • company_records.title / description / county / state → FTS
--     (these are natural-language fields; FTS is still appropriate)
--
-- PERFORMANCE
--   GIN trigram indexes are larger than FTS GIN indexes but still
--   compact relative to the source text. They handle ILIKE patterns
--   as short as 3 characters with an index scan; shorter patterns
--   fall back to a seq scan of candidates (i.e. same behaviour as
--   today for very short queries, which are inherently imprecise).
--
-- COMPAT
--   The fts generated column and its GIN index on record_files are
--   retained so existing queries that already use FTS on files are
--   not broken — nothing is dropped, only added.
-- ============================================================

-- pg_trgm ships with every Supabase / standard PostgreSQL install.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index on the raw extracted text. ILIKE '%…%' queries on
-- content_text will use this index instead of a sequential scan.
CREATE INDEX IF NOT EXISTS idx_record_files_content_trgm
  ON public.record_files USING GIN (content_text gin_trgm_ops);

-- ────────────────────────────────────────────────────────────
-- Redefine search_company_records with the hybrid approach:
--   metadata fields  → FTS (websearch_to_tsquery, GIN fts index)
--   document content → trigram ILIKE (GIN trgm index)
-- ────────────────────────────────────────────────────────────
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
      btrim(coalesce(search_query, ''))                         AS trimmed,
      -- FTS query — used only for metadata fields
      websearch_to_tsquery('english', coalesce(search_query, '')) AS tsq,
      -- ILIKE pattern — used for raw document text
      '%' || btrim(coalesce(search_query, '')) || '%'           AS ilike_pat
  ),
  -- Candidate records: own company, match in metadata OR in any
  -- attached document's raw text. GIN indexes cover both paths.
  base AS (
    SELECT r.*
    FROM public.company_records r
    CROSS JOIN q
    WHERE r.company_id = public.get_my_company_id()
      AND (
        q.trimmed = ''
        OR r.fts @@ q.tsq                                   -- FTS on metadata
        OR EXISTS (
          SELECT 1
          FROM public.record_files f
          WHERE f.record_id = r.id
            AND f.content_text ILIKE q.ilike_pat            -- trigram on content
        )
      )
  ),
  -- Best-matching file per record (highest trigram similarity wins).
  -- DISTINCT ON keeps exactly one file row per record — the one
  -- whose content_text most closely resembles the query string.
  file_match AS (
    SELECT DISTINCT ON (f.record_id)
      f.record_id,
      f.name                                             AS file_name,
      similarity(f.content_text, q.trimmed)             AS file_sim
    FROM public.record_files f
    JOIN base b ON b.id = f.record_id
    CROSS JOIN q
    WHERE q.trimmed <> ''
      AND f.content_text ILIKE q.ilike_pat
    ORDER BY f.record_id, similarity(f.content_text, q.trimmed) DESC
  )
  SELECT
    b.id, b.company_id, b.created_by, b.title, b.description,
    b.record_type, b.data, b.county, b.state, b.is_shared,
    b.shared_at, b.created_at, b.updated_at,
    -- Where did this record match?
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
    -- File name shown only for document-only matches.
    CASE
      WHEN q.trimmed <> ''
        AND fm.record_id IS NOT NULL
        AND NOT (to_tsvector('english', coalesce(b.title, '')) @@ q.tsq)
        AND NOT (to_tsvector('english', coalesce(b.description, '')) @@ q.tsq)
        AND NOT (to_tsvector(
                   'english',
                   coalesce(b.county, '') || ' ' || coalesce(b.state, '')
                 ) @@ q.tsq)
      THEN fm.file_name
      ELSE NULL
    END AS matched_file_name,
    -- Relevance: FTS rank for metadata matches + trigram similarity
    -- for document matches. Keeps title > description > location >
    -- document ordering without re-computing full tsvectors.
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
        + coalesce(fm.file_sim, 0) * 0.1
      )::REAL
    END AS relevance_rank
  FROM base b
  CROSS JOIN q
  LEFT JOIN file_match fm ON fm.record_id = b.id
  ORDER BY relevance_rank DESC, b.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_company_records(TEXT) TO authenticated;
