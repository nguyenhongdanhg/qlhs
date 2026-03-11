
CREATE TABLE public.kitchen_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX kitchen_suppliers_school_name_idx ON public.kitchen_suppliers(school_id, name);

ALTER TABLE public.kitchen_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view suppliers"
  ON public.kitchen_suppliers FOR SELECT
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage suppliers"
  ON public.kitchen_suppliers FOR ALL
  USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all suppliers"
  ON public.kitchen_suppliers FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Accountant role can manage suppliers"
  ON public.kitchen_suppliers FOR ALL
  USING (has_role_in_school(auth.uid(), school_id, 'accountant'))
  WITH CHECK (has_role_in_school(auth.uid(), school_id, 'accountant'));

CREATE POLICY "Kitchen role can manage suppliers"
  ON public.kitchen_suppliers FOR ALL
  USING (has_role_in_school(auth.uid(), school_id, 'kitchen'))
  WITH CHECK (has_role_in_school(auth.uid(), school_id, 'kitchen'));
