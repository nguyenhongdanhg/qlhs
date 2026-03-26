
-- Add custom_scores JSONB column to emulation_scores for dynamic column values
ALTER TABLE public.emulation_scores 
ADD COLUMN IF NOT EXISTS custom_scores jsonb DEFAULT '{}'::jsonb;

-- Create formula config table for storing formula type per school
CREATE TABLE IF NOT EXISTS public.emulation_formula_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  formula_type text NOT NULL DEFAULT 'weighted_average',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id)
);

-- Enable RLS
ALTER TABLE public.emulation_formula_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "School members can view formula config"
  ON public.emulation_formula_config FOR SELECT
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage formula config"
  ON public.emulation_formula_config FOR ALL
  USING (is_school_admin(auth.uid(), school_id))
  WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all formula config"
  ON public.emulation_formula_config FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users with emulation permission can manage formula config"
  ON public.emulation_formula_config FOR ALL
  USING (has_emulation_permission(auth.uid(), school_id))
  WITH CHECK (has_emulation_permission(auth.uid(), school_id));
