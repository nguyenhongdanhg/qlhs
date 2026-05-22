import { supabase } from '@/integrations/supabase/client';

/**
 * Trả về Set các student_id đang bị ẩn khỏi điểm danh tại ngày `date` (yyyy-MM-dd)
 * Áp dụng cho mọi loại điểm danh (nội trú, bữa ăn, tự học).
 */
export async function getHiddenStudentIds(
  schoolId: string,
  date: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('student_attendance_hidden')
    .select('student_id')
    .eq('school_id', schoolId)
    .lte('start_date', date)
    .gte('end_date', date);

  if (error) {
    console.error('getHiddenStudentIds error:', error);
    return new Set();
  }
  return new Set((data || []).map((r: any) => r.student_id));
}
