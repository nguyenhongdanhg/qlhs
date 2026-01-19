import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface AttendanceStats {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

interface TypeStats {
  type: string;
  label: string;
  present: number;
  absent: number;
  rate: number;
}

const COLORS = ['hsl(142, 76%, 36%)', 'hsl(0, 84%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(199, 89%, 48%)'];

export default function Statistics() {
  const { currentSchool } = useAuth();

  const [dateRange, setDateRange] = useState<'week' | 'month' | 'custom'>('week');
  const [startDate, setStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dailyStats, setDailyStats] = useState<AttendanceStats[]>([]);
  const [typeStats, setTypeStats] = useState<TypeStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (dateRange === 'week') {
      setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
      setEndDate(endOfWeek(new Date(), { weekStartsOn: 1 }));
    } else if (dateRange === 'month') {
      setStartDate(startOfMonth(new Date()));
      setEndDate(endOfMonth(new Date()));
    }
  }, [dateRange]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchStats();
  }, [currentSchool, startDate, endDate]);

  const fetchStats = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch attendance records
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .gte('attendance_date', startStr)
        .lte('attendance_date', endStr);

      const records = data || [];

      // Calculate daily stats
      const dailyMap: Record<string, AttendanceStats> = {};
      records.forEach((record: any) => {
        const date = record.attendance_date;
        if (!dailyMap[date]) {
          dailyMap[date] = { date, present: 0, absent: 0, late: 0, excused: 0 };
        }
        if (record.status === 'present') dailyMap[date].present++;
        else if (record.status === 'absent') dailyMap[date].absent++;
        else if (record.status === 'late') dailyMap[date].late++;
        else if (record.status === 'excused') dailyMap[date].excused++;
      });

      const sortedDaily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      setDailyStats(sortedDaily.map(d => ({
        ...d,
        date: format(new Date(d.date), 'dd/MM')
      })));

      // Calculate type stats
      const typeMap: Record<string, { present: number; total: number }> = {
        evening_study: { present: 0, total: 0 },
        boarding: { present: 0, total: 0 },
        breakfast: { present: 0, total: 0 },
        lunch: { present: 0, total: 0 },
        dinner: { present: 0, total: 0 },
      };

      records.forEach((record: any) => {
        if (typeMap[record.attendance_type]) {
          typeMap[record.attendance_type].total++;
          if (record.status === 'present') {
            typeMap[record.attendance_type].present++;
          }
        }
      });

      const typeLabels: Record<string, string> = {
        evening_study: 'Tự học tối',
        boarding: 'Nội trú',
        breakfast: 'Sáng',
        lunch: 'Trưa',
        dinner: 'Tối',
      };

      setTypeStats(
        Object.entries(typeMap)
          .filter(([_, v]) => v.total > 0)
          .map(([type, v]) => ({
            type,
            label: typeLabels[type] || type,
            present: v.present,
            absent: v.total - v.present,
            rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
          }))
      );
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRecords = dailyStats.reduce((sum, d) => sum + d.present + d.absent + d.late + d.excused, 0);
  const totalPresent = dailyStats.reduce((sum, d) => sum + d.present, 0);
  const overallRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

  if (!currentSchool) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn trường để tiếp tục</p>
      </div>
    );
  }

  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-info" />
          Thống kê
        </h1>
        <p className="page-description">
          Báo cáo và phân tích điểm danh
        </p>
      </div>

      {/* Date Range Selector */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Tuần này</SelectItem>
              <SelectItem value="month">Tháng này</SelectItem>
              <SelectItem value="custom">Tùy chọn</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">đến</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tổng lượt điểm danh</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalRecords}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tổng có mặt</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-success">{totalPresent}</span>
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tỷ lệ có mặt</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{overallRate}%</span>
                  {overallRate >= 90 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Daily Attendance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Điểm danh theo ngày</CardTitle>
                <CardDescription>Số lượng có mặt/vắng mỗi ngày</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyStats.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="present" name="Có mặt" fill="hsl(142, 76%, 36%)" />
                      <Bar dataKey="absent" name="Vắng" fill="hsl(0, 84%, 60%)" />
                      <Bar dataKey="late" name="Muộn" fill="hsl(38, 92%, 50%)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Type Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Tỷ lệ theo loại</CardTitle>
                <CardDescription>Phân bố điểm danh theo loại hình</CardDescription>
              </CardHeader>
              <CardContent>
                {typeStats.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    Chưa có dữ liệu
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={typeStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="label" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="rate" name="Tỷ lệ %" fill="hsl(173, 58%, 39%)">
                        {typeStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
