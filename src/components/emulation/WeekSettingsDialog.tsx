import { useState, useEffect } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WeekSettingsDialogProps {
  schoolId: string;
  schoolYear: string;
  onSaved: () => void;
}

interface WeekSetting {
  week_number: number;
  start_date: string;
  end_date: string;
}

export function WeekSettingsDialog({ schoolId, schoolYear, onSaved }: WeekSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [existingWeeks, setExistingWeeks] = useState<WeekSetting[]>([]);

  useEffect(() => {
    if (open && schoolId) {
      loadExistingSettings();
    }
  }, [open, schoolId, schoolYear]);

  useEffect(() => {
    // When selected week changes, show its current start date
    const week = existingWeeks.find(w => w.week_number === selectedWeek);
    if (week) {
      setStartDate(parseISO(week.start_date));
    } else {
      setStartDate(undefined);
    }
  }, [selectedWeek, existingWeeks]);

  const loadExistingSettings = async () => {
    const { data } = await supabase
      .from('week_settings')
      .select('week_number, start_date, end_date')
      .eq('school_id', schoolId)
      .eq('school_year', schoolYear)
      .order('week_number', { ascending: true });

    if (data && data.length > 0) {
      setExistingWeeks(data);
    } else {
      setExistingWeeks([]);
    }
  };

  const handleSave = async () => {
    if (!startDate) {
      toast({ title: 'Vui lòng chọn ngày bắt đầu', variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      // Keep weeks before selectedWeek, recalculate from selectedWeek onward
      const keepWeeks = existingWeeks.filter(w => w.week_number < selectedWeek);
      
      const newWeeks: { school_id: string; school_year: string; week_number: number; start_date: string; end_date: string }[] = [];
      
      // Add kept weeks
      for (const w of keepWeeks) {
        newWeeks.push({
          school_id: schoolId,
          school_year: schoolYear,
          week_number: w.week_number,
          start_date: w.start_date,
          end_date: w.end_date,
        });
      }

      // Generate from selectedWeek to 35
      for (let i = 0; i < (35 - selectedWeek + 1); i++) {
        const weekStart = addDays(startDate, i * 7);
        const weekEnd = addDays(weekStart, 6);
        newWeeks.push({
          school_id: schoolId,
          school_year: schoolYear,
          week_number: selectedWeek + i,
          start_date: format(weekStart, 'yyyy-MM-dd'),
          end_date: format(weekEnd, 'yyyy-MM-dd'),
        });
      }

      // Delete existing settings for this school year
      await supabase
        .from('week_settings')
        .delete()
        .eq('school_id', schoolId)
        .eq('school_year', schoolYear);

      // Insert new settings
      const { error } = await supabase
        .from('week_settings')
        .insert(newWeeks);

      if (error) throw error;

      toast({ title: `Đã lưu cài đặt từ tuần ${selectedWeek}` });
      setExistingWeeks(newWeeks.map(w => ({ week_number: w.week_number, start_date: w.start_date, end_date: w.end_date })));
      onSaved();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const weekOptions = Array.from({ length: 35 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Cài đặt thời gian tuần">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cài đặt thời gian tuần</DialogTitle>
          <DialogDescription>
            Chọn tuần cần điều chỉnh và ngày bắt đầu. Các tuần trước đó giữ nguyên, các tuần sau tự động tính lại.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Năm học</Label>
            <Input value={schoolYear} disabled />
          </div>

          <div className="space-y-2">
            <Label>Chọn tuần cần điều chỉnh</Label>
            <Select value={String(selectedWeek)} onValueChange={v => setSelectedWeek(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-60">
                  {weekOptions.map(w => {
                    const existing = existingWeeks.find(e => e.week_number === w);
                    return (
                      <SelectItem key={w} value={String(w)}>
                        Tuần {w} {existing ? `(${format(parseISO(existing.start_date), 'dd/MM')} - ${format(parseISO(existing.end_date), 'dd/MM')})` : ''}
                      </SelectItem>
                    );
                  })}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ngày bắt đầu tuần {selectedWeek}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy', { locale: vi }) : <span>Chọn ngày</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {startDate && (
            <div className="rounded-md border p-3 bg-muted/50 space-y-1 text-sm">
              <p className="font-medium">Xem trước:</p>
              {selectedWeek > 1 && existingWeeks.find(w => w.week_number === selectedWeek - 1) && (
                <p className="text-muted-foreground">
                  Tuần {selectedWeek - 1}: {format(parseISO(existingWeeks.find(w => w.week_number === selectedWeek - 1)!.start_date), 'dd/MM/yyyy')} - {format(parseISO(existingWeeks.find(w => w.week_number === selectedWeek - 1)!.end_date), 'dd/MM/yyyy')} (giữ nguyên)
                </p>
              )}
              <p className="font-medium text-primary">
                Tuần {selectedWeek}: {format(startDate, 'dd/MM/yyyy')} - {format(addDays(startDate, 6), 'dd/MM/yyyy')}
              </p>
              <p>
                Tuần {selectedWeek + 1}: {format(addDays(startDate, 7), 'dd/MM/yyyy')} - {format(addDays(startDate, 13), 'dd/MM/yyyy')}
              </p>
              <p>
                Tuần {selectedWeek + 2}: {format(addDays(startDate, 14), 'dd/MM/yyyy')} - {format(addDays(startDate, 20), 'dd/MM/yyyy')}
              </p>
              <p className="text-muted-foreground">...</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving || !startDate}>
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
