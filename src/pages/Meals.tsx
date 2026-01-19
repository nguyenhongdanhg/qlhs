import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Student, Class, AttendanceStatus, AttendanceType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, subDays, isBefore, setHours, setMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  Save,
  Sunrise,
  Sun,
  Moon,
  Users,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  History,
  Ban,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DateRangeType, 
  getDateRange, 
  exportMealStatistics, 
  MealStudentData 
} from '@/lib/excel-export';

type AttendanceMap = Record<string, AttendanceStatus>;

interface MealDeadline {
  type: AttendanceType;
  deadlineHour: number;
  deadlineMinute: number;
  dayOffset: number;
  label: string;
  description: string;
}

interface MealSettingsData {
  breakfast_deadline_time: string;
  breakfast_deadline_offset: number;
  lunch_deadline_time: string;
  lunch_deadline_offset: number;
  dinner_deadline_time: string;
  dinner_deadline_offset: number;
  rice_per_student: number;
}

const DEFAULT_MEAL_DEADLINES: MealDeadline[] = [
  { type: 'breakfast', deadlineHour: 20, deadlineMinute: 0, dayOffset: -1, label: 'Bữa sáng', description: 'Báo trước 20:00 hôm trước' },
  { type: 'lunch', deadlineHour: 7, deadlineMinute: 30, dayOffset: 0, label: 'Bữa trưa', description: 'Báo trước 7:30 cùng ngày' },
  { type: 'dinner', deadlineHour: 14, deadlineMinute: 0, dayOffset: 0, label: 'Bữa tối', description: 'Báo trước 14:00 cùng ngày' },
];

const mealTypes: { type: AttendanceType; label: string; icon: typeof Sunrise }[] = [
  { type: 'breakfast', label: 'Bữa sáng', icon: Sunrise },
  { type: 'lunch', label: 'Bữa trưa', icon: Sun },
  { type: 'dinner', label: 'Bữa tối', icon: Moon },
];

interface HistoryRecord {
  date: string;
  meal: AttendanceType;
  reportedAt: string;
  reporterId: string;
  reporterName: string;
  total: number;
  present: number;
  absent: number;
}

