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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WeekSettingsDialogProps {
  schoolId: string;
  schoolYear: string;
  onSaved: () => void;
}

export function WeekSettingsDialog({ schoolId, schoolYear, onSaved }: WeekSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [week1StartDate, setWeek1StartDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && schoolId) {
      loadExistingSettings();
    }
  }, [open, schoolId, schoolYear]);

  const loadExistingSettings = async () => {
    const { data } = await supabase
      .from('week_settings')
      .select('start_date')
      .eq('school_id', schoolId)
      .eq('school_year', schoolYear)
      .eq('week_number', 1)
      .maybeSingle();

    if (data?.start_date) {
      setWeek1StartDate(parseISO(data.start_date));
    }
  };

  const handleSave = async () => {
    if (!week1StartDate) {
      toast({ title: 'Vui lòng chọn ngày bắt đầu tuần 1', variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      // Generate all 35 weeks
      const weekSettings = [];
      for (let i = 0; i < 35; i++) {
        const startDate = addDays(week1StartDate, i * 7);
        const endDate = addDays(startDate, 6);
        weekSettings.push({
          school_id: schoolId,
          school_year: schoolYear,
          week_number: i + 1,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
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
        .insert(weekSettings);

      if (error) throw error;

      toast({ title: 'Đã lưu cài đặt thời gian tuần' });
      setOpen(false);
      onSaved();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Cài đặt thời gian tuần">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cài đặt thời gian tuần</DialogTitle>
          <DialogDescription>
            Chọn ngày bắt đầu tuần 1, hệ thống sẽ tự động tính các tuần tiếp theo (mỗi tuần 7 ngày).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Năm học</Label>
            <Input value={schoolYear} disabled />
          </div>
          <div className="space-y-2">
            <Label>Ngày bắt đầu tuần 1</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !week1StartDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {week1StartDate ? (
                    format(week1StartDate, 'dd/MM/yyyy', { locale: vi })
                  ) : (
                    <span>Chọn ngày</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={week1StartDate}
                  onSelect={setWeek1StartDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {week1StartDate && (
            <div className="rounded-md border p-3 bg-muted/50 space-y-1 text-sm">
              <p className="font-medium">Xem trước:</p>
              <p>Tuần 1: {format(week1StartDate, 'dd/MM/yyyy')} - {format(addDays(week1StartDate, 6), 'dd/MM/yyyy')}</p>
              <p>Tuần 2: {format(addDays(week1StartDate, 7), 'dd/MM/yyyy')} - {format(addDays(week1StartDate, 13), 'dd/MM/yyyy')}</p>
              <p>Tuần 3: {format(addDays(week1StartDate, 14), 'dd/MM/yyyy')} - {format(addDays(week1StartDate, 20), 'dd/MM/yyyy')}</p>
              <p className="text-muted-foreground">...</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving || !week1StartDate}>
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
