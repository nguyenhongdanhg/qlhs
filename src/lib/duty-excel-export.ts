import XLSX from 'xlsx-js-style';
import { format, eachDayOfInterval, getDay, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { DutySchedule as DutyScheduleType, Profile } from '@/types';
import {
  ExcelColors,
  ExcelFonts,
  ExcelBorders,
  CellAlign,
  fitColumnsToA4,
} from './excel-styles';

interface DutyMember extends Profile {
  dutyCount: number;
  isFixed: boolean;
  fixedDays: number[];
}

interface DutyExportOptions {
  schoolName: string;
  schedules: DutyScheduleType[];
  dutyMembers: DutyMember[];
  periodLabel: string;
  startDate: Date;
  endDate: Date;
}

const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function applyCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  value: any,
  style: any
) {
  const ref = XLSX.utils.encode_cell({ r, c });
  ws[ref] = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
    s: style,
  };
}

const headerStyle = {
  fill: { fgColor: { rgb: ExcelColors.headerBg } },
  font: ExcelFonts.header,
  alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
  border: ExcelBorders.thin,
};

const titleStyle = {
  font: { bold: true, sz: 14 },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};

const subtitleStyle = {
  font: { bold: true, sz: 11 },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};

const cellStyle = (bgColor: string, align: 'left' | 'center' | 'right' = 'center', bold = false) => ({
  fill: { fgColor: { rgb: bgColor } },
  font: bold ? ExcelFonts.cellBold : ExcelFonts.cell,
  alignment: { horizontal: align, vertical: 'center' as const },
  border: ExcelBorders.thin,
});

const totalsStyle = (align: 'left' | 'center' | 'right' = 'center') => ({
  fill: { fgColor: { rgb: ExcelColors.totalsBg } },
  font: ExcelFonts.totals,
  alignment: { horizontal: align, vertical: 'center' as const },
  border: ExcelBorders.thin,
});

const weekendHeaderStyle = {
  fill: { fgColor: { rgb: 'E65100' } },
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
  border: ExcelBorders.thin,
};

