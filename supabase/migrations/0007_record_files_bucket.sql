-- ============================================================
-- Migration: 0007_record_files_bucket.sql
-- Description: Create the private Storage bucket that holds record
--              attachments. The RLS policies in 0003 / 0006 already
--              reference this bucket by id ('record-files'); without
--              the bucket itself, every upload fails and attachments
--              silently disappear.
--
-- The bucket is PRIVATE (public = false): files are never served via
-- public URLs. The app reads them through short-lived signed URLs
-- (see app/actions/files.ts -> getSignedUrl).
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('record-files', 'record-files', FALSE)
ON CONFLICT (id) DO NOTHING;
