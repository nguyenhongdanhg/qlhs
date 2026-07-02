
-- =====================================================
-- GIAI ĐOẠN 1: Nền tảng năm học (academic years)
-- =====================================================

-- Enum trạng thái năm học
DO $$ BEGIN
  CREATE TYPE public.academic_year_status AS ENUM ('open', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Bảng academic_years
CREATE TABLE public.academic_years (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- VD: "2025-2026"
  start_date DATE,
  end_date DATE,
  status public.academic_year_status NOT NULL DEFAULT 'open',
  is_active BOOLEAN NOT NULL DEFAULT false,    -- năm mặc định của trường
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_name_per_school UNIQUE (school_id, name)
);

-- Chỉ 1 năm active mỗi trường
CREATE UNIQUE INDEX academic_years_one_active_per_school
  ON public.academic_years(school_id)
  WHERE is_active = true;

CREATE INDEX academic_years_school_status_idx
  ON public.academic_years(school_id, status);

-- 2. GRANTS
GRANT SELECT, INSERT, UPDATE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;

-- 3. Enable RLS
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Mọi thành viên trường xem được
CREATE POLICY "Members can view academic years"
  ON public.academic_years FOR SELECT
  TO authenticated
  USING (
    public.is_school_member(auth.uid(), school_id)
    OR public.is_super_admin(auth.uid())
  );

-- Chỉ admin/super_admin tạo
CREATE POLICY "Admins can create academic years"
  ON public.academic_years FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_school_admin(auth.uid(), school_id)
    OR public.is_super_admin(auth.uid())
  );

-- Chỉ admin/super_admin sửa
CREATE POLICY "Admins can update academic years"
  ON public.academic_years FOR UPDATE
  TO authenticated
  USING (
    public.is_school_admin(auth.uid(), school_id)
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    public.is_school_admin(auth.uid(), school_id)
    OR public.is_super_admin(auth.uid())
  );

-- Không có DELETE policy → không ai xoá được

-- 5. Trigger updated_at
CREATE TRIGGER academic_years_updated_at
  BEFORE UPDATE ON public.academic_years
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Hàm: lấy năm active của trường
CREATE OR REPLACE FUNCTION public.current_academic_year_id(sid UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.academic_years
  WHERE school_id = sid AND is_active = true
  LIMIT 1
$$;

-- 7. Hàm: đặt năm active (đảm bảo chỉ 1 năm active/trường)
CREATE OR REPLACE FUNCTION public.set_active_academic_year(year_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_school UUID;
BEGIN
  SELECT school_id INTO target_school
  FROM public.academic_years WHERE id = year_id;

  IF target_school IS NULL THEN
    RAISE EXCEPTION 'Academic year not found';
  END IF;

  -- Chỉ admin trường hoặc super_admin
  IF NOT (public.is_school_admin(auth.uid(), target_school)
          OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Không có quyền đặt năm học mặc định';
  END IF;

  -- Bỏ active tất cả năm khác của trường
  UPDATE public.academic_years
     SET is_active = false
   WHERE school_id = target_school AND id <> year_id AND is_active = true;

  -- Đặt active năm được chọn, đồng thời mở lại nếu đã đóng
  UPDATE public.academic_years
     SET is_active = true,
         status = CASE WHEN status = 'archived' THEN 'open' ELSE status END
   WHERE id = year_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_academic_year_id(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_active_academic_year(UUID) TO authenticated;
