import XLSX from 'xlsx-js-style';
import { vietnameseNameSortCompare } from './utils';
import { format, eachDayOfInterval, getDay, eachWeekOfInterval } from 'date-fns';
import { DutySchedule as DutyScheduleType, Profile } from '@/types';
import {
  ExcelColors,
  ExcelFonts,
  ExcelBorders,
  fitColumnsToA4,
} from './excel-styles';

interface DutyMember extends Profile {
  dutyCount: number;
  isFixed: boolean;
  fixedDays: number[];
}

interface DutyLeaderData {
  user_id: string;
  duty_date: string;
  notes?: string | null;
  profile?: Profile;
}

interface DutyExportOptions {
  schoolName: string;
  schedules: DutyScheduleType[];
  dutyMembers: DutyMember[];
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  dutyLeaders?: DutyLeaderData[];
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
  alignment: { horizontal: align, vertical: 'center' as const, wrapText: true },
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

const leaderStyle = (bgColor: string) => ({
  fill: { fgColor: { rgb: bgColor } },
  font: { sz: 9, color: { rgb: '1565C0' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
  border: ExcelBorders.thin,
});

function buildAssignmentSheet(options: DutyExportOptions): XLSX.WorkSheet {
  const { schoolName, schedules, dutyMembers, periodLabel, startDate, endDate, dutyLeaders = [] } = options;
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const ws: XLSX.WorkSheet = {};
  const sortedMembers = [...dutyMembers].sort((a, b) => vietnameseNameSortCompare(a.full_name, b.full_name));

  const numCols = 3 + days.length + 1;
  const hasLeaders = dutyLeaders.length > 0;

  // Row 0: Title
  applyCell(ws, 0, 0, `BẢNG PHÂN CÔNG TRỰC - ${schoolName.toUpperCase()}`, titleStyle);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
  ];

  // Row 1: Period
  applyCell(ws, 1, 0, periodLabel, subtitleStyle);

  // Row 2: Headers
  const headers = ['STT', 'Họ và tên', 'GT'];
  days.forEach((d) => {
    const dayOfWeek = getDay(d);
    headers.push(`${format(d, 'dd')}\n${dayLabels[dayOfWeek]}`);
  });
  headers.push('Tổng');

  headers.forEach((h, c) => {
    const isWeekendCol = c >= 3 && c < 3 + days.length && (getDay(days[c - 3]) === 0 || getDay(days[c - 3]) === 6);
    applyCell(ws, 2, c, h, isWeekendCol ? weekendHeaderStyle : headerStyle);
  });

  // Row 3: Quản lý trực (if any leaders exist)
  let dataStartRow = 3;
  if (hasLeaders) {
    applyCell(ws, 3, 0, '', cellStyle('E3F2FD', 'center'));
    applyCell(ws, 3, 1, 'Quản lý trực', cellStyle('E3F2FD', 'left', true));
    applyCell(ws, 3, 2, '', cellStyle('E3F2FD', 'center'));

    days.forEach((d, dIdx) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const leadersForDay = dutyLeaders.filter(l => l.duty_date === dateStr);
      const leaderNames = leadersForDay.map(l => {
        const name = l.profile?.full_name || '';
        const shortName = name.split(' ').slice(-1).join('');
        const note = l.notes ? `\n(${l.notes})` : '';
        return shortName + note;
      }).join('\n');
      applyCell(ws, 3, 3 + dIdx, leaderNames, leaderStyle('E3F2FD'));
    });

    applyCell(ws, 3, 3 + days.length, '', cellStyle('E3F2FD', 'center'));
    dataStartRow = 4;
  }

  // Data rows
  sortedMembers.forEach((member, idx) => {
    const rowIdx = dataStartRow + idx;
    const isOdd = idx % 2 === 1;
    const bg = isOdd ? ExcelColors.oddRowBg : ExcelColors.evenRowBg;

    applyCell(ws, rowIdx, 0, idx + 1, cellStyle(bg, 'center'));
    applyCell(ws, rowIdx, 1, member.full_name, cellStyle(bg, 'left'));
    applyCell(ws, rowIdx, 2, member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : '', cellStyle(bg, 'center'));

    let totalCount = 0;
    days.forEach((d, dIdx) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const schedule = schedules.find(s => s.user_id === member.id && s.duty_date === dateStr);
      const isAssigned = !!schedule;
      const isWeekend = getDay(d) === 0 || getDay(d) === 6;
      const cellBg = isAssigned && isWeekend ? 'FFF3E0' : isAssigned ? 'E8F5E9' : bg;

      let cellValue = '';
      if (isAssigned) {
        cellValue = '✓';
        if (schedule?.notes) {
          cellValue = schedule.notes;
        }
      }

      applyCell(ws, rowIdx, 3 + dIdx, cellValue, cellStyle(cellBg, 'center', isAssigned));
      if (isAssigned) totalCount++;
    });

    applyCell(ws, rowIdx, 3 + days.length, totalCount, cellStyle(bg, 'center', true));
  });