export default function Meals() {
  const { currentSchool, user, profile, currentMembership } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  const [date, setDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedMeal, setSelectedMeal] = useState<AttendanceType>('breakfast');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyDate, setHistoryDate] = useState<Date>(new Date());
  const [historyRangeType, setHistoryRangeType] = useState<DateRangeType>('month');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [mealDeadlines, setMealDeadlines] = useState<MealDeadline[]>(DEFAULT_MEAL_DEADLINES);

  const historyDateRange = useMemo(() => getDateRange(historyDate, historyRangeType), [historyDate, historyRangeType]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [classes]);

  // Fetch meal settings from database
  useEffect(() => {
    if (!currentSchool) return;
    fetchMealSettings();
  }, [currentSchool]);

  const fetchMealSettings = async () => {
    if (!currentSchool) return;

    try {
      const { data } = await supabase
        .from('meal_settings')
        .select('*')
        .eq('school_id', currentSchool.id)
        .maybeSingle();

      if (data) {
        // Parse settings into MealDeadline format
        const parseTime = (timeStr: string) => {
          const parts = timeStr.split(':');
          return { hour: parseInt(parts[0]), minute: parseInt(parts[1]) };
        };

        const breakfastTime = parseTime(data.breakfast_deadline_time);
        const lunchTime = parseTime(data.lunch_deadline_time);
        const dinnerTime = parseTime(data.dinner_deadline_time);

        const formatDescription = (hour: number, minute: number, offset: number) => {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const dayStr = offset === -1 ? 'hôm trước' : 'cùng ngày';
          return `Báo trước ${timeStr} ${dayStr}`;
        };

        setMealDeadlines([
          {
            type: 'breakfast',
            deadlineHour: breakfastTime.hour,
            deadlineMinute: breakfastTime.minute,
            dayOffset: data.breakfast_deadline_offset,
            label: 'Bữa sáng',
            description: formatDescription(breakfastTime.hour, breakfastTime.minute, data.breakfast_deadline_offset),
          },
          {
            type: 'lunch',
            deadlineHour: lunchTime.hour,
            deadlineMinute: lunchTime.minute,
            dayOffset: data.lunch_deadline_offset,
            label: 'Bữa trưa',
            description: formatDescription(lunchTime.hour, lunchTime.minute, data.lunch_deadline_offset),
          },
          {
            type: 'dinner',
            deadlineHour: dinnerTime.hour,
            deadlineMinute: dinnerTime.minute,
            dayOffset: data.dinner_deadline_offset,
            label: 'Bữa tối',
            description: formatDescription(dinnerTime.hour, dinnerTime.minute, data.dinner_deadline_offset),
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching meal settings:', error);
    }
  };

  const getMealDeadlineInfo = useCallback((mealType: AttendanceType, targetDate: Date) => {
    const deadline = mealDeadlines.find(d => d.type === mealType);
    if (!deadline) return { canReport: false, remainingTime: '', isExpired: true };

    const now = new Date();
    let deadlineDate = new Date(targetDate);
    
    if (deadline.dayOffset === -1) {
      deadlineDate = subDays(deadlineDate, 1);
    }
    
    deadlineDate = setHours(deadlineDate, deadline.deadlineHour);
    deadlineDate = setMinutes(deadlineDate, deadline.deadlineMinute);

    const canReport = isBefore(now, deadlineDate);
    const diff = deadlineDate.getTime() - now.getTime();
    
    let remainingTime = '';
    if (canReport) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) {
        remainingTime = `Còn ${hours}h ${minutes}p`;
      } else {
        remainingTime = `Còn ${minutes} phút`;
      }
    }

    return {
      canReport,
      remainingTime,
      isExpired: !canReport,
      deadlineText: deadline.description,
    };
  }, [mealDeadlines]);

  const currentMealDeadline = useMemo(() => {
    return getMealDeadlineInfo(selectedMeal, date);
  }, [selectedMeal, date, getMealDeadlineInfo]);

  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    return mealDeadlines.map(deadline => {
      let targetDate = deadline.type === 'breakfast' ? tomorrow : today;
      const info = getMealDeadlineInfo(deadline.type, targetDate);
      return {
        ...deadline,
        ...info,
        targetDate,
      };
    }).filter(d => d.canReport);
  }, [getMealDeadlineInfo, mealDeadlines]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchClasses();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchStudentsAndAttendance();
  }, [currentSchool, date, selectedMeal]);

  useEffect(() => {
    if (!currentSchool || activeTab !== 'history') return;
    fetchHistory();
  }, [currentSchool, activeTab, historyDateRange]);

  const fetchClasses = async () => {
    if (!currentSchool) return;
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', currentSchool.id)
      .eq('is_active', true)
      .order('grade', { ascending: true })
      .order('name', { ascending: true });
    setClasses((data || []) as Class[]);
  };

  const fetchStudentsAndAttendance = async () => {
    if (!currentSchool) return;
    setIsLoading(true);
    try {
      const { data: studentsData } = await supabase
        .from('students')
        .select('*, class:classes(*)')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .eq('is_boarding', true)
        .order('full_name');

      const typedStudents = (studentsData || []).map(s => ({
        ...s,
        class: s.class as unknown as Class
      })) as Student[];
      setStudents(typedStudents);

      const dateStr = format(date, 'yyyy-MM-dd');
      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', selectedMeal);

      const attendanceMap: AttendanceMap = {};
      (recordsData || []).forEach((record: any) => {
        attendanceMap[record.student_id] = record.status;
      });
      
      typedStudents.forEach((student) => {
        if (!attendanceMap[student.id]) {
          attendanceMap[student.id] = 'present';
        }
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!currentSchool) return;
    setIsLoadingHistory(true);
    try {
      const startDate = format(historyDateRange.start, 'yyyy-MM-dd');
      const endDate = format(historyDateRange.end, 'yyyy-MM-dd');

      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('created_at', { ascending: false });

      // Group by date and meal, take latest report for each
      const grouped = new Map<string, HistoryRecord>();
      (recordsData || []).forEach((record: any) => {
        const key = `${record.attendance_date}-${record.attendance_type}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            date: record.attendance_date,
            meal: record.attendance_type,
            reportedAt: record.created_at,
            reporterId: record.reporter_id,
            reporterName: record.reporter?.full_name || 'N/A',
            total: 0,
            present: 0,
            absent: 0,
          });
        }
        const entry = grouped.get(key)!;
        entry.total++;
        if (record.status === 'present') entry.present++;
        else entry.absent++;
      });

      setHistoryRecords(Array.from(grouped.values()).sort((a, b) => 
        b.date.localeCompare(a.date) || mealTypes.findIndex(m => m.type === b.meal) - mealTypes.findIndex(m => m.type === a.meal)
      ));
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleToggleAbsent = (studentId: string) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'absent' ? 'present' : 'absent',
    }));
  };

  const handleMarkAllPresent = () => {
    const newAttendance: AttendanceMap = {};
    filteredStudents.forEach(s => newAttendance[s.id] = 'present');
    setAttendance(prev => ({ ...prev, ...newAttendance }));
  };

  const handleMarkAllAbsent = () => {
    const newAttendance: AttendanceMap = {};
    filteredStudents.forEach(s => newAttendance[s.id] = 'absent');
    setAttendance(prev => ({ ...prev, ...newAttendance }));
  };

  const handleMarkAll3Meals = async (markPresent: boolean) => {
    if (!currentSchool || !user) return;
    setIsSaving(true);
    
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const mealTypesToSave: AttendanceType[] = ['breakfast', 'lunch', 'dinner'];
      
      const expiredMeals = mealTypesToSave.filter(meal => {
        const info = getMealDeadlineInfo(meal, date);
        return info.isExpired;
      });

      if (expiredMeals.length === 3) {
        toast({ 
          title: 'Không thể báo cáo', 
          description: 'Tất cả các bữa đã quá hạn báo cáo', 
          variant: 'destructive' 
        });
        setIsSaving(false);
        return;
      }

      const validMeals = mealTypesToSave.filter(meal => !expiredMeals.includes(meal));

      for (const meal of validMeals) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr)
          .eq('attendance_type', meal);

        const records = students.map((student) => ({
          school_id: currentSchool.id,
          student_id: student.id,
          class_id: student.class_id,
          attendance_date: dateStr,
          attendance_type: meal,
          status: (markPresent ? 'present' : 'absent') as AttendanceStatus,
          reporter_id: user.id,
        }));

        await supabase.from('attendance_records').insert(records);
      }

      const savedMeals = validMeals.map(m => mealTypes.find(t => t.type === m)?.label).join(', ');
      toast({ 
        title: 'Thành công', 
        description: `Đã lưu ${markPresent ? 'đủ' : 'vắng'} ${savedMeals}` 
      });
      
      if (expiredMeals.length > 0) {
        const skippedMeals = expiredMeals.map(m => mealTypes.find(t => t.type === m)?.label).join(', ');
        toast({ 
          title: 'Lưu ý', 
          description: `Đã bỏ qua ${skippedMeals} do quá hạn`, 
          variant: 'destructive' 
        });
      }
      
      fetchStudentsAndAttendance();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!currentSchool || !user) return;
    
    if (currentMealDeadline.isExpired) {
      toast({ 
        title: 'Quá hạn báo cáo', 
        description: `${mealTypes.find(m => m.type === selectedMeal)?.label} đã quá hạn`, 
        variant: 'destructive' 
      });
      return;
    }

    setIsSaving(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      await supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', selectedMeal);

      const records = students.map((student) => ({
        school_id: currentSchool.id,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: selectedMeal,
        status: attendance[student.id] || 'present',
        reporter_id: user.id,
      }));

      const { error } = await supabase.from('attendance_records').insert(records);
      if (error) throw error;

      toast({ title: 'Thành công', description: `Đã lưu điểm danh bữa ăn` });
      fetchStudentsAndAttendance();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (historyDate: string, meal: AttendanceType) => {
    if (!currentSchool) return;
    try {
      await supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', historyDate)
        .eq('attendance_type', meal);
      
      toast({ title: 'Đã xóa', description: 'Đã xóa báo cáo' });
      fetchHistory();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleExportExcel = async () => {
    if (!currentSchool) return;
    setIsExporting(true);
    
    try {
      const days = eachDayOfInterval({ start: historyDateRange.start, end: historyDateRange.end });
      
      // Fetch all attendance records for the date range
      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', format(historyDateRange.start, 'yyyy-MM-dd'))
        .lte('attendance_date', format(historyDateRange.end, 'yyyy-MM-dd'));

      // Create attendance map: studentId -> date -> meal -> status (based on latest report per meal/date)
      const latestByKey = new Map<string, any>();
      (recordsData || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}-${record.attendance_type}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByKey.set(key, record);
        }
      });

      // Determine which dates have any reports
      const reportedDates = new Set<string>();
      latestByKey.forEach((record) => {
        reportedDates.add(record.attendance_date);
      });

      // Build student data with null for unreported meals
      const studentData: MealStudentData[] = students.map(student => {
        const attendanceMap = new Map<string, { breakfast: boolean | null; lunch: boolean | null; dinner: boolean | null }>();
        
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const bKey = `${student.id}-${dateStr}-breakfast`;
          const lKey = `${student.id}-${dateStr}-lunch`;
          const dKey = `${student.id}-${dateStr}-dinner`;
          
          const bRecord = latestByKey.get(bKey);
          const lRecord = latestByKey.get(lKey);
          const dRecord = latestByKey.get(dKey);
          
          // Use null if no report exists for this meal on this date
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
        title: 'THỐNG KÊ BỮA ĂN HỌC SINH NỘI TRÚ',
        dateRange: historyDateRange,
        reporterName: profile?.full_name,
        exportTime: new Date(),
      });

      toast({ title: 'Thành công', description: 'Đã xuất file Excel' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'all') return students;
    return students.filter(s => s.class?.name === selectedClass);
  }, [students, selectedClass]);

  const presentCount = useMemo(() => {
    return filteredStudents.filter(s => attendance[s.id] === 'present').length;
  }, [filteredStudents, attendance]);

  if (!currentSchool) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Vui lòng chọn trường</p></div>;
  }

  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <UtensilsCrossed className="h-7 w-7 text-purple-500" />
          Báo cáo bữa ăn
        </h1>
        <p className="page-description">Đăng ký và quản lý bữa ăn cho học sinh nội trú</p>
      </div>

      {/* User Role Badge with Deadline Reminders */}
      <Card className="mb-4">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <span className="font-medium">{profile?.full_name || 'Quản trị viên'}</span>
              <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-600">
                {currentMembership?.role === 'admin' ? 'Quản trị viên' : currentMembership?.role || 'Người dùng'}
              </Badge>
            </div>
          </div>
          
          {upcomingDeadlines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {upcomingDeadlines.map((deadline) => (
                <Badge 
                  key={deadline.type} 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    deadline.remainingTime.includes('phút') && parseInt(deadline.remainingTime.match(/\d+/)?.[0] || '60') < 30 
                      ? "border-red-300 text-red-600 bg-red-50" 
                      : "border-blue-300 text-blue-600 bg-blue-50"
                  )}
                >
                  {deadline.label}: {deadline.remainingTime}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full grid grid-cols-2 bg-transparent border-b rounded-none h-12">
            <TabsTrigger value="register" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <UtensilsCrossed className="h-4 w-4 mr-2" />Đăng ký bữa ăn
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <History className="h-4 w-4 mr-2" />Lịch sử & Thống kê
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="p-4 space-y-4">
            {/* Date and Class Selection */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Ngày</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, 'EEEE, dd/MM/yyyy', { locale: vi })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Lớp</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger><SelectValue placeholder="Tất cả lớp" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lớp</SelectItem>
                    {sortedClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Meal Tabs with Deadline Status */}
            <div className="flex gap-2 flex-wrap">
              {mealTypes.map(({ type, label, icon: Icon }) => {
                const deadlineInfo = getMealDeadlineInfo(type, date);
                return (
                  <Button 
                    key={type} 
                    variant={selectedMeal === type ? 'default' : 'outline'} 
                    onClick={() => setSelectedMeal(type)} 
                    className={cn(
                      "flex-1 min-w-[100px] relative",
                      deadlineInfo.isExpired && "opacity-50"
                    )}
                    disabled={deadlineInfo.isExpired}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                    {deadlineInfo.isExpired && (
                      <Ban className="h-3 w-3 absolute top-1 right-1 text-red-500" />
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Deadline Warning */}
            {currentMealDeadline.isExpired ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {mealTypes.find(m => m.type === selectedMeal)?.label} đã quá hạn báo cáo. {currentMealDeadline.deadlineText}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-blue-200 bg-blue-50">
                <Clock className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-700">
                  {currentMealDeadline.remainingTime} để báo {mealTypes.find(m => m.type === selectedMeal)?.label.toLowerCase()}. {currentMealDeadline.deadlineText}
                </AlertDescription>
              </Alert>
            )}

            {/* Quick Actions */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleMarkAllPresent} disabled={currentMealDeadline.isExpired}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />Đủ tất cả
                </Button>
                <Button variant="outline" size="sm" onClick={handleMarkAllAbsent} disabled={currentMealDeadline.isExpired}>
                  <XCircle className="h-4 w-4 mr-1" />Vắng tất cả
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={() => handleMarkAll3Meals(true)} 
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />Đủ 3 bữa
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => handleMarkAll3Meals(false)} 
                  disabled={isSaving}
                >
                  <XCircle className="h-4 w-4 mr-1" />Vắng 3 bữa
                </Button>
              </div>
              <span className="text-sm text-green-600 font-medium">{presentCount}/{filteredStudents.length} ăn</span>
            </div>

            {/* Students Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredStudents.map((student) => (
                  <button 
                    key={student.id} 
                    onClick={() => !currentMealDeadline.isExpired && handleToggleAbsent(student.id)}
                    disabled={currentMealDeadline.isExpired}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                      attendance[student.id] === 'absent' 
                        ? 'border-red-300 bg-red-50 text-red-700' 
                        : 'border-border hover:border-primary/50',
                      currentMealDeadline.isExpired && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex-shrink-0',
                      attendance[student.id] === 'absent' ? 'border-red-500 bg-red-500' : 'border-muted-foreground'
                    )} />
                    <div className="flex-1 min-w-0">
                      <span className="truncate text-sm block">{student.full_name}</span>
                      <span className="text-xs text-muted-foreground">{student.class?.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <Button 
              onClick={handleSave} 
              disabled={isSaving || currentMealDeadline.isExpired} 
              className="w-full"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Lưu {mealTypes.find(m => m.type === selectedMeal)?.label}
            </Button>
          </TabsContent>

          <TabsContent value="history" className="p-4 space-y-4">
            {/* Date Range Selection and Export */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Loại thống kê</label>
                  <Select value={historyRangeType} onValueChange={(v) => setHistoryRangeType(v as DateRangeType)}>
                    <SelectTrigger className="w-[130px]">
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
                  <label className="text-sm text-muted-foreground mb-1.5 block">Chọn {historyRangeType === 'day' ? 'ngày' : historyRangeType === 'week' ? 'tuần' : 'tháng'}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">
                        <CalendarIcon className="mr-2 h-4 w-4" />
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
              </div>
              <Button onClick={handleExportExcel} variant="outline" disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Xuất Excel
              </Button>
            </div>

            {/* Statistics Summary */}
            {historyRecords.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center bg-blue-50">
                  <p className="text-2xl font-bold text-blue-600">{historyRecords.length}</p>
                  <p className="text-xs text-muted-foreground">Số báo cáo</p>
                </Card>
                <Card className="p-4 text-center bg-green-50">
                  <p className="text-2xl font-bold text-green-600">{historyRecords.reduce((s, r) => s + r.present, 0)}</p>
                  <p className="text-xs text-muted-foreground">Tổng có mặt</p>
                </Card>
                <Card className="p-4 text-center bg-red-50">
                  <p className="text-2xl font-bold text-red-600">{historyRecords.reduce((s, r) => s + r.absent, 0)}</p>
                  <p className="text-xs text-muted-foreground">Tổng vắng</p>
                </Card>
              </div>
            )}

            {/* History Records */}
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Không có báo cáo trong khoảng thời gian này
              </div>
            ) : (
              <div className="space-y-3">
                {historyRecords.map((record, idx) => {
                  const mealInfo = mealTypes.find(m => m.type === record.meal);
                  const MealIcon = mealInfo?.icon || Sun;
                  return (
                    <Card key={idx} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              record.meal === 'breakfast' && "bg-yellow-100",
                              record.meal === 'lunch' && "bg-orange-100",
                              record.meal === 'dinner' && "bg-purple-100"
                            )}>
                              <MealIcon className={cn(
                                "h-5 w-5",
                                record.meal === 'breakfast' && "text-yellow-600",
                                record.meal === 'lunch' && "text-orange-600",
                                record.meal === 'dinner' && "text-purple-600"
                              )} />
                            </div>
                            <div>
                              <div className="font-medium">
                                {format(new Date(record.date), 'EEEE, dd/MM/yyyy', { locale: vi })}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {mealInfo?.label} • Báo bởi: {record.reporterName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(record.reportedAt), 'HH:mm dd/MM/yyyy', { locale: vi })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm">
                                <span className="text-green-600 font-medium">{record.present} ăn</span>
                                {' / '}
                                <span className="text-red-600">{record.absent} vắng</span>
                              </div>
                              <div className="text-xs text-muted-foreground">Tổng: {record.total}</div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteHistory(record.date, record.meal)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
