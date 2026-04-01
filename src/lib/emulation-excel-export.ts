import XLSX from 'xlsx-js-style';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  applyProfessionalStyle,
  CellAlign,
  fitColumnsToA4
} from './excel-styles';

interface DynamicColumn {
  key: string;
  name: string;
  weight: number;
}

interface DynamicClassScore {
  class_name: string;
  scores: Record<string, number>;
  average_score: number;
  rank: number;
  notes?: string;
}

interface WeekData {
  week_number: number;
  start_date?: string;
  end_date?: string;
  scores: DynamicClassScore[];
}

interface ExportOptions {
  schoolName: string;
  schoolYear: string;
  type: 'week' | 'month' | 'year';
  weekNumber?: number;
  weekDateRange?: { start: string; end: string };
  monthName?: string;
  weeksData?: WeekData[];
  classScores?: DynamicClassScore[];
  columns: DynamicColumn[];
  formulaString: string;
}

const formatDate = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: vi });
  } catch {
    return dateStr;
  }
};

const createWeekSheet = (
  wb: XLSX.WorkBook,
  sheetName: string,
  title: string,
  subtitle: string,
  classScores: DynamicClassScore[],
  schoolName: string,
  schoolYear: string,
  columns: DynamicColumn[],
  formulaString: string,
) => {
  const data: (string | number)[][] = [];
  const numCols = columns.length + 4; // STT + Lớp + [dynamic cols] + TB + Xếp hạng + Ghi chú
  
  // Header rows
  data.push([schoolName]);
  data.push([title]);
  data.push([subtitle]);
  data.push([`Năm học: ${schoolYear}`]);
  data.push([]);
  
  // Table header
  const headerRow: (string | number)[] = ['STT', 'Lớp'];
  columns.forEach(col => headerRow.push(col.name));
  headerRow.push('Điểm thi đua', 'Xếp hạng', 'Ghi chú');
  data.push(headerRow);
  
  // Data rows
  classScores.forEach((cls, index) => {
    const row: (string | number)[] = [index + 1, cls.class_name];
    columns.forEach(col => row.push(cls.scores[col.key] ?? 0));
    row.push(cls.average_score, cls.rank || '-' as any, cls.notes || '');
    data.push(row);
  });
  
  // Formula note
  data.push([]);
  data.push([`* Công thức: Điểm thi đua = ${formulaString}`]);
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  const colWidthValues: number[] = [5, 12];
  columns.forEach(() => colWidthValues.push(10));
  colWidthValues.push(8, 10, 30);
  fitColumnsToA4(ws, colWidthValues);
  
  // Merge header cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: numCols - 1 } },
  ];
  
  // Column alignments
  const columnAlignments: CellAlign[] = [
    'center', // STT
    'left',   // Lớp
  ];
  columns.forEach(() => columnAlignments.push('center'));
  columnAlignments.push('center', 'center', 'left'); // TB, Xếp hạng, Ghi chú
  
  applyProfessionalStyle(ws, {
    headerRowIndex: 5,
    dataStartRow: 6,
    dataRowCount: classScores.length,
    numCols,
    columnAlignments,
    numTitleRows: 5,
  });
  
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
};

