-- ============================================================
-- Migration: 0008_record_files_audit.sql
-- Description: Audit logging for record attachments, mirroring the
--              existing audit_company_records() trigger pattern.
--
--   INSERT on record_files -> action 'ATTACHMENT_UPLOADED'
--   DELETE on record_files -> action 'ATTACHMENT_DELETED'
--
-- record_id is logged as the PARENT company record so attachment
-- events sit alongside that record's history. SECURITY DEFINER lets
-- the trigger write to audit_logs regardless of the caller's RLS.
-- (record_updated events are already captured by the existing
--  company_records UPDATE trigger when an edit adds attachments.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_record_files()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, table_name, record_id, new_data)
    VALUES (NEW.company_id, auth.uid(), 'ATTACHMENT_UPLOADED', TG_TABLE_NAME, NEW.record_id, to_jsonb(NEW));

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, table_name, record_id, old_data)
    VALUES (OLD.company_id, auth.uid(), 'ATTACHMENT_DELETED', TG_TABLE_NAME, OLD.record_id, to_jsonb(OLD));
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_record_files ON public.record_files;

CREATE TRIGGER trg_audit_record_files
  AFTER INSERT OR DELETE ON public.record_files
  FOR EACH ROW EXECUTE FUNCTION public.audit_record_files();
