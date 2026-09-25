-- ==============================================================================
-- MTG LIMITED IQ: SECURE ADMIN EVALUATIONS & STATS ACCESS REPAIR
-- Run this script in your Supabase Dashboard -> SQL Editor (irxgoelllogcyoiumxup)
-- This grants admin read permissions across user card evaluations & telemetry.
-- ==============================================================================

-- 0. Ensure profiles table has email and is_admin columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Backfill emails and is_admin
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

UPDATE public.profiles
SET is_admin = true
WHERE lower(coalesce(email, '')) IN ('dbyrd1568@gmail.com', 'devonwbyrd@gmail.com');

-- 1. Ensure permanent super-admin owners in app_admins table
CREATE TABLE IF NOT EXISTS public.app_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.app_admins (email, role)
VALUES 
  ('dbyrd1568@gmail.com', 'owner'),
  ('devonwbyrd@gmail.com', 'owner')
ON CONFLICT (email) DO UPDATE SET role = 'owner';

-- Link existing user IDs for both admin accounts
UPDATE public.app_admins a
SET user_id = u.id
FROM auth.users u
WHERE lower(a.email) = lower(u.email);

-- 2. Update is_admin function to recognize both owner emails and check auth.users directly
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  caller_email TEXT;
BEGIN
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 0. Check verified JWT email for permanent super admins
  caller_email := lower(auth.jwt() ->> 'email');
  IF caller_email IN ('dbyrd1568@gmail.com', 'devonwbyrd@gmail.com') THEN
    RETURN true;
  END IF;

  -- 1. Check email directly from auth.users table for check_user_id
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

-- 3. SECURITY DEFINER RPC: get_admin_card_evaluations()
-- Allows authenticated admins to fetch all user evaluations without being blocked by RLS or 1000-row limits
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

-- 4. SECURITY DEFINER RPC: get_admin_user_card_evaluations(target_user_id UUID)
-- Allows authenticated admins to fetch all card evaluations for a specific user
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

-- 5. SECURITY DEFINER RPC: get_admin_user_stats()
-- Allows authenticated admins to fetch all user statistics without being blocked by RLS
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

-- 6. FIX TABLE-LEVEL ROW SECURITY (RLS) POLICIES
ALTER TABLE public.card_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Card Evaluations: Drop old restrictive policies and grant full access to owner or admin
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

-- User Stats: Drop old restrictive policies and grant full access to owner or admin
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

-- User Activity Logs: Ensure users can insert and admins can view
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
