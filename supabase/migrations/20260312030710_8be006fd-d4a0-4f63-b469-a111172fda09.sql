
-- Index cho bảng attendance_records (bảng lớn nhất)
CREATE INDEX IF NOT EXISTS idx_attendance_records_school_date_type 
  ON public.attendance_records (school_id, attendance_date, attendance_type);

CREATE INDEX IF NOT EXISTS idx_attendance_records_school_student_date 
  ON public.attendance_records (school_id, student_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_reporter_date 
  ON public.attendance_records (reporter_id, attendance_date);

-- Index cho bảng students
CREATE INDEX IF NOT EXISTS idx_students_school_class_active 
  ON public.students (school_id, class_id, is_active);

-- Index cho bảng emulation_scores
CREATE INDEX IF NOT EXISTS idx_emulation_scores_school_year_week 
  ON public.emulation_scores (school_id, school_year, week_number);

-- Index cho bảng health_records
CREATE INDEX IF NOT EXISTS idx_health_records_school_date 
  ON public.health_records (school_id, record_date);

-- Index cho bảng kitchen_transactions
CREATE INDEX IF NOT EXISTS idx_kitchen_transactions_school_date 
  ON public.kitchen_transactions (school_id, transaction_date);

-- Index cho bảng duty_schedules
CREATE INDEX IF NOT EXISTS idx_duty_schedules_school_date 
  ON public.duty_schedules (school_id, duty_date);

-- Index cho bảng dormitory_exit_requests
CREATE INDEX IF NOT EXISTS idx_dormitory_exit_school_date_status 
  ON public.dormitory_exit_requests (school_id, request_date, status);

-- Index cho bảng school_memberships (dùng nhiều trong RLS)
CREATE INDEX IF NOT EXISTS idx_school_memberships_user_school_status 
  ON public.school_memberships (user_id, school_id, status);
