-- ============================================================
-- Migration: 0021_lock_profile_self_update.sql
-- Description: SECURITY HARDENING — prevent privilege escalation via the
--   "profiles: update own" policy (0001), which checked only
--   id = auth.uid() and therefore let a user change their OWN role to
--   'admin' or repoint their profile to another company via a direct API
--   call.
--
--   This replaces that policy with one whose WITH CHECK additionally
--   requires role and company_id to remain UNCHANGED. Legitimate role
--   changes still flow through the set_member_role RPC (0017), which runs
--   SECURITY DEFINER and enforces its own admin guard, so it is unaffected.
--
--   Idempotent: DROP ... IF EXISTS before CREATE.
-- ============================================================

DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Role and company are immutable on a self-service update. Changing
    -- either must go through a SECURITY DEFINER RPC (e.g. set_member_role),
    -- which bypasses RLS and applies its own admin checks.
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND company_id = (SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid())
  );
