import * as XLSX from 'xlsx';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';

export type DateRangeType = 'day' | 'week' | 'month';

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

// Get date range based on type
export function getDateRange(date: Date, rangeType: DateRangeType): DateRange {
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

    const totalRice = (lunchCount + dinnerCount) * 0.2;
    row.push(breakfastCount, lunchCount, dinnerCount, totalRice.toFixed(1));

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
  
  const grandTotalRice = (grandTotalLunch + grandTotalDinner) * 0.2;
  totalsRow.push(grandTotalBreakfast, grandTotalLunch, grandTotalDinner, grandTotalRice.toFixed(1));

  // Note rows
  const noteRows: any[][] = [
    [],
    ['Ghi chú: x = ăn, o = vắng, - = chưa báo cáo. Mỗi ô: Sáng/Trưa/Tối'],
    ['Lượng gạo: 0.2kg/học sinh cho mỗi bữa trưa và tối'],
    [`Tổng gạo: ${grandTotalRice.toFixed(1)} kg`],
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

  // Apply header style (row 7 after 6 header info rows)
  const headerRowIndex = 6;
  for (let col = 0; col < totalCols; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
    if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
    ws[cellRef].s = {
      fill: { fgColor: { rgb: '1565C0' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  // Apply alternating row colors and red for absent cells
  const dataStartRow = 7;
  dataRows.forEach((row, rowIdx) => {
    const actualRow = dataStartRow + rowIdx;
    const isEvenRow = rowIdx % 2 === 0;
    const bgColor = isEvenRow ? 'FFFFFF' : 'E3F2FD'; // White or light blue

    for (let col = 0; col < row.length; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: actualRow, c: col });
      const cellValue = row[col];
      
      if (!ws[cellRef]) ws[cellRef] = { v: cellValue, t: typeof cellValue === 'number' ? 'n' : 's' };
      
      // Check if it's a meal cell with absence
      const isMealCell = col >= 5 && col < 5 + days.length;
      const hasAbsence = isMealCell && typeof cellValue === 'string' && cellValue.includes('o');
      
      if (hasAbsence) {
        ws[cellRef].s = {
          fill: { fgColor: { rgb: 'FFCDD2' } }, // Light red
          font: { color: { rgb: 'C62828' }, sz: 9 },
          alignment: { horizontal: 'center' },
        };
      } else {
        ws[cellRef].s = {
          fill: { fgColor: { rgb: bgColor } },
          font: { sz: 9 },
          alignment: { horizontal: col < 2 ? 'left' : 'center' },
        };
      }
    }
  });

  // Style totals row with bold
  const totalsRowIndex = dataStartRow + dataRows.length + 1;
  for (let col = 0; col < totalsRow.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalsRowIndex, c: col });
    if (!ws[cellRef]) ws[cellRef] = { v: totalsRow[col], t: typeof totalsRow[col] === 'number' ? 'n' : 's' };
    ws[cellRef].s = {
      fill: { fgColor: { rgb: 'FFF3E0' } }, // Light orange
      font: { bold: true, sz: 10 },
      alignment: { horizontal: 'center' },
    };
  }

  return ws;
}

// Create summary sheet with class totals (Sheet 1: Toàn trường)
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

  // Calculate totals per class
  const classRows: { className: string; breakfast: number; lunch: number; dinner: number }[] = [];
  
  sortedClasses.forEach(([className, classData]) => {
    let breakfastTotal = 0;
    let lunchTotal = 0;
    let dinnerTotal = 0;

    classData.students.forEach(student => {
      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayData = student.attendance.get(dateStr);
        
        if (dayData) {
          if (dayData.breakfast === true) breakfastTotal++;
          if (dayData.lunch === true) lunchTotal++;
          if (dayData.dinner === true) dinnerTotal++;
        }
      });
    });

    classRows.push({
      className,
      breakfast: breakfastTotal,
      lunch: lunchTotal,
      dinner: dinnerTotal,
    });
  });

  // Build worksheet data
  const headerInfoRows: any[][] = [
    ['THỐNG KÊ BỮA ĂN TOÀN TRƯỜNG'],
    [`Trường: ${config.schoolName}`],
    [`Thời gian: ${config.dateRange.label}`],
    [config.reporterName ? `Người xuất: ${config.reporterName}` : ''],
    [`Ngày xuất: ${format(config.exportTime, 'HH:mm dd/MM/yyyy', { locale: vi })}`],
    [],
  ];

  const headerRow = ['STT', 'Lớp', 'Bữa sáng', 'Bữa trưa', 'Bữa tối', 'Số gạo (kg)'];
  
  const dataRows: any[][] = classRows.map((row, idx) => {
    const rice = (row.lunch + row.dinner) * 0.2;
    return [
      idx + 1,
      row.className,
      row.breakfast,
      row.lunch,
      row.dinner,
      rice.toFixed(1),
    ];
  });

  // Calculate grand totals
  const grandBreakfast = classRows.reduce((sum, r) => sum + r.breakfast, 0);
  const grandLunch = classRows.reduce((sum, r) => sum + r.lunch, 0);
  const grandDinner = classRows.reduce((sum, r) => sum + r.dinner, 0);
  const grandRice = (grandLunch + grandDinner) * 0.2;
  
  const totalsRow = ['', 'TỔNG CỘNG', grandBreakfast, grandLunch, grandDinner, grandRice.toFixed(1)];

  const wsData: any[][] = [...headerInfoRows, headerRow, ...dataRows, [], totalsRow];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

  // Merge header info cells
  if (!ws['!merges']) ws['!merges'] = [];
  for (let i = 0; i < 5; i++) {
    if (wsData[i] && wsData[i][0]) {
      ws['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: 5 } });
    }
  }

  // Style header row (row 7)
  const headerRowIndex = 6;
  for (let col = 0; col < 6; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
    if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
    ws[cellRef].s = {
      fill: { fgColor: { rgb: '1565C0' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
  }

  // Style data rows
  const dataStartRow = 7;
  dataRows.forEach((row, rowIdx) => {
    const actualRow = dataStartRow + rowIdx;
    const isEvenRow = rowIdx % 2 === 0;
    const bgColor = isEvenRow ? 'FFFFFF' : 'E3F2FD';

    for (let col = 0; col < row.length; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: actualRow, c: col });
      if (!ws[cellRef]) ws[cellRef] = { v: row[col], t: typeof row[col] === 'number' ? 'n' : 's' };
      ws[cellRef].s = {
        fill: { fgColor: { rgb: bgColor } },
        font: { sz: 10 },
        alignment: { horizontal: col < 2 ? 'left' : 'center' },
      };
    }
  });

  // Style totals row
  const totalsRowIndex = dataStartRow + dataRows.length + 1;
  for (let col = 0; col < totalsRow.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalsRowIndex, c: col });
    if (!ws[cellRef]) ws[cellRef] = { v: totalsRow[col], t: typeof totalsRow[col] === 'number' ? 'n' : 's' };
    ws[cellRef].s = {
      fill: { fgColor: { rgb: 'FFF3E0' } },
      font: { bold: true, sz: 11 },
      alignment: { horizontal: 'center' },
    };
  }

  return ws;
}