  // Totals row
  const totalsRow = dataStartRow + sortedMembers.length;
  applyCell(ws, totalsRow, 0, '', totalsStyle());
  applyCell(ws, totalsRow, 1, 'Tổng/ngày', totalsStyle('left'));
  applyCell(ws, totalsRow, 2, '', totalsStyle());

  let grandTotal = 0;
  days.forEach((d, dIdx) => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const count = schedules.filter(s => s.duty_date === dateStr && sortedMembers.some(m => m.id === s.user_id)).length;
    applyCell(ws, totalsRow, 3 + dIdx, count || '', totalsStyle());
    grandTotal += count;
  });
  applyCell(ws, totalsRow, 3 + days.length, grandTotal, totalsStyle());

  fitColumnsToA4(ws, [5, 22, 6, ...days.map(() => 5), 6]);
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalsRow, c: numCols - 1 } });

  return ws;
}

function buildStatsSheet(options: DutyExportOptions): XLSX.WorkSheet {
  const { schoolName, schedules, dutyMembers, periodLabel, startDate, endDate } = options;
  const ws: XLSX.WorkSheet = {};
  const sortedMembers = [...dutyMembers].sort((a, b) => vietnameseNameSortCompare(a.full_name, b.full_name));

  const statsHeaders = ['STT', 'Họ và tên', 'Giới tính', 'Chức vụ', 'Tổng lượt', 'Ngày thường', 'Thứ 7', 'Chủ nhật', 'Cuối tuần'];
  const statsNumCols = statsHeaders.length;

  applyCell(ws, 0, 0, `THỐNG KÊ LỊCH TRỰC - ${schoolName.toUpperCase()}`, titleStyle);
  applyCell(ws, 1, 0, periodLabel, subtitleStyle);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: statsNumCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: statsNumCols - 1 } },
  ];

  statsHeaders.forEach((h, c) => {
    applyCell(ws, 2, c, h, headerStyle);
  });

  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  const memberStats = sortedMembers.map((member) => {
    const memberSchedules = schedules.filter(s =>
      s.user_id === member.id &&
      s.duty_date >= startStr &&
      s.duty_date <= endStr
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

    applyCell(ws, row, 0, idx + 1, cellStyle(bg, 'center'));
    applyCell(ws, row, 1, m.full_name, cellStyle(bg, 'left'));
    applyCell(ws, row, 2, m.gender === 'male' ? 'Nam' : m.gender === 'female' ? 'Nữ' : '', cellStyle(bg, 'center'));
    applyCell(ws, row, 3, m.position || '', cellStyle(bg, 'left'));
    applyCell(ws, row, 4, m.totalDuties, cellStyle(bg, 'center', true));
    applyCell(ws, row, 5, m.weekdayCount, cellStyle(bg, 'center'));
    applyCell(ws, row, 6, m.satCount, cellStyle(bg, 'center'));
    applyCell(ws, row, 7, m.sunCount, cellStyle(bg, 'center'));
    applyCell(ws, row, 8, m.weekendCount, cellStyle(bg, 'center'));
  });

  // Totals
  const statsTotalsRow = 3 + memberStats.length;
  const totalAll = memberStats.reduce((s, m) => s + m.totalDuties, 0);
  const totalWeekday = memberStats.reduce((s, m) => s + m.weekdayCount, 0);
  const totalSat = memberStats.reduce((s, m) => s + m.satCount, 0);
  const totalSun = memberStats.reduce((s, m) => s + m.sunCount, 0);
  const totalWeekend = memberStats.reduce((s, m) => s + m.weekendCount, 0);

  applyCell(ws, statsTotalsRow, 0, '', totalsStyle());
  applyCell(ws, statsTotalsRow, 1, 'TỔNG CỘNG', totalsStyle('left'));
  applyCell(ws, statsTotalsRow, 2, `${memberStats.length} người`, totalsStyle());
  applyCell(ws, statsTotalsRow, 3, '', totalsStyle());
  applyCell(ws, statsTotalsRow, 4, totalAll, totalsStyle());
  applyCell(ws, statsTotalsRow, 5, totalWeekday, totalsStyle());
  applyCell(ws, statsTotalsRow, 6, totalSat, totalsStyle());
  applyCell(ws, statsTotalsRow, 7, totalSun, totalsStyle());
  applyCell(ws, statsTotalsRow, 8, totalWeekend, totalsStyle());

  // Average row
  const avgRow = statsTotalsRow + 1;
  const avgAll = memberStats.length > 0 ? +(totalAll / memberStats.length).toFixed(1) : 0;
  const avgWeekend = memberStats.length > 0 ? +(totalWeekend / memberStats.length).toFixed(1) : 0;

  applyCell(ws, avgRow, 0, '', totalsStyle());
  applyCell(ws, avgRow, 1, 'TRUNG BÌNH', totalsStyle('left'));
  applyCell(ws, avgRow, 2, '', totalsStyle());
  applyCell(ws, avgRow, 3, '', totalsStyle());
  applyCell(ws, avgRow, 4, avgAll, totalsStyle());
  applyCell(ws, avgRow, 5, '', totalsStyle());
  applyCell(ws, avgRow, 6, '', totalsStyle());
  applyCell(ws, avgRow, 7, '', totalsStyle());
  applyCell(ws, avgRow, 8, avgWeekend, totalsStyle());

  fitColumnsToA4(ws, [5, 22, 10, 14, 10, 12, 8, 10, 10]);
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: avgRow, c: statsNumCols - 1 } });

  return ws;
}

