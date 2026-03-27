
-- Duty Groups table
CREATE TABLE public.duty_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Duty Group Members table
CREATE TABLE public.duty_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.duty_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Duty Shifts table
CREATE TABLE public.duty_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '06:00',
  end_time TEXT NOT NULL DEFAULT '18:00',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add shift_id and group_id to duty_schedules for optional linking
ALTER TABLE public.duty_schedules 
  ADD COLUMN shift_id UUID REFERENCES public.duty_shifts(id) ON DELETE SET NULL,
  ADD COLUMN group_id UUID REFERENCES public.duty_groups(id) ON DELETE SET NULL;

-- RLS for duty_groups
ALTER TABLE public.duty_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view duty groups" ON public.duty_groups
  FOR SELECT USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage duty groups" ON public.duty_groups
  FOR ALL USING (is_school_admin(auth.uid(), school_id))
  WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all duty groups" ON public.duty_groups
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users with duty permission can manage duty groups" ON public.duty_groups
  FOR ALL USING (has_duty_permission(auth.uid(), school_id))
  WITH CHECK (has_duty_permission(auth.uid(), school_id));

-- RLS for duty_group_members
ALTER TABLE public.duty_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view duty group members" ON public.duty_group_members
  FOR SELECT USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage duty group members" ON public.duty_group_members
  FOR ALL USING (is_school_admin(auth.uid(), school_id))
  WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all duty group members" ON public.duty_group_members
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users with duty permission can manage duty group members" ON public.duty_group_members
  FOR ALL USING (has_duty_permission(auth.uid(), school_id))
  WITH CHECK (has_duty_permission(auth.uid(), school_id));

-- RLS for duty_shifts
ALTER TABLE public.duty_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view duty shifts" ON public.duty_shifts
  FOR SELECT USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage duty shifts" ON public.duty_shifts
  FOR ALL USING (is_school_admin(auth.uid(), school_id))
  WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all duty shifts" ON public.duty_shifts
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users with duty permission can manage duty shifts" ON public.duty_shifts
  FOR ALL USING (has_duty_permission(auth.uid(), school_id))
  WITH CHECK (has_duty_permission(auth.uid(), school_id));
