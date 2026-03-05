
-- Master food items table for both dishes and ingredients
CREATE TABLE public.food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'dish',
  unit text NOT NULL DEFAULT '',
  default_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, name, category)
);

ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "School members can view food items"
  ON public.food_items FOR SELECT
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage food items"
  ON public.food_items FOR ALL
  USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all food items"
  ON public.food_items FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Kitchen role can manage food items"
  ON public.food_items FOR ALL
  USING (has_role_in_school(auth.uid(), school_id, 'kitchen'))
  WITH CHECK (has_role_in_school(auth.uid(), school_id, 'kitchen'));

CREATE POLICY "Accountant role can manage food items"
  ON public.food_items FOR ALL
  USING (has_role_in_school(auth.uid(), school_id, 'accountant'))
  WITH CHECK (has_role_in_school(auth.uid(), school_id, 'accountant'));