function buildWeeklySheet(options: DutyExportOptions): XLSX.WorkSheet | null {
  const { schoolName, schedules, dutyMembers, periodLabel, startDate, endDate } = options;
  const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 });
  if (weeks.length === 0) return null;

  const ws: XLSX.WorkSheet = {};
  const sortedMembers = [...dutyMembers].sort((a, b) => vietnameseNameSortCompare(a.full_name, b.full_name));

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

  applyCell(ws, 0, 0, `THỐNG KÊ THEO TUẦN - ${schoolName.toUpperCase()}`, titleStyle);
  applyCell(ws, 1, 0, periodLabel, subtitleStyle);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: weekNumCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: weekNumCols - 1 } },
  ];

  weekHeaders.forEach((h, c) => {
    applyCell(ws, 2, c, h, headerStyle);
  });

  sortedMembers.forEach((member, idx) => {
    const row = 3 + idx;
    const isOdd = idx % 2 === 1;
    const bg = isOdd ? ExcelColors.oddRowBg : ExcelColors.evenRowBg;

    applyCell(ws, row, 0, idx + 1, cellStyle(bg, 'center'));
    applyCell(ws, row, 1, member.full_name, cellStyle(bg, 'left'));

    let rowTotal = 0;
    weekRanges.forEach((wr, wIdx) => {
      const wStartStr = format(wr.start, 'yyyy-MM-dd');
      const wEndStr = format(wr.end, 'yyyy-MM-dd');
      const count = schedules.filter(s =>
        s.user_id === member.id &&
        s.duty_date >= wStartStr &&
        s.duty_date <= wEndStr
      ).length;
      applyCell(ws, row, 2 + wIdx, count || '', cellStyle(bg, 'center', count > 0));
      rowTotal += count;
    });

    applyCell(ws, row, 2 + weekRanges.length, rowTotal, cellStyle(bg, 'center', true));
  });

  // Totals
  const weekTotalsRow = 3 + sortedMembers.length;
  applyCell(ws, weekTotalsRow, 0, '', totalsStyle());
  applyCell(ws, weekTotalsRow, 1, 'TỔNG CỘNG', totalsStyle('left'));

  let weekGrandTotal = 0;
  weekRanges.forEach((wr, wIdx) => {
    const wStartStr = format(wr.start, 'yyyy-MM-dd');
    const wEndStr = format(wr.end, 'yyyy-MM-dd');
    const count = schedules.filter(s => s.duty_date >= wStartStr && s.duty_date <= wEndStr).length;
    applyCell(ws, weekTotalsRow, 2 + wIdx, count, totalsStyle());
    weekGrandTotal += count;
  });
  applyCell(ws, weekTotalsRow, 2 + weekRanges.length, weekGrandTotal, totalsStyle());

  fitColumnsToA4(ws, [5, 22, ...weekRanges.map(() => 14), 6]);
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: weekTotalsRow, c: weekNumCols - 1 } });

  return ws;
}

