import { useEffect, useRef } from 'react';
import { useSelectedYear } from '@/contexts/SelectedYearContext';

/**
 * Khi người dùng đổi năm học ở header, tự động clamp/thiết lập lại date state
 * về ngày hợp lệ trong năm học đang chọn (hôm nay nếu trong năm, ngược lại endDate).
 *
 * Không chạy lần đầu — chỉ chạy khi selectedYearId thay đổi.
 */
export function useSyncDateToSelectedYear(
  setDate: (d: Date) => void,
  extraSetters?: ((d: Date) => void)[]
) {
  const { selectedYearId, workingDate } = useSelectedYear();
  const firstRun = useRef(true);
  const prevYearId = useRef(selectedYearId);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      prevYearId.current = selectedYearId;
      return;
    }
    if (prevYearId.current === selectedYearId) return;
    prevYearId.current = selectedYearId;
    const d = new Date(workingDate);
    setDate(d);
    extraSetters?.forEach((s) => s(new Date(workingDate)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYearId]);
}
