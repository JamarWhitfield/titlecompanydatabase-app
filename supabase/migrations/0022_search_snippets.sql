-- ============================================================
-- Migration: 0022_search_snippets.sql
-- Description: Add a text SNIPPET to search results so the UI can show a
--   short excerpt of the matching document content — not just the file
--   name. This makes in-document search (0019) visible and useful:
--   e.g. "…parcel APN-0042 recorded in book 12…".
--
--   * Adds a helper make_snippet(content, term) that returns a normalised
--     window of text centred on the first occurrence of the search term,
--     with leading/trailing ellipses when the excerpt is clipped.
--   * Redefines search_company_records to return an extra `snippet` column,
--     populated for document matches (mirrors matched_file_name).
--
--   Idempotent: CREATE OR REPLACE / DROP ... IF EXISTS.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper: windowed excerpt around the first match of `term`.
-- Whitespace is collapsed so multi-line extracted text reads cleanly.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.make_snippet(content TEXT, term TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  norm        TEXT;
  pos         INT;
  win_before  INT := 50;   -- characters of context before the match
  win_len     INT := 180;  -- total excerpt length
  start_i     INT;
  excerpt     TEXT;
BEGIN
  IF content IS NULL OR btrim(coalesce(term, '')) = '' THEN
    RETURN NULL;
  END IF;

  -- Collapse all whitespace runs to single spaces for readable output.
  norm := btrim(regexp_replace(content, '\s+', ' ', 'g'));
  IF norm = '' THEN
    RETURN NULL;
  END IF;

  pos := position(lower(term) IN lower(norm));

  -- No literal substring hit (e.g. trigram-similar but not exact) — fall
  -- back to the start of the document.
  IF pos = 0 THEN
    RETURN left(norm, win_len)
           || CASE WHEN length(norm) > win_len THEN '…' ELSE '' END;
  END IF;

  start_i := greatest(1, pos - win_before);
  excerpt := substring(norm FROM start_i FOR win_len);

  RETURN
    CASE WHEN start_i > 1 THEN '…' ELSE '' END
    || btrim(excerpt)
    || CASE WHEN start_i + win_len - 1 < length(norm) THEN '…' ELSE '' END;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Redefine search_company_records with an added `snippet` column.
-- Body is identical to 0019 except: file_match also carries the raw
-- content_text, and the final SELECT computes the snippet for document
-- matches.
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
  snippet           TEXT,
  relevance_rank    REAL
)
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT
      btrim(coalesce(search_query, ''))                           AS trimmed,
      websearch_to_tsquery('english', coalesce(search_query, '')) AS tsq,
      '%' || btrim(coalesce(search_query, '')) || '%'             AS ilike_pat
  ),
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
            AND f.content_text ILIKE q.ilike_pat
        )
      )
  ),
  file_match AS (
    SELECT DISTINCT ON (f.record_id)
      f.record_id,
      f.name                                  AS file_name,
      f.content_text                          AS raw,
      similarity(f.content_text, q.trimmed)   AS file_sim
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
    -- Excerpt of the matching document, shown for document-only matches.
    CASE
      WHEN q.trimmed <> ''
        AND fm.record_id IS NOT NULL
        AND NOT (to_tsvector('english', coalesce(b.title, '')) @@ q.tsq)
        AND NOT (to_tsvector('english', coalesce(b.description, '')) @@ q.tsq)
        AND NOT (to_tsvector(
                   'english',
                   coalesce(b.county, '') || ' ' || coalesce(b.state, '')
                 ) @@ q.tsq)
      THEN public.make_snippet(fm.raw, q.trimmed)
      ELSE NULL
    END AS snippet,
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
