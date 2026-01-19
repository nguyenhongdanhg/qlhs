
-- =====================================================
-- MULTI-TENANT BOARDING SCHOOL MANAGEMENT SYSTEM
-- =====================================================

-- E1) ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'teacher', 'class_teacher', 'accountant', 'kitchen');
CREATE TYPE public.membership_status AS ENUM ('active', 'suspended');
CREATE TYPE public.attendance_type AS ENUM ('evening_study', 'boarding', 'breakfast', 'lunch', 'dinner');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE public.gender AS ENUM ('male', 'female');

-- =====================================================
-- E2) CORE TABLES
-- =====================================================

-- 1) SCHOOLS - Trường học
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) PROFILES - Hồ sơ người dùng (global)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3) GLOBAL_ROLES - Super Admin (system-wide roles)
CREATE TABLE public.global_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'super_admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4) SCHOOL_MEMBERSHIPS - User thuộc trường nào với role gì
CREATE TABLE public.school_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  status membership_status DEFAULT 'active',
  class_id TEXT, -- Nếu là GVCN, ghi nhận class phụ trách
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, user_id)
);

-- 5) SCHOOL_FEATURES - Bật/tắt tính năng theo trường
CREATE TABLE public.school_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, feature_code)
);

-- 6) CLASSES - Lớp học trong trường
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  school_year TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, name, school_year)
);

-- 7) STUDENTS - Học sinh
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  student_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender gender,
  date_of_birth DATE,
  phone TEXT,
  parent_phone TEXT,
  address TEXT,
  is_boarding BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, student_code)
);

-- 8) ATTENDANCE_RECORDS - Điểm danh
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL,
  attendance_type attendance_type NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  reporter_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9) DUTY_SCHEDULES - Lịch trực
CREATE TABLE public.duty_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duty_date DATE NOT NULL,
  shift TEXT, -- 'morning', 'afternoon', 'evening', 'night'
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10) PERMISSION_GROUPS - Nhóm quyền
CREATE TABLE public.permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, name)
);

-- 11) PERMISSION_GROUP_PERMISSIONS - Quyền trong nhóm
CREATE TABLE public.permission_group_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  UNIQUE(group_id, feature_code)
);

-- 12) USER_PERMISSION_GROUPS - Gán user vào nhóm quyền
CREATE TABLE public.user_permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, user_id, group_id)
);

-- 13) USER_PERMISSIONS - Quyền lẻ cho user
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  UNIQUE(school_id, user_id, feature_code)
);

-- 14) APP_FEATURES - Danh sách tính năng (global)
CREATE TABLE public.app_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 15) LOGIN_HISTORY - Lịch sử đăng nhập
CREATE TABLE public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  login_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT true
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_school_memberships_user ON public.school_memberships(user_id);
CREATE INDEX idx_school_memberships_school ON public.school_memberships(school_id);
CREATE INDEX idx_students_school_class ON public.students(school_id, class_id);
CREATE INDEX idx_attendance_school_date ON public.attendance_records(school_id, attendance_date);
CREATE INDEX idx_attendance_student ON public.attendance_records(student_id);
CREATE INDEX idx_duty_school_date ON public.duty_schedules(school_id, duty_date);
CREATE INDEX idx_classes_school ON public.classes(school_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.global_roles
    WHERE user_id = uid AND role = 'super_admin'
  )
$$;

-- Check if user has role in school
CREATE OR REPLACE FUNCTION public.has_role_in_school(uid UUID, sid UUID, r app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = uid AND school_id = sid AND role = r AND status = 'active'
  )
$$;

-- Check if user is member of school
CREATE OR REPLACE FUNCTION public.is_school_member(uid UUID, sid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = uid AND school_id = sid AND status = 'active'
  )
$$;

-- Check if user is admin of school
CREATE OR REPLACE FUNCTION public.is_school_admin(uid UUID, sid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = uid AND school_id = sid AND role = 'admin' AND status = 'active'
  )
$$;

-- Check if user is class teacher
CREATE OR REPLACE FUNCTION public.is_class_teacher(uid UUID, sid UUID, cid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE user_id = uid AND school_id = sid AND role = 'class_teacher' AND class_id = cid AND status = 'active'
  )
$$;

