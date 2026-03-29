import XLSX from 'xlsx-js-style';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  ExcelColors, 
  ExcelFonts, 
  ExcelBorders, 
  applyProfessionalStyle,
  applyTitleRowsStyle,
  CellAlign,
  getColumnAlignments 
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

// Professional Excel export config
export interface ExcelExportConfig {
  schoolName: string;
  title: string;
  subtitle?: string;
  dateRange: DateRange;
  reporterName?: string;
  exportTime: Date;
  ricePerStudent?: number;
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

  // Set column widths
  ws['!cols'] = columnWidths.map(w => ({ wch: w }));

  // Set print settings for A4 landscape
  ws['!margins'] = {
    left: 0.5,
    right: 0.5,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };

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
  type: 'boarding' | 'evening_study'
): void {
  const wb = XLSX.utils.book_new();
  const typeLabel = type === 'boarding' ? 'NỘI TRÚ' : 'TỰ HỌC TỐI';

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
    { ...config, title: `BÁO CÁO ĐIỂM DANH ${typeLabel}` },
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
      { ...config, title: `DANH SÁCH HỌC SINH VẮNG ${typeLabel}` },
      [5, 25, 10, 12, 15, 12, 30]
    );
    applyHeaderStyle(absentWs, 6, 7);
    XLSX.utils.book_append_sheet(wb, absentWs, 'DS Vắng');
  }

  const fileName = `Diem_danh_${type === 'boarding' ? 'noi_tru' : 'tu_hoc'}_${format(config.dateRange.start, 'dd-MM-yyyy')}_${format(config.dateRange.end, 'dd-MM-yyyy')}.xlsx`;
  XLSX.writeFile(wb, fileName);
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

