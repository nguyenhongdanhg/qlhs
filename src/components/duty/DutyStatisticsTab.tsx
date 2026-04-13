import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DutySchedule as DutyScheduleType, Profile } from '@/types';
import { format, getDay, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { BarChart3, Calendar, Sun, Trophy, TrendingUp, TrendingDown, Minus, Download, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportDutyAssignment } from '@/lib/duty-excel-export';
import { useToast } from '@/hooks/use-toast';

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

interface DutyStatisticsTabProps {
  schedules: DutyScheduleType[];
  previousMonthSchedules: DutyScheduleType[];
  dutyMembers: DutyMember[];
  currentMonth: Date;
  schoolName?: string;
  dutyLeaders?: DutyLeaderData[];
}

export default function DutyStatisticsTab({
  schedules,
  previousMonthSchedules,
  dutyMembers,
  currentMonth,
  schoolName = '',
  dutyLeaders = [],
}: DutyStatisticsTabProps) {
  const { toast } = useToast();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<'month' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(currentMonth), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(currentMonth), 'yyyy-MM-dd'));
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Calculate statistics per member for current month
  const memberStats = useMemo(() => {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    // Previous month stats
    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    const prevMonthEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

    return dutyMembers.map((member) => {
      // Current month
      const memberSchedules = schedules.filter(
        (s) =>
          s.user_id === member.id &&
          s.duty_date >= monthStart &&
          s.duty_date <= monthEnd
      );

      // Previous month
      const prevMemberSchedules = previousMonthSchedules.filter(
        (s) =>
          s.user_id === member.id &&
          s.duty_date >= prevMonthStart &&
          s.duty_date <= prevMonthEnd
      );

      let saturdayCount = 0;
      let sundayCount = 0;
      let weekdayCount = 0;
      let prevSaturdayCount = 0;
      let prevSundayCount = 0;
      let prevWeekdayCount = 0;

      memberSchedules.forEach((s) => {
        const date = new Date(s.duty_date);
        const dayOfWeek = getDay(date);
        if (dayOfWeek === 6) saturdayCount++;
        else if (dayOfWeek === 0) sundayCount++;
        else weekdayCount++;
      });

      prevMemberSchedules.forEach((s) => {
        const date = new Date(s.duty_date);
        const dayOfWeek = getDay(date);
        if (dayOfWeek === 6) prevSaturdayCount++;
        else if (dayOfWeek === 0) prevSundayCount++;
        else prevWeekdayCount++;
      });

      const prevTotalDuties = prevMemberSchedules.length;
      const prevWeekendCount = prevSaturdayCount + prevSundayCount;

      return {
        ...member,
        totalDuties: memberSchedules.length,
        saturdayCount,
        sundayCount,
        weekendCount: saturdayCount + sundayCount,
        weekdayCount,
        dutyDates: memberSchedules.map((s) => s.duty_date),
        // Previous month comparison
        prevTotalDuties,
        prevWeekendCount,
        prevWeekdayCount,
        totalChange: memberSchedules.length - prevTotalDuties,
        weekendChange: (saturdayCount + sundayCount) - prevWeekendCount,
      };
    }).sort((a, b) => b.totalDuties - a.totalDuties);
  }, [schedules, previousMonthSchedules, dutyMembers, currentMonth]);

  // Calculate day-of-week distribution for current and previous month
  const { dayOfWeekStats, prevDayOfWeekStats } = useMemo(() => {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    const prevMonthEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

    const filtered = schedules.filter(
      (s) => s.duty_date >= monthStart && s.duty_date <= monthEnd
    );
    const prevFiltered = previousMonthSchedules.filter(
      (s) => s.duty_date >= prevMonthStart && s.duty_date <= prevMonthEnd
    );

    const counts = [0, 0, 0, 0, 0, 0, 0];
    const prevCounts = [0, 0, 0, 0, 0, 0, 0];
    
    filtered.forEach((s) => {
      const dayOfWeek = getDay(new Date(s.duty_date));
      counts[dayOfWeek]++;
    });

    prevFiltered.forEach((s) => {
      const dayOfWeek = getDay(new Date(s.duty_date));
      prevCounts[dayOfWeek]++;
    });

    return { dayOfWeekStats: counts, prevDayOfWeekStats: prevCounts };
  }, [schedules, previousMonthSchedules, currentMonth]);

  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(-2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const totalDuties = memberStats.reduce((sum, m) => sum + m.totalDuties, 0);
  const prevTotalDuties = memberStats.reduce((sum, m) => sum + m.prevTotalDuties, 0);
  const avgDuties = dutyMembers.length > 0 ? (totalDuties / dutyMembers.length).toFixed(1) : 0;
  const prevAvgDuties = dutyMembers.length > 0 ? (prevTotalDuties / dutyMembers.length).toFixed(1) : 0;
  
  const totalChange = totalDuties - prevTotalDuties;
  const weekendTotal = dayOfWeekStats[0] + dayOfWeekStats[6];
  const prevWeekendTotal = prevDayOfWeekStats[0] + prevDayOfWeekStats[6];
  const weekendChange = weekendTotal - prevWeekendTotal;

  const renderChange = (change: number) => {
    if (change > 0) {
      return (
        <span className="flex items-center gap-0.5 text-xs text-green-600">
          <TrendingUp className="h-3 w-3" />
          +{change}
        </span>
      );
    } else if (change < 0) {
      return (
        <span className="flex items-center gap-0.5 text-xs text-red-600">
          <TrendingDown className="h-3 w-3" />
          {change}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0
      </span>
    );
  };

  const handleExport = () => {
    const start = exportPeriod === 'month' ? startOfMonth(currentMonth) : new Date(customStartDate);
    const end = exportPeriod === 'month' ? endOfMonth(currentMonth) : new Date(customEndDate);
    
    const periodLabel = exportPeriod === 'month'
      ? `Tháng ${format(currentMonth, 'MM/yyyy')}`
      : `Từ ${format(start, 'dd/MM/yyyy')} đến ${format(end, 'dd/MM/yyyy')}`;

    exportDutyAssignment({
      schoolName,
      schedules,
      dutyMembers,
      periodLabel,
      startDate: start,
      endDate: end,
    });

    setShowExportDialog(false);
    toast({ title: 'Thành công', description: 'Đã xuất file Excel báo cáo lịch trực' });
  };

  return (
    <div className="space-y-4">
      {/* Export Button */}
      <div className="flex justify-end">
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Xuất Excel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Xuất báo cáo lịch trực</DialogTitle>
              <DialogDescription>Chọn giai đoạn xuất báo cáo</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Giai đoạn</Label>
                <Select value={exportPeriod} onValueChange={(v: 'month' | 'custom') => setExportPeriod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Tháng hiện tại ({format(currentMonth, 'MM/yyyy')})</SelectItem>
                    <SelectItem value="custom">Tùy chọn giai đoạn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {exportPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Từ ngày</Label>
                    <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Đến ngày</Label>
                    <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Xuất báo cáo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tổng lượt trực</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{totalDuties}</p>
                  {renderChange(totalChange)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-950/30 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">TB/người</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{avgDuties}</p>
                  <span className="text-xs text-muted-foreground">
                    (T.trước: {prevAvgDuties})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-950/30 rounded-lg">
                <Sun className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cuối tuần</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{weekendTotal}</p>
                  {renderChange(weekendChange)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-950/30 rounded-lg">
                <Trophy className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Người trực</p>
                <p className="text-2xl font-bold">{dutyMembers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Day of Week Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Phân bố theo thứ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 justify-between">
            {dayNames.map((name, idx) => {
              const isWeekend = idx === 0 || idx === 6;
              const count = dayOfWeekStats[idx];
              const maxCount = Math.max(...dayOfWeekStats);
              const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="h-20 w-full flex flex-col justify-end">
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        isWeekend
                          ? 'bg-orange-400 dark:bg-orange-600'
                          : 'bg-primary'
                      )}
                      style={{ height: `${Math.max(heightPercent, 5)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isWeekend && 'text-orange-600 dark:text-orange-400'
                    )}
                  >
                    {name}
                  </span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Member Statistics Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Chi tiết theo người</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 text-center">STT</TableHead>
                  <TableHead className="min-w-[150px]">Họ tên</TableHead>
                  <TableHead className="w-16 text-center">Giới tính</TableHead>
                  <TableHead className="w-16 text-center">Tổng</TableHead>
                  <TableHead className="w-16 text-center">Ngày thường</TableHead>
                  <TableHead className="w-16 text-center">
                    <span className="text-orange-600">T7</span>
                  </TableHead>
                  <TableHead className="w-16 text-center">
                    <span className="text-orange-600">CN</span>
                  </TableHead>
                      <TableHead className="w-20 text-center">
                        <span className="text-orange-600">Cuối tuần</span>
                      </TableHead>
                      <TableHead className="w-20 text-center hidden md:table-cell">
                        So tháng trước
                      </TableHead>
                    </TableRow>
                  </TableHeader>
              <TableBody>
                {memberStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Chưa có dữ liệu thống kê
                    </TableCell>
                  </TableRow>
                ) : (
                  memberStats.map((member, idx) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            member.gender === 'male'
                              ? 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30'
                              : member.gender === 'female'
                              ? 'border-pink-300 text-pink-600 bg-pink-50 dark:bg-pink-950/30'
                              : 'border-muted'
                          )}
                        >
                          {member.gender === 'male'
                            ? 'Nam'
                            : member.gender === 'female'
                            ? 'Nữ'
                            : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-bold">
                          {member.totalDuties}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{member.weekdayCount}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-orange-600 font-medium">
                          {member.saturdayCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-orange-600 font-medium">
                          {member.sundayCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-950/30"
                        >
                          {member.weekendCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        <div className="flex flex-col items-center gap-1">
                          {renderChange(member.totalChange)}
                          {member.weekendChange !== 0 && (
                            <span className={cn(
                              "text-[10px]",
                              member.weekendChange > 0 ? "text-orange-500" : "text-orange-400"
                            )}>
                              CT: {member.weekendChange > 0 ? '+' : ''}{member.weekendChange}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
