-- ============================================================
-- Migration: 0006_shared_record_files.sql
-- Description: Let any authenticated user read the file metadata
--              and download the actual files for records that have
--              been shared to the network (is_shared = TRUE).
--
-- Files for PRIVATE records remain visible only to the owning
-- company. These policies are additive (SELECT policies are OR'd),
-- so own-company access from 0003 is preserved.
-- ============================================================

-- Read file metadata for any shared record.
CREATE POLICY "record_files: read shared records"
  ON public.record_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_records r
      WHERE r.id = record_files.record_id
        AND r.is_shared = TRUE
    )
  );

-- Read the underlying storage object for any shared record's file.
-- record_files.path stores the full object name (bucket key), so we
-- match storage.objects.name against it.
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