export function exportDutyAssignment(options: DutyExportOptions) {
  const { schoolName, schedules, dutyMembers, periodLabel, startDate, endDate } = options;
  const wb = XLSX.utils.book_new();

  // ===== SHEET 1: BẢNG PHÂN CÔNG =====
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const ws1: XLSX.WorkSheet = {};

  // Columns: STT | Họ tên | Giới tính | Day1 | Day2 | ... | Tổng
  const numCols = 3 + days.length + 1;
  const numDataRows = dutyMembers.length;

  // Row 0: Title
  applyCell(ws1, 0, 0, `BẢNG PHÂN CÔNG TRỰC - ${schoolName.toUpperCase()}`, titleStyle);
  ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
  ];

  // Row 1: Period
  applyCell(ws1, 1, 0, periodLabel, subtitleStyle);

  // Row 2: Headers
  const headers = ['STT', 'Họ và tên', 'GT'];
  days.forEach((d) => {
    const dayOfWeek = getDay(d);
    headers.push(`${format(d, 'dd')}\n${dayLabels[dayOfWeek]}`);
  });
  headers.push('Tổng');

  headers.forEach((h, c) => {
    const isWeekendCol = c >= 3 && c < 3 + days.length && (getDay(days[c - 3]) === 0 || getDay(days[c - 3]) === 6);
    applyCell(ws1, 2, c, h, isWeekendCol ? weekendHeaderStyle : headerStyle);
  });

  // Data rows
  const sortedMembers = [...dutyMembers].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));

  sortedMembers.forEach((member, idx) => {
    const rowIdx = 3 + idx;
    const isOdd = idx % 2 === 1;
    const bg = isOdd ? ExcelColors.oddRowBg : ExcelColors.evenRowBg;

    applyCell(ws1, rowIdx, 0, idx + 1, cellStyle(bg, 'center'));
    applyCell(ws1, rowIdx, 1, member.full_name, cellStyle(bg, 'left'));
    applyCell(ws1, rowIdx, 2, member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : '', cellStyle(bg, 'center'));

    let totalCount = 0;
    days.forEach((d, dIdx) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const isAssigned = schedules.some(s => s.user_id === member.id && s.duty_date === dateStr);
      const isWeekend = getDay(d) === 0 || getDay(d) === 6;
      const cellBg = isAssigned && isWeekend ? 'FFF3E0' : isAssigned ? 'E8F5E9' : bg;

      applyCell(ws1, rowIdx, 3 + dIdx, isAssigned ? '✓' : '', cellStyle(cellBg, 'center', isAssigned));
      if (isAssigned) totalCount++;
    });

    applyCell(ws1, rowIdx, 3 + days.length, totalCount, cellStyle(bg, 'center', true));
  });

  // Totals row
  const totalsRow = 3 + numDataRows;
  applyCell(ws1, totalsRow, 0, '', totalsStyle());
  applyCell(ws1, totalsRow, 1, 'Tổng/ngày', totalsStyle('left'));
  applyCell(ws1, totalsRow, 2, '', totalsStyle());

  let grandTotal = 0;
  days.forEach((d, dIdx) => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const count = schedules.filter(s => s.duty_date === dateStr).length;
    applyCell(ws1, totalsRow, 3 + dIdx, count || '', totalsStyle());
    grandTotal += count;
  });
  applyCell(ws1, totalsRow, 3 + days.length, grandTotal, totalsStyle());

  // Column widths
  ws1['!cols'] = [
    { wch: 5 },   // STT
    { wch: 22 },  // Họ tên
    { wch: 6 },   // GT
    ...days.map(() => ({ wch: 5 })),  // Days
    { wch: 6 },   // Tổng
  ];

  // Set range
  ws1['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalsRow, c: numCols - 1 } });

  XLSX.utils.book_append_sheet(wb, ws1, 'Phân công');

  // ===== SHEET 2: THỐNG KÊ CHI TIẾT =====
  const ws2: XLSX.WorkSheet = {};

  const statsHeaders = ['STT', 'Họ và tên', 'Giới tính', 'Tổng lượt', 'Ngày thường', 'Thứ 7', 'Chủ nhật', 'Cuối tuần'];
  const statsNumCols = statsHeaders.length;

  // Title rows
  applyCell(ws2, 0, 0, `THỐNG KÊ LỊCH TRỰC - ${schoolName.toUpperCase()}`, titleStyle);
  applyCell(ws2, 1, 0, periodLabel, subtitleStyle);

  ws2['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: statsNumCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: statsNumCols - 1 } },
  ];

  // Headers row 2
  statsHeaders.forEach((h, c) => {
    applyCell(ws2, 2, c, h, headerStyle);
  });

  // Calculate stats per member
  const memberStats = sortedMembers.map((member) => {
    const memberSchedules = schedules.filter(s => 
      s.user_id === member.id && 
      s.duty_date >= format(startDate, 'yyyy-MM-dd') && 
      s.duty_date <= format(endDate, 'yyyy-MM-dd')
    );

    let weekdayCount = 0, satCount = 0, sunCount = 0;
    memberSchedules.forEach(s => {
      const dow = getDay(new Date(s.duty_date));
      if (dow === 6) satCount++;
      else if (dow === 0) sunCount++;
      else weekdayCount++;
    });

    return {
      ...member,
      totalDuties: memberSchedules.length,
      weekdayCount,
      satCount,
      sunCount,
      weekendCount: satCount + sunCount,
    };
  }).sort((a, b) => b.totalDuties - a.totalDuties);

  memberStats.forEach((m, idx) => {
    const row = 3 + idx;
    const isOdd = idx % 2 === 1;
    const bg = isOdd ? ExcelColors.oddRowBg : ExcelColors.evenRowBg;

    applyCell(ws2, row, 0, idx + 1, cellStyle(bg, 'center'));
    applyCell(ws2, row, 1, m.full_name, cellStyle(bg, 'left'));
    applyCell(ws2, row, 2, m.gender === 'male' ? 'Nam' : m.gender === 'female' ? 'Nữ' : '', cellStyle(bg, 'center'));
    applyCell(ws2, row, 3, m.totalDuties, cellStyle(bg, 'center', true));
    applyCell(ws2, row, 4, m.weekdayCount, cellStyle(bg, 'center'));
    applyCell(ws2, row, 5, m.satCount, cellStyle(bg, 'center'));
    applyCell(ws2, row, 6, m.sunCount, cellStyle(bg, 'center'));
    applyCell(ws2, row, 7, m.weekendCount, cellStyle(bg, 'center'));
  });

  // Totals
  const statsTotalsRow = 3 + memberStats.length;
  const totalAll = memberStats.reduce((s, m) => s + m.totalDuties, 0);
  const totalWeekday = memberStats.reduce((s, m) => s + m.weekdayCount, 0);
  const totalSat = memberStats.reduce((s, m) => s + m.satCount, 0);
  const totalSun = memberStats.reduce((s, m) => s + m.sunCount, 0);
  const totalWeekend = memberStats.reduce((s, m) => s + m.weekendCount, 0);

  applyCell(ws2, statsTotalsRow, 0, '', totalsStyle());
  applyCell(ws2, statsTotalsRow, 1, 'TỔNG CỘNG', totalsStyle('left'));
  applyCell(ws2, statsTotalsRow, 2, `${memberStats.length} người`, totalsStyle());
  applyCell(ws2, statsTotalsRow, 3, totalAll, totalsStyle());
  applyCell(ws2, statsTotalsRow, 4, totalWeekday, totalsStyle());
  applyCell(ws2, statsTotalsRow, 5, totalSat, totalsStyle());
  applyCell(ws2, statsTotalsRow, 6, totalSun, totalsStyle());
  applyCell(ws2, statsTotalsRow, 7, totalWeekend, totalsStyle());

  // Average row
  const avgRow = statsTotalsRow + 1;
  const avgAll = memberStats.length > 0 ? +(totalAll / memberStats.length).toFixed(1) : 0;
  const avgWeekend2 = memberStats.length > 0 ? +(totalWeekend / memberStats.length).toFixed(1) : 0;

  applyCell(ws2, avgRow, 0, '', totalsStyle());
  applyCell(ws2, avgRow, 1, 'TRUNG BÌNH', totalsStyle('left'));
  applyCell(ws2, avgRow, 2, '', totalsStyle());
  applyCell(ws2, avgRow, 3, avgAll, totalsStyle());
  applyCell(ws2, avgRow, 4, '', totalsStyle());
  applyCell(ws2, avgRow, 5, '', totalsStyle());
  applyCell(ws2, avgRow, 6, '', totalsStyle());
  applyCell(ws2, avgRow, 7, avgWeekend2, totalsStyle());

  ws2['!cols'] = [
    { wch: 5 },   // STT
    { wch: 22 },  // Họ tên
    { wch: 10 },  // Giới tính
    { wch: 10 },  // Tổng lượt
    { wch: 12 },  // Ngày thường
    { wch: 8 },   // T7
    { wch: 10 },  // CN
    { wch: 10 },  // Cuối tuần
  ];

  ws2['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: avgRow, c: statsNumCols - 1 } });

  XLSX.utils.book_append_sheet(wb, ws2, 'Thống kê');

  // ===== SHEET 3: THỐNG KÊ THEO TUẦN =====
  const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
  
  if (weeks.length > 0) {
    const ws3: XLSX.WorkSheet = {};
    
    // Headers: STT | Họ tên | Tuần 1 | Tuần 2 | ... | Tổng
    const weekHeaders = ['STT', 'Họ và tên'];
    const weekRanges: { start: Date; end: Date; label: string }[] = [];

    weeks.forEach((weekStart, i) => {
      const wStart = weekStart < startDate ? startDate : weekStart;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const wEnd = weekEnd > endDate ? endDate : weekEnd;
      const label = `${format(wStart, 'dd/MM')}-${format(wEnd, 'dd/MM')}`;
      weekHeaders.push(`Tuần ${i + 1}\n${label}`);
      weekRanges.push({ start: wStart, end: wEnd, label });
    });
    weekHeaders.push('Tổng');

    const weekNumCols = weekHeaders.length;

    applyCell(ws3, 0, 0, `THỐNG KÊ THEO TUẦN - ${schoolName.toUpperCase()}`, titleStyle);
    applyCell(ws3, 1, 0, periodLabel, subtitleStyle);

    ws3['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: weekNumCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: weekNumCols - 1 } },
    ];

    weekHeaders.forEach((h, c) => {
      applyCell(ws3, 2, c, h, headerStyle);
    });

    sortedMembers.forEach((member, idx) => {
      const row = 3 + idx;
      const isOdd = idx % 2 === 1;
      const bg = isOdd ? ExcelColors.oddRowBg : ExcelColors.evenRowBg;

      applyCell(ws3, row, 0, idx + 1, cellStyle(bg, 'center'));
      applyCell(ws3, row, 1, member.full_name, cellStyle(bg, 'left'));

      let rowTotal = 0;
      weekRanges.forEach((wr, wIdx) => {
        const wStartStr = format(wr.start, 'yyyy-MM-dd');
        const wEndStr = format(wr.end, 'yyyy-MM-dd');
        const count = schedules.filter(s =>
          s.user_id === member.id &&
          s.duty_date >= wStartStr &&
          s.duty_date <= wEndStr
        ).length;
        applyCell(ws3, row, 2 + wIdx, count || '', cellStyle(bg, 'center', count > 0));
        rowTotal += count;
      });

      applyCell(ws3, row, 2 + weekRanges.length, rowTotal, cellStyle(bg, 'center', true));
    });

    // Totals
    const weekTotalsRow = 3 + sortedMembers.length;
    applyCell(ws3, weekTotalsRow, 0, '', totalsStyle());
    applyCell(ws3, weekTotalsRow, 1, 'TỔNG CỘNG', totalsStyle('left'));

    let weekGrandTotal = 0;
    weekRanges.forEach((wr, wIdx) => {
      const wStartStr = format(wr.start, 'yyyy-MM-dd');
      const wEndStr = format(wr.end, 'yyyy-MM-dd');
      const count = schedules.filter(s => s.duty_date >= wStartStr && s.duty_date <= wEndStr).length;
      applyCell(ws3, weekTotalsRow, 2 + wIdx, count, totalsStyle());
      weekGrandTotal += count;
    });
    applyCell(ws3, weekTotalsRow, 2 + weekRanges.length, weekGrandTotal, totalsStyle());

    ws3['!cols'] = [
      { wch: 5 },
      { wch: 22 },
      ...weekRanges.map(() => ({ wch: 14 })),
      { wch: 6 },
    ];

    ws3['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: weekTotalsRow, c: weekNumCols - 1 } });

    XLSX.utils.book_append_sheet(wb, ws3, 'Theo tuần');
  }

  // Save
  const fileName = `lich-truc-${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
