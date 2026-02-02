-- Create health treatment type enum
CREATE TYPE public.health_treatment_type AS ENUM ('medicine', 'first_aid', 'hospital');

-- Create medicines table for inventory management
CREATE TABLE public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'viên', -- viên, gói, lọ, tuýp, etc.
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create medicine transactions table for tracking input/output
CREATE TABLE public.medicine_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('import', 'export')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create health records table
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis TEXT NOT NULL,
  treatment_type health_treatment_type NOT NULL,
  -- For hospital cases
  hospital_name TEXT,
  hospital_date DATE,
  discharge_date DATE,
  hospital_result TEXT,
  -- Parent contact tracking
  parent_contacted BOOLEAN DEFAULT false,
  parent_contact_notes TEXT,
  -- General
  notes TEXT,
  reporter_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create health record medicines junction table (for dispensed medicines)
CREATE TABLE public.health_record_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_record_id UUID NOT NULL REFERENCES public.health_records(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_medicines_school_id ON public.medicines(school_id);
CREATE INDEX idx_medicine_transactions_school_id ON public.medicine_transactions(school_id);
CREATE INDEX idx_medicine_transactions_medicine_id ON public.medicine_transactions(medicine_id);
CREATE INDEX idx_health_records_school_id ON public.health_records(school_id);
CREATE INDEX idx_health_records_student_id ON public.health_records(student_id);
CREATE INDEX idx_health_records_record_date ON public.health_records(record_date);
CREATE INDEX idx_health_record_medicines_health_record_id ON public.health_record_medicines(health_record_id);

-- Enable RLS
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_record_medicines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medicines table
CREATE POLICY "School members can view medicines"
  ON public.medicines FOR SELECT
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage medicines"
  ON public.medicines FOR ALL
  USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all medicines"
  ON public.medicines FOR ALL
  USING (is_super_admin(auth.uid()));

-- RLS Policies for medicine_transactions
CREATE POLICY "School members can view medicine transactions"
  ON public.medicine_transactions FOR SELECT
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage medicine transactions"
  ON public.medicine_transactions FOR ALL
  USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all medicine transactions"
  ON public.medicine_transactions FOR ALL
  USING (is_super_admin(auth.uid()));

-- RLS Policies for health_records
CREATE POLICY "School members can view health records"
  ON public.health_records FOR SELECT
  USING (is_school_member(auth.uid(), school_id));

CREATE POLICY "School admins can manage health records"
  ON public.health_records FOR ALL
  USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Super admins can manage all health records"
  ON public.health_records FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Members can create health records"
  ON public.health_records FOR INSERT
  WITH CHECK (is_school_member(auth.uid(), school_id) AND reporter_id = auth.uid());

CREATE POLICY "Reporters can update own health records"
  ON public.health_records FOR UPDATE
  USING (reporter_id = auth.uid());

-- RLS Policies for health_record_medicines
CREATE POLICY "School members can view health record medicines"
  ON public.health_record_medicines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.health_records hr
    WHERE hr.id = health_record_medicines.health_record_id
    AND is_school_member(auth.uid(), hr.school_id)
  ));

CREATE POLICY "School admins can manage health record medicines"
  ON public.health_record_medicines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.health_records hr
    WHERE hr.id = health_record_medicines.health_record_id
    AND is_school_admin(auth.uid(), hr.school_id)
  ));

CREATE POLICY "Super admins can manage all health record medicines"
  ON public.health_record_medicines FOR ALL
  USING (is_super_admin(auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_medicines_updated_at
  BEFORE UPDATE ON public.medicines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_health_records_updated_at
  BEFORE UPDATE ON public.health_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add health feature to app_features
INSERT INTO public.app_features (code, label, description, icon_name, display_order, is_active)
VALUES ('health', 'Sức khỏe', 'Quản lý sức khỏe học sinh', 'Heart', 6, true)
ON CONFLICT DO NOTHING;