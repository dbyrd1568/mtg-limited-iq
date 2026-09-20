-- ==============================================================================
-- MTG LIMITED IQ: SUPABASE PRODUCTION DATABASE SCHEMA & ROW-LEVEL SECURITY (RLS)
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 0. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
  DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
END $$;

CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Profile updated_at trigger
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. USER STATS TABLE
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INT DEFAULT 0 NOT NULL,
  level INT DEFAULT 1 NOT NULL,
  overall_accuracy INT DEFAULT 0 NOT NULL,
  stats_json JSONB DEFAULT '{}'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on user_stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- User Stats Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users can insert their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users can update their own stats" ON public.user_stats;
END $$;

CREATE POLICY "Users can view their own stats" 
  ON public.user_stats FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats" 
  ON public.user_stats FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats" 
  ON public.user_stats FOR UPDATE 
  USING (auth.uid() = user_id);

-- User Stats updated_at trigger
DROP TRIGGER IF EXISTS on_user_stats_updated ON public.user_stats;
CREATE TRIGGER on_user_stats_updated
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. CARD EVALUATIONS TABLE
CREATE TABLE IF NOT EXISTS public.card_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_code TEXT NOT NULL,
  card_name TEXT NOT NULL,
  evaluation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_set_card UNIQUE(user_id, set_code, card_name)
);

-- Index for fast lookup by user and set
CREATE INDEX IF NOT EXISTS idx_card_evaluations_user_set 
  ON public.card_evaluations(user_id, set_code);

-- Enable RLS on card_evaluations
ALTER TABLE public.card_evaluations ENABLE ROW LEVEL SECURITY;

-- Card Evaluations Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can insert their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can update their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can delete their own evaluations" ON public.card_evaluations;
END $$;

CREATE POLICY "Users can view their own evaluations" 
  ON public.card_evaluations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evaluations" 
  ON public.card_evaluations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evaluations" 
  ON public.card_evaluations FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evaluations" 
  ON public.card_evaluations FOR DELETE 
  USING (auth.uid() = user_id);

-- Card Evaluations updated_at trigger
DROP TRIGGER IF EXISTS on_card_evaluations_updated ON public.card_evaluations;
CREATE TRIGGER on_card_evaluations_updated
  BEFORE UPDATE ON public.card_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. AUTOMATIC NEW USER INITIALIZATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name',
      split_part(NEW.email, '@', 1),
      'Drafter'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc'::text, now());

  -- Insert default user_stats
  INSERT INTO public.user_stats (user_id, xp, level, overall_accuracy, stats_json)
  VALUES (NEW.id, 0, 1, 0, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute upon auth.users INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. SEVENTEEN_LANDS_CACHE TABLE (UNIVERSAL TELEMETRY CACHE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.seventeen_lands_cache (
  set_code TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'PremierDraft',
  sample_size BIGINT DEFAULT 0 NOT NULL,
  card_count INT DEFAULT 0 NOT NULL,
  dataset JSONB NOT NULL,
  draft_status TEXT DEFAULT 'historical' NOT NULL, -- 'active', 'flashback', 'historical'
  is_frozen BOOLEAN DEFAULT FALSE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (set_code, format)
);

CREATE INDEX IF NOT EXISTS idx_seventeen_lands_cache_set_code 
  ON public.seventeen_lands_cache (set_code);

ALTER TABLE public.seventeen_lands_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can read 17lands cache" ON public.seventeen_lands_cache;
  DROP POLICY IF EXISTS "Admins and service roles can modify 17lands cache" ON public.seventeen_lands_cache;
END $$;

CREATE POLICY "Public can read 17lands cache"
  ON public.seventeen_lands_cache FOR SELECT
  USING (true);

CREATE POLICY "Admins and service roles can modify 17lands cache"
  ON public.seventeen_lands_cache FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS on_seventeen_lands_cache_updated ON public.seventeen_lands_cache;
CREATE TRIGGER on_seventeen_lands_cache_updated
  BEFORE UPDATE ON public.seventeen_lands_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

