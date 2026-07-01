-- ============================================================
-- Migration: 0009_record_files_has_text.sql
-- Description: Lightweight, stored boolean that records whether an
--              attachment produced searchable extracted text. Lets the
--              UI show an "Indexed for search" / "No text extracted"
--              status WITHOUT pulling the (potentially large) full
--              content_text over the wire on every page load.
--
-- Generated + STORED so it is computed once and cheap to SELECT. This
-- is additive only — it does not alter existing columns, data, search,
-- or RLS behaviour.
-- ============================================================

ALTER TABLE public.record_files
  ADD COLUMN IF NOT EXISTS has_text BOOLEAN
  GENERATED ALWAYS AS (content_text IS NOT NULL AND length(content_text) > 0) STORED;
