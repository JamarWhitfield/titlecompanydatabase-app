-- ============================================================
-- Migration: 0020_admin_controls.sql
-- Description: Three permission refinements, enforced at the database level
--   so the UI cannot be bypassed via a direct API call:
--
--   1. record_notes — only the AUTHOR may edit or delete a note. Company
--      admins can no longer manage other members' notes (0014 previously
--      allowed "own note OR admin"; this drops the admin escape hatch).
--
--   2. companies — company admins may RENAME their own company. Previously
--      there was no UPDATE policy at all, so no user could change the name.
--      Only the name/slug of the caller's OWN company can be changed.
--
--   3. company_records sharing — only admins may share/unshare a record to
--      the network. Members can still create and edit records, but any change
--      to is_shared is rejected unless the caller is an admin. Enforced with a
--      BEFORE UPDATE trigger so it applies to single and bulk updates alike.
--
-- Every statement is idempotent (DROP ... IF EXISTS before CREATE) so this is
-- safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. record_notes — author-only edit/delete.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "record_notes: update own or admin" ON public.record_notes;
CREATE POLICY "record_notes: update own author only"
  ON public.record_notes FOR UPDATE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "record_notes: delete own or admin" ON public.record_notes;
CREATE POLICY "record_notes: delete own author only"
  ON public.record_notes FOR DELETE TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND user_id = auth.uid()
  );

-- ────────────────────────────────────────────────────────────
-- 2. companies — admins can rename their own company.
--    WITH CHECK keeps the row inside the caller's company so an admin can
--    never repoint the row to a different company id.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "companies: admins update own" ON public.companies;
CREATE POLICY "companies: admins update own"
  ON public.companies FOR UPDATE TO authenticated
  USING (
    id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- ────────────────────────────────────────────────────────────
-- 3. company_records — only admins may change the shared flag.
--    The records UPDATE policy (0011) still allows any member of the owning
--    company to edit a record. This trigger narrows just the is_shared
--    transition to admins, raising a friendly error otherwise.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_admin_share()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only guard the transition itself; unrelated edits pass straight through.
  IF NEW.is_shared IS DISTINCT FROM OLD.is_shared THEN
    IF public.get_my_role() <> 'admin' THEN
      RAISE EXCEPTION 'Only admins can share or unshare records to the network.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_share ON public.company_records;
CREATE TRIGGER trg_enforce_admin_share
  BEFORE UPDATE ON public.company_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_share();
