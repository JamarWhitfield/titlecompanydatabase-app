-- ============================================================
-- Migration: 0010_shared_records_search.sql
-- Description: Full-text search across the SHARED network — record
--              metadata, owning company name, AND the extracted text
--              contents of attached files. Mirrors search_company_records
--              but scopes to shared records and joins the company name.
--
-- SECURITY INVOKER (default): RLS still applies. Reading shared records
-- is permitted by the "records: read shared records from other companies"
-- policy (0001) and reading their files by the shared-file SELECT policy
-- (0006), so results never leak private records or private files.
--
-- Returns the exact shared_records_network view column shape.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_shared_records(search_query TEXT)
RETURNS TABLE (
  id           UUID,
  company_id   UUID,
  company_name TEXT,
  title        TEXT,
  description  TEXT,
  record_type  TEXT,
  data         JSONB,
  county       TEXT,
  state        TEXT,
  shared_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.id, r.company_id, c.name AS company_name, r.title, r.description,
    r.record_type, r.data, r.county, r.state, r.shared_at
  FROM public.company_records r
  JOIN public.companies c ON c.id = r.company_id
  WHERE r.is_shared = TRUE
    AND (
      btrim(coalesce(search_query, '')) = ''
      OR r.fts @@ websearch_to_tsquery('english', search_query)
      OR c.name ILIKE '%' || search_query || '%'
      OR EXISTS (
        SELECT 1
        FROM public.record_files f
        WHERE f.record_id = r.id
          AND f.fts @@ websearch_to_tsquery('english', search_query)
      )
    )
  ORDER BY r.shared_at DESC NULLS LAST;
$$;
