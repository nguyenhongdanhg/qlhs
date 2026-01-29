import { useState, useEffect } from 'react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface WeekSetting {
  week_number: number;
  start_date: string;
  end_date: string;
}

interface UseCurrentWeekResult {
  currentWeek: number;
  weekSettings: WeekSetting[];
  isLoading: boolean;
  getWeekDateRange: (weekNumber: number) => { start: string; end: string } | null;
  refetch: () => Promise<void>;
}

export function useCurrentWeek(schoolId: string | undefined, schoolYear: string): UseCurrentWeekResult {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weekSettings, setWeekSettings] = useState<WeekSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWeekSettings = async () => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('week_settings')
        .select('week_number, start_date, end_date')
        .eq('school_id', schoolId)
        .eq('school_year', schoolYear)
        .order('week_number', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setWeekSettings(data);

        // Find current week based on today's date
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');

        let foundWeek = 1;
        for (const week of data) {
          const startDate = parseISO(week.start_date);
          const endDate = parseISO(week.end_date);

          if (isWithinInterval(today, { start: startDate, end: endDate })) {
            foundWeek = week.week_number;
            break;
          }

          // If today is after this week's end date, keep updating to next week
          if (todayStr > week.end_date) {
            foundWeek = Math.min(week.week_number + 1, 35);
          }
        }

        setCurrentWeek(foundWeek);
      } else {
        setWeekSettings([]);
        setCurrentWeek(1);
      }
    } catch (error) {
      console.error('Error fetching week settings:', error);
      setCurrentWeek(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeekSettings();
  }, [schoolId, schoolYear]);

  const getWeekDateRange = (weekNumber: number) => {
    const week = weekSettings.find(w => w.week_number === weekNumber);
    if (!week) return null;
    return {
      start: week.start_date,
      end: week.end_date,
    };
  };

  return {
    currentWeek,
    weekSettings,
    isLoading,
    getWeekDateRange,
    refetch: fetchWeekSettings,
  };
}
