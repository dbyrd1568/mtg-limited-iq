-- ==============================================================================
-- MTG LIMITED IQ: SET ARCHETYPES TABLE & PUBLIC RLS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.set_archetypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_code TEXT NOT NULL,
  color_pair TEXT NOT NULL, -- 'WU', 'UB', etc.
  name TEXT NOT NULL,
  guild_name TEXT,
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  mechanics JSONB NOT NULL DEFAULT '[]'::jsonb,
  pace TEXT DEFAULT 'Midrange',
  draft_pointers JSONB DEFAULT '[]'::jsonb,
  key_commons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (set_code, color_pair)
);

CREATE INDEX IF NOT EXISTS idx_set_archetypes_set_code ON public.set_archetypes(set_code);
CREATE INDEX IF NOT EXISTS idx_set_archetypes_set_pair ON public.set_archetypes(set_code, color_pair);

ALTER TABLE public.set_archetypes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can read set archetypes" ON public.set_archetypes;
  DROP POLICY IF EXISTS "Admins and service roles can modify set archetypes" ON public.set_archetypes;
END $$;

CREATE POLICY "Public can read set archetypes"
  ON public.set_archetypes FOR SELECT
  USING (true);

CREATE POLICY "Admins and service roles can modify set archetypes"
  ON public.set_archetypes FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS on_set_archetypes_updated ON public.set_archetypes;
CREATE TRIGGER on_set_archetypes_updated
  BEFORE UPDATE ON public.set_archetypes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
