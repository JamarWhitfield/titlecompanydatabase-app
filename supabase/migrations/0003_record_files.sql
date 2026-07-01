-- ============================================================
-- Migration: 0003_record_files.sql
-- Description: File attachments for company records
-- ============================================================

-- Stores metadata for files uploaded to Supabase Storage.
-- Actual files live in the 'record-files' storage bucket at:
--   {company_id}/{record_id}/{uuid}-{original_filename}

CREATE TABLE public.record_files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  record_id  UUID NOT NULL REFERENCES public.company_records(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  path       TEXT NOT NULL UNIQUE,
  size       BIGINT NOT NULL,
  mime_type  TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.record_files ENABLE ROW LEVEL SECURITY;

-- Helper: returns the caller's company_id from their profile.
-- SECURITY DEFINER + fixed search_path so it can be used safely inside RLS
-- policies without recursing through the profiles policies.
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY "record_files: read own company"
  ON public.record_files FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "record_files: insert own company"
  ON public.record_files FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "record_files: delete own company"
  ON public.record_files FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id());

-- ============================================================
-- Storage RLS policies for the 'record-files' bucket
-- Files are stored at {company_id}/{record_id}/{uuid}-{name}
-- so the first path segment is always the owning company's id.
-- ============================================================

CREATE POLICY "storage: read own company files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'record-files' AND
    (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "storage: insert own company files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'record-files' AND
    (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "storage: delete own company files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'record-files' AND
    (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
