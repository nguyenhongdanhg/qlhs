import { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useImageExport } from '@/hooks/use-image-export';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarIcon,
  Download,
  ImageIcon,
  FileSpreadsheet,
  Loader2,
  Pill,
  Stethoscope,
  Building2,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx-js-style';
import { fitColumnsToA4 } from '@/lib/excel-styles';
import type { HealthRecord, HealthTreatmentType } from '@/types';

interface HealthExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  schoolName: string;
}

const TREATMENT_LABELS: Record<HealthTreatmentType, string> = {
  medicine: 'Phát thuốc',
  first_aid: 'Sơ cứu',
  hospital: 'Vào viện',
  family_pickup: 'Gia đình đón về',
};

export function HealthExportDialog({
  open,
  onOpenChange,
  schoolId,
  schoolName,
}: HealthExportDialogProps) {
  const { toast } = useToast();
  const { exportAndShare, isExporting } = useImageExport();
  const reportRef = useRef<HTMLDivElement>(null);

  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [exportMode, setExportMode] = useState<'image' | 'excel'>('image');

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    let start: Date, end: Date;
    if (dateRange === 'day') {
      start = startOfDay(selectedDate);
      end = endOfDay(selectedDate);
    } else if (dateRange === 'week') {
      start = subDays(selectedDate, 6);
      end = endOfDay(selectedDate);
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }
    return { startDate: start, endDate: end };
  }, [dateRange, selectedDate]);

  // Fetch health records with pagination
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['health-records-export', schoolId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!schoolId) return [];
      const PAGE_SIZE = 1000;
      let allRecords: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('health_records')
          .select(`
            *,
            student:students(id, full_name, student_code, class:classes(name), parent_phone),
            reporter:profiles(id, full_name),
            medicines:health_record_medicines(
              id,
              quantity,
              medicine:medicines(id, name, unit)
            )
          `)
          .eq('school_id', schoolId)
          .gte('record_date', format(startDate, 'yyyy-MM-dd'))
          .lte('record_date', format(endDate, 'yyyy-MM-dd'))
          .order('record_date', { ascending: true })
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        allRecords = [...allRecords, ...(data || [])];
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allRecords;
    },
    enabled: open && !!schoolId,
  });

  // Stats
  const stats = useMemo(() => ({
    total: records.length,
    medicine: records.filter((r) => r.treatment_type === 'medicine').length,
    firstAid: records.filter((r) => r.treatment_type === 'first_aid').length,
    hospital: records.filter((r) => r.treatment_type === 'hospital').length,
    familyPickup: records.filter((r) => r.treatment_type === 'family_pickup').length,
    contacted: records.filter((r) => r.parent_contacted).length,
  }), [records]);

  // Export to image
  const handleExportImage = async () => {
    if (!reportRef.current) return;
    const dateStr = dateRange === 'day' 
      ? format(selectedDate, 'dd-MM-yyyy')
      : dateRange === 'week'
        ? `${format(startDate, 'dd-MM')}_${format(endDate, 'dd-MM-yyyy')}`
        : format(selectedDate, 'MM-yyyy');
    
    await exportAndShare(
      reportRef,
      `BaoCaoSucKhoe_${dateStr}`,
      `Báo cáo sức khỏe ${schoolName}`,
      'share'
    );
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const data = records.map((r, idx) => ({
        'STT': idx + 1,
        'Ngày ghi nhận': format(new Date(r.record_date), 'dd/MM/yyyy'),
        'Thời gian tạo': r.created_at ? format(new Date(r.created_at), 'HH:mm dd/MM/yyyy') : '',
        'Họ tên học sinh': r.student?.full_name || '',
        'Lớp': r.student?.class?.name || '',
        'Mã HS': r.student?.student_code || '',
        'Chuẩn đoán': r.diagnosis || '',
        'Xử lý': TREATMENT_LABELS[r.treatment_type as HealthTreatmentType] || '',
        'Thuốc phát': r.treatment_type === 'medicine' && r.medicines?.length > 0
          ? r.medicines.map((m: any) => `${m.medicine?.name}: ${m.quantity} ${m.medicine?.unit}`).join('; ')
          : '',
        'Bệnh viện': r.hospital_name || '',
        'Đã liên hệ PH': r.parent_contacted ? 'Có' : '',
        'Ghi chú': r.notes || '',
        'Người ghi nhận': r.reporter?.full_name || '',
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      
      fitColumnsToA4(ws, [5, 12, 18, 25, 8, 10, 30, 12, 40, 20, 12, 30, 18]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sức khỏe');

      const dateStr = dateRange === 'month' 
        ? format(selectedDate, 'MM-yyyy')
        : format(selectedDate, 'dd-MM-yyyy');
      XLSX.writeFile(wb, `BaoCaoSucKhoe_${dateStr}.xlsx`);

      toast({ title: 'Thành công', description: 'Đã xuất file Excel' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg">Xuất báo cáo sức khỏe</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col px-4 pb-4 overflow-hidden">
          {/* Date range selector */}
          <div className="flex flex-wrap gap-2 items-center flex-shrink-0 pb-3">
            <div className="flex gap-1">
              {(['day', 'week', 'month'] as const).map((r) => (
                <Button
                  key={r}
                  variant={dateRange === r ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs px-2 sm:px-3"
                  onClick={() => setDateRange(r)}
                >
                  {r === 'day' ? 'Ngày' : r === 'week' ? 'Tuần' : 'Tháng'}
                </Button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                  <span>{format(selectedDate, 'dd/MM/yyyy', { locale: vi })}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  locale={vi}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Export mode tabs */}
          <Tabs value={exportMode} onValueChange={(v) => setExportMode(v as any)} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0 h-9">
              <TabsTrigger value="image" className="text-xs">
                <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Ảnh
              </TabsTrigger>
              <TabsTrigger value="excel" className="text-xs">
                <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Excel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="image" className="mt-3 flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Image preview - responsive scroll area */}
              <div className="flex-1 min-h-0 overflow-auto border rounded-lg bg-white">
                <div ref={reportRef} className="p-3 sm:p-4 bg-white" style={{ minWidth: '320px' }}>
                  {/* Header */}
                  <div className="text-center mb-3 sm:mb-4">
                    <h2 className="font-bold text-sm sm:text-lg break-words">{schoolName}</h2>
                    <h3 className="font-semibold text-xs sm:text-base">BÁO CÁO SỨC KHỎE HỌC SINH</h3>
                    <p className="text-xs text-muted-foreground">
                      {dateRange === 'day'
                        ? `Ngày ${format(selectedDate, 'dd/MM/yyyy', { locale: vi })}`
                        : dateRange === 'week'
                          ? `Từ ${format(startDate, 'dd/MM')} đến ${format(endDate, 'dd/MM/yyyy', { locale: vi })}`
                          : `Tháng ${format(selectedDate, 'MM/yyyy', { locale: vi })}`}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-1 sm:gap-2 mb-3 sm:mb-4 text-center text-xs">
                    <div className="p-1.5 sm:p-2 bg-blue-50 rounded">
                      <p className="font-bold text-base sm:text-lg">{stats.total}</p>
                      <p className="text-[10px] sm:text-xs">Tổng</p>
                    </div>
                    <div className="p-1.5 sm:p-2 bg-green-50 rounded">
                      <p className="font-bold text-base sm:text-lg text-green-700">{stats.medicine}</p>
                      <p className="text-[10px] sm:text-xs">Phát thuốc</p>
                    </div>
                    <div className="p-1.5 sm:p-2 bg-yellow-50 rounded">
                      <p className="font-bold text-base sm:text-lg text-yellow-700">{stats.firstAid}</p>
                      <p className="text-[10px] sm:text-xs">Sơ cứu</p>
                    </div>
                    <div className="p-1.5 sm:p-2 bg-red-50 rounded">
                      <p className="font-bold text-base sm:text-lg text-red-700">{stats.hospital}</p>
                      <p className="text-[10px] sm:text-xs">Vào viện</p>
                    </div>
                  </div>

                  {/* Records list */}
                  {records.length > 0 ? (
                    <div className="space-y-1.5 sm:space-y-2">
                      {records.slice(0, 20).map((r, idx) => (
                        <div key={r.id} className="text-xs border-b pb-1.5 sm:pb-2">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                            <span className="font-medium">{idx + 1}.</span>
                            <span className="text-muted-foreground text-[10px] sm:text-xs">{format(new Date(r.record_date), 'dd/MM')}</span>
                            <span className="font-medium break-words">{r.student?.full_name}</span>
                            <span className="text-muted-foreground text-[10px] sm:text-xs">({r.student?.class?.name})</span>
                            <Badge
                              className={cn(
                                'text-[9px] sm:text-[10px] px-1 py-0',
                                r.treatment_type === 'medicine' && 'bg-green-100 text-green-700',
                                r.treatment_type === 'first_aid' && 'bg-yellow-100 text-yellow-700',
                                r.treatment_type === 'hospital' && 'bg-red-100 text-red-700',
                                r.treatment_type === 'family_pickup' && 'bg-blue-100 text-blue-700'
                              )}
                            >
                              {TREATMENT_LABELS[r.treatment_type as HealthTreatmentType]}
                            </Badge>
                            {r.parent_contacted && (
                              <Phone className="h-3 w-3 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-muted-foreground ml-3 sm:ml-4 break-words text-[10px] sm:text-xs">{r.diagnosis}</p>
                          {r.treatment_type === 'medicine' && r.medicines?.length > 0 && (
                            <p className="text-green-600 ml-3 sm:ml-4 text-[10px] sm:text-xs break-words">
                              Thuốc: {r.medicines.map((m: any) => `${m.medicine?.name} (${m.quantity})`).join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                      {records.length > 20 && (
                        <p className="text-center text-xs text-muted-foreground">
                          ... và {records.length - 20} bản ghi khác
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4 text-sm">
                      Không có bản ghi trong khoảng thời gian này
                    </p>
                  )}

                  {/* Footer */}
                  <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t text-[10px] sm:text-xs text-muted-foreground text-center">
                    Xuất lúc: {format(new Date(), 'HH:mm dd/MM/yyyy', { locale: vi })}
                  </div>
                </div>
              </div>

              <Button
                className="w-full mt-3 flex-shrink-0"
                size="sm"
                onClick={handleExportImage}
                disabled={isExporting || records.length === 0}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="mr-2 h-4 w-4" />
                )}
                Chia sẻ ảnh báo cáo
              </Button>
            </TabsContent>

            <TabsContent value="excel" className="mt-3 flex-1 min-h-0 flex flex-col justify-center">
              <div className="text-center py-6">
                <FileSpreadsheet className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-green-600 mb-3" />
                <p className="text-sm text-muted-foreground mb-4 px-4">
                  Xuất {records.length} bản ghi ra file Excel
                </p>
                <Button
                  onClick={handleExportExcel}
                  disabled={records.length === 0}
                  className="gap-2"
                  size="sm"
                >
                  <Download className="h-4 w-4" />
                  Tải xuống Excel
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
