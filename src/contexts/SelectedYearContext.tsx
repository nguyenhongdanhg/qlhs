import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAcademicYears, type AcademicYear } from '@/hooks/useAcademicYears';
import { useAuth } from '@/contexts/AuthContext';

interface SelectedYearContextType {
  years: AcademicYear[];
  activeYear: AcademicYear | null;
  selectedYear: AcademicYear | null;
  selectedYearId: string | null;
  setSelectedYearId: (id: string | null) => void;
  isLoading: boolean;
  /** True nếu người dùng đang xem một năm khác năm đang hoạt động */
  isViewingOtherYear: boolean;
  /** Ngày bắt đầu / kết thúc của năm được chọn (nullable) */
  startDate: string | null;
  endDate: string | null;
  /** Clamp một ngày về trong khoảng năm học đang chọn (nếu có bounds) */
  clampDate: (d: Date) => Date;
  /** Ngày làm việc mặc định: hôm nay nếu nằm trong năm, ngược lại là endDate */
  workingDate: Date;
  /** True nếu ngày nằm trong khoảng năm học đang chọn */
  isDateInYear: (d: Date) => boolean;
}

const SelectedYearContext = createContext<SelectedYearContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'selected-academic-year:';

export function SelectedYearProvider({ children }: { children: React.ReactNode }) {
  const { currentSchool } = useAuth();
  const { years, activeYear, isLoading } = useAcademicYears();
  const [selectedYearId, setSelectedYearIdState] = useState<string | null>(null);

  const storageKey = currentSchool ? `${STORAGE_KEY_PREFIX}${currentSchool.id}` : null;

  // Load stored preference when school changes
  useEffect(() => {
    if (!storageKey) {
      setSelectedYearIdState(null);
      return;
    }
    const stored = localStorage.getItem(storageKey);
    setSelectedYearIdState(stored);
  }, [storageKey]);

  // Ensure selected year is valid for the current school; default to active year
  useEffect(() => {
    if (isLoading || !years.length) return;
    const exists = selectedYearId && years.some(y => y.id === selectedYearId);
    if (!exists) {
      const fallback = activeYear?.id ?? years[0]?.id ?? null;
      setSelectedYearIdState(fallback);
      if (storageKey && fallback) localStorage.setItem(storageKey, fallback);
    }
  }, [years, activeYear, selectedYearId, isLoading, storageKey]);

  const setSelectedYearId = (id: string | null) => {
    setSelectedYearIdState(id);
    if (storageKey) {
      if (id) localStorage.setItem(storageKey, id);
      else localStorage.removeItem(storageKey);
    }
  };

  const value = useMemo<SelectedYearContextType>(() => {
    const selectedYear = years.find(y => y.id === selectedYearId) ?? activeYear ?? null;
    const startStr = selectedYear?.start_date ?? null;
    const endStr = selectedYear?.end_date ?? null;
    const startD = startStr ? new Date(startStr + 'T00:00:00') : null;
    const endD = endStr ? new Date(endStr + 'T23:59:59') : null;

    const clampDate = (d: Date): Date => {
      if (startD && d < startD) return new Date(startD);
      if (endD && d > endD) return new Date(endD);
      return d;
    };
    const isDateInYear = (d: Date): boolean => {
      if (startD && d < startD) return false;
      if (endD && d > endD) return false;
      return true;
    };
    const today = new Date();
    const workingDate = clampDate(today);

    return {
      years,
      activeYear,
      selectedYear,
      selectedYearId: selectedYear?.id ?? null,
      setSelectedYearId,
      isLoading,
      isViewingOtherYear: !!selectedYear && !!activeYear && selectedYear.id !== activeYear.id,
      startDate: startStr,
      endDate: endStr,
      clampDate,
      workingDate,
      isDateInYear,
    };
  }, [years, activeYear, selectedYearId, isLoading]);

  return (
    <SelectedYearContext.Provider value={value}>{children}</SelectedYearContext.Provider>
  );
}

export function useSelectedYear() {
  const ctx = useContext(SelectedYearContext);
  if (!ctx) {
    // Safe fallback nếu component dùng ngoài provider (tránh crash)
    return {
      years: [],
      activeYear: null,
      selectedYear: null,
      selectedYearId: null,
      setSelectedYearId: () => {},
      isLoading: false,
      isViewingOtherYear: false,
      startDate: null,
      endDate: null,
      clampDate: (d: Date) => d,
      workingDate: new Date(),
      isDateInYear: () => true,
    } as SelectedYearContextType;
  }
  return ctx;
}
