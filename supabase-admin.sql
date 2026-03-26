-- ============================================================
-- FestForms Admin & Profiles Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Profiles table (merged: public profile + admin role management)
CREATE TABLE IF NOT EXISTS public.profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role           text NOT NULL DEFAULT 'creator', -- 'admin' | 'creator'
  suspended      boolean DEFAULT false,
  -- Public profile fields (used by /u/[username])
  username       text UNIQUE,
  name           text,
  full_name      text,
  bio            text,
  avatar_url     text,
  cover_url      text,
  cover_position text,
  social_links   jsonb DEFAULT '{}'::jsonb,
  account_type   text NOT NULL DEFAULT 'creator', -- 'creator' | 'company'
  industry       text,
  location       text,
  created_at     timestamptz DEFAULT now()
);

-- If profiles table already exists, add missing columns safely
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'creator';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_position text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'creator';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;

-- 2. RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Creators can read their own profile
CREATE POLICY "profiles_own_read" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Fallback insert if the signup trigger ever missed creating a row.
-- role = 'creator' and suspended = false are enforced at the DB level —
-- a malicious client cannot self-assign admin or pre-suspend their own account.
CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND role = 'creator'
    AND suspended = false
  );

-- profiles_own_update intentionally removed: users must call update_own_profile() RPC instead.
-- This prevents users from self-assigning role/suspended via direct API calls.

-- Admins can read ALL profiles
CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admins can update ALL profiles (for suspend/role changes)
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Safe profile update RPC — only allows editing non-privileged columns.
-- role and suspended are intentionally excluded and can only be changed by admins.
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_username       text DEFAULT NULL,
  p_name           text DEFAULT NULL,
  p_full_name      text DEFAULT NULL,
  p_bio            text DEFAULT NULL,
  p_avatar_url     text DEFAULT NULL,
  p_cover_url      text DEFAULT NULL,
  p_cover_position text DEFAULT NULL,
  p_social_links   jsonb DEFAULT NULL,
  p_account_type   text DEFAULT NULL,
  p_industry       text DEFAULT NULL,
  p_location       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET
    username       = COALESCE(p_username, username),
    name           = COALESCE(p_name, name),
    full_name      = COALESCE(p_full_name, full_name),
    bio            = left(COALESCE(p_bio, bio), 120),
    avatar_url     = COALESCE(p_avatar_url, avatar_url),
    cover_url      = COALESCE(p_cover_url, cover_url),
    cover_position = COALESCE(p_cover_position, cover_position),
    social_links   = COALESCE(p_social_links, social_links),
    account_type   = CASE WHEN p_account_type IN ('creator', 'company') THEN p_account_type ELSE account_type END,
    industry       = left(p_industry, 100),
    location       = left(p_location, 100)
    -- role and suspended are intentionally excluded
  WHERE id = auth.uid();
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.update_own_profile TO authenticated;

-- 3. Auto-create profile on every new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'creator', -- 🔒 FORCED to creator
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill existing users as creators (preserve existing profile data)
INSERT INTO public.profiles (id, role)
SELECT id, 'creator'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = COALESCE(profiles.role, 'creator');

-- 5. Promote your account to admin (replace with your user UUID from auth.users)
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'your-uuid-here';

-- 6. Helper: creator stats view (used by admin dashboard)
CREATE OR REPLACE VIEW public.creator_stats WITH (security_invoker = true) AS
SELECT
  p.id,
  p.full_name,
  p.role,
  p.suspended,
  p.created_at,
  u.email,
  COUNT(DISTINCT f.id)                                          AS form_count,
  COUNT(DISTINCT CASE WHEN f.config->>'isCourse' = 'true' THEN f.id END) AS course_count,
  COUNT(DISTINCT CASE WHEN f.config->'eventDetails'->>'isEvent' = 'true' THEN f.id END) AS event_count,
  COUNT(DISTINCT r.id)                                          AS response_count
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN public.forms f ON f.user_id = p.id
LEFT JOIN public.responses r ON r.form_id = f.id
WHERE p.role = 'creator'
GROUP BY p.id, p.full_name, p.role, p.suspended, p.created_at, u.email;

-- Restricted to service_role only — admin API uses service role key, no client can access this directly.
-- Revoke from PUBLIC and both Supabase client roles explicitly, because CREATE OR REPLACE VIEW
-- can re-trigger schema default privileges and silently re-grant access on each migration run.
REVOKE ALL ON public.creator_stats FROM PUBLIC;
REVOKE ALL ON public.creator_stats FROM anon;
REVOKE ALL ON public.creator_stats FROM authenticated;
GRANT SELECT ON public.creator_stats TO service_role;

-- 7. Public-safe profile view (used by /u/[username])
-- Only exposes fields safe for public display — no role, suspended, full_name
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  username,
  name,
  bio,
  avatar_url,
  cover_url,
  cover_position,
  social_links,
  account_type,
  industry,
  location
FROM public.profiles;

-- Allow anyone (including unauthenticated visitors) to read public profiles
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 8. Certificate defaults (one design per creator, used as fallback for all courses)
CREATE TABLE IF NOT EXISTS public.certificate_defaults (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_name     text,
  primary_color        text,
  accent_color         text,
  background_image_url text,
  logo_url             text,
  signature_url        text,
  signatory_name       text,
  signatory_title      text,
  certify_text         text,
  completion_text      text,
  font_family          text,
  heading_size         text,
  padding_top          integer,
  padding_left         integer,
  line_spacing         text,
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE public.certificate_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_defaults_own" ON public.certificate_defaults
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
