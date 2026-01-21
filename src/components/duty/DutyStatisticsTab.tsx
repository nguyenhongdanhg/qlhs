import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DutySchedule as DutyScheduleType, Profile } from '@/types';
import { format, getDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { BarChart3, Calendar, Sun, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DutyMember extends Profile {
  dutyCount: number;
  isFixed: boolean;
  fixedDays: number[];
}

interface DutyStatisticsTabProps {
  schedules: DutyScheduleType[];
  dutyMembers: DutyMember[];
  currentMonth: Date;
}

export default function DutyStatisticsTab({
  schedules,
  dutyMembers,
  currentMonth,
}: DutyStatisticsTabProps) {
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Calculate statistics per member
  const memberStats = useMemo(() => {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    return dutyMembers.map((member) => {
      const memberSchedules = schedules.filter(
        (s) =>
          s.user_id === member.id &&
          s.duty_date >= monthStart &&
          s.duty_date <= monthEnd
      );

      let saturdayCount = 0;
      let sundayCount = 0;
      let weekdayCount = 0;

      memberSchedules.forEach((s) => {
        const date = new Date(s.duty_date);
        const dayOfWeek = getDay(date);
        if (dayOfWeek === 6) saturdayCount++;
        else if (dayOfWeek === 0) sundayCount++;
        else weekdayCount++;
      });

      return {
        ...member,
        totalDuties: memberSchedules.length,
        saturdayCount,
        sundayCount,
        weekendCount: saturdayCount + sundayCount,
        weekdayCount,
        dutyDates: memberSchedules.map((s) => s.duty_date),
      };
    }).sort((a, b) => b.totalDuties - a.totalDuties);
  }, [schedules, dutyMembers, currentMonth]);

  // Calculate day-of-week distribution
  const dayOfWeekStats = useMemo(() => {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const filtered = schedules.filter(
      (s) => s.duty_date >= monthStart && s.duty_date <= monthEnd
    );

    const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    filtered.forEach((s) => {
      const dayOfWeek = getDay(new Date(s.duty_date));
      counts[dayOfWeek]++;
    });

    return counts;
  }, [schedules, currentMonth]);

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
  const avgDuties = dutyMembers.length > 0 ? (totalDuties / dutyMembers.length).toFixed(1) : 0;

  return (
    <div className="space-y-4">
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
                <p className="text-2xl font-bold">{totalDuties}</p>
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
                <p className="text-2xl font-bold">{avgDuties}</p>
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
                <p className="text-2xl font-bold">
                  {dayOfWeekStats[0] + dayOfWeekStats[6]}
                </p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
