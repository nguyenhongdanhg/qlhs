import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { format, eachDayOfInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DateRangeType, getDateRange } from '@/lib/excel-export';
import { useToast } from '@/hooks/use-toast';
import { Class, Student } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  currentSchool: { id: string; name: string };
  classes: Class[];
  students: Student[];
}

type ActivityType = 'boarding' | 'breakfast' | 'lunch' | 'dinner' | 'evening_study';

const ACTIVITIES: { key: ActivityType; label: string }[] = [
  { key: 'boarding', label: 'Nội trú (ngủ)' },
  { key: 'breakfast', label: 'Ăn sáng' },
  { key: 'lunch', label: 'Ăn trưa' },
  { key: 'dinner', label: 'Ăn tối' },
  { key: 'evening_study', label: 'Tự học tối' },
];

interface Cell {
  present: number;
  absent: number;
  has: boolean;
}

export function DailyActivityMatrix({ currentSchool, classes, students }: Props) {
  const { toast } = useToast();
  const [rangeType, setRangeType] = useState<DateRangeType>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [matrix, setMatrix] = useState<Record<string, Record<ActivityType, Cell>>>({});

  const dateRange = useMemo(() => getDateRange(selectedDate, rangeType), [selectedDate, rangeType]);
  const days = useMemo(() => eachDayOfInterval({ start: dateRange.start, end: dateRange.end }), [dateRange]);

  const fetchAll = async (buildQuery: () => any) => {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  const fetchData = useCallback(async () => {
    if (!currentSchool) return;
    setIsLoading(true);
    try {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const records = await fetchAll(() =>
        supabase
          .from('attendance_records')
          .select('student_id, attendance_date, attendance_type, status, created_at')
          .eq('school_id', currentSchool.id)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .order('created_at', { ascending: false })
      );

      // Latest per (student, date, type)
      const latest = new Map<string, any>();
      records.forEach((r: any) => {
        const k = `${r.student_id}-${r.attendance_date}-${r.attendance_type}`;
        const ex = latest.get(k);
        if (!ex || new Date(r.created_at).getTime() > new Date(ex.created_at).getTime()) {
          latest.set(k, r);
        }
      });

      const result: Record<string, Record<ActivityType, Cell>> = {};
      days.forEach(d => {
        const ds = format(d, 'yyyy-MM-dd');
        result[ds] = {} as any;
        ACTIVITIES.forEach(a => {
          result[ds][a.key] = { present: 0, absent: 0, has: false };
        });
      });

      latest.forEach((r: any) => {
        const ds = r.attendance_date;
        const type = r.attendance_type as ActivityType;
        if (!result[ds] || !result[ds][type]) return;
        result[ds][type].has = true;
        if (r.status === 'present') result[ds][type].present++;
        else if (r.status === 'absent' || r.status === 'excused') result[ds][type].absent++;
      });

      setMatrix(result);
    } catch (e) {
      console.error(e);
      toast({ title: 'Lỗi', description: 'Không thể tải dữ liệu', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentSchool, dateRange, days, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Bảng hoạt động theo ngày</CardTitle>
            <CardDescription>{dateRange.label} — có mặt / vắng theo từng hoạt động</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={rangeType} onValueChange={(v) => setRangeType(v as DateRangeType)}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Theo tuần</SelectItem>
                <SelectItem value="month">Theo tháng</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'dd/MM/yyyy', { locale: vi })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} locale={vi} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border bg-background p-2 text-left font-medium">Hoạt động</th>
                  {days.map(d => (
                    <th key={d.toISOString()} className="border p-2 text-center text-xs font-medium">
                      <div>{format(d, 'EEE', { locale: vi })}</div>
                      <div className="text-muted-foreground">{format(d, 'dd/MM')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTIVITIES.map(a => (
                  <tr key={a.key}>
                    <td className="sticky left-0 z-10 border bg-background p-2 font-medium">{a.label}</td>
                    {days.map(d => {
                      const ds = format(d, 'yyyy-MM-dd');
                      const cell = matrix[ds]?.[a.key];
                      if (!cell || !cell.has) {
                        return <td key={ds} className="border p-2 text-center text-xs text-muted-foreground">—</td>;
                      }
                      return (
                        <td key={ds} className="border p-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-semibold text-success">{cell.present}</span>
                            <span className={cn("text-xs", cell.absent > 0 ? "text-destructive font-medium" : "text-muted-foreground")}>
                              {cell.absent > 0 ? `−${cell.absent}` : '0'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span><span className="font-semibold text-success">Xanh</span>: có mặt</span>
              <span><span className="font-semibold text-destructive">Đỏ</span>: vắng</span>
              <span>—: chưa báo cáo</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
