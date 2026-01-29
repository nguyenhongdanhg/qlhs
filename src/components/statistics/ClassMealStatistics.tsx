import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  BarChart3,
  UtensilsCrossed,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Student, Class, AttendanceType } from '@/types';
import { DateRangeType, getDateRange, exportMealStatistics, MealStudentData } from '@/lib/excel-export';

interface MealStatWithReReport {
  present: number;
  absent: number;
  total: number;
  hasReport: boolean;
  isReReport: boolean;
}

interface DailyMealRecord {
  date: string;
  breakfast: MealStatWithReReport;
  lunch: MealStatWithReReport;
  dinner: MealStatWithReReport;
}

interface ClassMealStatisticsProps {
  students: Student[];
  classes: Class[];
  teacherClassId: string;
  teacherClassName: string;
}

export const ClassMealStatistics = memo(function ClassMealStatistics({
  students,
  classes,
  teacherClassId,
  teacherClassName,
}: ClassMealStatisticsProps) {
  const { currentSchool, profile } = useAuth();

  const [rangeType, setRangeType] = useState<DateRangeType>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<DailyMealRecord[]>([]);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Filter students to only this class
  const classStudents = useMemo(() => {
    return students.filter((s) => s.class_id === teacherClassId);
  }, [students, teacherClassId]);

  const dateRange = useMemo(
    () => getDateRange(selectedDate, rangeType),
    [selectedDate, rangeType]
  );

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    let totalReports = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    dailyRecords.forEach((record) => {
      if (record.breakfast.hasReport) {
        totalReports++;
        totalPresent += record.breakfast.present;
        totalAbsent += record.breakfast.absent;
      }
      if (record.lunch.hasReport) {
        totalReports++;
        totalPresent += record.lunch.present;
        totalAbsent += record.lunch.absent;
      }
      if (record.dinner.hasReport) {
        totalReports++;
        totalPresent += record.dinner.present;
        totalAbsent += record.dinner.absent;
      }
    });

    return { totalReports, totalPresent, totalAbsent };
  }, [dailyRecords]);

  useEffect(() => {
    if (!currentSchool || classStudents.length === 0) return;
    fetchMealData();
  }, [currentSchool, dateRange, classStudents.length]);

  const fetchMealData = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

      // CRITICAL: Query based on student IDs from classStudents list
      // This ensures data integrity even if class_id in attendance_records is inconsistent
      const studentIds = classStudents.map(s => s.id);
      
      if (studentIds.length === 0) {
        setDailyRecords([]);
        setIsLoading(false);
        return;
      }

      // Fetch attendance records for students in this class
      const { data: records } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .in('student_id', studentIds)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('attendance_date', format(dateRange.end, 'yyyy-MM-dd'));

      // Get latest record per student/date/meal - this ensures no duplicates
      const latestByKey = new Map<string, any>();
      (records || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}-${record.attendance_type}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByKey.set(key, record);
        }
      });

      // Track report counts per date/meal to detect re-reports
      const reportCountByDateMeal = new Map<string, Set<string>>();
      (records || []).forEach((record: any) => {
        const key = `${record.attendance_date}-${record.attendance_type}`;
        const reportTime = (record.created_at || '').substring(0, 16); // Round to minute
        if (!reportCountByDateMeal.has(key)) {
          reportCountByDateMeal.set(key, new Set());
        }
        reportCountByDateMeal.get(key)!.add(reportTime);
      });

      // Build daily records
      const dailyData: DailyMealRecord[] = days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');

        const getMealStats = (mealType: AttendanceType): MealStatWithReReport => {
          const mealRecords = classStudents
            .map((s) => latestByKey.get(`${s.id}-${dateStr}-${mealType}`))
            .filter(Boolean);

          const reportKey = `${dateStr}-${mealType}`;
          const reportCount = reportCountByDateMeal.get(reportKey)?.size || 0;
          const isReReport = reportCount > 1;

          if (mealRecords.length === 0) {
            return { present: 0, absent: 0, total: classStudents.length, hasReport: false, isReReport: false };
          }

          const present = mealRecords.filter((r) => r.status === 'present').length;
          const absent = mealRecords.filter((r) => r.status !== 'present').length;

          // Always show total as class size, not just reported records
          return {
            present,
            absent,
            total: classStudents.length,
            hasReport: true,
            isReReport,
          };
        };

        return {
          date: dateStr,
          breakfast: getMealStats('breakfast'),
          lunch: getMealStats('lunch'),
          dinner: getMealStats('dinner'),
        };
      });

      setDailyRecords(dailyData);
    } catch (error) {
      console.error('Error fetching meal data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!currentSchool || classStudents.length === 0) return;
    setIsExporting(true);

    try {
      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

      const { data: records } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('class_id', teacherClassId)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('attendance_date', format(dateRange.end, 'yyyy-MM-dd'));

      // Get latest record per student/date/meal
      const latestByKey = new Map<string, any>();
      (records || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}-${record.attendance_type}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByKey.set(key, record);
        }
      });

      // Build student data
      const studentData: MealStudentData[] = classStudents.map((student) => {
        const attendanceMap = new Map<
          string,
          { breakfast: boolean | null; lunch: boolean | null; dinner: boolean | null }
        >();

        days.forEach((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const bRecord = latestByKey.get(`${student.id}-${dateStr}-breakfast`);
          const lRecord = latestByKey.get(`${student.id}-${dateStr}-lunch`);
          const dRecord = latestByKey.get(`${student.id}-${dateStr}-dinner`);

          attendanceMap.set(dateStr, {
            breakfast: bRecord ? bRecord.status === 'present' : null,
            lunch: lRecord ? lRecord.status === 'present' : null,
            dinner: dRecord ? dRecord.status === 'present' : null,
          });
        });

        return {
          id: student.id,
          name: student.full_name,
          className: student.class?.name || '',
          classGrade: student.class?.grade,
          roomNumber: student.room_number || undefined,
          mealGroup: student.meal_group || undefined,
          attendance: attendanceMap,
        };
      });

      exportMealStatistics(studentData, {
        schoolName: currentSchool.name,
        title: `THỐNG KÊ BỮA ĂN LỚP ${teacherClassName}`,
        dateRange: dateRange,
        reporterName: profile?.full_name,
        exportTime: new Date(),
      });
    } catch (error) {
      console.error('Error exporting meal stats:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleDay = (dateStr: string) => {
    setExpandedDays((prev) => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  // Filter days that have at least one report
  const daysWithReports = useMemo(() => {
    return dailyRecords.filter(
      (r) => r.breakfast.hasReport || r.lunch.hasReport || r.dinner.hasReport
    );
  }, [dailyRecords]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-info" />
          Thống kê bữa ăn lớp {teacherClassName}
        </h1>
        <p className="page-description">
          Xem báo cáo bữa ăn theo ngày, tuần, tháng
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Loại thống kê</span>
            <Select
              value={rangeType}
              onValueChange={(v) => setRangeType(v as DateRangeType)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Theo ngày</SelectItem>
                <SelectItem value="week">Theo tuần</SelectItem>
                <SelectItem value="month">Theo tháng</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Chọn tháng</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {rangeType === 'month'
                    ? format(selectedDate, 'MM/yyyy', { locale: vi })
                    : format(selectedDate, 'dd/MM/yyyy')}
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

          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={isExporting || classStudents.length === 0}
            className="ml-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Xuất Excel
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">
              {summaryStats.totalReports}
            </div>
            <div className="text-sm text-muted-foreground">Số báo cáo</div>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-success">
              {summaryStats.totalPresent}
            </div>
            <div className="text-sm text-muted-foreground">Tổng có mặt</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-destructive">
              {summaryStats.totalAbsent}
            </div>
            <div className="text-sm text-muted-foreground">Tổng vắng</div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : daysWithReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Không có báo cáo trong khoảng thời gian này
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              Chi tiết theo ngày ({daysWithReports.length} ngày có báo cáo)
            </div>
            {daysWithReports.map((record) => {
              const isExpanded = expandedDays[record.date];
              const dayLabel = format(new Date(record.date), 'EEEE, dd/MM/yyyy', {
                locale: vi,
              });

              return (
                <div
                  key={record.date}
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    onClick={() => toggleDay(record.date)}
                  >
                    <span className="font-medium text-sm capitalize">{dayLabel}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2 text-xs">
                        {record.breakfast.hasReport && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            S: {record.breakfast.present}/{record.breakfast.total}
                            {record.breakfast.isReReport && <span className="ml-1 text-warning">⟳</span>}
                          </Badge>
                        )}
                        {record.lunch.hasReport && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            T: {record.lunch.present}/{record.lunch.total}
                            {record.lunch.isReReport && <span className="ml-1 text-warning">⟳</span>}
                          </Badge>
                        )}
                        {record.dinner.hasReport && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            C: {record.dinner.present}/{record.dinner.total}
                            {record.dinner.isReReport && <span className="ml-1 text-warning">⟳</span>}
                          </Badge>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        {/* Breakfast */}
                        <div className="rounded-lg bg-amber-50 p-2">
                          <div className="font-medium text-amber-700 mb-1 flex items-center justify-center gap-1">
                            Sáng
                            {record.breakfast.isReReport && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-warning text-warning">
                                Lại
                              </Badge>
                            )}
                          </div>
                          {record.breakfast.hasReport ? (
                            <div className="space-y-1">
                              <div className="text-success font-medium">
                                Ăn: {record.breakfast.present}
                              </div>
                              <div className="text-destructive font-medium">
                                Vắng: {record.breakfast.absent}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs">
                              Chưa báo cáo
                            </div>
                          )}
                        </div>

                        {/* Lunch */}
                        <div className="rounded-lg bg-orange-50 p-2">
                          <div className="font-medium text-orange-700 mb-1 flex items-center justify-center gap-1">
                            Trưa
                            {record.lunch.isReReport && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-warning text-warning">
                                Lại
                              </Badge>
                            )}
                          </div>
                          {record.lunch.hasReport ? (
                            <div className="space-y-1">
                              <div className="text-success font-medium">
                                Ăn: {record.lunch.present}
                              </div>
                              <div className="text-destructive font-medium">
                                Vắng: {record.lunch.absent}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs">
                              Chưa báo cáo
                            </div>
                          )}
                        </div>

                        {/* Dinner */}
                        <div className="rounded-lg bg-purple-50 p-2">
                          <div className="font-medium text-purple-700 mb-1 flex items-center justify-center gap-1">
                            Tối
                            {record.dinner.isReReport && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-warning text-warning">
                                Lại
                              </Badge>
                            )}
                          </div>
                          {record.dinner.hasReport ? (
                            <div className="space-y-1">
                              <div className="text-success font-medium">
                                Ăn: {record.dinner.present}
                              </div>
                              <div className="text-destructive font-medium">
                                Vắng: {record.dinner.absent}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs">
                              Chưa báo cáo
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
});