// Create meal statistics sheet for a group of students
function createMealStatsSheet(
  students: MealStudentData[],
  days: Date[],
  config: ExcelExportConfig,
  sheetTitle: string
): XLSX.WorkSheet {
  // Build header row
  const headerRow: any[] = ['STT', 'Họ và tên', 'Lớp', 'Phòng', 'Mâm'];
  
  days.forEach(day => {
    headerRow.push(format(day, 'dd'));
  });
  
  headerRow.push('Sáng', 'Trưa', 'Tối', 'Gạo (kg)');

  // Build data rows
  const dataRows: any[][] = [];
  
  // Track column totals
  const dayTotals: Map<string, { breakfast: number; lunch: number; dinner: number }> = new Map();
  let grandTotalBreakfast = 0;
  let grandTotalLunch = 0;
  let grandTotalDinner = 0;

  students.forEach((student, idx) => {
    const row: any[] = [
      idx + 1,
      student.name,
      student.className,
      student.roomNumber || '',
      student.mealGroup || '',
    ];

    let breakfastCount = 0;
    let lunchCount = 0;
    let dinnerCount = 0;

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayData = student.attendance.get(dateStr);
      
      // Check if any meal has a report for this date
      const hasAnyReport = dayData && (dayData.breakfast !== null || dayData.lunch !== null || dayData.dinner !== null);
      
      if (!hasAnyReport) {
        // No report for this date - show dash and don't count
        row.push('-');
      } else {
        // Get actual values - null means no report for that specific meal
        const b = dayData?.breakfast;
        const l = dayData?.lunch;
        const d = dayData?.dinner;

        // Only count if explicitly reported as present (true)
        if (b === true) breakfastCount++;
        if (l === true) lunchCount++;
        if (d === true) dinnerCount++;

        // Update day totals
        if (!dayTotals.has(dateStr)) {
          dayTotals.set(dateStr, { breakfast: 0, lunch: 0, dinner: 0 });
        }
        const totals = dayTotals.get(dateStr)!;
        if (b === true) totals.breakfast++;
        if (l === true) totals.lunch++;
        if (d === true) totals.dinner++;

        // Display: x = present, o = absent, - = no report
        const bChar = b === null ? '-' : (b ? 'x' : 'o');
        const lChar = l === null ? '-' : (l ? 'x' : 'o');
        const dChar = d === null ? '-' : (d ? 'x' : 'o');
        
        const display = `${bChar}${lChar}${dChar}`;
        row.push(display);
      }
    });

    const riceRate = config.ricePerStudent ?? 0.2;
    const totalRice = (lunchCount + dinnerCount) * riceRate;
    row.push(breakfastCount, lunchCount, dinnerCount, totalRice.toFixed(2));

    grandTotalBreakfast += breakfastCount;
    grandTotalLunch += lunchCount;
    grandTotalDinner += dinnerCount;

    dataRows.push(row);
  });

  // Totals row - sum by columns
  const totalsRow: any[] = ['', 'TỔNG CỘNG', '', '', ''];
  
  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const totals = dayTotals.get(dateStr);
    
    if (!totals) {
      // No reports for this date
      totalsRow.push('-');
    } else {
      // Show total for each meal type in the day
      totalsRow.push(`${totals.breakfast}/${totals.lunch}/${totals.dinner}`);
    }
  });
  
  const riceRate = config.ricePerStudent ?? 0.2;
  const grandTotalRice = (grandTotalLunch + grandTotalDinner) * riceRate;
  totalsRow.push(grandTotalBreakfast, grandTotalLunch, grandTotalDinner, grandTotalRice.toFixed(2));

  // Note rows
  const noteRows: any[][] = [
    [],
    ['Ghi chú: x = ăn, o = vắng, - = chưa báo cáo. Mỗi ô: Sáng/Trưa/Tối'],
    [`Lượng gạo: ${riceRate}kg/học sinh cho mỗi bữa trưa và tối`],
    [`Tổng gạo: ${grandTotalRice.toFixed(2)} kg`],
  ];

  // Header info rows
  const headerInfoRows: any[][] = [
    [sheetTitle],
    [`Trường: ${config.schoolName}`],
    [`Thời gian: ${config.dateRange.label}`],
    [config.reporterName ? `Người xuất: ${config.reporterName}` : ''],
    [`Ngày xuất: ${format(config.exportTime, 'HH:mm dd/MM/yyyy', { locale: vi })}`],
    [],
  ];

  const wsData: any[][] = [...headerInfoRows, headerRow, ...dataRows, [], totalsRow, ...noteRows];

  // Column widths
  const columnWidths = [
    5, 22, 8, 6, 6,
    ...days.map(() => 5),
    6, 6, 6, 8
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = columnWidths.map(w => ({ wch: w }));

  // Print settings for A4 landscape
  ws['!margins'] = {
    left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2,
  };

  // Merge header info cells
  if (!ws['!merges']) ws['!merges'] = [];
  const totalCols = columnWidths.length;
  for (let i = 0; i < 5; i++) {
    if (wsData[i] && wsData[i][0]) {
      ws['!merges'].push({
        s: { r: i, c: 0 },
        e: { r: i, c: totalCols - 1 }
      });
    }
  }

  // Apply professional styling
  const numDays = days.length;
  const numTotalCols = 5 + numDays + 4; // STT, name, class, room, meal + days + totals
  const columnAlignments: CellAlign[] = [
    'center', // STT
    'left',   // Họ và tên
    'left',   // Lớp
    'center', // Phòng
    'center', // Mâm
    ...days.map(() => 'center' as CellAlign), // Days
    'center', 'center', 'center', 'center', // Totals
  ];
  
  // Meal cell columns (day columns)
  const mealCellColumns = Array.from({ length: numDays }, (_, i) => 5 + i);
  
  applyProfessionalStyle(ws, {
    headerRowIndex: 6,
    dataStartRow: 7,
    dataRowCount: dataRows.length,
    numCols: numTotalCols,
    columnAlignments,
    hasTotalsRow: true,
    totalsRowIndex: 7 + dataRows.length + 1,
    numTitleRows: 6,
    mealCellColumns,
  });

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

  // Build header row with day columns
  const headerRow: any[] = ['STT', 'Lớp', 'Sĩ số'];
  days.forEach(day => {
    headerRow.push(format(day, 'dd/MM'));
  });
  headerRow.push('Tổng sáng', 'Tổng trưa', 'Tổng tối', 'Gạo (kg)');

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
      } else {
        row.push(`${bPresent}/${lPresent}/${dPresent}`);
      }

      // Accumulate per-day school totals
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
    const classRice = (classLunch + classDinner) * riceRate;
    row.push(classBreakfast, classLunch, classDinner, classRice.toFixed(2));
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
    } else {
      totalsRow.push(`${dt.breakfast}/${dt.lunch}/${dt.dinner}`);
    }
  });
  const riceRate2 = config.ricePerStudent ?? 0.2;
  const grandRice = (grandLunch + grandDinner) * riceRate2;
  totalsRow.push(grandBreakfast, grandLunch, grandDinner, grandRice.toFixed(2));

  // Note row
  const noteRows: any[][] = [
    [],
    [`Ghi chú: Mỗi ô ngày hiển thị Sáng/Trưa/Tối (số suất ăn). Gạo = ${riceRate2}kg × (Trưa + Tối)`],
  ];

  // Header info rows
  const headerInfoRows: any[][] = [
    ['THỐNG KÊ BỮA ĂN TOÀN TRƯỜNG'],
    [`Trường: ${config.schoolName}`],
    [`Thời gian: ${config.dateRange.label}`],
    [config.reporterName ? `Người xuất: ${config.reporterName}` : ''],
    [`Ngày xuất: ${format(config.exportTime, 'HH:mm dd/MM/yyyy', { locale: vi })}`],
    [],
  ];

  const wsData: any[][] = [...headerInfoRows, headerRow, ...dataRows, [], totalsRow, ...noteRows];
  const numCols = headerRow.length;

  // Column widths
  const columnWidths = [
    5, 12, 6,
    ...days.map(() => 10),
    8, 8, 8, 9,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = columnWidths.map(w => ({ wch: w }));

  // Merge header info cells
  if (!ws['!merges']) ws['!merges'] = [];
  for (let i = 0; i < 5; i++) {
    if (wsData[i] && wsData[i][0]) {
      ws['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: numCols - 1 } });
    }
  }

  // Apply professional styling
  const columnAlignments: CellAlign[] = [
    'center', // STT
    'left',   // Lớp
    'center', // Sĩ số
    ...days.map(() => 'center' as CellAlign),
    'center', 'center', 'center', 'center',
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
      `THỐNG KÊ BỮA ĂN - LỚP ${className}`
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
  dailyWs['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
  ];

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

  const fileName = `Thong_ke_bua_an_${format(config.dateRange.start, 'dd-MM-yyyy')}_${format(config.dateRange.end, 'dd-MM-yyyy')}.xlsx`;
  XLSX.writeFile(wb, fileName);
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
  type: 'boarding' | 'evening_study'
): void {
  const typeLabel = type === 'boarding' ? 'NỘI TRÚ' : 'TỰ HỌC TỐI';
  const wb = XLSX.utils.book_new();

  const wsData: any[][] = [
    [`BÁO CÁO ĐIỂM DANH ${typeLabel}`],
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
  ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 35 }];

  // Merge title cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
  ];

  // Print setup for A4 landscape
  ws['!margins'] = {
    left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3,
  };

  XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo');

  const fileName = `Bao_cao_${type === 'boarding' ? 'noi_tru' : 'tu_hoc'}_${report.date}_${report.session}.xlsx`;
  XLSX.writeFile(wb, fileName);
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
              return a.name.localeCompare(b.name, 'vi');
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
    ws['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 30 }];

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
  XLSX.writeFile(wb, fileName);
}
