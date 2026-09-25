-- ==============================================================================
-- MTG LIMITED IQ: SECURE ADMIN SCHEMA & TELEMETRY
-- Run this script in your Supabase SQL Editor to configure:
-- 1. profiles email column & backfill: ensures verified user email is in profiles
-- 2. app_admins: Table containing authorized administrator users & emails (dbyrd1568@gmail.com owner)
-- 3. user_activity_logs: Telemetry table tracking user logins, set exploration & features
-- 4. is_admin(): Security definer function checking admin permissions
-- 5. get_admin_users_directory(): Security definer RPC returning all users with emails from auth.users
-- 6. Row-Level Security (RLS) policies granting admins access to user metrics
-- ==============================================================================

-- 0. EXTEND PROFILES WITH EMAIL COLUMN & BACKFILL FROM AUTH.USERS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill emails for existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Automatic trigger to populate profiles on auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url, updated_at)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = coalesce(public.profiles.email, excluded.email),
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 1. APP ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.app_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_admins_user_id ON public.app_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_app_admins_email ON public.app_admins(lower(email));

-- 2. USER ACTIVITY LOGS TABLE (Telemetry)
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  event_type TEXT NOT NULL, -- e.g. 'login', 'feature_used', 'grade_card', 'set_switcher', 'set_explorer'
  feature_name TEXT NOT NULL, -- e.g. 'card_grading', 'card_quiz', 'set_explorer', 'set_switcher'
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feature ON public.user_activity_logs(feature_name);
CREATE INDEX IF NOT EXISTS idx_activity_user_feature ON public.user_activity_logs(user_id, feature_name);

-- 3. IS_ADMIN SECURITY DEFINER FUNCTION
-- Permanent super admin owners: dbyrd1568@gmail.com and devonwbyrd@gmail.com
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  caller_email TEXT;
BEGIN
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 0. Check verified JWT email for permanent super admin
  caller_email := lower(auth.jwt() ->> 'email');
  IF caller_email IN ('dbyrd1568@gmail.com', 'devonwbyrd@gmail.com') THEN
    RETURN true;
  END IF;

  -- 1. Check verified email directly from auth.users table for check_user_id
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = check_user_id
      AND lower(u.email) IN ('dbyrd1568@gmail.com', 'devonwbyrd@gmail.com')
  ) THEN
    RETURN true;
  END IF;

  -- 2. Check if user_id is in app_admins
  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = check_user_id) THEN
    RETURN true;
  END IF;

  -- 3. Check if caller email is in app_admins
  IF caller_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.app_admins WHERE lower(email) = caller_email
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PRE-PROVISION OWNER ADMINS & LINK TO AUTH USERS
INSERT INTO public.app_admins (email, role)
VALUES 
  ('dbyrd1568@gmail.com', 'owner'),
  ('devonwbyrd@gmail.com', 'owner')
ON CONFLICT (email) DO UPDATE SET role = 'owner';

UPDATE public.app_admins a
SET user_id = u.id
FROM auth.users u
WHERE lower(a.email) = lower(u.email);

-- 5. ADMIN USERS DIRECTORY RPC FUNCTION
-- Allows verified admins to retrieve all registered users directly with verified emails from auth.users
CREATE OR REPLACE FUNCTION public.get_admin_users_directory()
RETURNS TABLE (
  id UUID,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email::TEXT,
    coalesce(p.display_name, split_part(u.email, '@', 1))::TEXT as display_name,
    p.avatar_url,
    u.created_at,
    coalesce(p.updated_at, u.updated_at, u.created_at) as updated_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5B. ADMIN CARD EVALUATIONS RPC FUNCTION
CREATE OR REPLACE FUNCTION public.get_admin_card_evaluations()
RETURNS TABLE (
  user_id UUID,
  set_code TEXT,
  card_name TEXT,
  evaluation_json JSONB,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    ce.user_id,
    ce.set_code,
    ce.card_name,
    ce.evaluation_json,
    ce.updated_at
  FROM public.card_evaluations ce
  ORDER BY ce.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5C. ADMIN SPECIFIC USER CARD EVALUATIONS RPC FUNCTION
CREATE OR REPLACE FUNCTION public.get_admin_user_card_evaluations(target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  set_code TEXT,
  card_name TEXT,
  evaluation_json JSONB,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    ce.user_id,
    ce.set_code,
    ce.card_name,
    ce.evaluation_json,
    ce.updated_at
  FROM public.card_evaluations ce
  WHERE ce.user_id = target_user_id
  ORDER BY ce.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5D. ADMIN USER STATS RPC FUNCTION
CREATE OR REPLACE FUNCTION public.get_admin_user_stats()
RETURNS TABLE (
  user_id UUID,
  xp INT,
  level INT,
  overall_accuracy INT,
  stats_json JSONB,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    us.user_id,
    us.xp,
    us.level,
    us.overall_accuracy,
    us.stats_json,
    us.updated_at
  FROM public.user_stats us
  ORDER BY us.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- 7. APP ADMINS POLICIES
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can view admins list" ON public.app_admins;
  DROP POLICY IF EXISTS "Admins can add new admins" ON public.app_admins;
  DROP POLICY IF EXISTS "Admins can delete admins" ON public.app_admins;
END $$;

CREATE POLICY "Admins can view admins list"
  ON public.app_admins FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can add new admins"
  ON public.app_admins FOR INSERT
  WITH CHECK (public.is_admin());

-- Only admins can delete, and owner dbyrd1568@gmail.com can NEVER be deleted
CREATE POLICY "Admins can delete admins"
  ON public.app_admins FOR DELETE
  USING (
    public.is_admin()
    AND role != 'owner'
    AND lower(email) != 'dbyrd1568@gmail.com'
  );

-- 8. USER ACTIVITY LOGS POLICIES
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert activity logs" ON public.user_activity_logs;
  DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.user_activity_logs;
END $$;

CREATE POLICY "Users can insert activity logs"
  ON public.user_activity_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all activity logs"
  ON public.user_activity_logs FOR SELECT
  USING (public.is_admin());

-- 9. EXTEND EXISTING TABLES TO GRANT USER AND ADMIN ACCESS
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can insert their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can update their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can delete their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Admins can view all card evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Admins or owners can view card evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users and admins can manage card evaluations" ON public.card_evaluations;
END $$;

CREATE POLICY "Users and admins can manage card evaluations"
  ON public.card_evaluations FOR ALL
  USING (public.is_admin() OR auth.uid() = user_id)
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users can insert their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users can update their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users can delete their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Admins can view all user stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Admins or owners can view user stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users and admins can manage user stats" ON public.user_stats;
END $$;

CREATE POLICY "Users and admins can manage user stats"
  ON public.user_stats FOR ALL
  USING (public.is_admin() OR auth.uid() = user_id)
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);
