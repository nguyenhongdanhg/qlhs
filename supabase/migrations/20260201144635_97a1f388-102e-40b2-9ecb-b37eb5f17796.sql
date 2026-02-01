-- Create table for Google Sheets sync configuration per school
CREATE TABLE public.sheets_sync_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  service_account_email TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_meal_attendance BOOLEAN NOT NULL DEFAULT true,
  sync_evening_study BOOLEAN NOT NULL DEFAULT true,
  sync_boarding BOOLEAN NOT NULL DEFAULT true,
  sync_emulation BOOLEAN NOT NULL DEFAULT true,
  meal_sheet_name TEXT DEFAULT 'Điểm danh bữa ăn',
  evening_study_sheet_name TEXT DEFAULT 'Tự học tối',
  boarding_sheet_name TEXT DEFAULT 'Nội trú',
  emulation_sheet_name TEXT DEFAULT 'Thi đua',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id)
);

-- Enable RLS
ALTER TABLE public.sheets_sync_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "School admins can manage sheets config"
ON public.sheets_sync_config
FOR ALL
USING (is_school_admin(auth.uid(), school_id))
WITH CHECK (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all sheets config"
ON public.sheets_sync_config
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "School members can view sheets config"
ON public.sheets_sync_config
FOR SELECT
USING (is_school_member(auth.uid(), school_id));

-- Trigger for updated_at
CREATE TRIGGER update_sheets_sync_config_updated_at
BEFORE UPDATE ON public.sheets_sync_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();