function buildLeadersSheet(options: DutyExportOptions): XLSX.WorkSheet | null {
  const { schoolName, dutyLeaders = [], periodLabel, startDate, endDate } = options;
  if (dutyLeaders.length === 0) return null;

  const ws: XLSX.WorkSheet = {};
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Get unique leaders
  const leaderMap = new Map<string, { profile: Profile; dates: { date: string; notes?: string | null }[] }>();
  dutyLeaders.forEach(l => {
    if (l.duty_date < format(startDate, 'yyyy-MM-dd') || l.duty_date > format(endDate, 'yyyy-MM-dd')) return;
    const key = l.user_id;
    if (!leaderMap.has(key)) {
      leaderMap.set(key, { profile: l.profile!, dates: [] });
    }
    leaderMap.get(key)!.dates.push({ date: l.duty_date, notes: l.notes });
  });

  const leaders = Array.from(leaderMap.entries())
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => vietnameseNameSortCompare(a.profile?.full_name || '', b.profile?.full_name || ''));

  const numCols = 3 + days.length + 1;

  applyCell(ws, 0, 0, `LỊCH QUẢN LÝ TRỰC - ${schoolName.toUpperCase()}`, titleStyle);
  applyCell(ws, 1, 0, periodLabel, subtitleStyle);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
  ];

  // Headers
  const headers = ['STT', 'Họ và tên', 'Chức vụ'];
  days.forEach((d) => {
    const dayOfWeek = getDay(d);
    headers.push(`${format(d, 'dd')}\n${dayLabels[dayOfWeek]}`);
  });
  headers.push('Tổng');

  headers.forEach((h, c) => {
    const isWeekendCol = c >= 3 && c < 3 + days.length && (getDay(days[c - 3]) === 0 || getDay(days[c - 3]) === 6);
    applyCell(ws, 2, c, h, isWeekendCol ? weekendHeaderStyle : headerStyle);
  });

  leaders.forEach((leader, idx) => {
    const row = 3 + idx;
    const isOdd = idx % 2 === 1;
    const bg = isOdd ? ExcelColors.oddRowBg : ExcelColors.evenRowBg;

    applyCell(ws, row, 0, idx + 1, cellStyle(bg, 'center'));
    applyCell(ws, row, 1, leader.profile?.full_name || '', cellStyle(bg, 'left'));
    applyCell(ws, row, 2, leader.profile?.position || '', cellStyle(bg, 'left'));

    let total = 0;
    days.forEach((d, dIdx) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const entry = leader.dates.find(e => e.date === dateStr);
      const isWeekend = getDay(d) === 0 || getDay(d) === 6;
      const cellBg = entry && isWeekend ? 'FFF3E0' : entry ? 'E3F2FD' : bg;
      const cellVal = entry ? (entry.notes || '✓') : '';
      applyCell(ws, row, 3 + dIdx, cellVal, cellStyle(cellBg, 'center', !!entry));
      if (entry) total++;
    });

    applyCell(ws, row, 3 + days.length, total, cellStyle(bg, 'center', true));
  });

  const totalsRow = 3 + leaders.length;
  applyCell(ws, totalsRow, 0, '', totalsStyle());
  applyCell(ws, totalsRow, 1, 'Tổng/ngày', totalsStyle('left'));
  applyCell(ws, totalsRow, 2, '', totalsStyle());

  let grandTotal = 0;
  days.forEach((d, dIdx) => {
    const dateStr = format(d, 'yyyy-MM-dd');
    const count = dutyLeaders.filter(l => l.duty_date === dateStr).length;
    applyCell(ws, totalsRow, 3 + dIdx, count || '', totalsStyle());
    grandTotal += count;
  });
  applyCell(ws, totalsRow, 3 + days.length, grandTotal, totalsStyle());

  fitColumnsToA4(ws, [5, 22, 14, ...days.map(() => 5), 6]);
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalsRow, c: numCols - 1 } });

  return ws;
}

export function exportDutyAssignment(options: DutyExportOptions) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Bảng phân công (with leaders row)
  const ws1 = buildAssignmentSheet(options);
  XLSX.utils.book_append_sheet(wb, ws1, 'Phân công');

  // Sheet 2: Quản lý trực (if any)
  const ws4 = buildLeadersSheet(options);
  if (ws4) {
    XLSX.utils.book_append_sheet(wb, ws4, 'Quản lý trực');
  }

  // Sheet 3: Thống kê chi tiết
  const ws2 = buildStatsSheet(options);
  XLSX.utils.book_append_sheet(wb, ws2, 'Thống kê');

  // Sheet 4: Theo tuần
  const ws3 = buildWeeklySheet(options);
  if (ws3) {
    XLSX.utils.book_append_sheet(wb, ws3, 'Theo tuần');
  }

  // Save using Blob for browser compatibility
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lich-truc-${format(options.startDate, 'yyyyMMdd')}-${format(options.endDate, 'yyyyMMdd')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
