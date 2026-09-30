-- ==============================================================================
-- MTG LIMITED IQ: PRO CARD RATINGS & SET RELEASE SCHEDULES
-- Run via automated migrations or in Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CREATE PRO_CARD_RATINGS TABLE
CREATE TABLE IF NOT EXISTS public.pro_card_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_code TEXT NOT NULL,
  card_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'LSV',
  score NUMERIC(3, 1) NOT NULL,
  grade TEXT NOT NULL,
  verdict TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(set_code, card_name, source)
);

CREATE INDEX IF NOT EXISTS idx_pro_card_ratings_set_code 
  ON public.pro_card_ratings (set_code);

CREATE INDEX IF NOT EXISTS idx_pro_card_ratings_set_card 
  ON public.pro_card_ratings (set_code, card_name);

-- 3. CREATE SET_RELEASE_SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS public.set_release_schedules (
  set_code TEXT PRIMARY KEY,
  set_name TEXT NOT NULL,
  card_count INT DEFAULT 0 NOT NULL,
  released_at DATE NOT NULL,
  arena_released_at DATE NOT NULL,
  lsv_available_at DATE NOT NULL,
  seventeen_lands_available_at DATE NOT NULL,
  has_17lands_data BOOLEAN DEFAULT false NOT NULL,
  is_active_draft BOOLEAN DEFAULT false NOT NULL,
  is_flashback BOOLEAN DEFAULT false NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.pro_card_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_release_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can read pro card ratings" ON public.pro_card_ratings;
  DROP POLICY IF EXISTS "Admins can manage pro card ratings" ON public.pro_card_ratings;
  DROP POLICY IF EXISTS "Public can read set release schedules" ON public.set_release_schedules;
  DROP POLICY IF EXISTS "Admins can manage set release schedules" ON public.set_release_schedules;
END $$;

-- Public can read ratings & schedules
CREATE POLICY "Public can read pro card ratings"
  ON public.pro_card_ratings FOR SELECT
  USING (true);

CREATE POLICY "Public can read set release schedules"
  ON public.set_release_schedules FOR SELECT
  USING (true);

-- Admins and service role can insert, update, delete
CREATE POLICY "Admins can manage pro card ratings"
  ON public.pro_card_ratings FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage set release schedules"
  ON public.set_release_schedules FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
    )
  );

-- 5. AUTOMATIC UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS on_pro_card_ratings_updated ON public.pro_card_ratings;
CREATE TRIGGER on_pro_card_ratings_updated
  BEFORE UPDATE ON public.pro_card_ratings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_set_release_schedules_updated ON public.set_release_schedules;
CREATE TRIGGER on_set_release_schedules_updated
  BEFORE UPDATE ON public.set_release_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. SEED SET RELEASE SCHEDULES
INSERT INTO public.set_release_schedules (
  set_code, set_name, card_count, released_at, arena_released_at, lsv_available_at, seventeen_lands_available_at, has_17lands_data, is_active_draft
) VALUES
  ('TRK', 'Star Trek', 135, '2026-11-01', '2026-10-27', '2026-10-24', '2026-11-10', false, false),
  ('FRA', 'Reality Fracture', 290, '2026-10-02', '2026-09-29', '2026-09-25', '2026-10-13', false, false),
  ('HOB', 'The Hobbit', 321, '2026-08-14', '2026-08-11', '2026-08-07', '2026-08-25', true, true),
  ('MBC', 'Mystery Booster Commander Edition', 80, '2026-08-01', '2026-08-01', '2026-07-28', '2026-08-15', true, true),
  ('MSH', 'Marvel Super Heroes', 453, '2026-06-01', '2026-05-26', '2026-05-22', '2026-06-09', true, false),
  ('SOS', 'Secrets of Strixhaven', 368, '2026-04-24', '2026-04-21', '2026-04-17', '2026-05-05', true, false),
  ('TMT', 'Teenage Mutant Ninja Turtles', 320, '2026-03-01', '2026-02-24', '2026-02-20', '2026-03-10', true, false),
  ('ECL', 'Lorwyn Eclipsed', 408, '2026-01-01', '2025-12-30', '2025-12-26', '2026-01-13', true, false),
  ('TLA', 'Avatar: The Last Airbender', 394, '2025-11-01', '2025-10-28', '2025-10-24', '2025-11-11', true, false),
  ('SPM', 'Marvel''s Spider-Man', 286, '2025-09-26', '2025-09-23', '2025-09-19', '2025-10-07', false, false),
  ('EOE', 'Edge of Eternities', 400, '2025-08-01', '2025-07-29', '2025-07-25', '2025-08-12', true, false),
  ('FIN', 'Final Fantasy', 599, '2025-06-13', '2025-06-10', '2025-06-06', '2025-06-24', true, false),
  ('TDM', 'Tarkir: Dragonstorm', 427, '2025-04-11', '2025-04-08', '2025-04-04', '2025-04-22', true, false),
  ('DFT', 'Aetherdrift', 276, '2025-02-14', '2025-02-11', '2025-02-07', '2025-02-25', true, false)
ON CONFLICT (set_code) DO UPDATE
SET
  set_name = excluded.set_name,
  card_count = excluded.card_count,
  released_at = excluded.released_at,
  arena_released_at = excluded.arena_released_at,
  lsv_available_at = excluded.lsv_available_at,
  seventeen_lands_available_at = excluded.seventeen_lands_available_at,
  has_17lands_data = excluded.has_17lands_data,
  is_active_draft = excluded.is_active_draft,
  updated_at = timezone('utc'::text, now());
