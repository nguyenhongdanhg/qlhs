import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { format, eachDayOfInterval, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  FileSpreadsheet,
  Trash2,
  History,
  AlertTriangle,
  Users,
  Sunrise,
  Sun,
  Moon,
  XCircle,
  ChevronUp,
  ChevronDown,
  Edit3,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangeType, getDateRange, exportMealStatistics, MealStudentData, MealExportFilter } from '@/lib/excel-export';
import { MealDiagnosticDialog } from '@/components/attendance/MealDiagnosticDialog';
import { MealExportDialog } from '@/components/attendance/MealExportDialog';
import { Student, Class, AttendanceType, AttendanceStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface AbsentStudentInfo {
  id: string;
  name: string;
  className: string;
}

interface MealReport {
  meal: AttendanceType;
  reportedAt: string;
  reporterId: string;
  reporterName: string;
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudentInfo[];
  className?: string;
}

interface DayHistoryRecord {
  date: string;
  meals: {
    breakfast?: MealReport;
    lunch?: MealReport;
    dinner?: MealReport;
  };
}

interface MealHistoryTabProps {
  students: Student[];
  classes: Class[];
  isClassTeacher: boolean;
  teacherClassId: string | null;
  teacherClassName: string | null;
  canDelete: boolean;
  onEditReport: (date: string, meal: AttendanceType, className?: string) => void;
}

const mealTypes: { type: AttendanceType; label: string; shortLabel: string; icon: typeof Sunrise; colorClass: string; bgClass: string }[] = [
  { type: 'breakfast', label: 'Bữa sáng', shortLabel: 'S', icon: Sunrise, colorClass: 'text-amber-600', bgClass: 'bg-amber-50 border-amber-200' },
  { type: 'lunch', label: 'Bữa trưa', shortLabel: 'T', icon: Sun, colorClass: 'text-orange-600', bgClass: 'bg-orange-50 border-orange-200' },
  { type: 'dinner', label: 'Bữa tối', shortLabel: 'C', icon: Moon, colorClass: 'text-purple-600', bgClass: 'bg-purple-50 border-purple-200' },
];

export function MealHistoryTab({
  students,
  classes,
  isClassTeacher,
  teacherClassId,
  teacherClassName,
  canDelete,
  onEditReport,
}: MealHistoryTabProps) {
  const { currentSchool, user, profile, isSuperAdmin, isSchoolAdmin } = useAuth();
  const { toast } = useToast();

  const [historyDate, setHistoryDate] = useState<Date>(new Date());
  const [historyRangeType, setHistoryRangeType] = useState<DateRangeType>('week');
  const [historyClassFilter, setHistoryClassFilter] = useState<string>('all');
  const [historyReporterFilter, setHistoryReporterFilter] = useState<string>('all');
  const [reporters, setReporters] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dayRecords, setDayRecords] = useState<DayHistoryRecord[]>([]);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});

  // Bulk delete state
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Dialog states
  const [diagnosticDialogOpen, setDiagnosticDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const historyDateRange = useMemo(() => getDateRange(historyDate, historyRangeType), [historyDate, historyRangeType]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [classes]);

  // Fetch unique reporters for filter dropdown
  useEffect(() => {
    if (!currentSchool) return;
    fetchReporters();
  }, [currentSchool, historyDateRange]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchHistory();
  }, [currentSchool, historyDateRange, historyClassFilter, historyReporterFilter, classes]);

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

  const fetchReporters = async () => {
    if (!currentSchool) return;
    try {
      const startDate = format(historyDateRange.start, 'yyyy-MM-dd');
      const endDate = format(historyDateRange.end, 'yyyy-MM-dd');

      const buildReporterQuery = () => {
        let q = supabase
          .from('attendance_records')
          .select('reporter_id, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
          .eq('school_id', currentSchool.id)
          .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate);

        if (isClassTeacher && teacherClassId) {
          q = q.eq('class_id', teacherClassId);
        }
        return q;
      };

      const data = await fetchAllRecords(buildReporterQuery);

      // Get unique reporters
      const reporterMap = new Map<string, string>();
      (data || []).forEach((record: any) => {
        if (record.reporter_id && record.reporter?.full_name) {
          reporterMap.set(record.reporter_id, record.reporter.full_name);
        }
      });

      const uniqueReporters = Array.from(reporterMap.entries()).map(([id, name]) => ({ id, name }));
      uniqueReporters.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      setReporters(uniqueReporters);
    } catch (error) {
      console.error('Error fetching reporters:', error);
    }
  };

  const fetchHistory = async () => {
    if (!currentSchool) return;
    setIsLoadingHistory(true);
    try {
      const startDate = format(historyDateRange.start, 'yyyy-MM-dd');
      const endDate = format(historyDateRange.end, 'yyyy-MM-dd');

      const buildHistoryQuery = () => {
        let q = supabase
          .from('attendance_records')
          .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name), student:students(full_name, class:classes(name))')
          .eq('school_id', currentSchool.id)
          .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate)
          .order('created_at', { ascending: false });

        if (isClassTeacher && teacherClassId) {
          q = q.eq('class_id', teacherClassId);
        } else if (historyClassFilter !== 'all') {
          const selectedClassObj = classes.find(c => c.name === historyClassFilter);
          if (selectedClassObj) {
            q = q.eq('class_id', selectedClassObj.id);
          }
        }

        if (historyReporterFilter !== 'all') {
          q = q.eq('reporter_id', historyReporterFilter);
        }
        return q;
      };

      const recordsData = await fetchAllRecords(buildHistoryQuery);

      // Get latest record per student/date/meal
      const latestByStudentDateMeal = new Map<string, any>();
      (recordsData || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}-${record.attendance_type}`;
        const existing = latestByStudentDateMeal.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByStudentDateMeal.set(key, record);
        }
      });

      // Group by date, then by meal
      const dayMap = new Map<string, DayHistoryRecord>();

      latestByStudentDateMeal.forEach((record) => {
        const dateStr = record.attendance_date;
        const mealType = record.attendance_type as AttendanceType;

        if (!dayMap.has(dateStr)) {
          dayMap.set(dateStr, {
            date: dateStr,
            meals: {},
          });
        }

        const dayRecord = dayMap.get(dateStr)!;
        if (!dayRecord.meals[mealType]) {
          dayRecord.meals[mealType] = {
            meal: mealType,
            reportedAt: record.created_at,
            reporterId: record.reporter_id,
            reporterName: record.reporter?.full_name || 'N/A',
            total: 0,
            present: 0,
            absent: 0,
            absentStudents: [],
            className: isClassTeacher && teacherClassName ? teacherClassName : (historyClassFilter !== 'all' ? historyClassFilter : undefined),
          };
        }

        const mealReport = dayRecord.meals[mealType]!;
        mealReport.total++;
        if (record.status === 'present') {
          mealReport.present++;
        } else {
          mealReport.absent++;
          mealReport.absentStudents.push({
            id: record.student_id,
            name: record.student?.full_name || 'N/A',
            className: record.student?.class?.name || 'N/A',
          });
        }

        // Keep the latest report time
        if (new Date(record.created_at) > new Date(mealReport.reportedAt)) {
          mealReport.reportedAt = record.created_at;
          mealReport.reporterId = record.reporter_id;
          mealReport.reporterName = record.reporter?.full_name || 'N/A';
        }
      });

      // Sort absent students
      dayMap.forEach((day) => {
        Object.values(day.meals).forEach((meal) => {
          if (meal) {
            meal.absentStudents.sort((a, b) => {
              if (a.className !== b.className) return a.className.localeCompare(b.className, 'vi');
              return a.name.localeCompare(b.name, 'vi');
            });
          }
        });
      });

      // Sort by date descending
      const sortedDays = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
      setDayRecords(sortedDays);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteDay = async (date: string) => {
    if (!currentSchool) return;
    
    try {
      let query = supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', date)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner']);

      if (isClassTeacher && teacherClassId) {
        query = query.eq('class_id', teacherClassId);
      } else if (historyClassFilter !== 'all') {
        const selectedClassObj = classes.find(c => c.name === historyClassFilter);
        if (selectedClassObj) {
          query = query.eq('class_id', selectedClassObj.id);
        }
      }

      await query;
      fetchHistory();
    } catch (error) {
      console.error('Error deleting history:', error);
    }
  };

  const handleDeleteMeal = async (date: string, meal: AttendanceType) => {
    if (!currentSchool) return;
    
    try {
      let query = supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', date)
        .eq('attendance_type', meal);

      if (isClassTeacher && teacherClassId) {
        query = query.eq('class_id', teacherClassId);
      } else if (historyClassFilter !== 'all') {
        const selectedClassObj = classes.find(c => c.name === historyClassFilter);
        if (selectedClassObj) {
          query = query.eq('class_id', selectedClassObj.id);
        }
      }

      await query;
      fetchHistory();
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!currentSchool || selectedDays.size === 0) return;
    
    if (!window.confirm(`Xác nhận xóa ${selectedDays.size} ngày báo cáo?`)) return;
    
    setIsDeleting(true);
    try {
      for (const date of selectedDays) {
        await handleDeleteDay(date);
      }
      setSelectedDays(new Set());
      fetchHistory();
    } catch (error) {
      console.error('Error bulk deleting:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectDay = (date: string) => {
    setSelectedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDays.size === dayRecords.length) {
      setSelectedDays(new Set());
    } else {
      setSelectedDays(new Set(dayRecords.map(d => d.date)));
    }
  };

  const toggleExpandDay = (date: string) => {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const toggleExpandMeal = (key: string) => {
    setExpandedMeals(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportExcel = async (rangeType: DateRangeType, selectedDate: Date, mealFilter?: MealExportFilter) => {
    if (!currentSchool) return;
    setIsExporting(true);
    
    try {
      const exportDateRange = getDateRange(selectedDate, rangeType);
      const days = eachDayOfInterval({ start: exportDateRange.start, end: exportDateRange.end });

      // CRITICAL: Re-fetch ALL boarding students directly from DB to ensure complete list
      const { data: allStudentsData, error: studentsError } = await supabase
        .from('students')
        .select('*, class:classes(*)')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .eq('is_boarding', true)
        .order('full_name');

      if (studentsError) throw studentsError;

      const allStudents = (allStudentsData || []).map(s => ({
        ...s,
        class: s.class as unknown as Class
      })) as Student[];

      // For class teachers, only export their class students
      let studentsToExport = allStudents;
      if (isClassTeacher && teacherClassId) {
        studentsToExport = allStudents.filter(s => s.class_id === teacherClassId);
      } else if (historyClassFilter !== 'all') {
        studentsToExport = allStudents.filter(s => s.class?.name === historyClassFilter);
      }

      const studentIds = studentsToExport.map(s => s.id);
      if (studentIds.length === 0) {
        toast({ title: 'Không có dữ liệu', description: 'Không có học sinh để xuất' });
        setIsExporting(false);
        return;
      }

      const startDate = format(exportDateRange.start, 'yyyy-MM-dd');
      const endDate = format(exportDateRange.end, 'yyyy-MM-dd');

      // Fetch attendance records in parallel batches (filtered by student IDs at DB level)
      const { fetchAttendanceRecordsBatched, deduplicateRecords } = await import('@/lib/meal-export-utils');
      const recordsData = await fetchAttendanceRecordsBatched(currentSchool.id, studentIds, startDate, endDate);
      const latestByKey = deduplicateRecords(recordsData);

      // Build student data with null for unreported meals
      const mealStudents: MealStudentData[] = studentsToExport.map(student => {
        const attendanceMap = new Map<string, { breakfast: boolean | null; lunch: boolean | null; dinner: boolean | null }>();

        days.forEach(day => {
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

      // Determine export title
      let titleSuffix = '';
      if (isClassTeacher && teacherClassName) {
        titleSuffix = ` LỚP ${teacherClassName}`;
      } else if (historyClassFilter !== 'all') {
        titleSuffix = ` LỚP ${historyClassFilter}`;
      }

      // Fetch rice_per_student setting
      const { data: mealSettingsData } = await supabase
        .from('meal_settings')
        .select('rice_per_student')
        .eq('school_id', currentSchool.id)
        .maybeSingle();

      exportMealStatistics(mealStudents, {
        schoolName: currentSchool.name,
        title: `THỐNG KÊ BỮA ĂN${titleSuffix ? titleSuffix : ' HỌC SINH NỘI TRÚ'}`,
        dateRange: exportDateRange,
        reporterName: profile?.full_name || '',
        exportTime: new Date(),
        ricePerStudent: mealSettingsData?.rice_per_student ? Number(mealSettingsData.rice_per_student) : undefined,
        mealFilter: mealFilter || 'all',
      });

      toast({
        title: 'Thành công',
        description: `Đã xuất báo cáo Excel${titleSuffix || ''}`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xuất Excel',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    let totalReports = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    dayRecords.forEach(day => {
      Object.values(day.meals).forEach(meal => {
        if (meal) {
          totalReports++;
          totalPresent += meal.present;
          totalAbsent += meal.absent;
        }
      });
    });

    return { totalReports, totalPresent, totalAbsent, daysCount: dayRecords.length };
  }, [dayRecords]);

  const canManageHistory = isSuperAdmin || isSchoolAdmin() || canDelete;

  return (
    <div className="space-y-4">
      {/* Filters - Compact Layout */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Loại thống kê</label>
          <Select value={historyRangeType} onValueChange={(v) => setHistoryRangeType(v as DateRangeType)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Theo ngày</SelectItem>
              <SelectItem value="week">Theo tuần</SelectItem>
              <SelectItem value="month">Theo tháng</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Thời gian</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 justify-start text-sm">
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {historyDateRange.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar 
                mode="single" 
                selected={historyDate} 
                onSelect={(d) => d && setHistoryDate(d)} 
                className="pointer-events-auto" 
              />
            </PopoverContent>
          </Popover>
        </div>
        {!isClassTeacher && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Lọc lớp</label>
            <Select value={historyClassFilter} onValueChange={setHistoryClassFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả lớp</SelectItem>
                {sortedClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Người báo cáo</label>
          <Select value={historyReporterFilter} onValueChange={setHistoryReporterFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {reporters.map((reporter) => (
                <SelectItem key={reporter.id} value={reporter.id}>{reporter.name}</SelectItem>
                                  ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isClassTeacher && (
          <Button 
            onClick={() => setDiagnosticDialogOpen(true)} 
            variant="outline" 
            size="sm"
            className="text-amber-600 border-amber-300 hover:bg-amber-50"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Chẩn đoán
          </Button>
        )}
        <Button onClick={() => setExportDialogOpen(true)} variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}
          Xuất Excel
        </Button>
      </div>

      {/* Class Teacher Notice */}
      {isClassTeacher && teacherClassName && (
        <Alert className="border-blue-200 bg-blue-50 py-2">
          <Users className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-blue-700 text-sm">
            Lịch sử báo cáo lớp <strong>{teacherClassName}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Stats - Compact */}
      {summaryStats.totalReports > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <Card className="p-2.5 text-center bg-muted/30">
            <p className="text-lg font-bold">{summaryStats.daysCount}</p>
            <p className="text-[10px] text-muted-foreground">Ngày</p>
          </Card>
          <Card className="p-2.5 text-center bg-primary/5 border-primary/20">
            <p className="text-lg font-bold text-primary">{summaryStats.totalReports}</p>
            <p className="text-[10px] text-muted-foreground">Báo cáo</p>
          </Card>
          <Card className="p-2.5 text-center bg-success/10 border-success/20">
            <p className="text-lg font-bold text-success">{summaryStats.totalPresent}</p>
            <p className="text-[10px] text-muted-foreground">Có mặt</p>
          </Card>
          <Card className="p-2.5 text-center bg-destructive/10 border-destructive/20">
            <p className="text-lg font-bold text-destructive">{summaryStats.totalAbsent}</p>
            <p className="text-[10px] text-muted-foreground">Vắng</p>
          </Card>
        </div>
      )}

      {/* Bulk Delete Actions */}
      {dayRecords.length > 0 && canManageHistory && (
        <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedDays.size === dayRecords.length && dayRecords.length > 0}
              onCheckedChange={toggleSelectAll}
              aria-label="Chọn tất cả"
            />
            <span className="text-xs text-muted-foreground">
              {selectedDays.size > 0 
                ? `Đã chọn ${selectedDays.size}/${dayRecords.length} ngày` 
                : 'Chọn tất cả'}
            </span>
          </div>
          {selectedDays.size > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="h-7 text-xs"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Xóa {selectedDays.size} ngày
            </Button>
          )}
        </div>
      )}

      {/* Day Records */}
      {isLoadingHistory ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : dayRecords.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Không có báo cáo trong khoảng thời gian này
        </div>
      ) : (
        <div className="space-y-2">
          {dayRecords.map((day) => {
            const isExpanded = expandedDays[day.date];
            const isSelected = selectedDays.has(day.date);
            const meals = day.meals;
            const totalMeals = Object.values(meals).filter(Boolean).length;

            return (
              <Card 
                key={day.date} 
                className={cn(
                  "overflow-hidden transition-all",
                  isSelected && "ring-2 ring-primary"
                )}
              >
                <CardContent className="p-0">
                  {/* Day Header - Always visible */}
                  <div 
                    className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30"
                    onClick={() => toggleExpandDay(day.date)}
                  >
                    {canManageHistory && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectDay(day.date)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {format(new Date(day.date), 'EEEE, dd/MM', { locale: vi })}
                        </span>
                        {isToday(new Date(day.date)) && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">Hôm nay</Badge>
                        )}
                        {meals.breakfast?.className && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{meals.breakfast.className}</Badge>
                        )}
                      </div>
                      {/* Compact meal badges - show in header */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {mealTypes.map(({ type, shortLabel, bgClass, colorClass }) => {
                          const meal = meals[type];
                          if (!meal) return (
                            <span key={type} className="text-[10px] text-muted-foreground/50 w-12">—</span>
                          );
                          return (
                            <Badge 
                              key={type} 
                              variant="outline" 
                              className={cn("text-[10px] px-1.5 py-0 font-normal", bgClass, colorClass)}
                            >
                              {shortLabel}: {meal.present}/{meal.total}
                              {meal.absent > 0 && <span className="text-destructive ml-0.5">(-{meal.absent})</span>}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-muted-foreground">{totalMeals} bữa</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content - Meal Details */}
                  {isExpanded && (
                    <div className="border-t px-3 py-2 space-y-2 bg-muted/10">
                      {mealTypes.map(({ type, label, icon: Icon, colorClass, bgClass }) => {
                        const meal = meals[type];
                        if (!meal) return null;

                        const mealKey = `${day.date}-${type}`;
                        const isMealExpanded = expandedMeals[mealKey];
                        const canEdit = isSuperAdmin || isSchoolAdmin() || meal.reporterId === user?.id;

                        return (
                          <div key={type} className={cn("rounded-lg border p-2.5", bgClass)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className={cn("h-4 w-4", colorClass)} />
                                <span className={cn("text-sm font-medium", colorClass)}>{label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right text-xs">
                                  <span className="text-success font-medium">{meal.present}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span>{meal.total}</span>
                                  {meal.absent > 0 && (
                                    <span className="text-destructive ml-1">(-{meal.absent})</span>
                                  )}
                                </div>
                                {meal.absent > 0 && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => toggleExpandMeal(mealKey)}
                                    className="h-6 w-6 p-0"
                                  >
                                    {isMealExpanded ? (
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                                {canEdit && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onEditReport(day.date, type, meal.className)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {canManageHistory && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      if (window.confirm(`Xóa báo cáo ${label} ngày ${format(new Date(day.date), 'dd/MM')}?`)) {
                                        handleDeleteMeal(day.date, type);
                                      }
                                    }}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {meal.reporterName} • {format(new Date(meal.reportedAt), 'HH:mm')}
                            </div>

                            {/* Absent Students List */}
                            {isMealExpanded && meal.absentStudents.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-dashed">
                                <p className="text-[10px] text-muted-foreground mb-1.5">Vắng ({meal.absentStudents.length}):</p>
                                <div className="flex flex-wrap gap-1">
                                  {meal.absentStudents.map((student, idx) => (
                                    <Badge 
                                      key={idx} 
                                      variant="outline" 
                                      className="text-[10px] px-1.5 py-0 bg-destructive/5 border-destructive/20 text-destructive"
                                    >
                                      {student.name}
                                      {!isClassTeacher && <span className="text-muted-foreground ml-0.5">({student.className})</span>}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {currentSchool && (
        <MealDiagnosticDialog
          open={diagnosticDialogOpen}
          onOpenChange={setDiagnosticDialogOpen}
          schoolId={currentSchool.id}
          students={students}
          classes={classes}
          startDate={historyDateRange.start}
          endDate={historyDateRange.end}
        />
      )}

      <MealExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExportExcel}
        isExporting={isExporting}
      />
    </div>
  );
}
