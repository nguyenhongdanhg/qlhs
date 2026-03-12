
CREATE OR REPLACE FUNCTION public.calculate_rice_stats(
  p_school_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(stat_date date, rice numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH latest_records AS (
    -- Get the latest record per student per date per meal type (lunch/dinner)
    -- Using DISTINCT ON to pick the most recent created_at per (student, date, type)
    SELECT DISTINCT ON (student_id, attendance_date, attendance_type)
      attendance_date,
      attendance_type,
      status
    FROM attendance_records
    WHERE school_id = p_school_id
      AND attendance_type IN ('lunch', 'dinner')
      AND attendance_date >= p_start_date
      AND attendance_date <= p_end_date
    ORDER BY student_id, attendance_date, attendance_type, created_at DESC
  ),
  daily_present AS (
    SELECT 
      attendance_date,
      COUNT(*) FILTER (WHERE status = 'present') AS present_count
    FROM latest_records
    GROUP BY attendance_date
  )
  SELECT 
    d.dt::date AS stat_date,
    COALESCE(dp.present_count * 0.2, 0)::numeric AS rice
  FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS d(dt)
  LEFT JOIN daily_present dp ON dp.attendance_date = d.dt::date
  ORDER BY d.dt;
$$;
