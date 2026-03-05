
-- Weekly menu templates (thực đơn mẫu theo ngày trong tuần)
CREATE TABLE public.weekly_menu_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  dishes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, day_of_week, meal_type)
);

-- Menu assignments to specific dates (gán thực đơn cho ngày cụ thể)
CREATE TABLE public.menu_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  menu_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  dishes text NOT NULL DEFAULT '',
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, menu_date, meal_type)
);

-- Kitchen transactions (xuất nhập kho thực phẩm)
CREATE TABLE public.kitchen_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  transaction_type text NOT NULL DEFAULT 'import' CHECK (transaction_type IN ('import', 'export')),
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weekly_menu_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_transactions ENABLE ROW LEVEL SECURITY;

-- RLS for weekly_menu_templates
CREATE POLICY "School members can view menu templates" ON public.weekly_menu_templates FOR SELECT USING (is_school_member(auth.uid(), school_id));
CREATE POLICY "School admins can manage menu templates" ON public.weekly_menu_templates FOR ALL USING (is_school_admin(auth.uid(), school_id));
CREATE POLICY "Super admins can manage all menu templates" ON public.weekly_menu_templates FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Kitchen role can manage menu templates" ON public.weekly_menu_templates FOR ALL USING (has_role_in_school(auth.uid(), school_id, 'kitchen')) WITH CHECK (has_role_in_school(auth.uid(), school_id, 'kitchen'));
CREATE POLICY "Accountant role can manage menu templates" ON public.weekly_menu_templates FOR ALL USING (has_role_in_school(auth.uid(), school_id, 'accountant')) WITH CHECK (has_role_in_school(auth.uid(), school_id, 'accountant'));

-- RLS for menu_assignments
CREATE POLICY "School members can view menu assignments" ON public.menu_assignments FOR SELECT USING (is_school_member(auth.uid(), school_id));
CREATE POLICY "School admins can manage menu assignments" ON public.menu_assignments FOR ALL USING (is_school_admin(auth.uid(), school_id));
CREATE POLICY "Super admins can manage all menu assignments" ON public.menu_assignments FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Kitchen role can manage menu assignments" ON public.menu_assignments FOR ALL USING (has_role_in_school(auth.uid(), school_id, 'kitchen')) WITH CHECK (has_role_in_school(auth.uid(), school_id, 'kitchen'));
CREATE POLICY "Accountant role can manage menu assignments" ON public.menu_assignments FOR ALL USING (has_role_in_school(auth.uid(), school_id, 'accountant')) WITH CHECK (has_role_in_school(auth.uid(), school_id, 'accountant'));

-- RLS for kitchen_transactions
CREATE POLICY "School members can view kitchen transactions" ON public.kitchen_transactions FOR SELECT USING (is_school_member(auth.uid(), school_id));
CREATE POLICY "School admins can manage kitchen transactions" ON public.kitchen_transactions FOR ALL USING (is_school_admin(auth.uid(), school_id));
CREATE POLICY "Super admins can manage all kitchen transactions" ON public.kitchen_transactions FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Kitchen role can manage kitchen transactions" ON public.kitchen_transactions FOR ALL USING (has_role_in_school(auth.uid(), school_id, 'kitchen')) WITH CHECK (has_role_in_school(auth.uid(), school_id, 'kitchen'));
CREATE POLICY "Accountant role can manage kitchen transactions" ON public.kitchen_transactions FOR ALL USING (has_role_in_school(auth.uid(), school_id, 'accountant')) WITH CHECK (has_role_in_school(auth.uid(), school_id, 'accountant'));

-- Updated_at triggers
CREATE TRIGGER update_weekly_menu_templates_updated_at BEFORE UPDATE ON public.weekly_menu_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_assignments_updated_at BEFORE UPDATE ON public.menu_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kitchen_transactions_updated_at BEFORE UPDATE ON public.kitchen_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
