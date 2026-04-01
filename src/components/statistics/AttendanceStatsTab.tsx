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
import { CalendarIcon, FileSpreadsheet, Loader2, Home, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { DateRangeType, getDateRange, exportAttendanceReport, AttendanceReportData, ExcelExportConfig } from '@/lib/excel-export';
import { useToast } from '@/hooks/use-toast';
import { Class, Student, AttendanceType } from '@/types';
import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface AttendanceStatsTabProps {
  currentSchool: { id: string; name: string };
  classes: Class[];
  students: Student[];
  profile: { full_name: string } | null;
}

interface ClassAttendanceData {
  className: string;
  classId: string;
  total: number;
  present: number;
  absent: number;
  excused: number;
  rate: number;
}

interface DailyAttendanceData {
  date: string;
  dateLabel: string;
  boarding: { total: number; present: number; absent: number };
  evening_study: { total: number; present: number; absent: number };
}

export function AttendanceStatsTab({ currentSchool, classes, students, profile }: AttendanceStatsTabProps) {
  const { toast } = useToast();
  const [rangeType, setRangeType] = useState<DateRangeType>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [attendanceType, setAttendanceType] = useState<'boarding' | 'evening_study'>('boarding');

  const [classData, setClassData] = useState<ClassAttendanceData[]>([]);
  const [dailyData, setDailyData] = useState<DailyAttendanceData[]>([]);

  const dateRange = useMemo(() => getDateRange(selectedDate, rangeType), [selectedDate, rangeType]);

  const fetchAllRecords = async (buildQuery: () => any) => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const fetchData = useCallback(async () => {
    if (!currentSchool || classes.length === 0 || students.length === 0) return;
    setIsLoading(true);

    try {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      // Fetch both boarding and evening_study records
      const [boardingRecords, studyRecords] = await Promise.all([
        fetchAllRecords(() =>
          supabase
            .from('attendance_records')
            .select('student_id, class_id, attendance_date, status, created_at, reporter_id, reporter:profiles!attendance_records_reporter_id_fkey(full_name), excused_reason')
            .eq('school_id', currentSchool.id)
            .eq('attendance_type', 'boarding')
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)
            .order('created_at', { ascending: false })
        ),
        fetchAllRecords(() =>
          supabase
            .from('attendance_records')
            .select('student_id, class_id, attendance_date, status, created_at, reporter_id, reporter:profiles!attendance_records_reporter_id_fkey(full_name), excused_reason')
            .eq('school_id', currentSchool.id)
            .eq('attendance_type', 'evening_study')
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)
            .order('created_at', { ascending: false })
        ),
      ]);

      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

      // Process records: get latest per student per date
      const processRecords = (records: any[]) => {
        const latestMap = new Map<string, any>();
        records.forEach(r => {
          const key = `${r.student_id}-${r.attendance_date}`;
          const existing = latestMap.get(key);
          if (!existing || new Date(r.created_at).getTime() > new Date(existing.created_at).getTime()) {
            latestMap.set(key, r);
          }
        });
        return Array.from(latestMap.values());
      };

      const latestBoarding = processRecords(boardingRecords);
      const latestStudy = processRecords(studyRecords);

      // Build class-level data for selected type
      const buildClassData = (records: any[]): ClassAttendanceData[] => {
        const classMap = new Map<string, { present: number; absent: number; excused: number; total: number }>();

        // Initialize with all classes
        classes.forEach(c => {
          const classStudentCount = students.filter(s => s.class_id === c.id).length;
          classMap.set(c.id, { present: 0, absent: 0, excused: 0, total: classStudentCount });
        });

        records.forEach(r => {
          const classId = r.class_id;
          if (!classId || !classMap.has(classId)) return;
          const entry = classMap.get(classId)!;
          if (r.status === 'present') entry.present++;
          else if (r.status === 'absent') entry.absent++;
          else if (r.status === 'excused') entry.excused++;
        });

        return classes.map(c => {
          const data = classMap.get(c.id) || { present: 0, absent: 0, excused: 0, total: 0 };
          const totalReports = data.present + data.absent + data.excused;
          return {
            className: c.name,
            classId: c.id,
            total: data.total,
            present: data.present,
            absent: data.absent,
            excused: data.excused,
            rate: totalReports > 0 ? Math.round((data.present / totalReports) * 100) : 0,
          };
        }).filter(d => d.total > 0);
      };

      setClassData(buildClassData(attendanceType === 'boarding' ? latestBoarding : latestStudy));

      // Build daily data
      const buildDailyData = (): DailyAttendanceData[] => {
        return days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const bRecords = latestBoarding.filter(r => r.attendance_date === dateStr);
          const sRecords = latestStudy.filter(r => r.attendance_date === dateStr);

          return {
            date: dateStr,
            dateLabel: format(day, 'dd/MM'),
            boarding: {
              total: bRecords.length,
              present: bRecords.filter(r => r.status === 'present').length,
              absent: bRecords.filter(r => r.status === 'absent' || r.status === 'excused').length,
            },
            evening_study: {
              total: sRecords.length,
              present: sRecords.filter(r => r.status === 'present').length,
              absent: sRecords.filter(r => r.status === 'absent' || r.status === 'excused').length,
            },
          };
        }).filter(d => d.boarding.total > 0 || d.evening_study.total > 0);
      };

      setDailyData(buildDailyData());
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
      toast({ title: 'Lỗi', description: 'Không thể tải dữ liệu thống kê', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentSchool, classes, students, dateRange, attendanceType, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export Excel
  const handleExport = async (type: 'boarding' | 'evening_study') => {
    if (!currentSchool) return;
    setIsExporting(true);

    try {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const records = await fetchAllRecords(() =>
        supabase
          .from('attendance_records')
          .select('student_id, class_id, attendance_date, status, created_at, reporter_id, reporter:profiles!attendance_records_reporter_id_fkey(full_name), excused_reason, notes')
          .eq('school_id', currentSchool.id)
          .eq('attendance_type', type)
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .order('created_at', { ascending: false })
      );

      // Get latest per student per date
      const latestMap = new Map<string, any>();
      records.forEach((r: any) => {
        const key = `${r.student_id}-${r.attendance_date}`;
        const existing = latestMap.get(key);
        if (!existing || new Date(r.created_at).getTime() > new Date(existing.created_at).getTime()) {
          latestMap.set(key, r);
        }
      });
      const latestRecords = Array.from(latestMap.values());

      // Group by date
      const dateMap = new Map<string, any[]>();
      latestRecords.forEach(r => {
        if (!dateMap.has(r.attendance_date)) dateMap.set(r.attendance_date, []);
        dateMap.get(r.attendance_date)!.push(r);
      });

      // Build report data
      const reports: AttendanceReportData[] = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, recs]) => {
          const absentRecs = recs.filter(r => r.status === 'absent' || r.status === 'excused');
          const presentRecs = recs.filter(r => r.status === 'present');
          const latestRec = recs[0];
          const reporterName = (latestRec as any)?.reporter?.full_name || 'N/A';

          return {
            date,
            session: '',
            sessionLabel: type === 'boarding' ? 'Nội trú' : 'Tự học tối',
            reporter: reporterName,
            reportTime: latestRec?.created_at ? format(new Date(latestRec.created_at), 'HH:mm dd/MM/yyyy') : '',
            total: students.length,
            present: presentRecs.length,
            absent: absentRecs.length,
            absentStudents: absentRecs.map(r => {
              const student = students.find(s => s.id === r.student_id);
              return {
                name: student?.full_name || 'N/A',
                className: student?.class?.name || '',
                excused: r.status === 'excused',
                reason: r.excused_reason || '',
              };
            }),
          };
        });

      if (reports.length === 0) {
        toast({ title: 'Không có dữ liệu', description: 'Không có báo cáo trong khoảng thời gian này' });
        return;
      }

      const config: ExcelExportConfig = {
        schoolName: currentSchool.name,
        title: type === 'boarding' ? 'BÁO CÁO ĐIỂM DANH NỘI TRÚ' : 'BÁO CÁO ĐIỂM DANH TỰ HỌC TỐI',
        dateRange,
        reporterName: profile?.full_name,
        exportTime: new Date(),
      };

      exportAttendanceReport(reports, config, type);
      toast({ title: 'Xuất thành công', description: 'File Excel đã được tải về' });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Lỗi', description: 'Không thể xuất file Excel', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // Chart config
  const chartConfig: ChartConfig = {
    present: { label: 'Có mặt', color: 'hsl(var(--success))' },
    absent: { label: 'Vắng', color: 'hsl(var(--destructive))' },
  };

  const classChartData = classData.map(d => ({
    name: d.className,
    present: d.present,
    absent: d.absent + d.excused,
  }));

  const typeLabel = attendanceType === 'boarding' ? 'Nội trú' : 'Tự học tối';

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={attendanceType} onValueChange={(v) => setAttendanceType(v as 'boarding' | 'evening_study')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="boarding">
                <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" /> Nội trú</span>
              </SelectItem>
              <SelectItem value="evening_study">
                <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Tự học</span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={rangeType} onValueChange={(v) => setRangeType(v as DateRangeType)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Theo tuần</SelectItem>
              <SelectItem value="month">Theo tháng</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.label}
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

          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('boarding')}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Excel Nội trú
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('evening_study')}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Excel Tự học
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary */}
          {dailyData.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-muted/30">
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-muted-foreground">Số ngày có báo cáo</div>
                  <div className="text-2xl font-bold">{dailyData.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-success/10">
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-success">Tổng có mặt ({typeLabel})</div>
                  <div className="text-2xl font-bold text-success">
                    {dailyData.reduce((s, d) => s + d[attendanceType].present, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-destructive/10">
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-destructive">Tổng vắng ({typeLabel})</div>
                  <div className="text-2xl font-bold text-destructive">
                    {dailyData.reduce((s, d) => s + d[attendanceType].absent, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chart: compare by class */}
          {classChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  So sánh điểm danh {typeLabel} theo lớp
                </CardTitle>
                <CardDescription>{dateRange.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                  <BarChart data={classChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="present" name="Có mặt" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="Vắng" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Daily breakdown table */}
          {dailyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chi tiết theo ngày</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="p-2 text-left font-medium">Ngày</th>
                        <th className="p-2 text-center font-medium">Nội trú - Có mặt</th>
                        <th className="p-2 text-center font-medium">Nội trú - Vắng</th>
                        <th className="p-2 text-center font-medium">Tự học - Có mặt</th>
                        <th className="p-2 text-center font-medium">Tự học - Vắng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyData.map((d, idx) => (
                        <tr key={d.date} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                          <td className="p-2">{format(new Date(d.date), 'EEEE, dd/MM', { locale: vi })}</td>
                          <td className="p-2 text-center font-medium text-success">
                            {d.boarding.total > 0 ? d.boarding.present : '-'}
                          </td>
                          <td className="p-2 text-center font-medium text-destructive">
                            {d.boarding.total > 0 ? d.boarding.absent : '-'}
                          </td>
                          <td className="p-2 text-center font-medium text-success">
                            {d.evening_study.total > 0 ? d.evening_study.present : '-'}
                          </td>
                          <td className="p-2 text-center font-medium text-destructive">
                            {d.evening_study.total > 0 ? d.evening_study.absent : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-primary/10 font-bold">
                      <tr>
                        <td className="p-2">Tổng cộng</td>
                        <td className="p-2 text-center text-success">
                          {dailyData.reduce((s, d) => s + d.boarding.present, 0)}
                        </td>
                        <td className="p-2 text-center text-destructive">
                          {dailyData.reduce((s, d) => s + d.boarding.absent, 0)}
                        </td>
                        <td className="p-2 text-center text-success">
                          {dailyData.reduce((s, d) => s + d.evening_study.present, 0)}
                        </td>
                        <td className="p-2 text-center text-destructive">
                          {dailyData.reduce((s, d) => s + d.evening_study.absent, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {dailyData.length === 0 && !isLoading && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Không có dữ liệu điểm danh trong khoảng thời gian này
              </CardContent>
            </Card>
          )}

          {/* Class detail table */}
          {classData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thống kê {typeLabel} theo lớp</CardTitle>
                <CardDescription>{dateRange.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="p-2 text-left font-medium">Lớp</th>
                        <th className="p-2 text-center font-medium">Sĩ số</th>
                        <th className="p-2 text-center font-medium">Có mặt</th>
                        <th className="p-2 text-center font-medium">Vắng</th>
                        <th className="p-2 text-center font-medium">Có phép</th>
                        <th className="p-2 text-center font-medium">Tỷ lệ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classData.map((d, idx) => (
                        <tr key={d.classId} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                          <td className="p-2 font-medium">{d.className}</td>
                          <td className="p-2 text-center">{d.total}</td>
                          <td className="p-2 text-center text-success">{d.present}</td>
                          <td className="p-2 text-center text-destructive">{d.absent}</td>
                          <td className="p-2 text-center text-warning">{d.excused}</td>
                          <td className="p-2 text-center">
                            <Badge variant={d.rate >= 90 ? 'default' : d.rate >= 70 ? 'secondary' : 'destructive'}>
                              {d.rate}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