export const exportEmulationToExcel = (options: ExportOptions) => {
  const { schoolName, schoolYear, type, weekNumber, weekDateRange, monthName, weeksData, classScores, columns, formulaString } = options;
  
  const wb = XLSX.utils.book_new();
  
  if (type === 'week' && classScores) {
    const dateRangeStr = weekDateRange 
      ? `Từ ${formatDate(weekDateRange.start)} đến ${formatDate(weekDateRange.end)}`
      : '';
    
    createWeekSheet(wb, `Tuần ${weekNumber}`, `BẢNG THI ĐUA TUẦN ${weekNumber}`, dateRangeStr, classScores, schoolName, schoolYear, columns, formulaString);
    XLSX.writeFile(wb, `Thi-dua-Tuan-${weekNumber}-${schoolYear}.xlsx`);
  } else if (type === 'month' && weeksData) {
    const summaryScores = calculateAverageFromWeeks(weeksData, columns, options);
    createWeekSheet(wb, 'Tổng hợp', `THỐNG KÊ THI ĐUA ${monthName || 'THÁNG'}`, `Tổng hợp ${weeksData.length} tuần`, summaryScores, schoolName, schoolYear, columns, formulaString);
    
    weeksData.forEach((week) => {
      const dateRangeStr = week.start_date && week.end_date
        ? `Từ ${formatDate(week.start_date)} đến ${formatDate(week.end_date)}`
        : '';
      createWeekSheet(wb, `Tuần ${week.week_number}`, `BẢNG THI ĐUA TUẦN ${week.week_number}`, dateRangeStr, week.scores, schoolName, schoolYear, columns, formulaString);
    });
    
    XLSX.writeFile(wb, `Thi-dua-${monthName || 'Thang'}-${schoolYear}.xlsx`);
  } else if (type === 'year' && weeksData) {
    const summaryScores = calculateAverageFromWeeks(weeksData, columns, options);
    createWeekSheet(wb, 'Tổng hợp năm', `THỐNG KÊ THI ĐUA NĂM HỌC ${schoolYear}`, `Tổng hợp ${weeksData.length} tuần`, summaryScores, schoolName, schoolYear, columns, formulaString);
    
    weeksData.forEach((week) => {
      const dateRangeStr = week.start_date && week.end_date
        ? `${formatDate(week.start_date)} - ${formatDate(week.end_date)}`
        : '';
      createWeekSheet(wb, `T${week.week_number}`, `TUẦN ${week.week_number}`, dateRangeStr, week.scores, schoolName, schoolYear, columns, formulaString);
    });
    
    XLSX.writeFile(wb, `Thi-dua-Nam-hoc-${schoolYear}.xlsx`);
  }
};

const calculateAverageFromWeeks = (weeksData: WeekData[], columns: DynamicColumn[], options: ExportOptions): DynamicClassScore[] => {
  const classMap = new Map<string, {
    totals: Record<string, number>;
    count: number;
    notes: string[];
  }>();
  
  weeksData.forEach((week) => {
    week.scores.forEach((score) => {
      const existing = classMap.get(score.class_name) || {
        totals: {},
        count: 0,
        notes: [],
      };
      
      const hasAnyScore = columns.some(col => (score.scores[col.key] ?? 0) > 0);
      if (hasAnyScore) {
        columns.forEach(col => {
          existing.totals[col.key] = (existing.totals[col.key] || 0) + (score.scores[col.key] ?? 0);
        });
        existing.count += 1;
      }
      
      if (score.notes) {
        existing.notes.push(`T${week.week_number}: ${score.notes}`);
      }
      
      classMap.set(score.class_name, existing);
    });
  });
  
  const results: DynamicClassScore[] = [];
  
  classMap.forEach((value, className) => {
    if (value.count > 0) {
      const avgScores: Record<string, number> = {};
      let weightedSum = 0;
      let totalWeight = 0;
      
      columns.forEach(col => {
        const avg = (value.totals[col.key] || 0) / value.count;
        avgScores[col.key] = Math.round(avg * 100) / 100;
        weightedSum += avg * col.weight;
        totalWeight += col.weight;
      });
      
      const avgScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
      
      results.push({
        class_name: className,
        scores: avgScores,
        average_score: Math.round(avgScore * 100) / 100,
        rank: 0,
        notes: value.notes.join('; '),
      });
    }
  });
  
  // Assign ranks
  results.sort((a, b) => b.average_score - a.average_score);
  results.forEach((item, index) => {
    item.rank = item.average_score > 0 ? index + 1 : 0;
  });
  
  // Sort by class name
  results.sort((a, b) => a.class_name.localeCompare(b.class_name, 'vi'));
  
  return results;
};
