-- ============================================================
-- One-off cleanup: remove ALL demo / fake companies and their data,
-- keeping only the real company (the one your account belongs to).
--
-- HOW TO RUN
--   1. Edit the KEEP_EMAILS list below if you want to keep more accounts.
--   2. Supabase Dashboard → SQL Editor → paste this whole file → Run.
--      (It runs in a single transaction; if anything fails, NOTHING is
--       deleted.)
--   3. Afterwards, clear the matching Storage files:
--        node --env-file=.env.local scripts/clean-storage.mjs
--
-- WHAT IT KEEPS
--   Every company that has at least one member whose auth email is in
--   KEEP_EMAILS. Everything else — records, files, notes, notifications,
--   saved searches, invitations, audit logs, profiles and the demo auth
--   users themselves — is removed.
--
-- SAFETY
--   * Runs in one transaction (BEGIN/COMMIT).
--   * Aborts if the keep-list matches zero companies (prevents wiping
--     the whole database by mistake).
--   * Deletes children before parents and clears audit_logs AFTER the
--     record deletes, so the audit triggers don't re-insert blocked rows.
-- ============================================================

BEGIN;

-- ── 1. Companies to KEEP (edit the email list as needed) ────────────
CREATE TEMP TABLE keep_companies ON COMMIT DROP AS
  SELECT DISTINCT p.company_id AS id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = ANY (ARRAY[
    'jamarkwjr@gmail.com'
  ]);

-- Abort if we matched nothing — avoids deleting every company.
DO $$
BEGIN
  IF (SELECT count(*) FROM keep_companies) = 0 THEN
    RAISE EXCEPTION
      'Keep-list matched 0 companies — aborting so nothing is deleted. '
      'Check the email(s) in KEEP_EMAILS.';
  END IF;
END $$;

-- ── 2. Everything else is a company to DELETE ──────────────────────
CREATE TEMP TABLE del_companies ON COMMIT DROP AS
  SELECT id FROM public.companies
  WHERE id NOT IN (SELECT id FROM keep_companies);

-- ── 3. Delete child rows first, in FK-safe order ───────────────────
DELETE FROM public.record_notes
  WHERE company_id IN (SELECT id FROM del_companies);

DELETE FROM public.notifications
  WHERE company_id IN (SELECT id FROM del_companies);

DELETE FROM public.saved_searches
  WHERE company_id IN (SELECT id FROM del_companies);

DELETE FROM public.company_invitations
  WHERE company_id IN (SELECT id FROM del_companies);

-- record_files + company_records fire audit triggers that INSERT into
-- audit_logs, so they must be deleted BEFORE we clear audit_logs.
DELETE FROM public.record_files
  WHERE company_id IN (SELECT id FROM del_companies);

DELETE FROM public.company_records
  WHERE company_id IN (SELECT id FROM del_companies);

-- Now clear the audit trail for those companies (including rows the
-- delete triggers just wrote).
DELETE FROM public.audit_logs
  WHERE company_id IN (SELECT id FROM del_companies);

-- ── 4. Remove the demo users, then the companies ───────────────────
-- Deleting the auth user cascades to its profile.
DELETE FROM auth.users
  WHERE id IN (
    SELECT p.id FROM public.profiles p
    WHERE p.company_id IN (SELECT id FROM del_companies)
  );

DELETE FROM public.companies
  WHERE id IN (SELECT id FROM del_companies);

-- ── 5. Show what remains, then commit ──────────────────────────────
DO $$
DECLARE
  remaining_companies INT;
  remaining_records   INT;
BEGIN
  SELECT count(*) INTO remaining_companies FROM public.companies;
  SELECT count(*) INTO remaining_records   FROM public.company_records;
  RAISE NOTICE 'Cleanup done. Companies left: %, records left: %',
    remaining_companies, remaining_records;
END $$;

COMMIT;
