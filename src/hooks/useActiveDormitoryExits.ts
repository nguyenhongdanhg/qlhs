import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface ActiveExitInfo {
  student_id: string;
  exit_date: string;
  exit_time: string;
  return_date: string | null;
  expected_return_time: string;
  same_day: boolean;
  reason: string | null;
  returned_at: string | null;
}

/**
 * Returns a map of student_id -> ActiveExitInfo for approved dormitory exit
 * requests that overlap with the given date (i.e. student is expected to be
 * out of the dorm during attendance on that date).
 *
 * "Active" = approved, not yet returned, and the date falls within
 * [exit_date, return_date or exit_date if same_day].
 */
export function useActiveDormitoryExits(
  schoolId: string | undefined,
  date: Date,
  attendanceType: 'evening_study' | 'boarding' | 'breakfast' | 'lunch' | 'dinner'
) {
  const [exits, setExits] = useState<Record<string, ActiveExitInfo>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) {
      setExits({});
      return;
    }
    let cancelled = false;
    const fetchExits = async () => {
      setIsLoading(true);
      try {
        const dateStr = format(date, 'yyyy-MM-dd');
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const currentTimeStr = format(now, 'HH:mm:ss');
        const isToday = dateStr === todayStr;

        const { data, error } = await supabase
          .from('dormitory_exit_requests')
          .select('student_id, exit_date, exit_time, return_date, expected_return_time, same_day, reason, returned_at, request_date, status')
          .eq('school_id', schoolId)
          .eq('status', 'approved')
          .is('returned_at', null);

        if (error) throw error;

        const map: Record<string, ActiveExitInfo> = {};
        (data || []).forEach((r: any) => {
          const start = r.exit_date || r.request_date;
          const end = r.same_day ? start : (r.return_date || start);
          if (!start) return;
          if (dateStr >= start && dateStr <= end) {
            // Skip if past expected return time on the current day
            if (isToday && r.expected_return_time) {
              const isReturnDay = dateStr === (r.same_day ? start : (r.return_date || start));
              if (isReturnDay && currentTimeStr > r.expected_return_time) {
                return;
              }
            }
            map[r.student_id] = {
              student_id: r.student_id,
              exit_date: start,
              exit_time: r.exit_time,
              return_date: r.return_date,
              expected_return_time: r.expected_return_time,
              same_day: r.same_day,
              reason: r.reason,
              returned_at: r.returned_at,
            };
          }
        });

        if (!cancelled) setExits(map);
      } catch (err) {
        console.error('Error fetching active dormitory exits:', err);
        if (!cancelled) setExits({});
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchExits();
    return () => {
      cancelled = true;
    };
  }, [schoolId, date]);

  return { exits, isLoading };
}

/** Format like "07:00 26/04 → 17:00 27/04" or "07:00 → 17:00 26/04" if same day */
export function formatExitWindow(info: ActiveExitInfo): string {
  const fmtTime = (t: string) => (t ? t.substring(0, 5) : '');
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '';
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}`;
  };
  if (info.same_day) {
    return `${fmtTime(info.exit_time)} → ${fmtTime(info.expected_return_time)} ${fmtDate(info.exit_date)}`;
  }
  return `${fmtTime(info.exit_time)} ${fmtDate(info.exit_date)} → ${fmtTime(info.expected_return_time)} ${fmtDate(info.return_date || info.exit_date)}`;
}
