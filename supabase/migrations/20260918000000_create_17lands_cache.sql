-- ==============================================================================
-- MTG LIMITED IQ: 17LANDS CENTRAL TELEMETRY CACHE TABLE & PUBLIC RLS
-- Run in Supabase SQL Editor or execute via automated migrations
-- ==============================================================================

-- 1. Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CREATE SEVENTEEN_LANDS_CACHE TABLE
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

-- Index for fast lookup by set_code
CREATE INDEX IF NOT EXISTS idx_seventeen_lands_cache_set_code 
  ON public.seventeen_lands_cache (set_code);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.seventeen_lands_cache ENABLE ROW LEVEL SECURITY;

-- 4. ROW LEVEL SECURITY POLICIES
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can read 17lands cache" ON public.seventeen_lands_cache;
  DROP POLICY IF EXISTS "Admins and service roles can modify 17lands cache" ON public.seventeen_lands_cache;
END $$;

-- Anonymous and authenticated users can freely read cached telemetry
CREATE POLICY "Public can read 17lands cache"
  ON public.seventeen_lands_cache FOR SELECT
  USING (true);

-- Upserts/updates are restricted to the service role or admin accounts
CREATE POLICY "Admins and service roles can modify 17lands cache"
  ON public.seventeen_lands_cache FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
    )
  );

-- 5. AUTOMATIC UPDATED_AT TRIGGER
DROP TRIGGER IF EXISTS on_seventeen_lands_cache_updated ON public.seventeen_lands_cache;
CREATE TRIGGER on_seventeen_lands_cache_updated
  BEFORE UPDATE ON public.seventeen_lands_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
