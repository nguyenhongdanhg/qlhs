import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, FileSpreadsheet, Loader2 } from 'lucide-react';
import { DateRangeType, getDateRange } from '@/lib/excel-export';

interface MealExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (rangeType: DateRangeType, selectedDate: Date) => Promise<void>;
  isExporting: boolean;
}

export function MealExportDialog({
  open,
  onOpenChange,
  onExport,
  isExporting,
}: MealExportDialogProps) {
  const [rangeType, setRangeType] = useState<DateRangeType>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateRange = getDateRange(selectedDate, rangeType);

  const handleExport = async () => {
    await onExport(rangeType, selectedDate);
    onOpenChange(false);
  };

  const getDateButtonLabel = () => {
    switch (rangeType) {
      case 'day':
        return format(selectedDate, 'dd/MM/yyyy', { locale: vi });
      case 'week':
        return `Tuần ${format(dateRange.start, 'dd/MM')} - ${format(dateRange.end, 'dd/MM/yyyy')}`;
      case 'month':
        return format(selectedDate, 'MM/yyyy', { locale: vi });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-success" />
            Xuất báo cáo Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Loại báo cáo</label>
            <Select
              value={rangeType}
              onValueChange={(v) => setRangeType(v as DateRangeType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Theo ngày</SelectItem>
                <SelectItem value="week">Theo tuần</SelectItem>
                <SelectItem value="month">Theo tháng</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {rangeType === 'day' && 'Chọn ngày'}
              {rangeType === 'week' && 'Chọn tuần'}
              {rangeType === 'month' && 'Chọn tháng'}
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {getDateButtonLabel()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  locale={vi}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
            <div className="font-medium text-foreground">Thời gian xuất:</div>
            <div className="text-muted-foreground">{dateRange.label}</div>
            <div className="text-xs text-muted-foreground mt-2">
              Từ {format(dateRange.start, 'dd/MM/yyyy')} đến {format(dateRange.end, 'dd/MM/yyyy')}
            </div>
          </div>

          <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-xs text-info space-y-1">
            <div className="font-medium">Cấu trúc file Excel:</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Sheet "Toàn trường": STT, Lớp, Sáng, Trưa, Tối, Gạo</li>
              <li>Sheet theo lớp: Điểm danh chi tiết từng học sinh</li>
              <li>Ký hiệu: x = ăn, o = vắng, - = chưa báo</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xuất...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Xuất Excel
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
