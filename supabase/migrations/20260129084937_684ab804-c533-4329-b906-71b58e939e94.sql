-- Create table for week date ranges
CREATE TABLE public.week_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year text NOT NULL,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 35),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(school_id, school_year, week_number)
);

-- Enable RLS
ALTER TABLE public.week_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "School members can view week settings"
ON public.week_settings
FOR SELECT
USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage week settings"
ON public.week_settings
FOR ALL
USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all week settings"
ON public.week_settings
FOR ALL
USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_week_settings_updated_at
BEFORE UPDATE ON public.week_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();