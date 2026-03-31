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
import { cn, vietnameseNameSortCompare } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DateRangeType, 
  getDateRange, 
  exportMealStatistics, 
  MealStudentData 
} from '@/lib/excel-export';
import { MealAbsentSelectionDialog } from '@/components/attendance/MealAbsentSelectionDialog';
import { AbsentConfirmationDialog } from '@/components/attendance/AbsentConfirmationDialog';
import { MealHistoryTab } from '@/components/attendance/MealHistoryTab';
import { StudentSearchInput } from '@/components/attendance/StudentSearchInput';
import { AdminReportOptions } from '@/components/attendance/AdminReportOptions';

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
  const [mealDeadlines, setMealDeadlines] = useState<MealDeadline[]>(DEFAULT_MEAL_DEADLINES);
  
  // Dialog for selecting absent students for 3 meals
  const [absent3MealsDialogOpen, setAbsent3MealsDialogOpen] = useState(false);
  const [absentSingleMealDialogOpen, setAbsentSingleMealDialogOpen] = useState(false);

  // Edit mode tracking for editing existing reports
  const [isEditMode, setIsEditMode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [editModeData, setEditModeData] = useState<{
    attendance: AttendanceMap;
    date: string;
    meal: AttendanceType;
    className?: string;
  } | null>(null);

  // Check if user is class teacher and get their class
  const isClassTeacher = currentMembership?.role === 'class_teacher';
  const teacherClassId = currentMembership?.class_id;

  // Admin report on behalf
  const [selectedReporterId, setSelectedReporterId] = useState(user?.id || '');

  // Check if user can bypass deadline (Admin, Super Admin, or Accountant)
  const canBypassDeadline = isSuperAdmin || isSchoolAdmin() || currentMembership?.role === 'accountant';

  // Confirmation dialog for single meal save
  const [showMealConfirmDialog, setShowMealConfirmDialog] = useState(false);
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
      typedStudents.sort((a, b) => vietnameseNameSortCompare(a.full_name, b.full_name));
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
    const reporterId = (isSuperAdmin || isSchoolAdmin()) && selectedReporterId ? selectedReporterId : user.id;
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
           reporter_id: reporterId,
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
    const reporterId = (isSuperAdmin || isSchoolAdmin()) && selectedReporterId ? selectedReporterId : user.id;
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
        reporter_id: reporterId,
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
    const reporterId = (isSuperAdmin || isSchoolAdmin()) && selectedReporterId ? selectedReporterId : user.id;
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
          reporter_id: reporterId,
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
    const reporterId = (isSuperAdmin || isSchoolAdmin()) && selectedReporterId ? selectedReporterId : user.id;
    
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
        reporter_id: reporterId,
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
      
      // First, set all relevant students as present (default)
      const studentsToUse = record.className 
        ? students.filter(s => s.class?.name === record.className)
        : students;
      
      studentsToUse.forEach((student) => {
        attendanceMap[student.id] = 'present';
      });
      
      // Then apply saved records from database - this will set absent students correctly
      (recordsData || []).forEach((rec: any) => {
        attendanceMap[rec.student_id] = rec.status;
      });

      // Set the date, meal, and class first (without triggering refetch)
      setSelectedMeal(record.meal);
      if (record.className) {
        setSelectedClass(record.className);
      }
      
      // Set the date - this will trigger fetchStudentsAndAttendance, but we'll override
      setDate(new Date(dateStr));
      
      // IMPORTANT: Set edit mode data AFTER date is set
      // The useEffect will apply this data after fetchStudentsAndAttendance completes
      setEditModeData({ 
        attendance: attendanceMap, 
        date: dateStr, 
        meal: record.meal,
        className: record.className
      });
      setIsEditMode(true);
      
      // Switch to register tab
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

  // Apply edit mode attendance data AFTER loading completes
  // This ensures the edit data overrides the fresh fetch
  useEffect(() => {
    if (isEditMode && editModeData && !isLoading) {
      // Apply the saved attendance data from the report being edited
      setAttendance(editModeData.attendance);
      // Clear edit mode after applying
      setIsEditMode(false);
      setEditModeData(null);
    }
  }, [isEditMode, editModeData, isLoading]);


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

    if (studentSearch.trim()) {
      const searchLower = studentSearch.toLowerCase().trim();
      filtered = filtered.filter(s => s.full_name.toLowerCase().includes(searchLower));
    }
    
    return filtered;
  }, [students, selectedClass, isClassTeacher, teacherClassId, studentSearch]);

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

              {/* Admin: Report on behalf */}
              {(isSuperAdmin || isSchoolAdmin()) && (
                <AdminReportOptions
                  schoolId={currentSchool.id}
                  currentUserId={user?.id || ''}
                  isAdmin={true}
                  selectedReporterId={selectedReporterId}
                  onReporterChange={setSelectedReporterId}
                />
              )}
            </div>

            {/* Class Filter Buttons */}
            {isClassTeacher && teacherClassName ? (
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                <span className="font-medium text-primary">{teacherClassName}</span>
                <Badge variant="secondary" className="text-xs">Lớp của bạn</Badge>
              </div>
            ) : (
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Chọn lớp</label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={selectedClass === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedClass('all')}
                    className="whitespace-nowrap"
                  >
                    Tất cả ({students.length})
                  </Button>
                  {sortedClasses.map((cls) => {
                    const count = students.filter(s => s.class?.name === cls.name).length;
                    return (
                      <Button
                        key={cls.id}
                        variant={selectedClass === cls.name ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedClass(cls.name)}
                        className="whitespace-nowrap"
                      >
                        {cls.name} ({count})
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

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

            {/* Student Search */}
            <StudentSearchInput
              value={studentSearch}
              onChange={setStudentSearch}
              resultCount={filteredStudents.length}
              totalCount={students.length}
            />

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

          <TabsContent value="history" className="p-4">
            <MealHistoryTab
              students={students}
              classes={classes}
              isClassTeacher={isClassTeacher}
              teacherClassId={teacherClassId || null}
              teacherClassName={teacherClassName || null}
              canDelete={canDelete}
              onEditReport={(date, meal, className) => {
                // Find or construct a history record to pass to edit handler
                const record = {
                  date,
                  meal,
                  reportedAt: new Date().toISOString(),
                  reporterId: user?.id || '',
                  reporterName: profile?.full_name || '',
                  total: 0,
                  present: 0,
                  absent: 0,
                  absentStudents: [],
                  className,
                };
                handleEditMealReport(record);
              }}
            />
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
