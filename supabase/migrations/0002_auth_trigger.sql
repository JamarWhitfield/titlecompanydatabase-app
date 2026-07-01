-- ============================================================
-- Migration: 0002_auth_trigger.sql
-- Description: Auto-create company + profile when a new user signs up
-- ============================================================

-- When a user registers via Supabase Auth, their metadata includes:
--   full_name    — entered on the registration form
--   company_name — entered on the registration form
--
-- This trigger fires after the row is inserted into auth.users and
-- atomically creates the company + profile. Using SECURITY DEFINER
-- so it runs with elevated privileges, bypassing RLS.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _company_id   UUID;
  _company_name TEXT;
  _full_name    TEXT;
  _base_slug    TEXT;
  _slug         TEXT;
BEGIN
  _company_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    'My Company'
  );
  _full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NEW.email
  );

  -- Build a URL-safe slug: lowercase, replace non-alphanumeric runs with '-'
  _base_slug := LOWER(REGEXP_REPLACE(TRIM(_company_name), '[^a-zA-Z0-9]+', '-', 'g'));
  -- Append the first 8 chars of the user UUID to guarantee uniqueness
  _slug := _base_slug || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);

  -- Create the company row (first user of a company is always an admin)
  INSERT INTO public.companies (name, slug)
  VALUES (_company_name, _slug)
  RETURNING id INTO _company_id;

  -- Create the profile row linked to the new company
  INSERT INTO public.profiles (id, company_id, full_name, role)
  VALUES (NEW.id, _company_id, _full_name, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire once per new auth.users row
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
