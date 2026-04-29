import XLSX from 'xlsx-js-style';
import { vietnameseNameSortCompare } from './utils';

// Browser-safe file download (avoids fs.writeFileSync error)
function saveWorkbook(wb: XLSX.WorkBook, fileName: string) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  ExcelColors, 
  ExcelFonts, 
  ExcelBorders, 
  applyProfessionalStyle,
  applyTitleRowsStyle,
  CellAlign,
  getColumnAlignments,
  fitColumnsToA4
} from './excel-styles';

export type DateRangeType = 'day' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

// Get date range based on type
export function getDateRange(date: Date, rangeType: DateRangeType, customEnd?: Date): DateRange {
  switch (rangeType) {
    case 'day':
      return {
        start: date,
        end: date,
        label: format(date, 'dd/MM/yyyy'),
      };
    case 'week':
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
        label: `Tuần ${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(date, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`,
      };
    case 'month':
      return {
        start: startOfMonth(date),
        end: endOfMonth(date),
        label: `Tháng ${format(date, 'MM/yyyy')}`,
      };
    case 'custom': {
      const end = customEnd || date;
      return {
        start: date,
        end: end,
        label: `${format(date, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`,
      };
    }
  }
}

// Excel styling for xlsx-js-style (using basic xlsx for now)
export interface ExcelStyle {
  fill?: { fgColor: { rgb: string } };
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number };
  alignment?: { horizontal?: 'left' | 'center' | 'right'; vertical?: 'top' | 'center' | 'bottom'; wrapText?: boolean };
  border?: { 
    top?: { style: string; color: { rgb: string } };
    bottom?: { style: string; color: { rgb: string } };
    left?: { style: string; color: { rgb: string } };
    right?: { style: string; color: { rgb: string } };
  };
}

// Meal filter type for selective export
export type MealExportFilter = 'all' | 'breakfast' | 'lunch_dinner';

// Professional Excel export config
export interface ExcelExportConfig {
  schoolName: string;
  title: string;
  subtitle?: string;
  dateRange: DateRange;
  reporterName?: string;
  exportTime: Date;
  ricePerStudent?: number;
  mealFilter?: MealExportFilter;
  /** Map: className -> GVCN full name */
  classTeachers?: Map<string, string>;
  /** Hiệu trưởng / Thủ trưởng đơn vị */
  principalName?: string;
  /** Địa danh để ghi vào dòng ký tên (vd: "Pà Vầy Sủ") */
  schoolLocation?: string;
  /** Năm học để hiển thị trong tiêu đề (vd: "2025-2026") */
  schoolYear?: string;
}

