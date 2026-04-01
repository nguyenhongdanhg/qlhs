import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch attendance records in parallel batches, filtering by student IDs at DB level.
 * This is much faster than fetching all school records and filtering client-side.
 */
export async function fetchAttendanceRecordsBatched(
  schoolId: string,
  studentIds: string[],
  startDate: string,
  endDate: string
): Promise<any[]> {
  // Supabase .in() has practical limits; batch by ~100 student IDs
  const BATCH_SIZE = 100;
  const batches: string[][] = [];
  for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
    batches.push(studentIds.slice(i, i + BATCH_SIZE));
  }

  // Fetch all batches in parallel
  const results = await Promise.all(
    batches.map(async (batchIds) => {
      const PAGE_SIZE = 1000;
      const allPages: any[] = [];
      let page = 0;

      while (page < 100) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('attendance_records')
          .select('student_id,attendance_date,attendance_type,status,created_at')
          .eq('school_id', schoolId)
          .in('student_id', batchIds)
          .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        const rows = data || [];
        allPages.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        page++;
      }

      return allPages;
    })
  );

  return results.flat();
}

/**
 * Deduplicate records: keep latest per student/date/meal
 */
export function deduplicateRecords(records: any[]): Map<string, any> {
  const latestByKey = new Map<string, any>();
  for (const record of records) {
    const key = `${record.student_id}-${record.attendance_date}-${record.attendance_type}`;
    const existing = latestByKey.get(key);
    if (!existing || record.created_at > existing.created_at) {
      latestByKey.set(key, record);
    }
  }
  return latestByKey;
}
