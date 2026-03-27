import { useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Download, Image, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useImageExport } from '@/hooks/use-image-export';
import { EmulationReportCard } from './EmulationReportCard';
import { exportEmulationToExcel } from '@/lib/emulation-excel-export';
import { naturalSortCompare } from '@/lib/utils';
import { useEmulationFormula, DEFAULT_COLUMNS } from '@/hooks/useEmulationFormula';

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

interface WeekSetting {
  week_number: number;
  start_date: string;
  end_date: string;
}

interface EmulationExportDialogProps {
  schoolId: string;
  schoolName: string;
  schoolYear: string;
  currentWeek: number;
  weekSettings: WeekSetting[];
  currentWeekScores: DynamicClassScore[];
  currentWeekDateRange?: { start: string; end: string };
  classes: { id: string; name: string; grade: number }[];
  displayColumns: DynamicColumn[];
}

export function EmulationExportDialog({
  schoolId,
  schoolName,
  schoolYear,
  currentWeek,
  weekSettings,
  currentWeekScores,
  currentWeekDateRange,
  classes,
  displayColumns,
}: EmulationExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [exportType, setExportType] = useState<'week' | 'month' | 'year'>('week');
  const [selectedMonth, setSelectedMonth] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const { captureElement, downloadImage } = useImageExport();
  const { calculateScore, getFormulaString } = useEmulationFormula(schoolId);

  const formulaString = getFormulaString();

  const months = [
    { value: '9', label: 'Tháng 9' },
    { value: '10', label: 'Tháng 10' },
    { value: '11', label: 'Tháng 11' },
    { value: '12', label: 'Tháng 12' },
    { value: '1', label: 'Tháng 1' },
    { value: '2', label: 'Tháng 2' },
    { value: '3', label: 'Tháng 3' },
    { value: '4', label: 'Tháng 4' },
    { value: '5', label: 'Tháng 5' },
  ];

  const fetchScoresForWeeks = async (weekNumbers: number[]) => {
    const { data, error } = await supabase
      .from('emulation_scores')
      .select('*')
      .eq('school_id', schoolId)
      .eq('school_year', schoolYear)
      .in('week_number', weekNumbers);

    if (error) throw error;
    return data || [];
  };

  const getScoreFromRecord = (record: any, colKey: string): number => {
    if (record?.custom_scores && record.custom_scores[colKey] !== undefined) {
      return Number(record.custom_scores[colKey]) || 0;
    }
    if (record?.[colKey] !== undefined) {
      return Number(record[colKey]) || 0;
    }
    return 0;
  };

  const processScoresForExport = (scores: any[], weekNum: number): DynamicClassScore[] => {
    const sortedClasses = [...classes].sort((a, b) => naturalSortCompare(a.name, b.name));
    
    const result = sortedClasses.map((cls) => {
      const record = scores.find((s) => s.class_id === cls.id && s.week_number === weekNum);
      
      const scoreValues: Record<string, number> = {};
      displayColumns.forEach(col => {
        scoreValues[col.key] = getScoreFromRecord(record, col.key);
      });
      
      const average = calculateScore(scoreValues);
      
      return {
        class_id: cls.id,
        class_name: cls.name,
        scores: scoreValues,
        average_score: Math.round(average * 100) / 100,
        rank: 0,
        notes: record?.notes || '',
      };
    });
    
    const sorted = [...result].sort((a, b) => b.average_score - a.average_score);
    sorted.forEach((item, index) => {
      item.rank = item.average_score > 0 ? index + 1 : 0;
    });
    
    return result.map((item) => ({
      ...item,
      rank: sorted.find((s) => s.class_name === item.class_name)?.rank || 0,
    }));
  };

  const getWeeksForMonth = (month: number) => {
    return weekSettings.filter((ws) => {
      const startMonth = parseISO(ws.start_date).getMonth() + 1;
      const endMonth = parseISO(ws.end_date).getMonth() + 1;
      return startMonth === month || endMonth === month;
    });
  };

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    try {
      const dataUrl = await captureElement(reportRef.current);
      if (dataUrl) {
        downloadImage(dataUrl, `Thi-dua-Tuan-${currentWeek}.png`);
        toast({ title: 'Đã xuất ảnh thành công' });
      }
    } catch (error: any) {
      toast({ title: 'Lỗi xuất ảnh', description: error.message, variant: 'destructive' });
    }
  };

  const handleExportExcel = async () => {
    setIsLoading(true);
    try {
      if (exportType === 'week') {
        exportEmulationToExcel({
          schoolName,
          schoolYear,
          type: 'week',
          weekNumber: currentWeek,
          weekDateRange: currentWeekDateRange,
          classScores: currentWeekScores,
          columns: displayColumns,
          formulaString,
        });
        toast({ title: 'Đã xuất Excel tuần thành công' });
      } else if (exportType === 'month') {
        const monthNum = parseInt(selectedMonth);
        const weeksInMonth = getWeeksForMonth(monthNum);
        
        if (weeksInMonth.length === 0) {
          toast({ title: 'Không có dữ liệu', description: 'Không tìm thấy tuần nào trong tháng này', variant: 'destructive' });
          return;
        }
        
        const weekNumbers = weeksInMonth.map((w) => w.week_number);
        const scores = await fetchScoresForWeeks(weekNumbers);
        
        const weeksData = weeksInMonth.map((ws) => ({
          week_number: ws.week_number,
          start_date: ws.start_date,
          end_date: ws.end_date,
          scores: processScoresForExport(scores, ws.week_number),
        }));
        
        exportEmulationToExcel({
          schoolName,
          schoolYear,
          type: 'month',
          monthName: `Tháng ${monthNum}`,
          weeksData,
          columns: displayColumns,
          formulaString,
        });
        toast({ title: `Đã xuất Excel tháng ${monthNum} thành công` });
      } else if (exportType === 'year') {
        const allWeekNumbers = weekSettings.map((w) => w.week_number);
        const scores = await fetchScoresForWeeks(allWeekNumbers);
        
        const weeksData = weekSettings.map((ws) => ({
          week_number: ws.week_number,
          start_date: ws.start_date,
          end_date: ws.end_date,
          scores: processScoresForExport(scores, ws.week_number),
        }));
        
        exportEmulationToExcel({
          schoolName,
          schoolYear,
          type: 'year',
          weeksData,
          columns: displayColumns,
          formulaString,
        });
        toast({ title: 'Đã xuất Excel năm học thành công' });
      }
    } catch (error: any) {
      toast({ title: 'Lỗi xuất Excel', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Xuất báo cáo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Xuất báo cáo thi đua</DialogTitle>
          <DialogDescription>Chọn loại xuất và định dạng báo cáo</DialogDescription>
        </DialogHeader>
        
        <Tabs value={exportType} onValueChange={(v) => setExportType(v as any)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Theo tuần</TabsTrigger>
            <TabsTrigger value="month">Theo tháng</TabsTrigger>
            <TabsTrigger value="year">Cả năm học</TabsTrigger>
          </TabsList>
          
          <TabsContent value="week" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Xuất báo cáo tuần {currentWeek} hiện tại
              {currentWeekDateRange && (
                <span> ({format(parseISO(currentWeekDateRange.start), 'dd/MM')} - {format(parseISO(currentWeekDateRange.end), 'dd/MM')})</span>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="month" className="space-y-4">
            <div className="flex items-center gap-3">
              <Label>Chọn tháng:</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          
          <TabsContent value="year" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Xuất thống kê tổng hợp cả năm học {schoolYear} ({weekSettings.length} tuần)
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex gap-3 mt-4">
          {exportType === 'week' && (
            <Button variant="outline" onClick={handleExportImage} disabled={isLoading}>
              <Image className="h-4 w-4 mr-2" />
              Xuất ảnh
            </Button>
          )}
          <Button onClick={handleExportExcel} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Xuất Excel
          </Button>
        </div>
        
        {/* Report card preview for image export */}
        {exportType === 'week' && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            <EmulationReportCard
              ref={reportRef}
              schoolName={schoolName}
              weekNumber={currentWeek}
              dateRange={currentWeekDateRange}
              schoolYear={schoolYear}
              classScores={currentWeekScores}
              columns={displayColumns}
              formulaString={formulaString}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
