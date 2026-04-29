CREATE TABLE public.dormitory_exit_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  registration_locked BOOLEAN NOT NULL DEFAULT false,
  lock_message TEXT NOT NULL DEFAULT 'Chức năng đăng ký ra KTX hiện đang tạm khoá. Vui lòng liên hệ quản trị.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dormitory_exit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view dorm exit settings"
ON public.dormitory_exit_settings FOR SELECT
USING (public.is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins manage dorm exit settings"
ON public.dormitory_exit_settings FOR ALL
USING (public.is_school_admin(auth.uid(), school_id) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_school_admin(auth.uid(), school_id) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_dormitory_exit_settings_updated_at
BEFORE UPDATE ON public.dormitory_exit_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();