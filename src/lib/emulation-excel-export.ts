import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  ExcelColors, 
  ExcelFonts, 
  ExcelBorders, 
  applyProfessionalStyle,
  CellAlign 
} from './excel-styles';

interface ClassScore {
  class_name: string;
  academic_score: number;
  discipline_score: number;
  boarding_score: number;
  average_score: number;
  rank: number;
  notes?: string;
}

interface WeekData {
  week_number: number;
  start_date?: string;
  end_date?: string;
  scores: ClassScore[];
}

interface ExportOptions {
  schoolName: string;
  schoolYear: string;
  type: 'week' | 'month' | 'year';
  weekNumber?: number;
  weekDateRange?: { start: string; end: string };
  monthName?: string;
  weeksData?: WeekData[];
  classScores?: ClassScore[];
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
  classScores: ClassScore[],
  schoolName: string,
  schoolYear: string
) => {
  const data: (string | number)[][] = [];
  
  // Header rows (5 rows for info + 1 empty)
  data.push([schoolName]);
  data.push([title]);
  data.push([subtitle]);
  data.push([`Năm học: ${schoolYear}`]);
  data.push([]);
  
  // Table header
  data.push(['STT', 'Lớp', 'Học tập', 'Nề nếp', 'Nội trú', 'TB', 'Xếp hạng', 'Ghi chú']);
  
  // Data rows
  classScores.forEach((cls, index) => {
    data.push([
      index + 1,
      cls.class_name,
      cls.academic_score,
      cls.discipline_score,
      cls.boarding_score,
      cls.average_score,
      cls.rank || '-',
      cls.notes || '',
    ]);
  });
  
  // Formula note
  data.push([]);
  data.push(['* Công thức: TB = (Học tập × 2 + Nề nếp + Nội trú) ÷ 4']);
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // STT
    { wch: 12 },  // Lớp
    { wch: 10 },  // Học tập
    { wch: 10 },  // Nề nếp
    { wch: 10 },  // Nội trú
    { wch: 8 },   // TB
    { wch: 10 },  // Xếp hạng
    { wch: 30 },  // Ghi chú
  ];
  
  // Merge header cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
  ];
  
  // Apply professional styling
  const columnAlignments: CellAlign[] = [
    'center', // STT
    'left',   // Lớp
    'center', // Học tập
    'center', // Nề nếp
    'center', // Nội trú
    'center', // TB
    'center', // Xếp hạng
    'left',   // Ghi chú
  ];
  
  applyProfessionalStyle(ws, {
    headerRowIndex: 5,
    dataStartRow: 6,
    dataRowCount: classScores.length,
    numCols: 8,
    columnAlignments,
    numTitleRows: 5,
  });
  
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
};

export const exportEmulationToExcel = (options: ExportOptions) => {
  const { schoolName, schoolYear, type, weekNumber, weekDateRange, monthName, weeksData, classScores } = options;
  
  const wb = XLSX.utils.book_new();
  
  if (type === 'week' && classScores) {
    const dateRangeStr = weekDateRange 
      ? `Từ ${formatDate(weekDateRange.start)} đến ${formatDate(weekDateRange.end)}`
      : '';
    
    createWeekSheet(
      wb,
      `Tuần ${weekNumber}`,
      `BẢNG THI ĐUA TUẦN ${weekNumber}`,
      dateRangeStr,
      classScores,
      schoolName,
      schoolYear
    );
    
    XLSX.writeFile(wb, `Thi-dua-Tuan-${weekNumber}-${schoolYear}.xlsx`);
  } else if (type === 'month' && weeksData) {
    // Create summary sheet
    const summaryScores = calculateAverageFromWeeks(weeksData);
    createWeekSheet(
      wb,
      'Tổng hợp',
      `THỐNG KÊ THI ĐUA ${monthName || 'THÁNG'}`,
      `Tổng hợp ${weeksData.length} tuần`,
      summaryScores,
      schoolName,
      schoolYear
    );
    
    // Create individual week sheets
    weeksData.forEach((week) => {
      const dateRangeStr = week.start_date && week.end_date
        ? `Từ ${formatDate(week.start_date)} đến ${formatDate(week.end_date)}`
        : '';
      
      createWeekSheet(
        wb,
        `Tuần ${week.week_number}`,
        `BẢNG THI ĐUA TUẦN ${week.week_number}`,
        dateRangeStr,
        week.scores,
        schoolName,
        schoolYear
      );
    });
    
    XLSX.writeFile(wb, `Thi-dua-${monthName || 'Thang'}-${schoolYear}.xlsx`);
  } else if (type === 'year' && weeksData) {
    // Create summary sheet for year
    const summaryScores = calculateAverageFromWeeks(weeksData);
    createWeekSheet(
      wb,
      'Tổng hợp năm',
      `THỐNG KÊ THI ĐUA NĂM HỌC ${schoolYear}`,
      `Tổng hợp ${weeksData.length} tuần`,
      summaryScores,
      schoolName,
      schoolYear
    );
    
    // Group by months or create individual sheets
    weeksData.forEach((week) => {
      const dateRangeStr = week.start_date && week.end_date
        ? `${formatDate(week.start_date)} - ${formatDate(week.end_date)}`
        : '';
      
      createWeekSheet(
        wb,
        `T${week.week_number}`,
        `TUẦN ${week.week_number}`,
        dateRangeStr,
        week.scores,
        schoolName,
        schoolYear
      );
    });
    
    XLSX.writeFile(wb, `Thi-dua-Nam-hoc-${schoolYear}.xlsx`);
  }
};

const calculateAverageFromWeeks = (weeksData: WeekData[]): ClassScore[] => {
  const classMap = new Map<string, {
    totalAcademic: number;
    totalDiscipline: number;
    totalBoarding: number;
    count: number;
    notes: string[];
  }>();
  
  weeksData.forEach((week) => {
    week.scores.forEach((score) => {
      const existing = classMap.get(score.class_name) || {
        totalAcademic: 0,
        totalDiscipline: 0,
        totalBoarding: 0,
        count: 0,
        notes: [],
      };
      
      if (score.academic_score > 0 || score.discipline_score > 0 || score.boarding_score > 0) {
        existing.totalAcademic += score.academic_score;
        existing.totalDiscipline += score.discipline_score;
        existing.totalBoarding += score.boarding_score;
        existing.count += 1;
      }
      
      if (score.notes) {
        existing.notes.push(`T${week.week_number}: ${score.notes}`);
      }
      
      classMap.set(score.class_name, existing);
    });
  });
  
  const results: ClassScore[] = [];
  
  classMap.forEach((value, className) => {
    if (value.count > 0) {
      const avgAcademic = value.totalAcademic / value.count;
      const avgDiscipline = value.totalDiscipline / value.count;
      const avgBoarding = value.totalBoarding / value.count;
      const avgScore = (avgAcademic * 2 + avgDiscipline + avgBoarding) / 4;
      
      results.push({
        class_name: className,
        academic_score: Math.round(avgAcademic * 100) / 100,
        discipline_score: Math.round(avgDiscipline * 100) / 100,
        boarding_score: Math.round(avgBoarding * 100) / 100,
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
