-- ==============================================================================
-- MTG LIMITED IQ: ARCHETYPE EVALUATIONS TABLE & ADMIN RLS POLICIES
-- Run this in your Supabase Dashboard -> SQL Editor (irxgoelllogcyoiumxup)
-- Enables cloud syncing for archetype & color ratings and admin inspection.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.archetype_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_code TEXT NOT NULL,
  archetype_code TEXT NOT NULL,
  evaluation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_set_archetype UNIQUE(user_id, set_code, archetype_code)
);

-- Index for fast lookups by user and set
CREATE INDEX IF NOT EXISTS idx_archetype_evaluations_user_set 
  ON public.archetype_evaluations(user_id, set_code);

-- Enable Row Level Security
ALTER TABLE public.archetype_evaluations ENABLE ROW LEVEL SECURITY;

-- Drop any previous policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own archetype evaluations" ON public.archetype_evaluations;
  DROP POLICY IF EXISTS "Users can insert their own archetype evaluations" ON public.archetype_evaluations;
  DROP POLICY IF EXISTS "Users can update their own archetype evaluations" ON public.archetype_evaluations;
  DROP POLICY IF EXISTS "Users can delete their own archetype evaluations" ON public.archetype_evaluations;
  DROP POLICY IF EXISTS "Admins or owners can view archetype evaluations" ON public.archetype_evaluations;
END $$;

-- 1. Users can manage their own archetype evaluations
CREATE POLICY "Users can view their own archetype evaluations"
  ON public.archetype_evaluations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own archetype evaluations"
  ON public.archetype_evaluations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own archetype evaluations"
  ON public.archetype_evaluations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own archetype evaluations"
  ON public.archetype_evaluations FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Admins can view all archetype evaluations
CREATE POLICY "Admins or owners can view archetype evaluations"
  ON public.archetype_evaluations FOR SELECT
  USING (public.is_admin() = true);

-- Updated_at trigger
DROP TRIGGER IF EXISTS on_archetype_evaluations_updated ON public.archetype_evaluations;
CREATE TRIGGER on_archetype_evaluations_updated
  BEFORE UPDATE ON public.archetype_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. SECURITY DEFINER RPC: get_admin_user_archetype_evaluations(target_user_id UUID)
CREATE OR REPLACE FUNCTION public.get_admin_user_archetype_evaluations(target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  set_code TEXT,
  archetype_code TEXT,
  evaluation_json JSONB,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    ae.user_id,
    ae.set_code,
    ae.archetype_code,
    ae.evaluation_json,
    ae.updated_at
  FROM public.archetype_evaluations ae
  WHERE ae.user_id = target_user_id
  ORDER BY ae.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
