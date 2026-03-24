
-- Duty settings table for configurable limits
CREATE TABLE public.duty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  max_per_day integer NOT NULL DEFAULT 3,
  max_per_person integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(school_id)
);

ALTER TABLE public.duty_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view duty settings"
  ON public.duty_settings FOR SELECT
  TO authenticated
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage duty settings"
  ON public.duty_settings FOR ALL
  TO authenticated
  USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all duty settings"
  ON public.duty_settings FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users with duty permission can manage duty settings"
  ON public.duty_settings FOR ALL
  TO authenticated
  USING (has_duty_permission(auth.uid(), school_id))
  WITH CHECK (has_duty_permission(auth.uid(), school_id));

-- Duty leaders table for leadership duty assignments
CREATE TABLE public.duty_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duty_date date NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(school_id, duty_date)
);

ALTER TABLE public.duty_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view duty leaders"
  ON public.duty_leaders FOR SELECT
  TO authenticated
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage duty leaders"
  ON public.duty_leaders FOR ALL
  TO authenticated
  USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all duty leaders"
  ON public.duty_leaders FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users with duty permission can manage duty leaders"
  ON public.duty_leaders FOR ALL
  TO authenticated
  USING (has_duty_permission(auth.uid(), school_id))
  WITH CHECK (has_duty_permission(auth.uid(), school_id));
