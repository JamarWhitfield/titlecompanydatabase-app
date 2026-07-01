-- ============================================================
-- Migration: 0001_initial_schema.sql
-- Description: Initial schema for Title Network Database
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

-- companies: One row per title company using the platform
CREATE TABLE IF NOT EXISTS public.companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE, -- URL-friendly identifier, e.g. "acme-title"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- profiles: One row per user, linked to a company
-- Extends Supabase auth.users (auth.users is managed by Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- company_records: The core data records each company manages
-- is_shared = false → private, only visible to own company
-- is_shared = true  → visible to all companies in the network (read-only for others)
CREATE TABLE IF NOT EXISTS public.company_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  title       TEXT NOT NULL,
  description TEXT,
  record_type TEXT NOT NULL DEFAULT 'general', -- e.g. 'property', 'lien', 'escrow', 'general'
  data        JSONB NOT NULL DEFAULT '{}',     -- flexible field for record-specific data
  is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
  shared_at   TIMESTAMPTZ,                     -- when it was first shared to the network
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- audit_logs: Immutable log of changes to company_records
-- Useful for compliance and tracing who shared/edited/deleted records
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id),
  user_id    UUID REFERENCES auth.users(id),
  action     TEXT NOT NULL,         -- 'INSERT', 'UPDATE', 'DELETE', 'SHARE', 'UNSHARE'
  table_name TEXT NOT NULL,
  record_id  UUID,                  -- the affected record's id
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIEWS
-- ============================================================

-- shared_records_network: A logical "shared database" — not a separate physical DB.
-- This view exposes only records where is_shared = true, joined with company name.
-- All authenticated users can query this view to search/browse the shared network.
CREATE OR REPLACE VIEW public.shared_records_network AS
  SELECT
    r.id,
    r.company_id,
    c.name   AS company_name,
    r.title,
    r.description,
    r.record_type,
    r.data,
    r.shared_at
  FROM public.company_records r
  JOIN public.companies c ON c.id = r.company_id
  WHERE r.is_shared = TRUE;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Automatically update updated_at on company_records row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_records_updated_at
  BEFORE UPDATE ON public.company_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Automatically set shared_at when a record is first shared
CREATE OR REPLACE FUNCTION public.set_shared_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_shared = TRUE AND OLD.is_shared = FALSE THEN
    NEW.shared_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_records_shared_at
  BEFORE UPDATE ON public.company_records
  FOR EACH ROW EXECUTE FUNCTION public.set_shared_at();

-- Writes an audit log row after any INSERT/UPDATE/DELETE on company_records
CREATE OR REPLACE FUNCTION public.audit_company_records()
RETURNS TRIGGER AS $$
DECLARE
  _action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'INSERT';
    INSERT INTO public.audit_logs (company_id, user_id, action, table_name, record_id, new_data)
    VALUES (NEW.company_id, auth.uid(), _action, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' THEN
    -- Label share / unshare events explicitly for clarity
    IF NEW.is_shared = TRUE AND OLD.is_shared = FALSE THEN
      _action := 'SHARE';
    ELSIF NEW.is_shared = FALSE AND OLD.is_shared = TRUE THEN
      _action := 'UNSHARE';
    ELSE
      _action := 'UPDATE';
    END IF;
    INSERT INTO public.audit_logs (company_id, user_id, action, table_name, record_id, old_data, new_data)
    VALUES (NEW.company_id, auth.uid(), _action, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));

  ELSIF TG_OP = 'DELETE' THEN
    _action := 'DELETE';
    INSERT INTO public.audit_logs (company_id, user_id, action, table_name, record_id, old_data)
    VALUES (OLD.company_id, auth.uid(), _action, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_company_records
  AFTER INSERT OR UPDATE OR DELETE ON public.company_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_company_records();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on every table (denies all access by default until policies are added)
ALTER TABLE public.companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs       ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- companies policies
-- ────────────────────────────────────────────────────────────

-- Any authenticated user can see the companies table
-- (needed to display company names in the shared network view)
CREATE POLICY "companies: authenticated users can read all"
  ON public.companies FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only service role / admin migrations can insert companies
-- (company creation happens server-side during onboarding, not directly by users)

-- ────────────────────────────────────────────────────────────
-- profiles policies
-- ────────────────────────────────────────────────────────────

-- Users can read any profile in their own company
CREATE POLICY "profiles: read own company"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Users can update only their own profile
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow new users to insert their own profile (called after sign-up)
CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- company_records policies
-- ────────────────────────────────────────────────────────────

-- Rule 1: Users can always read records that belong to their own company
CREATE POLICY "records: read own company records"
  ON public.company_records FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Rule 2: Users can read ANY record that has been shared to the network
CREATE POLICY "records: read shared records from other companies"
  ON public.company_records FOR SELECT
  TO authenticated
  USING (is_shared = TRUE);

-- Rule 3: Users can only insert records for their own company
CREATE POLICY "records: insert own company"
  ON public.company_records FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Rule 4: Users can only update records that belong to their own company
-- (this covers sharing/unsharing — only the owning company can share their record)
CREATE POLICY "records: update own company"
  ON public.company_records FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Rule 5: Users can only delete records that belong to their own company
CREATE POLICY "records: delete own company"
  ON public.company_records FOR DELETE
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- audit_logs policies
-- ────────────────────────────────────────────────────────────

-- Users can read audit logs for their own company only
CREATE POLICY "audit_logs: read own company"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- audit_logs is written by the SECURITY DEFINER trigger function — no direct INSERT policy needed
