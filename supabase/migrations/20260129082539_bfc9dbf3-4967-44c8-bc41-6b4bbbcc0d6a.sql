-- Create emulation_scores table for weekly competition scores
CREATE TABLE public.emulation_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 35),
  school_year TEXT NOT NULL,
  academic_score NUMERIC(4,2) DEFAULT 0 CHECK (academic_score >= 0 AND academic_score <= 10),
  discipline_score NUMERIC(4,2) DEFAULT 0 CHECK (discipline_score >= 0 AND discipline_score <= 10),
  boarding_score NUMERIC(4,2) DEFAULT 0 CHECK (boarding_score >= 0 AND boarding_score <= 10),
  reporter_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, class_id, week_number, school_year)
);

-- Enable RLS
ALTER TABLE public.emulation_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "School members can view emulation scores"
ON public.emulation_scores
FOR SELECT
USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage emulation scores"
ON public.emulation_scores
FOR ALL
USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all emulation scores"
ON public.emulation_scores
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_emulation_scores_updated_at
BEFORE UPDATE ON public.emulation_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add emulation feature to app_features
INSERT INTO public.app_features (code, label, description, icon_name, display_order, is_active)
VALUES ('emulation', 'Thi đua', 'Quản lý điểm thi đua các lớp theo tuần', 'Trophy', 7, true)
ON CONFLICT (code) DO NOTHING;