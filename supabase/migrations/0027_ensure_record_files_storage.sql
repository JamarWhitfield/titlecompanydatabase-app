-- ============================================================
-- Migration: 0027_ensure_record_files_storage.sql
-- Description: SELF-HEALING storage setup for the 'record-files'
--              bucket. Earlier environments were created where the
--              bucket insert (0007) and/or the storage.objects RLS
--              policies (0003 / 0006) never actually ran, which makes
--              EVERY attachment upload fail with "Bucket not found".
--
--              This migration is fully idempotent: it (re)creates the
--              private bucket and re-asserts all four storage policies
--              so any environment converges to the correct state. Safe
--              to run repeatedly.
-- ============================================================

-- 1. The private bucket. Files are never public; the app serves them
--    through short-lived signed URLs (app/actions/files.ts).
INSERT INTO storage.buckets (id, name, public)
VALUES ('record-files', 'record-files', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS. Objects live at {company_id}/{record_id}/{uuid}.{ext},
--    so the first path segment is always the owning company's id.

-- Read your own company's files.
DROP POLICY IF EXISTS "storage: read own company files" ON storage.objects;
CREATE POLICY "storage: read own company files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'record-files' AND
    (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Upload into your own company's folder.
DROP POLICY IF EXISTS "storage: insert own company files" ON storage.objects;
CREATE POLICY "storage: insert own company files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'record-files' AND
    (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Delete your own company's files.
DROP POLICY IF EXISTS "storage: delete own company files" ON storage.objects;
CREATE POLICY "storage: delete own company files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'record-files' AND
    (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Read the storage object behind any file that belongs to a SHARED record,
-- so other companies can download shared attachments via signed URLs.
DROP POLICY IF EXISTS "storage: read shared record files" ON storage.objects;
CREATE POLICY "storage: read shared record files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'record-files' AND
    EXISTS (
      SELECT 1
      FROM public.record_files f
      JOIN public.company_records r ON r.id = f.record_id
      WHERE f.path = storage.objects.name
        AND r.is_shared = TRUE
    )
  );
