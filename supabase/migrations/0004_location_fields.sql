-- ============================================================
-- Migration: 0004_location_fields.sql
-- Description: Add county/state columns and update record types
-- ============================================================

ALTER TABLE public.company_records
  ADD COLUMN IF NOT EXISTS county TEXT,
  ADD COLUMN IF NOT EXISTS state  TEXT;

-- Rebuild the shared network view to expose county and state
-- DROP first: CREATE OR REPLACE VIEW cannot insert columns before existing
-- ones (county/state sit before shared_at), so a plain replace fails with
-- "cannot change name of view column".
DROP VIEW IF EXISTS public.shared_records_network;

CREATE VIEW public.shared_records_network AS
  SELECT
    r.id,
    r.company_id,
    c.name   AS company_name,
    r.title,
    r.description,
    r.record_type,
    r.data,
    r.county,
    r.state,
    r.shared_at
  FROM public.company_records r
  JOIN public.companies c ON c.id = r.company_id
  WHERE r.is_shared = TRUE;