-- Get user's class in school (for class teachers)
CREATE OR REPLACE FUNCTION public.get_teacher_class(uid UUID, sid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT class_id FROM public.school_memberships
  WHERE user_id = uid AND school_id = sid AND role = 'class_teacher' AND status = 'active'
  LIMIT 1
$$;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_school_memberships_updated_at BEFORE UPDATE ON public.school_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_duty_schedules_updated_at BEFORE UPDATE ON public.duty_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_permission_groups_updated_at BEFORE UPDATE ON public.permission_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- SCHOOLS policies
CREATE POLICY "Super admins can do everything with schools"
  ON public.schools FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School members can view their school"
  ON public.schools FOR SELECT
  USING (public.is_school_member(auth.uid(), id));

-- PROFILES policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- GLOBAL_ROLES policies
CREATE POLICY "Super admins can manage global roles"
  ON public.global_roles FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view own global role"
  ON public.global_roles FOR SELECT
  USING (user_id = auth.uid());

-- SCHOOL_MEMBERSHIPS policies
CREATE POLICY "Super admins can manage all memberships"
  ON public.school_memberships FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage memberships in their school"
  ON public.school_memberships FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "Users can view own memberships"
  ON public.school_memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view memberships in their school"
  ON public.school_memberships FOR SELECT
  USING (public.is_school_member(auth.uid(), school_id));

-- SCHOOL_FEATURES policies
CREATE POLICY "Super admins can manage all features"
  ON public.school_features FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage features in their school"
  ON public.school_features FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School members can view features"
  ON public.school_features FOR SELECT
  USING (public.is_school_member(auth.uid(), school_id));

-- CLASSES policies
CREATE POLICY "Super admins can manage all classes"
  ON public.classes FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage classes"
  ON public.classes FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School members can view classes"
  ON public.classes FOR SELECT
  USING (public.is_school_member(auth.uid(), school_id));

-- STUDENTS policies
CREATE POLICY "Super admins can manage all students"
  ON public.students FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage students"
  ON public.students FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School members can view students"
  ON public.students FOR SELECT
  USING (public.is_school_member(auth.uid(), school_id));

CREATE POLICY "Teachers can manage students in their class"
  ON public.students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.school_memberships m
      JOIN public.classes c ON c.school_id = m.school_id
      WHERE m.user_id = auth.uid()
        AND m.school_id = students.school_id
        AND m.role = 'class_teacher'
        AND c.id = students.class_id
        AND c.name = m.class_id
        AND m.status = 'active'
    )
  );

-- ATTENDANCE_RECORDS policies
CREATE POLICY "Super admins can manage all attendance"
  ON public.attendance_records FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage attendance"
  ON public.attendance_records FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School members can view attendance"
  ON public.attendance_records FOR SELECT
  USING (public.is_school_member(auth.uid(), school_id));

CREATE POLICY "Members can create attendance reports"
  ON public.attendance_records FOR INSERT
  WITH CHECK (
    public.is_school_member(auth.uid(), school_id)
    AND reporter_id = auth.uid()
  );

CREATE POLICY "Reporters can update own attendance records"
  ON public.attendance_records FOR UPDATE
  USING (reporter_id = auth.uid());

-- DUTY_SCHEDULES policies
CREATE POLICY "Super admins can manage all duty schedules"
  ON public.duty_schedules FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage duty schedules"
  ON public.duty_schedules FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School members can view duty schedules"
  ON public.duty_schedules FOR SELECT
  USING (public.is_school_member(auth.uid(), school_id));

-- PERMISSION_GROUPS policies
CREATE POLICY "Super admins can manage all permission groups"
  ON public.permission_groups FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage permission groups"
  ON public.permission_groups FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School members can view permission groups"
  ON public.permission_groups FOR SELECT
  USING (public.is_school_member(auth.uid(), school_id));

-- PERMISSION_GROUP_PERMISSIONS policies
CREATE POLICY "Super admins can manage all group permissions"
  ON public.permission_group_permissions FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage group permissions"
  ON public.permission_group_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.permission_groups pg
      WHERE pg.id = permission_group_permissions.group_id
        AND public.is_school_admin(auth.uid(), pg.school_id)
    )
  );

CREATE POLICY "School members can view group permissions"
  ON public.permission_group_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.permission_groups pg
      WHERE pg.id = permission_group_permissions.group_id
        AND public.is_school_member(auth.uid(), pg.school_id)
    )
  );

-- USER_PERMISSION_GROUPS policies
CREATE POLICY "Super admins can manage all user permission groups"
  ON public.user_permission_groups FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage user permission groups"
  ON public.user_permission_groups FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "Users can view own permission groups"
  ON public.user_permission_groups FOR SELECT
  USING (user_id = auth.uid());

-- USER_PERMISSIONS policies
CREATE POLICY "Super admins can manage all user permissions"
  ON public.user_permissions FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage user permissions"
  ON public.user_permissions FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT
  USING (user_id = auth.uid());

-- APP_FEATURES policies
CREATE POLICY "Everyone can view app features"
  ON public.app_features FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage app features"
  ON public.app_features FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- LOGIN_HISTORY policies
CREATE POLICY "Users can view own login history"
  ON public.login_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own login history"
  ON public.login_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can view all login history"
  ON public.login_history FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert default app features
INSERT INTO public.app_features (code, label, description, icon_name, display_order) VALUES
  ('dashboard', 'Tổng quan', 'Bảng điều khiển tổng quan', 'LayoutDashboard', 1),
  ('students', 'Học sinh', 'Quản lý học sinh', 'Users', 2),
  ('evening_study', 'Tự học tối', 'Điểm danh tự học tối', 'Moon', 3),
  ('boarding', 'Nội trú', 'Điểm danh nội trú', 'Home', 4),
  ('meals', 'Bữa ăn', 'Điểm danh bữa ăn', 'UtensilsCrossed', 5),
  ('statistics', 'Thống kê', 'Thống kê và báo cáo', 'BarChart3', 6),
  ('duty_schedule', 'Lịch trực', 'Quản lý lịch trực', 'CalendarDays', 7),
  ('user_management', 'Người dùng', 'Quản lý người dùng', 'UserCog', 8),
  ('settings', 'Cài đặt', 'Cài đặt hệ thống', 'Settings', 9);