// Create worksheet with professional formatting
export function createProfessionalWorksheet(
  data: any[][],
  config: ExcelExportConfig,
  columnWidths: number[]
): XLSX.WorkSheet {
  // Header rows
  const headerRows: any[][] = [
    [config.title],
    [`Trường: ${config.schoolName}`],
    [`Thời gian: ${config.dateRange.label}`],
    [config.reporterName ? `Người xuất: ${config.reporterName}` : ''],
    [`Ngày xuất: ${format(config.exportTime, 'HH:mm dd/MM/yyyy', { locale: vi })}`],
    [], // Empty row before data
  ];

  const wsData = [...headerRows, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  fitColumnsToA4(ws, columnWidths);

  // Merge title cells
  if (!ws['!merges']) ws['!merges'] = [];
  const totalCols = columnWidths.length;
  
  // Merge header rows across all columns
  for (let i = 0; i < 5; i++) {
    if (wsData[i] && wsData[i][0]) {
      ws['!merges'].push({
        s: { r: i, c: 0 },
        e: { r: i, c: totalCols - 1 }
      });
    }
  }

  return ws;
}

// Export attendance report (Boarding/EveningStudy)
export interface AttendanceReportData {
  date: string;
  session: string;
  sessionLabel: string;
  reporter: string;
  reportTime: string;
  total: number;
  present: number;
  absent: number;
  notes?: string;
  absentStudents: {
    name: string;
    className: string;
    excused: boolean;
    reason: string;
  }[];
}

export function exportAttendanceReport(
  reports: AttendanceReportData[],
  config: ExcelExportConfig,
  type: 'boarding' | 'evening_study',
  customTypeLabel?: string
): void {
  const wb = XLSX.utils.book_new();
  const typeLabel = customTypeLabel || (type === 'boarding' ? 'NỘI TRÚ' : 'TỰ HỌC TỐI');

  // Summary sheet
  const summaryData: any[][] = [
    ['STT', 'Ngày', 'Buổi', 'Người báo cáo', 'Thời gian báo', 'Tổng số', 'Có mặt', 'Vắng', 'Ghi chú'],
  ];

  reports.forEach((report, idx) => {
    summaryData.push([
      idx + 1,
      format(new Date(report.date), 'dd/MM/yyyy'),
      report.sessionLabel,
      report.reporter,
      report.reportTime,
      report.total,
      report.present,
      report.absent,
      report.notes || '',
    ]);
  });

  // Add totals row
  const totalPresent = reports.reduce((sum, r) => sum + r.present, 0);
  const totalAbsent = reports.reduce((sum, r) => sum + r.absent, 0);
  summaryData.push([]);
  summaryData.push(['', 'TỔNG CỘNG', '', '', '', reports.reduce((s, r) => s + r.total, 0), totalPresent, totalAbsent, '']);

  const summaryWs = createProfessionalWorksheet(
    summaryData,
    { ...config, title: `ĐIỂM DANH ${typeLabel}` },
    [5, 12, 15, 20, 18, 10, 10, 10, 25]
  );

  // Style header row (row 7 after 6 header rows)
  applyHeaderStyle(summaryWs, 6, 9);

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Tổng hợp');

  // Absent students sheet
  const absentData: any[][] = [
    ['STT', 'Họ và tên', 'Lớp', 'Ngày vắng', 'Buổi', 'Phép/KP', 'Lý do vắng'],
  ];

  let stt = 0;
  reports.forEach(report => {
    report.absentStudents.forEach(student => {
      stt++;
      absentData.push([
        stt,
        student.name,
        student.className,
        format(new Date(report.date), 'dd/MM/yyyy'),
        report.sessionLabel,
        student.excused ? 'Có phép' : 'Không phép',
        student.reason || '',
      ]);
    });
  });

  if (absentData.length > 1) {
    const absentWs = createProfessionalWorksheet(
      absentData,
      { ...config, title: `DANH SÁCH HỌC SINH VẮNG - ${typeLabel}` },
      [5, 25, 10, 12, 15, 12, 30]
    );
    applyHeaderStyle(absentWs, 6, 7);
    XLSX.utils.book_append_sheet(wb, absentWs, 'DS Vắng');
  }

  const fileName = `Diem_danh_${type === 'boarding' ? 'noi_tru' : 'tu_hoc'}_${format(config.dateRange.start, 'dd-MM-yyyy')}_${format(config.dateRange.end, 'dd-MM-yyyy')}.xlsx`;
  saveWorkbook(wb, fileName);
}

// Export meal statistics
export interface MealStudentData {
  id: string;
  name: string;
  className: string;
  classGrade?: number;
  roomNumber?: string;
  mealGroup?: string;
  attendance: Map<string, { breakfast: boolean | null; lunch: boolean | null; dinner: boolean | null }>;
}

// Check if there's any report for a specific date
function hasReportForDate(students: MealStudentData[], dateStr: string): boolean {
  return students.some(student => {
    const dayData = student.attendance.get(dateStr);
    return dayData && (dayData.breakfast !== null || dayData.lunch !== null || dayData.dinner !== null);
  });
}

// Vietnamese day-of-week abbreviations (Mon=2, Tue=3, ..., Sun=CN)
function getVietnameseDayAbbr(date: Date): string {
  const day = date.getDay(); // 0=Sun, 1=Mon, ...
  const map: Record<number, string> = { 0: 'CN', 1: '2', 2: '3', 3: '4', 4: '5', 5: '6', 6: '7' };
  return map[day];
}

// Create meal statistics sheet for a group of students (formal template layout)
function createMealStatsSheet(
  students: MealStudentData[],
  days: Date[],
  config: ExcelExportConfig,
  sheetTitle: string
): XLSX.WorkSheet {
  const mealFilter = config.mealFilter || 'all';
  const riceRate = config.ricePerStudent ?? 0.2;

  // Extract class name from sheetTitle
  const classMatch = sheetTitle.match(/LỚP\s+(.+?)(?:\s*\(|$)/);
  const className = classMatch ? classMatch[1] : '';

  // Determine month/year from date range
  const monthNum = format(config.dateRange.start, 'M');
  const yearNum = format(config.dateRange.start, 'yyyy');
  const schoolYearStr = config.schoolYear || (() => {
    const y = config.dateRange.start.getFullYear();
    const m = config.dateRange.start.getMonth() + 1;
    // Năm học bắt đầu từ tháng 8
    return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  })();

  // GVCN name lookup
  const gvcnName = config.classTeachers?.get(className) || '';
  const principalName = config.principalName || '';
  const locationStr = config.schoolLocation || '';

  // Build title based on filter
  let mealTypeTitle = 'BỮA SÁNG, BỮA TRƯA, BỮA TỐI';
  if (mealFilter === 'breakfast') mealTypeTitle = 'BỮA SÁNG';
  else if (mealFilter === 'lunch_dinner') mealTypeTitle = 'BỮA TRƯA, BỮA TỐI';

  // Summary column header
  let sumColHeader = 'Tổng số\nbữa ăn sáng\ntrong tháng';
  if (mealFilter === 'lunch_dinner') sumColHeader = 'Tổng số\nbữa ăn trưa, tối\ntrong tháng';
  else if (mealFilter === 'all') sumColHeader = 'Tổng số\nbữa ăn\ntrong tháng';

  // --- Build worksheet data ---
  const numDays = days.length;
  // Columns: TT | Họ và tên | day1..dayN | Tổng | Ký nhận
  const numCols = 2 + numDays + 1 + 1;

  // Row 0: School name (left) + "CỘNG HÒA..." (center) + "Mẫu số: 04" (right)
  const row0: any[] = new Array(numCols).fill('');
  row0[0] = config.schoolName;
  const midCol = Math.max(2, Math.floor(numCols * 0.4));
  row0[midCol] = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  const lastCol = numCols - 1;
  // Mẫu số: 04 ở góc phải - sẽ được merge vào ô cuối cùng (riêng)
  // Để đơn giản, đặt ở dòng đầu tiên cột cuối
  row0[lastCol] = 'Mẫu số: 04';

  // Row 1: Class (left) + "Độc lập..." (center)
  const row1: any[] = new Array(numCols).fill('');
  row1[0] = `Lớp: ${className}`;
  row1[midCol] = 'Độc lập - Tự do - Hạnh phúc';

  // Row 2: Empty
  const row2: any[] = new Array(numCols).fill('');

  // Row 3: Main title (merged center)
  const row3: any[] = new Array(numCols).fill('');
  row3[0] = `BẢNG THEO DÕI HỌC SINH NỘI TRÚ ĂN TẬP TRUNG (${mealTypeTitle}) TẠI TRƯỜNG`;

  // Row 4: TTLT subtitle
  const row4: any[] = new Array(numCols).fill('');
  row4[0] = `THEO TTLT 109/2009/TTLT/BTC-BGDĐT NH ${schoolYearStr}`;

  // Row 5: Tháng / Năm
  const row5: any[] = new Array(numCols).fill('');
  row5[0] = `Tháng    ${monthNum}    Năm    ${yearNum}`;

  // Row 6: Sub-header label
  const row6: any[] = new Array(numCols).fill('');
  row6[2] = 'Số ngày ăn tại trường trong tháng (Ngày trên, thứ dưới)';

  // Row 7: Header row 1 - TT | Họ và tên | date numbers | sumColHeader | Ký nhận
  const headerRow1: any[] = new Array(numCols).fill('');
  headerRow1[0] = 'TT';
  headerRow1[1] = 'Họ và tên';
  days.forEach((day, i) => {
    headerRow1[2 + i] = parseInt(format(day, 'd'));
  });
  headerRow1[2 + numDays] = sumColHeader;
  headerRow1[2 + numDays + 1] = 'Ký nhận\ncủa học sinh';

  // Row 8: Header row 2 - day-of-week under each date
  const headerRow2: any[] = new Array(numCols).fill('');
  days.forEach((day, i) => {
    headerRow2[2 + i] = getVietnameseDayAbbr(day);
  });

  // --- Data rows ---
  const sortedStudents = [...students].sort((a, b) => vietnameseNameSortCompare(a.name, b.name));

  const dayTotals: Map<string, { breakfast: number; lunch: number; dinner: number }> = new Map();
  let grandTotalBreakfast = 0, grandTotalLunch = 0, grandTotalDinner = 0;

  const dataRows: any[][] = [];

  sortedStudents.forEach((student, idx) => {
    const row: any[] = new Array(numCols).fill('');
    row[0] = idx + 1;
    row[1] = student.name;

    let breakfastCount = 0, lunchCount = 0, dinnerCount = 0;

    days.forEach((day, i) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayData = student.attendance.get(dateStr);

      let hasAnyReport = false;
      if (mealFilter === 'breakfast') {
        hasAnyReport = dayData ? dayData.breakfast !== null : false;
      } else if (mealFilter === 'lunch_dinner') {
        hasAnyReport = dayData ? (dayData.lunch !== null || dayData.dinner !== null) : false;
      } else {
        hasAnyReport = dayData ? (dayData.breakfast !== null || dayData.lunch !== null || dayData.dinner !== null) : false;
      }

      if (!hasAnyReport) {
        row[2 + i] = '';
      } else {
        const b = dayData?.breakfast;
        const l = dayData?.lunch;
        const d = dayData?.dinner;

        if (b === true) breakfastCount++;
        if (l === true) lunchCount++;
        if (d === true) dinnerCount++;

        if (!dayTotals.has(dateStr)) dayTotals.set(dateStr, { breakfast: 0, lunch: 0, dinner: 0 });
        const totals = dayTotals.get(dateStr)!;
        if (b === true) totals.breakfast++;
        if (l === true) totals.lunch++;
        if (d === true) totals.dinner++;

        if (mealFilter === 'breakfast') {
          row[2 + i] = b === null ? '' : (b ? 'x' : '');
        } else if (mealFilter === 'lunch_dinner') {
          const hasLunch = l === true;
          const hasDinner = d === true;
          if (hasLunch && hasDinner) row[2 + i] = 'x';
          else if (hasLunch) row[2 + i] = '\\';
          else if (hasDinner) row[2 + i] = '/';
          else row[2 + i] = '';
        } else {
          const bChar = b === null ? '-' : (b ? 'x' : 'o');
          const lChar = l === null ? '-' : (l ? 'x' : 'o');
          const dChar = d === null ? '-' : (d ? 'x' : 'o');
          row[2 + i] = `${bChar}${lChar}${dChar}`;
        }
      }
    });

    // Summary column
    if (mealFilter === 'all') {
      row[2 + numDays] = breakfastCount + lunchCount + dinnerCount;
    } else if (mealFilter === 'breakfast') {
      row[2 + numDays] = breakfastCount;
    } else {
      row[2 + numDays] = lunchCount + dinnerCount;
    }
    row[2 + numDays + 1] = ''; // Ký nhận - empty

    grandTotalBreakfast += breakfastCount;
    grandTotalLunch += lunchCount;
    grandTotalDinner += dinnerCount;

    dataRows.push(row);
  });

  // Cộng (totals) row
  const totalsRow: any[] = new Array(numCols).fill('');
  totalsRow[1] = 'Cộng';
  days.forEach((day, i) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const totals = dayTotals.get(dateStr);
    if (!totals) {
      totalsRow[2 + i] = '';
    } else if (mealFilter === 'breakfast') {
      totalsRow[2 + i] = totals.breakfast || '';
    } else if (mealFilter === 'lunch_dinner') {
      const sum = totals.lunch + totals.dinner;
      totalsRow[2 + i] = sum || '';
    } else {
      const sum = totals.breakfast + totals.lunch + totals.dinner;
      totalsRow[2 + i] = sum || '';
    }
  });
  if (mealFilter === 'all') {
    totalsRow[2 + numDays] = grandTotalBreakfast + grandTotalLunch + grandTotalDinner;
  } else if (mealFilter === 'breakfast') {
    totalsRow[2 + numDays] = grandTotalBreakfast;
  } else {
    totalsRow[2 + numDays] = grandTotalLunch + grandTotalDinner;
  }

  // Notes row
  const noteRow: any[] = new Array(numCols).fill('');
  if (mealFilter === 'breakfast') {
    noteRow[0] = 'Ghi chú: Nếu học sinh ăn sáng thì đánh dấu (x), học sinh không ăn thì bỏ trống';
  } else if (mealFilter === 'lunch_dinner') {
    noteRow[0] = 'Ký hiệu chấm: X.  Trong đó: \\ : Ăn buổi trưa,  / : Ăn buổi chiều,  P: Nghỉ phép, Ô : Nghỉ ốm.';
  } else {
    noteRow[0] = 'Ghi chú: x = ăn, o = vắng, - = chưa báo cáo. Mỗi ô: Sáng/Trưa/Tối';
  }

  // Signature rows
  const emptyRow: any[] = new Array(numCols).fill('');
  const emptyRow2: any[] = new Array(numCols).fill('');
  const emptyRow3: any[] = new Array(numCols).fill('');

  const sigDateCol = Math.max(2 + numDays - 5, Math.floor(numCols * 0.6));
  // Note + date trên cùng 1 dòng
  const noteAndDateRow: any[] = [...noteRow];
  noteAndDateRow[sigDateCol] = `${locationStr ? locationStr + ', ' : ''}ngày ..... tháng ..... năm ${yearNum}`;

  const sigTitleRow: any[] = new Array(numCols).fill('');
  sigTitleRow[1] = 'Giáo viên chủ nhiệm';
  sigTitleRow[sigDateCol] = 'Thủ trưởng đơn vị';

  // Tên người ký (sau 2 dòng trống dành chỗ ký)
  const sigNameRow: any[] = new Array(numCols).fill('');
  sigNameRow[1] = gvcnName;
  sigNameRow[sigDateCol] = principalName;

  // Assemble all rows
  const wsData: any[][] = [
    row0,         // 0: school name + quốc hiệu + Mẫu số 04
    row1,         // 1: class + motto
    row2,         // 2: empty
    row3,         // 3: main title
    row4,         // 4: TTLT subtitle
    row5,         // 5: tháng/năm
    row6,         // 6: sub-header label
    headerRow1,   // 7: date numbers + TT/name
    headerRow2,   // 8: day-of-week
    ...dataRows,  // 9..9+N-1: student data
    totalsRow,    // 9+N: Cộng
    emptyRow,     // blank
    noteAndDateRow, // notes (left) + date (right)
    sigTitleRow,  // signature titles
    emptyRow2,    // blank for signature
    emptyRow3,    // blank for signature
    sigNameRow,   // GVCN name + Principal name
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // --- Column widths ---
  const columnWidths = [
    4, 20,
    ...days.map(() => 3),
    8, 8,
  ];
  fitColumnsToA4(ws, columnWidths);

  // --- Merges ---
  if (!ws['!merges']) ws['!merges'] = [];

  // Row 0: school name (left), quốc hiệu (giữa, không gồm cột cuối "Mẫu số: 04")
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: midCol - 1 } });
  ws['!merges'].push({ s: { r: 0, c: midCol }, e: { r: 0, c: numCols - 2 } });
  // (cột cuối là "Mẫu số: 04", không merge)

  // Row 1: class merge, motto merge (full to end)
  ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: midCol - 1 } });
  ws['!merges'].push({ s: { r: 1, c: midCol }, e: { r: 1, c: numCols - 1 } });

  // Row 3: main title (full width)
  ws['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: numCols - 1 } });

  // Row 4: TTLT subtitle (full width)
  ws['!merges'].push({ s: { r: 4, c: 0 }, e: { r: 4, c: numCols - 1 } });

  // Row 5: tháng/năm (full width)
  ws['!merges'].push({ s: { r: 5, c: 0 }, e: { r: 5, c: numCols - 1 } });

  // Row 6: sub-header label (across date columns)
  ws['!merges'].push({ s: { r: 6, c: 2 }, e: { r: 6, c: 2 + numDays - 1 } });

  // Header rows 7-8: TT merges vertically, Họ và tên merges vertically
  ws['!merges'].push({ s: { r: 7, c: 0 }, e: { r: 8, c: 0 } }); // TT
  ws['!merges'].push({ s: { r: 7, c: 1 }, e: { r: 8, c: 1 } }); // Họ và tên
  ws['!merges'].push({ s: { r: 7, c: 2 + numDays }, e: { r: 8, c: 2 + numDays } }); // Tổng
  ws['!merges'].push({ s: { r: 7, c: 2 + numDays + 1 }, e: { r: 8, c: 2 + numDays + 1 } }); // Ký nhận

  // Note + date row (merged: note left half, date right half)
  const noteAndDateRowIdx = 9 + dataRows.length + 2; // after totals + empty
  ws['!merges'].push({ s: { r: noteAndDateRowIdx, c: 0 }, e: { r: noteAndDateRowIdx, c: sigDateCol - 1 } });
  ws['!merges'].push({ s: { r: noteAndDateRowIdx, c: sigDateCol }, e: { r: noteAndDateRowIdx, c: numCols - 1 } });

  // Signature title row
  const sigTitleRowIdx = noteAndDateRowIdx + 1;
  ws['!merges'].push({ s: { r: sigTitleRowIdx, c: 0 }, e: { r: sigTitleRowIdx, c: sigDateCol - 1 } });
  ws['!merges'].push({ s: { r: sigTitleRowIdx, c: sigDateCol }, e: { r: sigTitleRowIdx, c: numCols - 1 } });

  // Signature name row (sau 2 dòng trống)
  const sigNameRowIdx = sigTitleRowIdx + 3;
  ws['!merges'].push({ s: { r: sigNameRowIdx, c: 0 }, e: { r: sigNameRowIdx, c: sigDateCol - 1 } });
  ws['!merges'].push({ s: { r: sigNameRowIdx, c: sigDateCol }, e: { r: sigNameRowIdx, c: numCols - 1 } });

  // --- Styling ---
  const thinBorder = ExcelBorders.thin;
  const headerFont = { bold: true, sz: 10, color: { rgb: 'FFFFFF' } };

  // Color palette
  const headerBg = '2E75B6';       // Steel blue for header rows
  const headerBgAlt = '3A8FD6';    // Lighter blue for day-of-week row
  const oddRowBg = 'F2F7FB';       // Very light blue for odd rows
  const evenRowBg = 'FFFFFF';      // White for even rows
  const totalsBg = 'FFF3E0';       // Light orange for totals
  const totalsFont = { bold: true, sz: 10, color: { rgb: 'BF360C' } }; // Deep orange text
  const titleColor = '1A237E';     // Dark navy for titles
  const sundayBg = 'FFEBEE';       // Light red for Sunday columns
  const sundayHeaderBg = 'C62828'; // Dark red for Sunday header

  // Detect Sunday columns
  const sundayCols = new Set<number>();
  days.forEach((day, i) => {
    if (day.getDay() === 0) sundayCols.add(2 + i);
  });

  // Style rows 0-1 (school/quốc hiệu)
  const setCell = (r: number, c: number, style: any) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };
    ws[ref].s = style;
  };

  setCell(0, 0, { font: { bold: true, sz: 11, color: { rgb: titleColor } }, alignment: { horizontal: 'center', vertical: 'center' } });
  setCell(0, midCol, { font: { bold: true, sz: 12, color: { rgb: 'C62828' } }, alignment: { horizontal: 'center', vertical: 'center' } });
  setCell(0, numCols - 1, { font: { italic: true, sz: 10, color: { rgb: '424242' } }, alignment: { horizontal: 'right', vertical: 'center' } });
  setCell(1, 0, { font: { bold: true, sz: 11, color: { rgb: '000000' } }, alignment: { horizontal: 'left', vertical: 'center' }, });
  setCell(1, midCol, { font: { bold: true, sz: 11, underline: true, color: { rgb: titleColor } }, alignment: { horizontal: 'center', vertical: 'center' } });

  // Title rows
  setCell(3, 0, { font: { bold: true, sz: 13, color: { rgb: titleColor } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } });
  setCell(4, 0, { font: { bold: true, sz: 11, color: { rgb: '37474F' } }, alignment: { horizontal: 'center', vertical: 'center' } });
  setCell(5, 0, { font: { bold: true, sz: 11, color: { rgb: '37474F' } }, alignment: { horizontal: 'center', vertical: 'center' } });

  // Sub-header row 6
  setCell(6, 2, { font: { italic: true, sz: 9, color: { rgb: '616161' } }, alignment: { horizontal: 'center', vertical: 'center' } });

  // Header rows 7-8 styling
  for (let c = 0; c < numCols; c++) {
    const isSunday = sundayCols.has(c);
    for (let r = 7; r <= 8; r++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { v: '', t: 's' };
      const bg = isSunday ? sundayHeaderBg : (r === 8 ? headerBgAlt : headerBg);
      ws[ref].s = {
        font: { ...headerFont, sz: r === 8 ? 9 : 10 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder,
        fill: { fgColor: { rgb: bg } },
      };
    }
  }

  // Data rows styling (9 to 9+dataRows.length-1)
  const dataStartRow = 9;
  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const actualRow = dataStartRow + rowIdx;
    const bgColor = rowIdx % 2 === 0 ? evenRowBg : oddRowBg;

    for (let c = 0; c < numCols; c++) {
      const ref = XLSX.utils.encode_cell({ r: actualRow, c });
      if (!ws[ref]) ws[ref] = { v: '', t: 's' };

      const isSunday = sundayCols.has(c);
      const cellBg = isSunday ? sundayBg : bgColor;

      // Check for absence markers
      const val = ws[ref].v;
      const hasAbsence = typeof val === 'string' && (val.includes('o') || val === '');
      const isAttendMark = typeof val === 'string' && (val === 'x' || val === '\\' || val === '/');

      let fontStyle: any = { sz: 10 };
      if (isAttendMark) {
        fontStyle = { sz: 10, bold: true, color: { rgb: '1B5E20' } }; // Green for attendance
      } else if (c >= 2 && c < 2 + numDays && hasAbsence && val === 'o') {
        fontStyle = { sz: 10, color: { rgb: 'C62828' } }; // Red for absent
      }

      ws[ref].s = {
        font: fontStyle,
        alignment: {
          horizontal: c <= 1 ? (c === 0 ? 'center' : 'left') : 'center',
          vertical: 'center',
        },
        border: thinBorder,
        fill: { fgColor: { rgb: cellBg } },
      };
    }
  }

  // Totals row styling
  const totalsRowIdx = dataStartRow + dataRows.length;
  for (let c = 0; c < numCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: totalsRowIdx, c });
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };
    ws[ref].s = {
      font: totalsFont,
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder,
      fill: { fgColor: { rgb: totalsBg } },
    };
  }

  // Note + date row styling
  setCell(noteAndDateRowIdx, 0, { font: { italic: true, sz: 9, color: { rgb: '616161' } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true } });
  setCell(noteAndDateRowIdx, sigDateCol, { font: { italic: true, sz: 10, color: { rgb: '424242' } }, alignment: { horizontal: 'center', vertical: 'center' } });

  // Signature title styling
  setCell(sigTitleRowIdx, 0, { font: { bold: true, sz: 11, color: { rgb: titleColor } }, alignment: { horizontal: 'center', vertical: 'center' } });
  setCell(sigTitleRowIdx, sigDateCol, { font: { bold: true, sz: 11, color: { rgb: titleColor } }, alignment: { horizontal: 'center', vertical: 'center' } });

  // Signature name styling (bold + italic for personal name)
  setCell(sigNameRowIdx, 0, { font: { bold: true, italic: true, sz: 11, color: { rgb: '000000' } }, alignment: { horizontal: 'center', vertical: 'center' } });
  setCell(sigNameRowIdx, sigDateCol, { font: { bold: true, italic: true, sz: 11, color: { rgb: '000000' } }, alignment: { horizontal: 'center', vertical: 'center' } });

  return ws;
}

