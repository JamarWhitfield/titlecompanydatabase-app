-- ============================================================
-- Bootstrap the FIRST platform owner.
--
-- Platform admins operate the SaaS itself and are intentionally NOT
-- self-service: there is no UI or public flow to make yourself one. The very
-- first owner must be inserted once, by hand, by someone with database access.
-- After that, the first owner can manage all other platform admins from
-- /dashboard/platform/admins.
--
-- HOW TO RUN
--   1. The person must already have a normal Title Network account (sign up
--      at /register). Find their user id:
--
--        SELECT id, email FROM auth.users WHERE email = 'you@example.com';
--
--   2. Paste this into the Supabase Dashboard → SQL Editor, replacing the
--      email, and Run.
-- ============================================================

INSERT INTO public.platform_admins (user_id, role, enabled)
SELECT id, 'owner', TRUE
FROM auth.users
WHERE lower(email) = lower('you@example.com')
ON CONFLICT (user_id)
DO UPDATE SET role = 'owner', enabled = TRUE;

-- Verify:
--   SELECT pa.role, pa.enabled, u.email
--   FROM public.platform_admins pa JOIN auth.users u ON u.id = pa.user_id;
