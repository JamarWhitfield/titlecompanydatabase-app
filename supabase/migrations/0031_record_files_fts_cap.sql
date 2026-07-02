-- ============================================================
-- Migration: 0031_record_files_fts_cap.sql
-- Description: Harden the record_files full-text-search column against the
--              Postgres 1 MB tsvector limit.
--
-- ROOT CAUSE
--   record_files.fts is a STORED generated column defined in 0005 as
--     to_tsvector('english', coalesce(content_text, ''))
--   Postgres rejects any tsvector over 1 MB with
--     "string is too long for tsvector (… bytes, max 1048575 bytes)".
--   A tsvector is larger than its source text, so a large content_text — e.g.
--   the extracted text layer of a dense 30-page PDF — produced a >1 MB
--   tsvector and FAILED the entire record_files INSERT. To the user this
--   appeared as "Attachments could not be saved" and a record with no file.
--
-- FIX (defense in depth)
--   Cap the tsvector INPUT with left(content_text, 600000) so an oversized
--   content_text can never break inserts, regardless of what the app stores.
--   content_text itself is left intact (trigram ILIKE search in 0019 has no
--   1 MB limit and still covers the full text). The app also caps extracted
--   text at 500 KB (lib/extractText.ts), so this is belt-and-suspenders and
--   allows raising that cap safely in future.
--
-- Redefining a generated column requires DROP + ADD; the dependent GIN index is
-- dropped and recreated. Idempotent (IF EXISTS / IF NOT EXISTS). On existing
-- data the column + index are regenerated once.
-- ============================================================

DROP INDEX IF EXISTS public.idx_record_files_fts;

ALTER TABLE public.record_files DROP COLUMN IF EXISTS fts;

ALTER TABLE public.record_files
  ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', left(coalesce(content_text, ''), 600000))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_record_files_fts
  ON public.record_files USING GIN (fts);