// Create summary sheet with class totals (Sheet 1: Toàn trường)
// Now includes per-day breakdown columns for each class
function createSchoolSummarySheet(
  students: MealStudentData[],
  days: Date[],
  config: ExcelExportConfig
): XLSX.WorkSheet {
  // Group students by class
  const classMap = new Map<string, { grade: number; students: MealStudentData[] }>();
  
  students.forEach(student => {
    const className = student.className;
    if (!classMap.has(className)) {
      classMap.set(className, {
        grade: student.classGrade || 0,
        students: []
      });
    }
    classMap.get(className)!.students.push(student);
  });

  // Sort classes by grade then by name
  const sortedClasses = Array.from(classMap.entries()).sort((a, b) => {
    if (a[1].grade !== b[1].grade) return a[1].grade - b[1].grade;
    return a[0].localeCompare(b[0], 'vi');
  });

  const mealFilter = config.mealFilter || 'all';

  // Build header row with day columns
  const headerRow: any[] = ['STT', 'Lớp', 'Sĩ số'];
  days.forEach(day => {
    headerRow.push(format(day, 'dd/MM'));
  });
  if (mealFilter === 'all') {
    headerRow.push('Tổng sáng', 'Tổng trưa', 'Tổng tối', 'Gạo (kg)');
  } else if (mealFilter === 'breakfast') {
    headerRow.push('Tổng sáng');
  } else {
    headerRow.push('Tổng trưa', 'Tổng tối', 'Gạo (kg)');
  }

  // Build data rows - one per class with daily totals
  const dataRows: any[][] = [];
  const dayTotals = new Map<string, { breakfast: number; lunch: number; dinner: number }>();
  let grandBreakfast = 0, grandLunch = 0, grandDinner = 0;
  
  sortedClasses.forEach(([className, classData], idx) => {
    const row: any[] = [idx + 1, className, classData.students.length];
    let classBreakfast = 0, classLunch = 0, classDinner = 0;

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      let bPresent = 0, lPresent = 0, dPresent = 0;
      let hasAnyReport = false;

      classData.students.forEach(student => {
        const dayData = student.attendance.get(dateStr);
        if (dayData) {
          if (dayData.breakfast !== null || dayData.lunch !== null || dayData.dinner !== null) {
            hasAnyReport = true;
          }
          if (dayData.breakfast === true) bPresent++;
          if (dayData.lunch === true) lPresent++;
          if (dayData.dinner === true) dPresent++;
        }
      });

      if (!hasAnyReport) {
        row.push('-');
      } else if (mealFilter === 'breakfast') {
        row.push(bPresent);
      } else if (mealFilter === 'lunch_dinner') {
        row.push(`${lPresent}/${dPresent}`);
      } else {
        row.push(`${bPresent}/${lPresent}/${dPresent}`);
      }

      if (!dayTotals.has(dateStr)) {
        dayTotals.set(dateStr, { breakfast: 0, lunch: 0, dinner: 0 });
      }
      const dt = dayTotals.get(dateStr)!;
      dt.breakfast += bPresent;
      dt.lunch += lPresent;
      dt.dinner += dPresent;

      classBreakfast += bPresent;
      classLunch += lPresent;
      classDinner += dPresent;
    });

    const riceRate = config.ricePerStudent ?? 0.2;
    if (mealFilter === 'all') {
      const classRice = (classLunch + classDinner) * riceRate;
      row.push(classBreakfast, classLunch, classDinner, classRice.toFixed(2));
    } else if (mealFilter === 'breakfast') {
      row.push(classBreakfast);
    } else {
      const classRice = (classLunch + classDinner) * riceRate;
      row.push(classLunch, classDinner, classRice.toFixed(2));
    }
    dataRows.push(row);

    grandBreakfast += classBreakfast;
    grandLunch += classLunch;
    grandDinner += classDinner;
  });

  // Totals row
  const totalsRow: any[] = ['', 'TỔNG CỘNG', students.length];
  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dt = dayTotals.get(dateStr);
    if (!dt) {
      totalsRow.push('-');
    } else if (mealFilter === 'breakfast') {
      totalsRow.push(dt.breakfast);
    } else if (mealFilter === 'lunch_dinner') {
      totalsRow.push(`${dt.lunch}/${dt.dinner}`);
    } else {
      totalsRow.push(`${dt.breakfast}/${dt.lunch}/${dt.dinner}`);
    }
  });
  const riceRate2 = config.ricePerStudent ?? 0.2;
  const grandRice = (grandLunch + grandDinner) * riceRate2;
  if (mealFilter === 'all') {
    totalsRow.push(grandBreakfast, grandLunch, grandDinner, grandRice.toFixed(2));
  } else if (mealFilter === 'breakfast') {
    totalsRow.push(grandBreakfast);
  } else {
    totalsRow.push(grandLunch, grandDinner, grandRice.toFixed(2));
  }

  // Daily combined totals row (lunch + dinner per day)
  const dailyCombinedRow: any[] = ['', 'TỔNG ĂN/NGÀY', ''];
  if (mealFilter === 'lunch_dinner' || mealFilter === 'all') {
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dt = dayTotals.get(dateStr);
      if (!dt) {
        dailyCombinedRow.push('-');
      } else {
        dailyCombinedRow.push(dt.lunch + dt.dinner);
      }
    });
    if (mealFilter === 'all') {
      dailyCombinedRow.push('', grandLunch + grandDinner, '', '');
    } else {
      dailyCombinedRow.push(grandLunch + grandDinner, '', '');
    }
  }

  // Note row
  const noteRows: any[][] = [[]];
  if (mealFilter === 'breakfast') {
    noteRows.push(['Ghi chú: Mỗi ô hiển thị số suất ăn sáng']);
  } else if (mealFilter === 'lunch_dinner') {
    noteRows.push([`Ghi chú: Mỗi ô hiển thị Trưa/Tối. Gạo = ${riceRate2}kg × (Trưa + Tối)`]);
  } else {
    noteRows.push([`Ghi chú: Mỗi ô ngày hiển thị Sáng/Trưa/Tối (số suất ăn). Gạo = ${riceRate2}kg × (Trưa + Tối)`]);
  }

  // Title based on filter
  const filterLabel = mealFilter === 'breakfast' ? ' - BỮA SÁNG' : mealFilter === 'lunch_dinner' ? ' - BỮA TRƯA & TỐI' : '';

  // Header info rows
  const headerInfoRows: any[][] = [
    [`THỐNG KÊ BỮA ĂN TOÀN TRƯỜNG${filterLabel}`],
    [`Trường: ${config.schoolName}`],
    [`Thời gian: ${config.dateRange.label}`],
    [config.reporterName ? `Người xuất: ${config.reporterName}` : ''],
    [`Ngày xuất: ${format(config.exportTime, 'HH:mm dd/MM/yyyy', { locale: vi })}`],
    [],
  ];

  const hasDailyCombined = mealFilter === 'lunch_dinner' || mealFilter === 'all';
  const wsData: any[][] = [...headerInfoRows, headerRow, ...dataRows, [], totalsRow, ...(hasDailyCombined ? [dailyCombinedRow] : []), ...noteRows];
  const numCols = headerRow.length;

  // Column widths
  const numSummaryCols = mealFilter === 'all' ? 4 : mealFilter === 'breakfast' ? 1 : 3;
  const columnWidths = [
    5, 12, 6,
    ...days.map(() => 10),
    ...Array(numSummaryCols).fill(8),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  fitColumnsToA4(ws, columnWidths);

  if (!ws['!merges']) ws['!merges'] = [];
  for (let i = 0; i < 5; i++) {
    if (wsData[i] && wsData[i][0]) {
      ws['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: numCols - 1 } });
    }
  }

  const columnAlignments: CellAlign[] = [
    'center', 'left', 'center',
    ...days.map(() => 'center' as CellAlign),
    ...Array(numSummaryCols).fill('center' as CellAlign),
  ];
  
  applyProfessionalStyle(ws, {
    headerRowIndex: 6,
    dataStartRow: 7,
    dataRowCount: dataRows.length,
    numCols,
    columnAlignments,
    hasTotalsRow: true,
    totalsRowIndex: 7 + dataRows.length + 1,
    numTitleRows: 6,
  });

  return ws;
}

export function exportMealStatistics(
  students: MealStudentData[],
  config: ExcelExportConfig
): void {
  const wb = XLSX.utils.book_new();
  const days = eachDayOfInterval({ start: config.dateRange.start, end: config.dateRange.end });

  // Debug: Log received student data
  console.log(`[Excel Export] Processing ${students.length} students for ${days.length} days`);

  // Group students by class and sort by grade
  const classeMap = new Map<string, { grade: number; students: MealStudentData[] }>();
  
  students.forEach(student => {
    const className = student.className;
    if (!classeMap.has(className)) {
      classeMap.set(className, {
        grade: student.classGrade || 0,
        students: []
      });
    }
    classeMap.get(className)!.students.push(student);
  });

  // Sort classes by grade (small to large) then by name
  const sortedClasses = Array.from(classeMap.entries()).sort((a, b) => {
    if (a[1].grade !== b[1].grade) return a[1].grade - b[1].grade;
    return a[0].localeCompare(b[0], 'vi');
  });

  // Debug: Log class-level summary of attendance data
  console.log(`[Excel Export] Class-level attendance summary:`);
  sortedClasses.forEach(([className, classData]) => {
    let totalBreakfast = 0, totalLunch = 0, totalDinner = 0;
    let hasAnyData = false;
    
    classData.students.forEach(student => {
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayData = student.attendance.get(dateStr);
        if (dayData) {
          if (dayData.breakfast === true) totalBreakfast++;
          if (dayData.lunch === true) totalLunch++;
          if (dayData.dinner === true) totalDinner++;
          if (dayData.breakfast !== null || dayData.lunch !== null || dayData.dinner !== null) {
            hasAnyData = true;
          }
        }
      });
    });
    
    console.log(`  ${className}: ${classData.students.length} students, B=${totalBreakfast}, L=${totalLunch}, D=${totalDinner}, hasData=${hasAnyData}`);
  });

  // Sheet 1: School Summary (5 columns: STT, Lớp, Sáng, Trưa, Tối)
  const schoolSummarySheet = createSchoolSummarySheet(students, days, config);
  XLSX.utils.book_append_sheet(wb, schoolSummarySheet, 'Toàn trường');

  // Create sheet for each class (detailed student-level stats)
  sortedClasses.forEach(([className, classData]) => {
    const classSheet = createMealStatsSheet(
      classData.students,
      days,
      config,
      `THỐNG KÊ BỮA ĂN - LỚP ${className}${config.mealFilter === 'breakfast' ? ' (Sáng)' : config.mealFilter === 'lunch_dinner' ? ' (Trưa & Tối)' : ''}`
    );
    
    // Truncate sheet name if too long (Excel limit is 31 chars)
    const sheetName = className.length > 28 ? className.substring(0, 28) : className;
    XLSX.utils.book_append_sheet(wb, classSheet, sheetName);
  });

  // Add daily summary sheet
  const dailySummary: any[][] = [
    ['Ngày', 'Tổng HS', 'Ăn sáng', 'Vắng sáng', 'Ăn trưa', 'Vắng trưa', 'Ăn tối', 'Vắng tối', 'Gạo (kg)'],
  ];

  // Track grand totals for all days
  let grandBPresent = 0, grandLPresent = 0, grandDPresent = 0;
  let grandBAbsent = 0, grandLAbsent = 0, grandDAbsent = 0;

  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const hasReport = hasReportForDate(students, dateStr);
    
    if (!hasReport) {
      dailySummary.push([
        format(day, 'dd/MM/yyyy'),
        '-', '-', '-', '-', '-', '-', '-', '-'
      ]);
    } else {
      let bPresent = 0, lPresent = 0, dPresent = 0;
      let bReported = 0, lReported = 0, dReported = 0;

      students.forEach(student => {
        const dayData = student.attendance.get(dateStr);
        // Only count if explicitly reported
        if (dayData?.breakfast === true) { bPresent++; bReported++; }
        else if (dayData?.breakfast === false) { bReported++; }
        
        if (dayData?.lunch === true) { lPresent++; lReported++; }
        else if (dayData?.lunch === false) { lReported++; }
        
        if (dayData?.dinner === true) { dPresent++; dReported++; }
        else if (dayData?.dinner === false) { dReported++; }
      });

      // Accumulate grand totals
      grandBPresent += bPresent;
      grandLPresent += lPresent;
      grandDPresent += dPresent;
      grandBAbsent += (bReported - bPresent);
      grandLAbsent += (lReported - lPresent);
      grandDAbsent += (dReported - dPresent);

      const riceRateDaily = config.ricePerStudent ?? 0.2;
      const dailyRice = (lPresent + dPresent) * riceRateDaily;

      dailySummary.push([
        format(day, 'dd/MM/yyyy'),
        students.length,
        bPresent,
        bReported - bPresent,
        lPresent,
        lReported - lPresent,
        dPresent,
        dReported - dPresent,
        dailyRice.toFixed(2),
      ]);
    }
  });

  // Add grand total row
  const grandRice = (grandLPresent + grandDPresent) * (config.ricePerStudent ?? 0.2);
  dailySummary.push([]); // Empty row
  dailySummary.push([
    'TỔNG CỘNG',
    '',
    grandBPresent,
    grandBAbsent,
    grandLPresent,
    grandLAbsent,
    grandDPresent,
    grandDAbsent,
    grandRice.toFixed(2),
  ]);

  // Create daily summary sheet with header info
  const dailyHeaderRows: any[][] = [
    ['THỐNG KÊ BỮA ĂN THEO NGÀY'],
    [`Trường: ${config.schoolName}`],
    [`Thời gian: ${config.dateRange.label}`],
    [`Ngày xuất: ${format(config.exportTime, 'HH:mm dd/MM/yyyy', { locale: vi })}`],
    [],
  ];

  const dailyWsData = [...dailyHeaderRows, ...dailySummary];
  const dailyWs = XLSX.utils.aoa_to_sheet(dailyWsData);
  fitColumnsToA4(dailyWs, [12, 8, 10, 10, 10, 10, 10, 10, 10]);

  // Merge header cells
  if (!dailyWs['!merges']) dailyWs['!merges'] = [];
  for (let i = 0; i < 4; i++) {
    dailyWs['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: 8 } });
  }

  // Apply professional styling
  const columnAlignments: CellAlign[] = [
    'left',   // Ngày
    'center', // Tổng HS
    'center', // Ăn sáng
    'center', // Vắng sáng
    'center', // Ăn trưa
    'center', // Vắng trưa
    'center', // Ăn tối
    'center', // Vắng tối
    'center', // Gạo
  ];
  
  const dataRowCount = dailySummary.length - 3; // Exclude header, empty row, and totals
  
  applyProfessionalStyle(dailyWs, {
    headerRowIndex: 5,
    dataStartRow: 6,
    dataRowCount,
    numCols: 9,
    columnAlignments,
    hasTotalsRow: true,
    totalsRowIndex: 5 + dailySummary.length - 1,
    numTitleRows: 5,
  });

  // Style the totals row (last row with data)
  const totalsRowIndex = 5 + dailySummary.length - 1; // Header rows + all summary rows - 1 for 0-index
  for (let col = 0; col < 9; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalsRowIndex, c: col });
    if (dailyWs[cellRef]) {
      dailyWs[cellRef].s = {
        fill: { fgColor: { rgb: 'FFF3E0' } },
        font: { bold: true, sz: 11 },
        alignment: { horizontal: 'center' },
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, dailyWs, 'Theo ngày');

  const filterSuffix = config.mealFilter === 'breakfast' ? '_sang' : config.mealFilter === 'lunch_dinner' ? '_trua_toi' : '';
  const fileName = `Thong_ke_bua_an${filterSuffix}_${format(config.dateRange.start, 'dd-MM-yyyy')}_${format(config.dateRange.end, 'dd-MM-yyyy')}.xlsx`;
  saveWorkbook(wb, fileName);
}

