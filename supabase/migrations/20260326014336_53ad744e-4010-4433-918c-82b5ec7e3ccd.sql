
CREATE TABLE public.emulation_formula_columns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  column_name text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.emulation_formula_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view formula columns"
  ON public.emulation_formula_columns
  FOR SELECT
  TO public
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage formula columns"
  ON public.emulation_formula_columns
  FOR ALL
  TO public
  USING (is_school_admin(auth.uid(), school_id))
  WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all formula columns"
  ON public.emulation_formula_columns
  FOR ALL
  TO public
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users with emulation permission can manage formula columns"
  ON public.emulation_formula_columns
  FOR ALL
  TO public
  USING (has_emulation_permission(auth.uid(), school_id))
  WITH CHECK (has_emulation_permission(auth.uid(), school_id));
