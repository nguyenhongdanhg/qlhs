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
    return {
      years,
      activeYear,
      selectedYear,
      selectedYearId: selectedYear?.id ?? null,
      setSelectedYearId,
      isLoading,
      isViewingOtherYear: !!selectedYear && !!activeYear && selectedYear.id !== activeYear.id,
      startDate: selectedYear?.start_date ?? null,
      endDate: selectedYear?.end_date ?? null,
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
    } as SelectedYearContextType;
  }
  return ctx;
}
