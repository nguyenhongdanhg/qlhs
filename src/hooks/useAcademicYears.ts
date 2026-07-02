import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AcademicYearStatus = 'open' | 'closed' | 'archived';

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: AcademicYearStatus;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useAcademicYears() {
  const { currentSchool } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentSchool) {
      setYears([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('is_active', { ascending: false })
        .order('start_date', { ascending: false, nullsFirst: false })
        .order('name', { ascending: false });
      if (error) throw error;
      setYears((data ?? []) as AcademicYear[]);
    } finally {
      setIsLoading(false);
    }
  }, [currentSchool]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeYear = years.find(y => y.is_active) ?? null;

  return { years, activeYear, isLoading, refresh };
}

export function useCurrentAcademicYear() {
  const { activeYear, isLoading } = useAcademicYears();
  return { activeYear, isLoading };
}