// Apply header style to a row
function applyHeaderStyle(ws: XLSX.WorkSheet, rowIndex: number, numCols: number): void {
  for (let col = 0; col < numCols; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: col });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        fill: { fgColor: { rgb: ExcelColors.headerBg } },
        font: ExcelFonts.header,
        alignment: { horizontal: 'center', vertical: 'center' },
        border: ExcelBorders.thin,
      };
    }
  }
}

// Single report export (for individual report cards)
export function exportSingleAttendanceReport(
  report: AttendanceReportData,
  config: Omit<ExcelExportConfig, 'dateRange'>,
  type: 'boarding' | 'evening_study',
  customTypeLabel?: string
): void {
  const typeLabel = customTypeLabel || (type === 'boarding' ? 'NỘI TRÚ' : 'TỰ HỌC TỐI');
  const wb = XLSX.utils.book_new();

  const wsData: any[][] = [
    [`ĐIỂM DANH ${typeLabel}`],
    [`Trường: ${config.schoolName}`],
    [`Ngày: ${format(new Date(report.date), 'EEEE, dd/MM/yyyy', { locale: vi })}`],
    [`Buổi: ${report.sessionLabel}`],
    [`Người báo cáo: ${report.reporter}`],
    [`Thời gian báo cáo: ${report.reportTime}`],
    [`Ngày xuất: ${format(config.exportTime, 'HH:mm dd/MM/yyyy', { locale: vi })}`],
    [],
    ['THỐNG KÊ SĨ SỐ'],
    ['Tổng số học sinh', report.total],
    ['Có mặt', report.present],
    ['Vắng', report.absent],
    ['Tỷ lệ có mặt', `${((report.present / report.total) * 100).toFixed(1)}%`],
    [],
  ];

  if (report.notes) {
    wsData.push(['GHI CHÚ']);
    wsData.push([report.notes]);
    wsData.push([]);
  }

  if (report.absentStudents.length > 0) {
    wsData.push(['DANH SÁCH HỌC SINH VẮNG']);
    wsData.push(['STT', 'Họ và tên', 'Lớp', 'Phép/Không phép', 'Lý do']);
    report.absentStudents.forEach((s, idx) => {
      wsData.push([
        idx + 1,
        s.name,
        s.className,
        s.excused ? 'Có phép' : 'Không phép',
        s.reason || '',
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  fitColumnsToA4(ws, [8, 30, 12, 15, 35]);

  // Merge title cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo');

  const fileName = `Bao_cao_${type === 'boarding' ? 'noi_tru' : 'tu_hoc'}_${report.date}_${report.session}.xlsx`;
  saveWorkbook(wb, fileName);
}

// Export absent students by meal group
export interface AbsentStudentByMealGroup {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  mealGroup?: string;
  excused: boolean;
  reason: string;
}

export interface MealAbsentData {
  breakfast: AbsentStudentByMealGroup[];
  lunch: AbsentStudentByMealGroup[];
  dinner: AbsentStudentByMealGroup[];
}

export function exportAbsentStudentsByMealGroup(
  data: MealAbsentData,
  config: Omit<ExcelExportConfig, 'dateRange'> & { date: Date }
): void {
  const wb = XLSX.utils.book_new();
  const dateStr = format(config.date, 'dd/MM/yyyy');
  const dayName = format(config.date, 'EEEE', { locale: vi });

  // Helper to create a sheet for each meal
  const createMealSheet = (
    mealName: string,
    mealLabel: string,
    students: AbsentStudentByMealGroup[]
  ): XLSX.WorkSheet => {
    // Group by meal group
    const groupedByMealGroup = new Map<string, AbsentStudentByMealGroup[]>();
    students.forEach(student => {
      const group = student.mealGroup || 'Chưa phân mâm';
      if (!groupedByMealGroup.has(group)) {
        groupedByMealGroup.set(group, []);
      }
      groupedByMealGroup.get(group)!.push(student);
    });

    // Sort meal groups naturally
    const sortedGroups = Array.from(groupedByMealGroup.keys()).sort((a, b) => {
      // "Chưa phân mâm" always last
      if (a === 'Chưa phân mâm') return 1;
      if (b === 'Chưa phân mâm') return -1;
      // Extract numbers for natural sorting
      const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

    const wsData: any[][] = [
      [`DANH SÁCH HỌC SINH VẮNG - ${mealLabel.toUpperCase()}`],
      [`Trường: ${config.schoolName}`],
      [`Ngày: ${dayName}, ${dateStr}`],
      [`Người xuất: ${config.reporterName || ''}`],
      [`Ngày xuất: ${format(config.exportTime, 'HH:mm dd/MM/yyyy', { locale: vi })}`],
      [],
    ];

    if (students.length === 0) {
      wsData.push(['Không có học sinh vắng']);
    } else {
      // Summary by meal group
      wsData.push(['THỐNG KÊ THEO MÂM']);
      wsData.push(['Mâm', 'Số lượng vắng']);
      sortedGroups.forEach(group => {
        const count = groupedByMealGroup.get(group)?.length || 0;
        wsData.push([group, count]);
      });
      wsData.push(['TỔNG CỘNG', students.length]);
      wsData.push([]);

      // Detailed list by meal group
      wsData.push(['CHI TIẾT THEO MÂM']);
      sortedGroups.forEach(group => {
        const groupStudents = groupedByMealGroup.get(group) || [];
        if (groupStudents.length > 0) {
          wsData.push([]);
          wsData.push([`MÂM: ${group} (${groupStudents.length} học sinh)`]);
          wsData.push(['STT', 'Họ và tên', 'Lớp', 'Phép/KP', 'Lý do']);
          
          // Sort students by class grade then name
          groupStudents
            .sort((a, b) => {
              if (a.classGrade !== b.classGrade) return a.classGrade - b.classGrade;
              return vietnameseNameSortCompare(a.name, b.name);
            })
            .forEach((student, idx) => {
              wsData.push([
                idx + 1,
                student.name,
                student.className,
                student.excused ? 'P' : 'KP',
                student.reason || '',
              ]);
            });
        }
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    fitColumnsToA4(ws, [8, 28, 10, 8, 30]);

    // Merge title cells
    if (!ws['!merges']) ws['!merges'] = [];
    for (let i = 0; i < 5; i++) {
      ws['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: 4 } });
    }

    return ws;
  };

  // Create sheets for each meal
  const breakfastWs = createMealSheet('breakfast', 'Bữa sáng', data.breakfast);
  const lunchWs = createMealSheet('lunch', 'Bữa trưa', data.lunch);
  const dinnerWs = createMealSheet('dinner', 'Bữa tối', data.dinner);

  XLSX.utils.book_append_sheet(wb, breakfastWs, 'Vắng sáng');
  XLSX.utils.book_append_sheet(wb, lunchWs, 'Vắng trưa');
  XLSX.utils.book_append_sheet(wb, dinnerWs, 'Vắng tối');

  const fileName = `DS_vang_theo_mam_${format(config.date, 'dd-MM-yyyy')}.xlsx`;
  saveWorkbook(wb, fileName);
}
