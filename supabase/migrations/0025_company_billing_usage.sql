-- ============================================================
-- Migration: 0025_company_billing_usage.sql
-- Description: Per-company plan + usage limits, and OWNER-ONLY platform RPCs
--   powering the Storage & Usage dashboard (/dashboard/platform/usage).
--
-- This is internal platform-owner USAGE MONITORING only. There is no Stripe,
-- no automatic billing, no automatic overage charging, and no automatic plan
-- enforcement here. "Overage" is computed for display as a quantity over the
-- configured limit — never a dollar charge.
--
-- Company storage usage is derived from SUM(record_files.size) grouped by
-- company_id — Casetra's billable, application-level metadata — never by
-- scanning the Storage bucket. The usage RPC returns AGGREGATE numbers only:
-- no file paths, file names, content_text, record titles, or signed URLs.
--
-- Security model (unchanged from 0023):
--   * Every RPC is SECURITY DEFINER and re-checks is_platform_admin(...).
--   * The read + write RPCs below require the ENABLED 'owner' role. Support and
--     auditor roles cannot read company usage or change limits here.
--   * company_billing has RLS enabled with NO client write policies; all writes
--     go through platform_set_company_billing(). No tenant policy is weakened.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. company_billing — one row per company: plan label + optional limits.
--    A NULL limit means "unlimited / not set". Limits are informational
--    thresholds for monitoring; nothing is enforced at write time.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_billing (
  company_id          UUID PRIMARY KEY
                        REFERENCES public.companies(id) ON DELETE CASCADE,
  plan                TEXT NOT NULL DEFAULT 'trial'
                        CHECK (plan IN ('trial', 'starter', 'growth', 'enterprise')),
  storage_limit_bytes BIGINT CHECK (storage_limit_bytes IS NULL OR storage_limit_bytes >= 0),
  user_limit          INTEGER CHECK (user_limit IS NULL OR user_limit >= 0),
  record_limit        INTEGER CHECK (record_limit IS NULL OR record_limit >= 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.company_billing ENABLE ROW LEVEL SECURITY;

-- Defense in depth: owners may read directly; everyone else has no access.
-- Writes are RPC-only (no INSERT/UPDATE/DELETE policies exist), so even an
-- owner cannot edit limits by a raw client write — only via the audited RPC.
DROP POLICY IF EXISTS "company_billing: owners read" ON public.company_billing;
CREATE POLICY "company_billing: owners read"
  ON public.company_billing FOR SELECT TO authenticated
  USING (public.is_platform_admin(ARRAY['owner']));

-- Seed a default 'trial' row for every existing company. New companies without
-- a row are still handled by the LEFT JOIN + COALESCE in the usage RPC below.
INSERT INTO public.company_billing (company_id)
SELECT c.id FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. platform_list_company_usage() — OWNER-ONLY aggregate usage per company.
--    Storage bytes come from SUM(record_files.size). Aggregate counts only —
--    no per-file or per-record detail is ever returned.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_list_company_usage()
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  slug                TEXT,
  plan                TEXT,
  storage_bytes       BIGINT,
  storage_limit_bytes BIGINT,
  user_count          BIGINT,
  user_limit          INTEGER,
  record_count        BIGINT,
  record_limit        INTEGER,
  file_count          BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(ARRAY['owner']) THEN
    RAISE EXCEPTION 'Only platform owners can view company usage.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    COALESCE(b.plan, 'trial')                                            AS plan,
    COALESCE((SELECT SUM(f.size) FROM public.record_files f
              WHERE f.company_id = c.id), 0)::BIGINT                     AS storage_bytes,
    b.storage_limit_bytes,
    (SELECT count(*) FROM public.profiles p
      WHERE p.company_id = c.id)                                        AS user_count,
    b.user_limit,
    (SELECT count(*) FROM public.company_records r
      WHERE r.company_id = c.id)                                        AS record_count,
    b.record_limit,
    (SELECT count(*) FROM public.record_files f
      WHERE f.company_id = c.id)                                        AS file_count
  FROM public.companies c
  LEFT JOIN public.company_billing b ON b.company_id = c.id
  ORDER BY 5 DESC, 2 ASC;  -- storage_bytes desc, then name asc (ordinals avoid
                           -- any collision with the RETURNS TABLE OUT names)
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_company_usage() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. platform_set_company_billing(...) — OWNER-ONLY upsert of a company's plan
--    and limits. Auditors and support cannot call this (owner check). Every
--    change is written to the platform audit trail. NULL limit = unlimited.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_set_company_billing(
  p_company_id          UUID,
  p_plan                TEXT,
  p_storage_limit_bytes BIGINT DEFAULT NULL,
  p_user_limit          INTEGER DEFAULT NULL,
  p_record_limit        INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(ARRAY['owner']) THEN
    RAISE EXCEPTION 'Only platform owners can change company billing limits.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_plan IS NULL OR p_plan NOT IN ('trial', 'starter', 'growth', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF (p_storage_limit_bytes IS NOT NULL AND p_storage_limit_bytes < 0)
     OR (p_user_limit IS NOT NULL AND p_user_limit < 0)
     OR (p_record_limit IS NOT NULL AND p_record_limit < 0) THEN
    RAISE EXCEPTION 'Limits cannot be negative' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.company_billing AS b (
    company_id, plan, storage_limit_bytes, user_limit, record_limit,
    updated_at, updated_by
  )
  VALUES (
    p_company_id, p_plan, p_storage_limit_bytes, p_user_limit, p_record_limit,
    NOW(), auth.uid()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    plan                = EXCLUDED.plan,
    storage_limit_bytes = EXCLUDED.storage_limit_bytes,
    user_limit          = EXCLUDED.user_limit,
    record_limit        = EXCLUDED.record_limit,
    updated_at          = NOW(),
    updated_by          = auth.uid();

  PERFORM public.log_platform_action(
    'update_company_billing',
    p_company_id,
    NULL,
    NULL,
    jsonb_build_object(
      'plan', p_plan,
      'storage_limit_bytes', p_storage_limit_bytes,
      'user_limit', p_user_limit,
      'record_limit', p_record_limit
    ),
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_set_company_billing(UUID, TEXT, BIGINT, INTEGER, INTEGER) TO authenticated;
