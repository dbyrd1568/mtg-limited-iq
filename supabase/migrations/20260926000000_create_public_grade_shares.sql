-- ==============================================================================
-- MTG LIMITED IQ: PUBLIC GRADE SHARES TABLE & RLS POLICIES
-- Enables users to share a read-only, stripped-down snapshot of card grades
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.public_grade_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_code TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous Drafter',
  title TEXT,
  include_notes BOOLEAN NOT NULL DEFAULT true,
  grades_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  archetype_grades_json JSONB DEFAULT '{}'::jsonb,
  summary_json JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_grade_shares_id_active 
  ON public.public_grade_shares(id) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_grade_shares_user_set 
  ON public.public_grade_shares(user_id, set_code);

-- Enable Row Level Security
ALTER TABLE public.public_grade_shares ENABLE ROW LEVEL SECURITY;

-- 1. Public can read active shares by id
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can view active grade shares by id" ON public.public_grade_shares;
  DROP POLICY IF EXISTS "Users can create their own grade shares" ON public.public_grade_shares;
  DROP POLICY IF EXISTS "Users can update their own grade shares" ON public.public_grade_shares;
  DROP POLICY IF EXISTS "Users can delete their own grade shares" ON public.public_grade_shares;
END $$;

CREATE POLICY "Public can view active grade shares by id"
  ON public.public_grade_shares FOR SELECT
  USING (is_active = true);

-- 2. Authenticated users can insert their own shares
CREATE POLICY "Users can create their own grade shares"
  ON public.public_grade_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Authenticated users can update their own shares
CREATE POLICY "Users can update their own grade shares"
  ON public.public_grade_shares FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Authenticated users can delete their own shares
CREATE POLICY "Users can delete their own grade shares"
  ON public.public_grade_shares FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS on_public_grade_shares_updated ON public.public_grade_shares;
CREATE TRIGGER on_public_grade_shares_updated
  BEFORE UPDATE ON public.public_grade_shares
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