export function exportMealStatistics(
  students: MealStudentData[],
  config: ExcelExportConfig
): void {
  const wb = XLSX.utils.book_new();
  const days = eachDayOfInterval({ start: config.dateRange.start, end: config.dateRange.end });

  // Sheet 1: School Summary (5 columns: STT, Lớp, Sáng, Trưa, Tối)
  const schoolSummarySheet = createSchoolSummarySheet(students, days, config);
  XLSX.utils.book_append_sheet(wb, schoolSummarySheet, 'Toàn trường');

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

      const dailyRice = (lPresent + dPresent) * 0.2;

      dailySummary.push([
        format(day, 'dd/MM/yyyy'),
        students.length,
        bPresent,
        bReported - bPresent,
        lPresent,
        lReported - lPresent,
        dPresent,
        dReported - dPresent,
        dailyRice.toFixed(1),
      ]);
    }
  });

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

  // Style header row (row 6)
  for (let col = 0; col < 9; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 5, c: col });
    if (!dailyWs[cellRef]) dailyWs[cellRef] = { v: '', t: 's' };
    dailyWs[cellRef].s = {
      fill: { fgColor: { rgb: '1565C0' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center' },
    };
  }

  // Apply alternating rows
  for (let rowIdx = 0; rowIdx < dailySummary.length - 1; rowIdx++) {
    const actualRow = 6 + rowIdx;
    const isEvenRow = rowIdx % 2 === 0;
    const bgColor = isEvenRow ? 'FFFFFF' : 'E3F2FD';
    
    for (let col = 0; col < 9; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: actualRow, c: col });
      if (dailyWs[cellRef]) {
        dailyWs[cellRef].s = {
          fill: { fgColor: { rgb: bgColor } },
          alignment: { horizontal: 'center' },
        };
      }
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
        fill: { fgColor: { rgb: '1565C0' } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
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
