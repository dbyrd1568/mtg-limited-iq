-- ==============================================================================
-- MTG LIMITED IQ: SECURE ADMIN SCHEMA & TELEMETRY
-- Run this script in your Supabase SQL Editor to configure:
-- 1. app_admins: Table containing authorized administrator users & emails
-- 2. user_activity_logs: Telemetry table tracking user logins & feature usage
-- 3. is_admin(): Security definer function checking admin permissions
-- 4. Row-Level Security (RLS) policies granting admins access to user metrics
-- ==============================================================================

-- 1. APP ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.app_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index on user_id and lower(email) for fast permission lookups
CREATE INDEX IF NOT EXISTS idx_app_admins_user_id ON public.app_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_app_admins_email ON public.app_admins(lower(email));

-- 2. USER ACTIVITY LOGS TABLE (Telemetry)
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  event_type TEXT NOT NULL, -- e.g. 'login', 'feature_used', 'grade_card', 'quiz_completed'
  feature_name TEXT NOT NULL, -- e.g. 'card_grading', 'card_quiz', 'archetype_forecast', 'set_explorer'
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for time-series analytics and user/feature filtering
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feature ON public.user_activity_logs(feature_name);
CREATE INDEX IF NOT EXISTS idx_activity_user_feature ON public.user_activity_logs(user_id, feature_name);

-- 3. IS_ADMIN SECURITY DEFINER FUNCTION
-- Securely verifies if the current caller is an authorized admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  caller_email TEXT;
BEGIN
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Check if user_id is in app_admins
  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = check_user_id) THEN
    RETURN true;
  END IF;

  -- 2. Check if user's verified JWT email matches any whitelisted admin email
  caller_email := lower(auth.jwt() ->> 'email');
  IF caller_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.app_admins WHERE lower(email) = caller_email
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. BOOTSTRAP INITIAL ADMIN (Run once or invoke if app_admins is empty)
CREATE OR REPLACE FUNCTION public.bootstrap_admin(admin_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  matched_user_id UUID;
BEGIN
  -- Find matching user in auth.users by email if exists
  SELECT id INTO matched_user_id FROM auth.users WHERE lower(email) = lower(admin_email) LIMIT 1;

  INSERT INTO public.app_admins (user_id, email, role)
  VALUES (matched_user_id, lower(admin_email), 'owner')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- 6. APP ADMINS POLICIES
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

CREATE POLICY "Admins can delete admins"
  ON public.app_admins FOR DELETE
  USING (public.is_admin());

-- 7. USER ACTIVITY LOGS POLICIES
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert activity logs" ON public.user_activity_logs;
  DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.user_activity_logs;
END $$;

-- Authenticated and anonymous users can submit telemetry events
CREATE POLICY "Users can insert activity logs"
  ON public.user_activity_logs FOR INSERT
  WITH CHECK (true);

-- Only verified admins can read activity logs
CREATE POLICY "Admins can view all activity logs"
  ON public.user_activity_logs FOR SELECT
  USING (public.is_admin());

-- 8. EXTEND EXISTING TABLES TO GRANT ADMIN READ ACCESS
-- Allow admins to view all user_stats and card_evaluations for cross-user reporting
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can view all user stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Admins can view all card evaluations" ON public.card_evaluations;
END $$;

CREATE POLICY "Admins can view all user stats"
  ON public.user_stats FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admins can view all card evaluations"
  ON public.card_evaluations FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);
