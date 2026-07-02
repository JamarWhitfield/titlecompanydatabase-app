-- ============================================================
-- Migration: 0026_contact_submissions.sql
-- Description: Storage for demo-request / "Build a demo" leads captured
--              by the public /contact page.
--
-- FLOW
--   1. A visitor (unauthenticated) fills out the demo-request form on the
--      public /contact route.
--   2. The Next.js server action submitDemoRequest() validates every field
--      server-side (required fields, email shape, length caps, allowed
--      option values, honeypot) and then inserts one row here using the
--      service-role client (lib/supabase/admin.ts).
--   3. If Resend is configured, an owner/admin is emailed a copy. Email
--      failure never blocks the insert.
--
-- SECURITY MODEL
--   * RLS is ENABLED with NO policies. That means neither the `anon` nor
--     the `authenticated` role can SELECT, INSERT, UPDATE, or DELETE these
--     rows through the API — the table is completely private to clients.
--   * The ONLY write path is the trusted server action, which uses the
--     service-role key. The service role bypasses RLS, so the insert
--     succeeds there and nowhere else. No customer, teammate, or anonymous
--     visitor can ever read the leads other people submit.
--   * Because there is no client-reachable insert path, the server action's
--     honeypot + validation are the single funnel every write must pass
--     through.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  company_name     TEXT,
  company_website  TEXT,
  role_title       TEXT,
  company_type     TEXT,
  team_size        TEXT,
  current_system   TEXT,
  main_pain_point  TEXT,
  message          TEXT,
  source           TEXT NOT NULL DEFAULT 'landing_contact',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Most-recent-first review by an operator (read via the service role only).
CREATE INDEX IF NOT EXISTS contact_submissions_created_at_idx
  ON public.contact_submissions (created_at DESC);

-- Lock the table down. RLS on + zero policies = deny-all for anon and
-- authenticated. Only the service role (server-side) can touch these rows.
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;

-- Defense in depth: explicitly ensure the API roles hold no table grants.
REVOKE ALL ON public.contact_submissions FROM anon, authenticated;
