import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeaturePermission } from '@/components/guards/FeatureGuard';
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
  UserMinus,
  ChevronUp,
  ChevronDown,
  Edit3,
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
import { MealAbsentSelectionDialog } from '@/components/attendance/MealAbsentSelectionDialog';

type AttendanceMap = Record<string, AttendanceStatus>;

interface ClassReportInfo {
  className: string;
  classId: string;
  reportCount: number;
  latestReportTime: string;
}

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

interface AbsentStudentInfo {
  id: string;
  name: string;
  className: string;
}

interface HistoryRecord {
  date: string;
  meal: AttendanceType;
  reportedAt: string;
  reporterId: string;
  reporterName: string;
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudentInfo[];
  className?: string; // For class-specific records (GVCN view)
}

export default function Meals() {
  const { currentSchool, user, profile, currentMembership, isSuperAdmin, isSchoolAdmin } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = useFeaturePermission('meals');
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
  const [historyClassFilter, setHistoryClassFilter] = useState<string>('all');
  const [historyReporterFilter, setHistoryReporterFilter] = useState<string>('all');
  const [reporters, setReporters] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedHistoryRecords, setExpandedHistoryRecords] = useState<Record<string, boolean>>({});
  const [mealDeadlines, setMealDeadlines] = useState<MealDeadline[]>(DEFAULT_MEAL_DEADLINES);
  
  // Dialog for selecting absent students for 3 meals
  const [absent3MealsDialogOpen, setAbsent3MealsDialogOpen] = useState(false);
  const [absentSingleMealDialogOpen, setAbsentSingleMealDialogOpen] = useState(false);

  // Edit mode tracking for editing existing reports
  const [isEditMode, setIsEditMode] = useState(false);
  const [editModeData, setEditModeData] = useState<{
    attendance: AttendanceMap;
    date: string;
    meal: AttendanceType;
    className?: string;
  } | null>(null);

  // Check if user is class teacher and get their class
  const isClassTeacher = currentMembership?.role === 'class_teacher';
  const teacherClassId = currentMembership?.class_id;

  // Check if user can bypass deadline (Admin, Super Admin, or Accountant)
  const canBypassDeadline = isSuperAdmin || isSchoolAdmin() || currentMembership?.role === 'accountant';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchool, date]);

  useEffect(() => {
    if (!currentSchool || activeTab !== 'history') return;
    fetchHistory();
  }, [currentSchool, activeTab, historyDateRange, historyClassFilter, historyReporterFilter, classes]);

  // Fetch unique reporters for filter dropdown
  useEffect(() => {
    if (!currentSchool || activeTab !== 'history') return;
    fetchReporters();
  }, [currentSchool, activeTab, historyDateRange]);

  const fetchReporters = async () => {
    if (!currentSchool) return;
    try {
      const startDate = format(historyDateRange.start, 'yyyy-MM-dd');
      const endDate = format(historyDateRange.end, 'yyyy-MM-dd');

      const { data } = await supabase
        .from('attendance_records')
        .select('reporter_id, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate);

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

      // Build query - for class teachers, only fetch their class records
      let query = supabase
        .from('attendance_records')
        .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name), student:students(full_name, class:classes(name))')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('created_at', { ascending: false });

      // Class teachers only see their class
      if (isClassTeacher && teacherClassId) {
        query = query.eq('class_id', teacherClassId);
      } else if (historyClassFilter !== 'all') {
        // Admin class filter
        const selectedClassObj = classes.find(c => c.name === historyClassFilter);
        if (selectedClassObj) {
          query = query.eq('class_id', selectedClassObj.id);
        }
      }

      // Reporter filter
      if (historyReporterFilter !== 'all') {
        query = query.eq('reporter_id', historyReporterFilter);
      }

      const { data: recordsData } = await query;

      // CRITICAL FIX: First, get the latest record per student/date/meal
      // This ensures we don't count duplicates from multiple report sessions
      const latestByStudentDateMeal = new Map<string, any>();
      (recordsData || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}-${record.attendance_type}`;
        const existing = latestByStudentDateMeal.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByStudentDateMeal.set(key, record);
        }
      });

      // Now group the latest records by date+meal for history display
      const historyByDateMeal = new Map<string, HistoryRecord>();
      
      latestByStudentDateMeal.forEach((record) => {
        const key = `${record.attendance_date}-${record.attendance_type}`;
        
        if (!historyByDateMeal.has(key)) {
          historyByDateMeal.set(key, {
            date: record.attendance_date,
            meal: record.attendance_type,
            reportedAt: record.created_at,
            reporterId: record.reporter_id,
            reporterName: record.reporter?.full_name || 'N/A',
            total: 0,
            present: 0,
            absent: 0,
            absentStudents: [],
            className: isClassTeacher && teacherClassName ? teacherClassName : (historyClassFilter !== 'all' ? historyClassFilter : undefined),
          });
        }
        
        const entry = historyByDateMeal.get(key)!;
        entry.total++;
        if (record.status === 'present') {
          entry.present++;
        } else {
          entry.absent++;
          // Add to absent students list
          const studentName = record.student?.full_name || 'N/A';
          const className = record.student?.class?.name || 'N/A';
          entry.absentStudents.push({
            id: record.student_id,
            name: studentName,
            className: className,
          });
        }
        
        // Keep the latest report time for display
        if (new Date(record.created_at) > new Date(entry.reportedAt)) {
          entry.reportedAt = record.created_at;
          entry.reporterId = record.reporter_id;
          entry.reporterName = record.reporter?.full_name || 'N/A';
        }
      });

      // Sort absent students by class then name
      historyByDateMeal.forEach((entry) => {
        entry.absentStudents.sort((a, b) => {
          if (a.className !== b.className) return a.className.localeCompare(b.className, 'vi');
          return a.name.localeCompare(b.name, 'vi');
        });
      });

      setHistoryRecords(Array.from(historyByDateMeal.values()).sort((a, b) => 
        b.date.localeCompare(a.date) || 
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
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

  // Handler for mark all 3 meals with custom absent list
  // For class teachers: only save records for their class students
  const handleSave3MealsWithAbsent = async (absentStudentIds: string[]) => {
    if (!currentSchool || !user) return;
    setIsSaving(true);
    setAbsent3MealsDialogOpen(false);
    
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
      const absentSet = new Set(absentStudentIds);
      
      // Use filteredStudents (class-specific for GVCN, all for admin)
      const studentsToReport = filteredStudents;

      for (const meal of validMeals) {
        // Only delete records for the students being reported (class-specific for GVCN)
        const studentIds = studentsToReport.map(s => s.id);
        if (studentIds.length > 0) {
          await supabase
            .from('attendance_records')
            .delete()
            .eq('school_id', currentSchool.id)
            .eq('attendance_date', dateStr)
            .eq('attendance_type', meal)
            .in('student_id', studentIds);
        }

        const records = studentsToReport.map((student) => ({
          school_id: currentSchool.id,
          student_id: student.id,
          class_id: student.class_id,
          attendance_date: dateStr,
          attendance_type: meal,
          status: (absentSet.has(student.id) ? 'absent' : 'present') as AttendanceStatus,
          reporter_id: user.id,
        }));

        await supabase.from('attendance_records').insert(records);
      }

      const savedMeals = validMeals.map(m => mealTypes.find(t => t.type === m)?.label).join(', ');
      toast({ 
        title: 'Thành công', 
        description: `Đã lưu ${savedMeals} - ${absentStudentIds.length} vắng` 
      });
      
      if (expiredMeals.length > 0) {
        const skippedMeals = expiredMeals.map(m => mealTypes.find(t => t.type === m)?.label).join(', ');
        toast({ 
          title: 'Lưu ý', 
          description: `Đã bỏ qua ${skippedMeals} do quá hạn`, 
          variant: 'destructive' 
        });
      }
      
      // Reset attendance to all present for next report
      const freshAttendance: AttendanceMap = {};
      filteredStudents.forEach(s => freshAttendance[s.id] = 'present');
      setAttendance(freshAttendance);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for save single meal with custom absent list
  // For class teachers: only save records for their class students
  const handleSaveSingleMealWithAbsent = async (absentStudentIds: string[]) => {
    if (!currentSchool || !user) return;
    setIsSaving(true);
    setAbsentSingleMealDialogOpen(false);
    
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const absentSet = new Set(absentStudentIds);
      
      // Use filteredStudents (class-specific for GVCN, all for admin)
      const studentsToReport = filteredStudents;
      const studentIds = studentsToReport.map(s => s.id);
      
      // Only delete records for the students being reported
      if (studentIds.length > 0) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr)
          .eq('attendance_type', selectedMeal)
          .in('student_id', studentIds);
      }

      const records = studentsToReport.map((student) => ({
        school_id: currentSchool.id,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: selectedMeal,
        status: (absentSet.has(student.id) ? 'absent' : 'present') as AttendanceStatus,
        reporter_id: user.id,
      }));

      const { error } = await supabase.from('attendance_records').insert(records);
      if (error) throw error;

      toast({ 
        title: 'Thành công', 
        description: `Đã lưu ${mealTypes.find(m => m.type === selectedMeal)?.label} - ${absentStudentIds.length} vắng` 
      });
      
      // Reset attendance to all present for next report
      const freshAttendance: AttendanceMap = {};
      filteredStudents.forEach(s => freshAttendance[s.id] = 'present');
      setAttendance(freshAttendance);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
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
      
      // Use filteredStudents (class-specific for GVCN, all for admin)
      const studentsToReport = filteredStudents;
      const studentIds = studentsToReport.map(s => s.id);

      for (const meal of validMeals) {
        // Only delete records for the students being reported
        if (studentIds.length > 0) {
          await supabase
            .from('attendance_records')
            .delete()
            .eq('school_id', currentSchool.id)
            .eq('attendance_date', dateStr)
            .eq('attendance_type', meal)
            .in('student_id', studentIds);
        }

        const records = studentsToReport.map((student) => ({
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
      
      // Reset attendance to all present for next report
      const freshAttendance: AttendanceMap = {};
      filteredStudents.forEach(s => freshAttendance[s.id] = 'present');
      setAttendance(freshAttendance);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!currentSchool || !user) return;
    
    // Check deadline - but allow bypass for Admin/Accountant
    if (currentMealDeadline.isExpired && !canBypassDeadline) {
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
      
      // Use filteredStudents (class-specific for GVCN, all for admin)
      const studentsToReport = filteredStudents;
      const studentIds = studentsToReport.map(s => s.id);
      
      // Only delete records for the students being reported
      if (studentIds.length > 0) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr)
          .eq('attendance_type', selectedMeal)
          .in('student_id', studentIds);
      }

      const records = studentsToReport.map((student) => ({
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
      
      // Reset attendance to all present for next report
      const freshAttendance: AttendanceMap = {};
      filteredStudents.forEach(s => freshAttendance[s.id] = 'present');
      setAttendance(freshAttendance);
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

  // Handle edit meal report - load existing data and switch to edit mode
  const handleEditMealReport = async (record: HistoryRecord) => {
    if (!currentSchool) return;
    
    try {
      setIsLoading(true);
      const dateStr = record.date;
      
      // Load attendance data from database for this date and meal
      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', record.meal);

      const attendanceMap: AttendanceMap = {};
      
      // First, set all relevant students as present
      const studentsToUse = record.className 
        ? students.filter(s => s.class?.name === record.className)
        : students;
      
      studentsToUse.forEach((student) => {
        attendanceMap[student.id] = 'present';
      });
      
      // Then apply saved records
      (recordsData || []).forEach((rec: any) => {
        attendanceMap[rec.student_id] = rec.status;
      });

      // Set edit mode data
      setEditModeData({ 
        attendance: attendanceMap, 
        date: dateStr, 
        meal: record.meal,
        className: record.className
      });
      setIsEditMode(true);
      
      // Set the date and meal, switch to register tab
      setDate(new Date(dateStr));
      setSelectedMeal(record.meal);
      if (record.className) {
        setSelectedClass(record.className);
      }
      setActiveTab('register');
      
      toast({
        title: 'Đang sửa báo cáo',
        description: `${mealTypes.find(m => m.type === record.meal)?.label} ngày ${format(new Date(dateStr), 'dd/MM/yyyy')}. Nhấn "Lưu" khi hoàn tất.`,
      });
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải dữ liệu báo cáo',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply edit mode data after component updates
  useEffect(() => {
    if (isEditMode && editModeData) {
      setAttendance(prev => ({ ...prev, ...editModeData.attendance }));
      setIsEditMode(false);
      setEditModeData(null);
    }
  }, [isEditMode, editModeData]);

  const handleExportExcel = async () => {
    if (!currentSchool) return;
    setIsExporting(true);
    
    try {
      const days = eachDayOfInterval({ start: historyDateRange.start, end: historyDateRange.end });
      
      // For class teachers, only export their class students
      const studentsToExport = isClassTeacher && teacherClassId 
        ? students.filter(s => s.class_id === teacherClassId)
        : students;

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
      const studentData: MealStudentData[] = studentsToExport.map(student => {
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

      // For class teachers, include class name in the title
      const teacherClass = isClassTeacher && teacherClassId 
        ? classes.find(c => c.id === teacherClassId)?.name 
        : null;
      const exportTitle = teacherClass 
        ? `THỐNG KÊ BỮA ĂN LỚP ${teacherClass}`
        : 'THỐNG KÊ BỮA ĂN HỌC SINH NỘI TRÚ';

      exportMealStatistics(studentData, {
        schoolName: currentSchool.name,
        title: exportTitle,
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

  // For class teachers, only show their class students
  // For admins/super admins, show all students or filter by selected class
  const filteredStudents = useMemo(() => {
    let filtered = students;
    
    // If class teacher, always filter to their class only
    if (isClassTeacher && teacherClassId) {
      filtered = students.filter(s => s.class_id === teacherClassId);
    } else if (selectedClass !== 'all') {
      filtered = students.filter(s => s.class?.name === selectedClass);
    }
    
    return filtered;
  }, [students, selectedClass, isClassTeacher, teacherClassId]);

  // Get the teacher's class name for display
  const teacherClassName = useMemo(() => {
    if (!isClassTeacher || !teacherClassId) return null;
    return classes.find(c => c.id === teacherClassId)?.name;
  }, [isClassTeacher, teacherClassId, classes]);

  // Check if user can report meals - use permission system
  const canReportMeals = canCreate || isSuperAdmin || isSchoolAdmin() || isClassTeacher;

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
                {isClassTeacher && teacherClassName ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                    <span className="font-medium text-primary">{teacherClassName}</span>
                    <Badge variant="secondary" className="text-xs">Lớp của bạn</Badge>
                  </div>
                ) : (
                  <Select value={selectedClass} onValueChange={setSelectedClass} disabled={isClassTeacher}>
                    <SelectTrigger><SelectValue placeholder="Tất cả lớp" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả lớp</SelectItem>
                      {sortedClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Class Teacher Notice */}
            {isClassTeacher && teacherClassName && (
              <Alert className="border-blue-200 bg-blue-50">
                <Users className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-700">
                  Bạn đang báo bữa ăn cho lớp <strong>{teacherClassName}</strong> - lớp bạn chủ nhiệm.
                </AlertDescription>
              </Alert>
            )}

            {/* Not Class Teacher Notice */}
            {!canReportMeals && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Bạn không có quyền báo bữa ăn. Chỉ giáo viên chủ nhiệm và quản trị viên mới có thể báo bữa ăn.
                </AlertDescription>
              </Alert>
            )}

            {/* Meal Tabs with Deadline Status */}
            <div className="flex gap-2 flex-wrap">
              {mealTypes.map(({ type, label, icon: Icon }) => {
                const deadlineInfo = getMealDeadlineInfo(type, date);
                const isDisabled = deadlineInfo.isExpired && !canBypassDeadline;
                return (
                  <Button 
                    key={type} 
                    variant={selectedMeal === type ? 'default' : 'outline'} 
                    onClick={() => setSelectedMeal(type)} 
                    className={cn(
                      "flex-1 min-w-[100px] relative",
                      isDisabled && "opacity-50"
                    )}
                    disabled={isDisabled}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                    {deadlineInfo.isExpired && !canBypassDeadline && (
                      <Ban className="h-3 w-3 absolute top-1 right-1 text-red-500" />
                    )}
                    {deadlineInfo.isExpired && canBypassDeadline && (
                      <Badge className="absolute -top-2 -right-2 text-[10px] px-1 py-0 bg-warning text-warning-foreground">
                        Bổ sung
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Deadline Warning */}
            {currentMealDeadline.isExpired ? (
              canBypassDeadline ? (
                <Alert className="border-warning bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-warning">
                    <strong>Bổ sung báo cáo:</strong> {mealTypes.find(m => m.type === selectedMeal)?.label} đã quá hạn. 
                    Bạn có quyền báo cáo bổ sung.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {mealTypes.find(m => m.type === selectedMeal)?.label} đã quá hạn báo cáo. {currentMealDeadline.deadlineText}
                  </AlertDescription>
                </Alert>
              )
            ) : (
              <Alert className="border-blue-200 bg-blue-50">
                <Clock className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-700">
                  {currentMealDeadline.remainingTime} để báo {mealTypes.find(m => m.type === selectedMeal)?.label.toLowerCase()}. {currentMealDeadline.deadlineText}
                </AlertDescription>
              </Alert>
            )}

            {/* Quick Actions - Compact for mobile */}
            <div className="space-y-2">
              {/* Row 1: Current meal actions */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleMarkAllPresent} 
                  disabled={(currentMealDeadline.isExpired && !canBypassDeadline) || !canReportMeals}
                  className="flex-1 h-8 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Đủ
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setAbsentSingleMealDialogOpen(true)} 
                  disabled={(currentMealDeadline.isExpired && !canBypassDeadline) || !canReportMeals}
                  className="flex-1 h-8 text-xs"
                >
                  <UserMinus className="h-3.5 w-3.5 mr-1" />Chọn vắng
                </Button>
              </div>
              
              {/* Row 2: 3-meal actions */}
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleMarkAll3Meals(true)} 
                  disabled={isSaving || !canReportMeals}
                  className="flex-1 h-8 text-xs bg-success hover:bg-success/90"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Đủ 3 bữa
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setAbsent3MealsDialogOpen(true)} 
                  disabled={isSaving || !canReportMeals}
                  className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90"
                >
                  <UserMinus className="h-3.5 w-3.5 mr-1" />3 bữa (chọn vắng)
                </Button>
              </div>
              
              {/* Summary */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">
                  {filteredStudents.length} học sinh
                </span>
                <Badge variant={presentCount === filteredStudents.length ? "default" : "secondary"} className="text-xs">
                  {presentCount}/{filteredStudents.length} ăn
                </Badge>
              </div>
            </div>

            {/* Compact Students Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto border rounded-lg p-1.5">
                <div className="grid gap-1 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                  {filteredStudents.map((student) => {
                    const isDisabledForUser = (currentMealDeadline.isExpired && !canBypassDeadline) || !canReportMeals;
                    return (
                    <button 
                      key={student.id} 
                      onClick={() => !isDisabledForUser && handleToggleAbsent(student.id)}
                      disabled={isDisabledForUser}
                      className={cn(
                        'flex items-center gap-1.5 p-2 rounded border text-left transition-all',
                        attendance[student.id] === 'absent' 
                          ? 'border-destructive/50 bg-destructive/10 text-destructive' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/30',
                        isDisabledForUser && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                        attendance[student.id] === 'absent' ? 'border-destructive bg-destructive' : 'border-muted-foreground'
                      )}>
                        {attendance[student.id] === 'absent' && (
                          <span className="text-destructive-foreground text-[8px]">✕</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium">{student.full_name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{student.class?.name}</span>
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button 
              onClick={handleSave} 
              disabled={isSaving || (currentMealDeadline.isExpired && !canBypassDeadline) || !canReportMeals} 
              className="w-full h-10"
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {currentMealDeadline.isExpired && canBypassDeadline ? 'Bổ sung ' : 'Lưu '}
              {mealTypes.find(m => m.type === selectedMeal)?.label}
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
                {/* Class Filter for Admin only */}
                {!isClassTeacher && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Lọc theo lớp</label>
                    <Select value={historyClassFilter} onValueChange={setHistoryClassFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Tất cả lớp" />
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
                {/* Reporter Filter */}
                {!isClassTeacher && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Lọc theo người báo cáo</label>
                    <Select value={historyReporterFilter} onValueChange={setHistoryReporterFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Tất cả người báo cáo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả người báo cáo</SelectItem>
                        {reporters.map((reporter) => (
                          <SelectItem key={reporter.id} value={reporter.id}>{reporter.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Button onClick={handleExportExcel} variant="outline" disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Xuất Excel
              </Button>
            </div>

            {/* Class Teacher Notice */}
            {isClassTeacher && teacherClassName && (
              <Alert className="border-blue-200 bg-blue-50">
                <Users className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-700">
                  Hiển thị lịch sử báo cáo bữa ăn của lớp <strong>{teacherClassName}</strong> - lớp bạn chủ nhiệm.
                </AlertDescription>
              </Alert>
            )}

            {/* Statistics Summary */}
            {historyRecords.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center bg-primary/5 border-primary/20">
                  <p className="text-2xl font-bold text-primary">{historyRecords.length}</p>
                  <p className="text-xs text-muted-foreground">Số báo cáo</p>
                </Card>
                <Card className="p-4 text-center bg-success/10 border-success/20">
                  <p className="text-2xl font-bold text-success">{historyRecords.reduce((s, r) => s + r.present, 0)}</p>
                  <p className="text-xs text-muted-foreground">Tổng có mặt</p>
                </Card>
                <Card className="p-4 text-center bg-destructive/10 border-destructive/20">
                  <p className="text-2xl font-bold text-destructive">{historyRecords.reduce((s, r) => s + r.absent, 0)}</p>
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
                  const recordKey = `${record.date}-${record.meal}`;
                  const isExpanded = expandedHistoryRecords[recordKey];
                  
                  return (
                    <Card key={idx} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              record.meal === 'breakfast' && "bg-amber-100",
                              record.meal === 'lunch' && "bg-orange-100",
                              record.meal === 'dinner' && "bg-purple-100"
                            )}>
                              <MealIcon className={cn(
                                "h-5 w-5",
                                record.meal === 'breakfast' && "text-amber-600",
                                record.meal === 'lunch' && "text-orange-600",
                                record.meal === 'dinner' && "text-purple-600"
                              )} />
                            </div>
                            <div>
                              <div className="font-medium">
                                {format(new Date(record.date), 'EEEE, dd/MM/yyyy', { locale: vi })}
                                {record.className && <Badge variant="secondary" className="ml-2 text-xs">{record.className}</Badge>}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {mealInfo?.label} • Báo bởi: {record.reporterName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(record.reportedAt), 'HH:mm dd/MM/yyyy', { locale: vi })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-sm">
                                <span className="text-success font-medium">{record.present} ăn</span>
                                {' / '}
                                <span className="text-destructive">{record.absent} vắng</span>
                              </div>
                              <div className="text-xs text-muted-foreground">Tổng: {record.total}</div>
                            </div>
                            {record.absentStudents.length > 0 && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setExpandedHistoryRecords(prev => ({
                                  ...prev,
                                  [recordKey]: !prev[recordKey]
                                }))}
                                className="h-8 px-2"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {(isSuperAdmin || isSchoolAdmin() || record.reporterId === user?.id) && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditMealReport(record)}
                                className="h-8 px-2"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            )}
                            {(isSuperAdmin || isSchoolAdmin() || canDelete) && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  if (window.confirm(`Xác nhận xóa báo cáo ${mealInfo?.label} ngày ${format(new Date(record.date), 'dd/MM/yyyy')}?`)) {
                                    handleDeleteHistory(record.date, record.meal);
                                  }
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Expandable Absent Students List */}
                        {isExpanded && record.absentStudents.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm font-medium text-muted-foreground mb-2">
                              Danh sách vắng ({record.absentStudents.length}):
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {record.absentStudents.map((student, sIdx) => (
                                <div 
                                  key={sIdx}
                                  className="flex items-center gap-1.5 p-2 rounded-lg bg-destructive/5 border border-destructive/20"
                                >
                                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{student.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{student.className}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Dialog for selecting absent students for 3 meals */}
      <MealAbsentSelectionDialog
        open={absent3MealsDialogOpen}
        onOpenChange={setAbsent3MealsDialogOpen}
        students={filteredStudents}
        classes={classes}
        onConfirm={handleSave3MealsWithAbsent}
        isLoading={isSaving}
        title="Báo 3 bữa - Chọn học sinh vắng"
        description={isClassTeacher && teacherClassName 
          ? `Chọn học sinh vắng cho cả 3 bữa (Sáng, Trưa, Tối) - Lớp ${teacherClassName}.`
          : "Chọn học sinh vắng cho cả 3 bữa (Sáng, Trưa, Tối). Các học sinh không chọn sẽ được báo đủ."}
      />

      {/* Dialog for selecting absent students for single meal */}
      <MealAbsentSelectionDialog
        open={absentSingleMealDialogOpen}
        onOpenChange={setAbsentSingleMealDialogOpen}
        students={filteredStudents}
        classes={classes}
        onConfirm={handleSaveSingleMealWithAbsent}
        isLoading={isSaving}
        title={`${mealTypes.find(m => m.type === selectedMeal)?.label} - Chọn học sinh vắng`}
        description="Chọn học sinh vắng cho bữa này. Các học sinh không chọn sẽ được báo đủ."
      />
    </div>
  );
}
