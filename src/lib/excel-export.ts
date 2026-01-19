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
  roomNumber?: string;
  mealGroup?: string;
  attendance: Map<string, { breakfast: boolean; lunch: boolean; dinner: boolean }>;
}

export function exportMealStatistics(
  students: MealStudentData[],
  config: ExcelExportConfig
): void {
  const wb = XLSX.utils.book_new();
  const days = eachDayOfInterval({ start: config.dateRange.start, end: config.dateRange.end });

  // Build header rows
  const headerRow1: any[] = ['STT', 'Họ và tên', 'Lớp', 'Phòng', 'Mâm'];
  const headerRow2: any[] = ['', '', '', '', ''];

  days.forEach(day => {
    headerRow1.push(format(day, 'dd/MM'));
    headerRow2.push('S/T/C');
  });

  headerRow1.push('Tổng S', 'Tổng T', 'Tổng C', 'Gạo (kg)');
  headerRow2.push('', '', '', '');

  // Build data rows
  const dataRows: any[][] = [];
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

      const b = dayData?.breakfast ?? true;
      const l = dayData?.lunch ?? true;
      const d = dayData?.dinner ?? true;

      if (b) breakfastCount++;
      if (l) lunchCount++;
      if (d) dinnerCount++;

      const display = `${b ? 'x' : 'o'}${l ? 'x' : 'o'}${d ? 'x' : 'o'}`;
      row.push(display);
    });

    const totalRice = (lunchCount + dinnerCount) * 0.2;
    row.push(breakfastCount, lunchCount, dinnerCount, totalRice.toFixed(1));

    grandTotalBreakfast += breakfastCount;
    grandTotalLunch += lunchCount;
    grandTotalDinner += dinnerCount;

    dataRows.push(row);
  });

  // Totals row
  const totalsRow: any[] = ['', 'TỔNG CỘNG', '', '', ''];
  days.forEach(() => totalsRow.push(''));
  const grandTotalRice = (grandTotalLunch + grandTotalDinner) * 0.2;
  totalsRow.push(grandTotalBreakfast, grandTotalLunch, grandTotalDinner, grandTotalRice.toFixed(1));

  // Note rows
  const noteRows: any[][] = [
    [],
    ['Ghi chú: x = ăn, o = vắng. Mỗi ô hiển thị: Sáng/Trưa/Chiều'],
    ['Lượng gạo tính: 0.2kg/học sinh cho mỗi bữa trưa và tối'],
    [`Tổng gạo tháng: ${grandTotalRice.toFixed(1)} kg`],
  ];

  const wsData: any[][] = [headerRow1, headerRow2, ...dataRows, [], totalsRow, ...noteRows];

  // Create worksheet
  const columnWidths = [
    5, 25, 10, 8, 8,
    ...days.map(() => 7),
    8, 8, 8, 10
  ];

  const ws = createProfessionalWorksheet(wsData, config, columnWidths);

  // Apply styles to header rows (row 7 and 8 after 6 header rows)
  applyHeaderStyle(ws, 6, days.length + 9);
  applyHeaderStyle(ws, 7, days.length + 9);

  // Apply red background to cells with absences
  const dataStartRow = 8; // 0-indexed: after 6 header rows + 2 table header rows
  dataRows.forEach((row, rowIdx) => {
    days.forEach((_, dayIdx) => {
      const cellValue = row[5 + dayIdx] as string;
      if (cellValue && cellValue.includes('o')) {
        const cellRef = XLSX.utils.encode_cell({ r: dataStartRow + rowIdx, c: 5 + dayIdx });
        if (!ws[cellRef]) ws[cellRef] = { v: cellValue, t: 's' };
        ws[cellRef].s = { 
          fill: { fgColor: { rgb: 'FFCDD2' } },
          font: { color: { rgb: 'C62828' } }
        };
      }
    });
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Thống kê bữa ăn');

  // Add daily summary sheet
  const dailySummary: any[][] = [
    ['Ngày', 'Tổng HS', 'Ăn sáng', 'Vắng sáng', 'Ăn trưa', 'Vắng trưa', 'Ăn tối', 'Vắng tối', 'Gạo (kg)'],
  ];

  days.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    let bPresent = 0, lPresent = 0, dPresent = 0;

    students.forEach(student => {
      const dayData = student.attendance.get(dateStr);
      if (dayData?.breakfast ?? true) bPresent++;
      if (dayData?.lunch ?? true) lPresent++;
      if (dayData?.dinner ?? true) dPresent++;
    });

    const totalStudents = students.length;
    const dailyRice = (lPresent + dPresent) * 0.2;

    dailySummary.push([
      format(day, 'dd/MM/yyyy'),
      totalStudents,
      bPresent,
      totalStudents - bPresent,
      lPresent,
      totalStudents - lPresent,
      dPresent,
      totalStudents - dPresent,
      dailyRice.toFixed(1),
    ]);
  });

  const dailyWs = createProfessionalWorksheet(
    dailySummary,
    { ...config, title: 'THỐNG KÊ BỮA ĂN THEO NGÀY' },
    [12, 10, 10, 10, 10, 10, 10, 10, 10]
  );
  applyHeaderStyle(dailyWs, 6, 9);

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
