import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, setHours, setMinutes, isBefore } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  BarChart3,
  Home,
  BookOpen,
  UtensilsCrossed,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileSpreadsheet,
  Image,
  Plus,
  Package,
  Trash2,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Student, Class, AttendanceType, AttendanceStatus } from '@/types';
import { DateRangeType, getDateRange, exportMealStatistics, MealStudentData } from '@/lib/excel-export';
import { ShareMealReportDialog } from '@/components/attendance/ShareMealReportDialog';
import { ShareAbsentByMealGroupDialog } from '@/components/attendance/ShareAbsentByMealGroupDialog';
import { SupplementMealReportDialog } from '@/components/attendance/SupplementMealReportDialog';
import { useToast } from '@/hooks/use-toast';
import { ClassMealStatistics } from '@/components/statistics/ClassMealStatistics';
import { cn } from '@/lib/utils';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  excused: boolean;
  reason: string;
  mealGroup?: string;
}

interface ClassReportInfo {
  className: string;
  classId: string;
  reportCount: number;
  latestReportTime: string;
}

interface MealStats {
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudent[];
  classesNotReported: string[];
  classReportInfos: ClassReportInfo[];
  hasReport: boolean;
}

interface DailyMealSummary {
  breakfast: MealStats;
  lunch: MealStats;
  dinner: MealStats;
  totalRice: number;
}

interface LatestReport {
  date: string;
  session: string;
  sessionLabel: string;
  reporter: string;
  reportTime: string;
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudent[];
}

export default function Statistics() {
  const { currentSchool, profile, user, currentMembership, isSuperAdmin, isSchoolAdmin } = useAuth();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  // Latest reports
  const [latestBoardingReport, setLatestBoardingReport] = useState<LatestReport | null>(null);
  const [latestStudyReport, setLatestStudyReport] = useState<LatestReport | null>(null);
  
  // Daily meal stats
  const [dailyMealStats, setDailyMealStats] = useState<DailyMealSummary | null>(null);
  
  // Rice statistics
  const [riceRangeType, setRiceRangeType] = useState<DateRangeType>('month');
  const [riceDate, setRiceDate] = useState<Date>(new Date());
  const [riceStats, setRiceStats] = useState<{ date: string; rice: number }[]>([]);
  const [totalRiceInRange, setTotalRiceInRange] = useState(0);
  const [isLoadingRice, setIsLoadingRice] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSingleMeal, setIsExportingSingleMeal] = useState<AttendanceType | null>(null);
  
  // Rice inventory
  const [riceInventory, setRiceInventory] = useState<{ id: string; amount: number; notes: string; created_at: string }[]>([]);
  const [newRiceAmount, setNewRiceAmount] = useState('');
  const [newRiceNotes, setNewRiceNotes] = useState('');
  const [isAddingRice, setIsAddingRice] = useState(false);
  const [showAddRiceForm, setShowAddRiceForm] = useState(false);
  
  // Share meal report dialog
  const [shareMealDialogOpen, setShareMealDialogOpen] = useState(false);
  
  // Share absent by meal group dialog
  const [shareAbsentByMealGroupDialogOpen, setShareAbsentByMealGroupDialogOpen] = useState(false);
  
  // Supplement meal report dialog
  const [supplementDialogOpen, setSupplementDialogOpen] = useState(false);
  const [supplementMealType, setSupplementMealType] = useState<AttendanceType>('breakfast');
  const [isSavingSupplement, setIsSavingSupplement] = useState(false);
  
  // Finalize (Chốt) state
  const [isFinalizingMeal, setIsFinalizingMeal] = useState<AttendanceType | null>(null);
  
  // Meal settings for deadline check
  const [mealDeadlines, setMealDeadlines] = useState<{
    type: AttendanceType;
    deadlineHour: number;
    deadlineMinute: number;
    dayOffset: number;
  }[]>([
    { type: 'breakfast', deadlineHour: 20, deadlineMinute: 0, dayOffset: -1 },
    { type: 'lunch', deadlineHour: 7, deadlineMinute: 30, dayOffset: 0 },
    { type: 'dinner', deadlineHour: 14, deadlineMinute: 0, dayOffset: 0 },
  ]);

  // Check if user can supplement reports (admin or accountant)
  const canSupplementReports = isSuperAdmin || isSchoolAdmin() || currentMembership?.role === 'accountant';

  // Check if user is class teacher and get their class
  const isClassTeacher = currentMembership?.role === 'class_teacher';
  const teacherClassId = currentMembership?.class_id;

  // Expand/collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
    notReported: false,
  });

  const riceDateRange = useMemo(() => getDateRange(riceDate, riceRangeType), [riceDate, riceRangeType]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [classes]);

  // Get teacher's class name for display
  const teacherClassName = useMemo(() => {
    if (!isClassTeacher || !teacherClassId) return null;
    return classes.find(c => c.id === teacherClassId)?.name;
  }, [isClassTeacher, teacherClassId, classes]);

  // Filter students for class teachers - they can only see their class
  const filteredStudents = useMemo(() => {
    if (isClassTeacher && teacherClassId) {
      return students.filter(s => s.class_id === teacherClassId);
    }
    return students;
  }, [students, isClassTeacher, teacherClassId]);

  // For class teachers, filter meal stats to only show their class
  // IMPORTANT: This uses the SAME data source as admin stats, which already takes the latest report per class
  // The class teacher view just filters to show only their class's data
  const filteredMealStats = useMemo((): DailyMealSummary | null => {
    if (!dailyMealStats) return null;
    
    // If not a class teacher, return all stats (admin aggregated view)
    if (!isClassTeacher || !teacherClassName) return dailyMealStats;
    
    // Filter meal stats for class teacher's class
    // The data in dailyMealStats already has the latest report per student (no cumulative)
    const filterMealForClass = (stats: MealStats): MealStats => {
      // Get absent students for this class only
      const classAbsentStudents = stats.absentStudents.filter(s => s.className === teacherClassName);
      const classReportInfos = stats.classReportInfos.filter(info => info.className === teacherClassName);
      
      // Check if this class has reported
      const classHasReported = classReportInfos.length > 0;
      const classTotal = filteredStudents.length;
      
      if (!classHasReported) {
        // Class hasn't reported
        return {
          total: classTotal,
          present: 0,
          absent: 0,
          absentStudents: [],
          classesNotReported: stats.classesNotReported.includes(teacherClassName) ? [teacherClassName] : [],
          classReportInfos: [],
          hasReport: false,
        };
      }
      
      // Class has reported - calculate present count
      // Present = total class students - absent students in the latest report
      const classPresent = classTotal - classAbsentStudents.length;
      
      return {
        total: classTotal,
        present: classPresent,
        absent: classAbsentStudents.length,
        absentStudents: classAbsentStudents,
        classesNotReported: [],
        classReportInfos,
        hasReport: true,
      };
    };

    return {
      breakfast: filterMealForClass(dailyMealStats.breakfast),
      lunch: filterMealForClass(dailyMealStats.lunch),
      dinner: filterMealForClass(dailyMealStats.dinner),
      totalRice: (filterMealForClass(dailyMealStats.lunch).present + filterMealForClass(dailyMealStats.dinner).present) * 0.2,
    };
  }, [dailyMealStats, isClassTeacher, teacherClassName, filteredStudents]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Check if meal deadline has expired for a given date
  const isMealDeadlineExpired = useCallback((mealType: AttendanceType, targetDate: Date): boolean => {
    const deadline = mealDeadlines.find(d => d.type === mealType);
    if (!deadline) return true;

    const now = new Date();
    let deadlineDate = new Date(targetDate);
    
    if (deadline.dayOffset === -1) {
      deadlineDate = subDays(deadlineDate, 1);
    }
    
    deadlineDate = setHours(deadlineDate, deadline.deadlineHour);
    deadlineDate = setMinutes(deadlineDate, deadline.deadlineMinute);

    return !isBefore(now, deadlineDate);
  }, [mealDeadlines]);

  // Fetch meal settings for deadline check
  const fetchMealSettings = useCallback(async () => {
    if (!currentSchool) return;

    try {
      const { data } = await supabase
        .from('meal_settings')
        .select('*')
        .eq('school_id', currentSchool.id)
        .maybeSingle();

      if (data) {
        const parseTime = (timeStr: string) => {
          const parts = timeStr.split(':');
          return { hour: parseInt(parts[0]), minute: parseInt(parts[1]) };
        };

        const breakfastTime = parseTime(data.breakfast_deadline_time);
        const lunchTime = parseTime(data.lunch_deadline_time);
        const dinnerTime = parseTime(data.dinner_deadline_time);

        setMealDeadlines([
          { type: 'breakfast', deadlineHour: breakfastTime.hour, deadlineMinute: breakfastTime.minute, dayOffset: data.breakfast_deadline_offset },
          { type: 'lunch', deadlineHour: lunchTime.hour, deadlineMinute: lunchTime.minute, dayOffset: data.lunch_deadline_offset },
          { type: 'dinner', deadlineHour: dinnerTime.hour, deadlineMinute: dinnerTime.minute, dayOffset: data.dinner_deadline_offset },
        ]);
      }
    } catch (error) {
      console.error('Error fetching meal settings:', error);
    }
  }, [currentSchool]);

  // Handle finalize meal - auto report present for unreported classes
  const handleFinalizeMeal = useCallback(async (mealType: AttendanceType, classesNotReported: string[]) => {
    if (!currentSchool || !user || classesNotReported.length === 0) return;

    setIsFinalizingMeal(mealType);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Get students from unreported classes
      const classNamesSet = new Set(classesNotReported);
      const studentsToReport = students.filter(s => classNamesSet.has(s.class?.name || ''));
      
      if (studentsToReport.length === 0) {
        toast({
          title: 'Không có học sinh',
          description: 'Không tìm thấy học sinh cần báo cáo',
          variant: 'destructive',
        });
        return;
      }

      // Insert all as present
      const records = studentsToReport.map(student => ({
        school_id: currentSchool.id,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: mealType,
        status: 'present' as AttendanceStatus,
        reporter_id: user.id,
      }));

      const { error } = await supabase.from('attendance_records').insert(records);
      if (error) throw error;

      const mealLabel = mealType === 'breakfast' ? 'Bữa sáng' : mealType === 'lunch' ? 'Bữa trưa' : 'Bữa tối';
      toast({
        title: 'Chốt thành công',
        description: `Đã chốt ${classesNotReported.length} lớp cho ${mealLabel} (${studentsToReport.length} học sinh)`,
      });

      // Refresh data
      setTimeout(() => {
        fetchDailyData();
      }, 500);
    } catch (error) {
      console.error('Error finalizing meal:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể chốt báo cáo. Vui lòng thử lại.',
        variant: 'destructive',
      });
    } finally {
      setIsFinalizingMeal(null);
    }
  }, [currentSchool, user, selectedDate, students, toast]);

  // Fetch meal settings on mount
  useEffect(() => {
    if (!currentSchool) return;
    fetchMealSettings();
  }, [currentSchool, fetchMealSettings]);

  // Fetch classes and students
  useEffect(() => {
    if (!currentSchool) return;
    fetchBasicData();
  }, [currentSchool]);

  // Fetch latest reports and daily meal stats when date changes
  useEffect(() => {
    if (!currentSchool || students.length === 0 || classes.length === 0) return;
    fetchDailyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchool, selectedDate, students.length, classes.length]);

  // Fetch rice statistics and inventory
  useEffect(() => {
    if (!currentSchool) return;
    fetchRiceStats();
    fetchRiceInventory();
  }, [currentSchool, riceDateRange, students]);

  // Subscribe to realtime updates for attendance_records
  useEffect(() => {
    if (!currentSchool || students.length === 0) return;

    const channel = supabase
      .channel('statistics-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `school_id=eq.${currentSchool.id}`,
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          // Refetch data when any attendance record changes
          fetchDailyData();
          fetchRiceStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchool, selectedDate, students.length]);

  const fetchBasicData = async () => {
    if (!currentSchool) return;
    
    try {
      const [classesRes, studentsRes] = await Promise.all([
        supabase
          .from('classes')
          .select('*')
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .order('grade', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('*, class:classes(*)')
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .eq('is_boarding', true)
          .order('full_name'),
      ]);

      setClasses((classesRes.data || []) as Class[]);
      setStudents((studentsRes.data || []).map(s => ({
        ...s,
        class: s.class as unknown as Class
      })) as Student[]);
    } catch (error) {
      console.error('Error fetching basic data:', error);
    }
  };

  const fetchDailyData = async () => {
    if (!currentSchool || students.length === 0 || classes.length === 0) {
      return;
    }
    setIsLoading(true);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // PARALLEL FETCH: Fetch each attendance type separately
      // Use ORDER BY created_at DESC to prioritize getting the LATEST reports first
      // This ensures we always get the most recent report even if hitting row limits
      const [boardingRes, studyRes, breakfastRes, lunchRes, dinnerRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr)
          .eq('attendance_type', 'boarding')
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('attendance_records')
          .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr)
          .eq('attendance_type', 'evening_study')
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('attendance_records')
          .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr)
          .eq('attendance_type', 'breakfast')
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('attendance_records')
          .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr)
          .eq('attendance_type', 'lunch')
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('attendance_records')
          .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
          .eq('school_id', currentSchool.id)
          .eq('attendance_date', dateStr)
          .eq('attendance_type', 'dinner')
          .order('created_at', { ascending: false })
          .limit(5000),
      ]);

      // Combine all records
      const allRecords = [
        ...(boardingRes.data || []),
        ...(studyRes.data || []),
        ...(breakfastRes.data || []),
        ...(lunchRes.data || []),
        ...(dinnerRes.data || []),
      ];
      
      // Debug: log the latest record from each type to verify correct fetching
      const latestBoarding = boardingRes.data?.[0];
      const latestStudy = studyRes.data?.[0];
      console.log('Statistics - Latest Boarding:', latestBoarding ? {
        reporter: (latestBoarding as any).reporter?.full_name,
        created_at: latestBoarding.created_at,
        count: boardingRes.data?.length
      } : 'No data');
      console.log('Statistics - Latest Evening Study:', latestStudy ? {
        reporter: (latestStudy as any).reporter?.full_name,
        created_at: latestStudy.created_at,
        count: studyRes.data?.length
      } : 'No data');

      // SIMPLIFIED LOGIC for Admin Statistics:
      // Show the LATEST REPORT based on the most recent created_at timestamp
      // A "report" is a batch of records submitted together by the same reporter
      
      const getLatestReport = (records: any[]) => {
        if (records.length === 0) return { records: [], reporter: null, reportTime: null };
        
        // Since data is already sorted by created_at DESC from the query,
        // the first record is the most recent
        const latestRecord = records[0];
        if (!latestRecord) return { records: [], reporter: null, reportTime: null };
        
        const latestTime = new Date(latestRecord.created_at || 0).getTime();
        const latestReporterId = latestRecord.reporter_id;
        
        // Get all records from the same reporter within 60 seconds of the latest record
        // This captures the entire "batch" of the latest report (larger schools need more time)
        const batchRecords = records.filter(r => {
          const recordTime = new Date(r.created_at || 0).getTime();
          const timeDiff = Math.abs(latestTime - recordTime);
          return r.reporter_id === latestReporterId && timeDiff <= 60000; // 60 seconds for large batches
        });
        
        console.log('getLatestReport:', {
          latestReporter: (latestRecord as any).reporter?.full_name,
          latestTime: latestRecord.created_at,
          batchSize: batchRecords.length,
          totalRecords: records.length
        });
        
        return { 
          records: batchRecords, 
          reporter: latestRecord,
          reportTime: latestRecord.created_at
        };
      };

      // Get latest report per CLASS per meal type (for meal statistics)
      const getLatestRecordsPerClass = (records: any[]) => {
        if (records.length === 0) return [];
        
        // Group by class_id and student_id, keep the latest record for each student
        const latestByStudent = new Map<string, any>();
        
        records.forEach(r => {
          const key = `${r.class_id || 'unknown'}-${r.student_id}`;
          const existing = latestByStudent.get(key);
          const currentTime = new Date(r.created_at || 0).getTime();
          
          if (!existing || currentTime > new Date(existing.created_at || 0).getTime()) {
            latestByStudent.set(key, r);
          }
        });
        
        return Array.from(latestByStudent.values());
      };

      // Process boarding report - show ONLY the latest report
      // Use directly from parallel fetch (boardingRes.data) instead of filtering allRecords
      const boardingRecords = boardingRes.data || [];
      const { records: latestBoardingRecords, reporter: latestBoardingReporter } = getLatestReport(boardingRecords);
      
      if (latestBoardingRecords.length > 0 && latestBoardingReporter) {
        // Count from the latest reporter's data only
        const absentRecords = latestBoardingRecords.filter(r => r.status === 'absent' || r.status === 'excused');
        const presentRecords = latestBoardingRecords.filter(r => r.status === 'present');
        
        const absentStudents: AbsentStudent[] = absentRecords.map(record => {
          const student = students.find(s => s.id === record.student_id);
          return {
            id: record.student_id,
            name: student?.full_name || 'N/A',
            className: student?.class?.name || 'Khác',
            classGrade: student?.class?.grade || 0,
            excused: record.status === 'excused',
            reason: record.excused_reason || '',
          };
        }).sort((a, b) => a.classGrade - b.classGrade || a.name.localeCompare(b.name, 'vi'));

        const reporterName = (latestBoardingReporter as any).reporter?.full_name || 'N/A';

        // Use total boarding students for consistency with Dashboard
        // Boarding students = students.length (query filters by is_boarding=true at line 296)
        const totalBoardingStudents = students.length;
        
        setLatestBoardingReport({
          date: dateStr,
          session: '',
          sessionLabel: 'Nội trú',
          reporter: reporterName,
          reportTime: format(new Date(latestBoardingReporter.created_at || new Date()), 'HH:mm dd/MM/yyyy'),
          total: totalBoardingStudents, // Total boarding students in school
          present: presentRecords.length,
          absent: absentRecords.length,
          absentStudents,
        });
      } else {
        setLatestBoardingReport(null);
      }

      // Process evening study report - show ONLY the latest report
      // Use directly from parallel fetch (studyRes.data) instead of filtering allRecords
      const studyRecords = studyRes.data || [];
      const { records: latestStudyRecords, reporter: latestStudyReporter } = getLatestReport(studyRecords);
      
      if (latestStudyRecords.length > 0 && latestStudyReporter) {
        // Count from the latest reporter's data only
        const absentRecords = latestStudyRecords.filter(r => r.status === 'absent' || r.status === 'excused');
        const presentRecords = latestStudyRecords.filter(r => r.status === 'present');
        
        const absentStudents: AbsentStudent[] = absentRecords.map(record => {
          const student = students.find(s => s.id === record.student_id);
          return {
            id: record.student_id,
            name: student?.full_name || 'N/A',
            className: student?.class?.name || 'Khác',
            classGrade: student?.class?.grade || 0,
            excused: record.status === 'excused',
            reason: record.excused_reason || '',
          };
        }).sort((a, b) => a.classGrade - b.classGrade || a.name.localeCompare(b.name, 'vi'));

        const reporterName = (latestStudyReporter as any).reporter?.full_name || 'N/A';

        // Use total student count for consistency with Dashboard
        // Present = students in report with status 'present'
        // Absent = total students - present (same logic as Dashboard)
        const totalStudentsCount = students.length;
        const absentCount = absentRecords.length;
        
        setLatestStudyReport({
          date: dateStr,
          session: '',
          sessionLabel: 'Tự học tối',
          reporter: reporterName,
          reportTime: format(new Date(latestStudyReporter.created_at || new Date()), 'HH:mm dd/MM/yyyy'),
          total: totalStudentsCount, // Total boarding students
          present: presentRecords.length,
          absent: absentCount,
          absentStudents,
        });
      } else {
        setLatestStudyReport(null);
      }

      // Process meal statistics
      const mealStats: DailyMealSummary = {
        breakfast: { total: 0, present: 0, absent: 0, absentStudents: [], classesNotReported: [], classReportInfos: [], hasReport: false },
        lunch: { total: 0, present: 0, absent: 0, absentStudents: [], classesNotReported: [], classReportInfos: [], hasReport: false },
        dinner: { total: 0, present: 0, absent: 0, absentStudents: [], classesNotReported: [], classReportInfos: [], hasReport: false },
        totalRice: 0,
      };

      const mealTypes: AttendanceType[] = ['breakfast', 'lunch', 'dinner'];
      const mealDataMap: Record<AttendanceType, any[]> = {
        'breakfast': breakfastRes.data || [],
        'lunch': lunchRes.data || [],
        'dinner': dinnerRes.data || [],
        'boarding': [],
        'evening_study': [],
      };
      
      for (const mealType of mealTypes) {
        const mealRecords = mealDataMap[mealType];
        // Use new logic: get latest records per class (aggregated from all class reports)
        const latestRecords = getLatestRecordsPerClass(mealRecords);
        
        if (latestRecords.length > 0) {
          const presentCount = latestRecords.filter(r => r.status === 'present').length;
          const absentRecords = latestRecords.filter(r => r.status !== 'present');
          
          // Find classes that haven't reported
          const classesWithReports = new Set(latestRecords.map(r => r.class_id).filter(Boolean));
          
          const classesNotReported = sortedClasses
            .filter(c => !classesWithReports.has(c.id))
            .filter(c => students.some(s => s.class_id === c.id))
            .map(c => c.name);

          // Calculate report count per class (how many times each class reported)
          const classReportInfos: ClassReportInfo[] = [];
          const classReportTracking = new Map<string, { timestamps: Set<string>; latestTime: string }>();
          
          mealRecords.forEach(r => {
            if (!r.class_id) return;
            const classId = r.class_id;
            const reportTime = r.created_at || '';
            // Use rounded time (to nearest minute) as unique identifier for a report session
            const roundedTime = reportTime ? reportTime.substring(0, 16) : '';
            
            if (!classReportTracking.has(classId)) {
              classReportTracking.set(classId, { timestamps: new Set(), latestTime: reportTime });
            }
            const tracking = classReportTracking.get(classId)!;
            tracking.timestamps.add(roundedTime);
            if (reportTime > tracking.latestTime) {
              tracking.latestTime = reportTime;
            }
          });
          
          classReportTracking.forEach((tracking, classId) => {
            const cls = sortedClasses.find(c => c.id === classId);
            if (cls) {
              classReportInfos.push({
                classId,
                className: cls.name,
                reportCount: tracking.timestamps.size,
                latestReportTime: tracking.latestTime,
              });
            }
          });
          
          // Sort by class grade
          classReportInfos.sort((a, b) => {
            const clsA = sortedClasses.find(c => c.id === a.classId);
            const clsB = sortedClasses.find(c => c.id === b.classId);
            return (clsA?.grade || 0) - (clsB?.grade || 0);
          });

          // Build absent students list sorted by class (for breakfast) or by class + meal group (for lunch/dinner)
          const absentStudents: AbsentStudent[] = absentRecords.map(record => {
            const student = students.find(s => s.id === record.student_id);
            return {
              id: record.student_id,
              name: student?.full_name || 'N/A',
              className: student?.class?.name || 'Khác',
              classGrade: student?.class?.grade || 0,
              excused: record.status === 'excused',
              reason: record.excused_reason || '',
              mealGroup: student?.meal_group || '',
            };
          });

          // Sort by class grade, then by meal group (for lunch/dinner), then by name
          absentStudents.sort((a, b) => {
            if (a.classGrade !== b.classGrade) return a.classGrade - b.classGrade;
            if (mealType !== 'breakfast' && a.mealGroup !== b.mealGroup) {
              return (a.mealGroup || '').localeCompare(b.mealGroup || '', 'vi');
            }
            return a.name.localeCompare(b.name, 'vi');
          });

          (mealStats as any)[mealType] = {
            total: latestRecords.length,
            present: presentCount,
            absent: absentRecords.length,
            absentStudents,
            classesNotReported,
            classReportInfos,
            hasReport: true,
          };
        } else {
          // No report - all classes haven't reported
          const allClassNames = sortedClasses
            .filter(c => students.some(s => s.class_id === c.id))
            .map(c => c.name);
          
          (mealStats as any)[mealType] = {
            total: students.length,
            present: 0,
            absent: 0,
            absentStudents: [],
            classesNotReported: allClassNames,
            classReportInfos: [],
            hasReport: false,
          };
        }
      }

      // Calculate total rice for lunch and dinner
      mealStats.totalRice = ((mealStats.lunch as MealStats).present + (mealStats.dinner as MealStats).present) * 0.2;

      setDailyMealStats(mealStats);
    } catch (error) {
      console.error('Error fetching daily data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRiceStats = async () => {
    if (!currentSchool || students.length === 0) return;
    setIsLoadingRice(true);

    try {
      const startDate = format(riceDateRange.start, 'yyyy-MM-dd');
      const endDate = format(riceDateRange.end, 'yyyy-MM-dd');

      const { data: records } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['lunch', 'dinner'])
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate);

      const allRecords = records || [];
      const days = eachDayOfInterval({ start: riceDateRange.start, end: riceDateRange.end });

      // Get latest report per date per meal
      const latestByKey = new Map<string, any>();
      allRecords.forEach((record: any) => {
        const key = `${record.attendance_date}-${record.attendance_type}-${record.student_id}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByKey.set(key, record);
        }
      });

      // Calculate rice per day
      const dailyRice: { date: string; rice: number }[] = [];
      let totalRice = 0;

      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        let dayPresent = 0;

        students.forEach(student => {
          const lunchKey = `${dateStr}-lunch-${student.id}`;
          const dinnerKey = `${dateStr}-dinner-${student.id}`;
          
          const lunchRecord = latestByKey.get(lunchKey);
          const dinnerRecord = latestByKey.get(dinnerKey);

          if (lunchRecord?.status === 'present') dayPresent++;
          if (dinnerRecord?.status === 'present') dayPresent++;
        });

        const dayRice = dayPresent * 0.2;
        totalRice += dayRice;
        dailyRice.push({ date: dateStr, rice: dayRice });
      });

      setRiceStats(dailyRice);
      setTotalRiceInRange(totalRice);
    } catch (error) {
      console.error('Error fetching rice stats:', error);
    } finally {
      setIsLoadingRice(false);
    }
  };

  const fetchRiceInventory = async () => {
    if (!currentSchool) return;

    try {
      const { data, error } = await supabase
        .from('rice_inventory')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRiceInventory(data || []);
    } catch (error) {
      console.error('Error fetching rice inventory:', error);
    }
  };

  const totalRiceAdded = useMemo(() => {
    return riceInventory.reduce((sum, item) => sum + Number(item.amount), 0);
  }, [riceInventory]);

  const remainingRice = useMemo(() => {
    return totalRiceAdded - totalRiceInRange;
  }, [totalRiceAdded, totalRiceInRange]);

  const handleAddRice = async () => {
    if (!currentSchool || !user || !newRiceAmount) return;
    
    const amount = parseFloat(newRiceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập số lượng gạo hợp lệ',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingRice(true);
    try {
      const { error } = await supabase
        .from('rice_inventory')
        .insert({
          school_id: currentSchool.id,
          amount,
          notes: newRiceNotes || null,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: `Đã thêm ${amount} kg gạo vào kho`,
      });

      setNewRiceAmount('');
      setNewRiceNotes('');
      setShowAddRiceForm(false);
      fetchRiceInventory();
    } catch (error) {
      console.error('Error adding rice:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể thêm gạo vào kho',
        variant: 'destructive',
      });
    } finally {
      setIsAddingRice(false);
    }
  };

  const handleDeleteRice = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa mục này?')) return;

    try {
      const { error } = await supabase
        .from('rice_inventory')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Thành công',
        description: 'Đã xóa mục gạo',
      });

      fetchRiceInventory();
    } catch (error) {
      console.error('Error deleting rice:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa mục gạo',
        variant: 'destructive',
      });
    }
  };

  // Handler to open absent by meal group dialog
  const handleExportAbsentByMealGroup = useCallback(() => {
    if (!currentSchool || !dailyMealStats) return;
    setShareAbsentByMealGroupDialogOpen(true);
  }, [currentSchool, dailyMealStats]);

  // Handler to export daily meal stats to Excel
  const handleExportDailyMealExcel = useCallback(async () => {
    if (!currentSchool || filteredStudents.length === 0) return;
    setIsExporting(true);

    try {
      // CRITICAL FIX: Query ALL meal records for the school/date, then filter by student IDs client-side
      // This avoids issues with large IN clauses and ensures data integrity
      const studentIdSet = new Set(filteredStudents.map(s => s.id));
      
      const { data: allRecords, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .eq('attendance_date', format(selectedDate, 'yyyy-MM-dd'))
        .limit(20000);

      if (error) {
        console.error('Error fetching records:', error);
        throw error;
      }

      // Filter to only include records for students in our filtered list
      const records = (allRecords || []).filter(r => studentIdSet.has(r.student_id));
      
      console.log(`[Excel Export] Total records fetched: ${allRecords?.length || 0}, After filtering: ${records.length}, Students: ${filteredStudents.length}`);

      // Get latest report per student/date/meal - CRITICAL: include date in key for multi-day exports
      const latestByKey = new Map<string, any>();
      (records || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}-${record.attendance_type}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByKey.set(key, record);
        }
      });

      // Build student data
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const studentData: MealStudentData[] = filteredStudents.map(student => {
        const bRecord = latestByKey.get(`${student.id}-${dateStr}-breakfast`);
        const lRecord = latestByKey.get(`${student.id}-${dateStr}-lunch`);
        const dRecord = latestByKey.get(`${student.id}-${dateStr}-dinner`);

        const attendanceMap = new Map<string, { breakfast: boolean | null; lunch: boolean | null; dinner: boolean | null }>();
        attendanceMap.set(dateStr, {
          breakfast: bRecord ? bRecord.status === 'present' : null,
          lunch: lRecord ? lRecord.status === 'present' : null,
          dinner: dRecord ? dRecord.status === 'present' : null,
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
        dateRange: getDateRange(selectedDate, 'day'),
        reporterName: profile?.full_name,
        exportTime: new Date(),
      });

      toast({
        title: 'Thành công',
        description: 'Đã xuất thống kê bữa ăn ra Excel',
      });
    } catch (error) {
      console.error('Error exporting daily meal stats:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xuất file Excel',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [currentSchool, filteredStudents, selectedDate, profile, toast]);

  const handleExportMealStats = async () => {
    if (!currentSchool || filteredStudents.length === 0) return;
    setIsExporting(true);

    try {
      const days = eachDayOfInterval({ start: riceDateRange.start, end: riceDateRange.end });

      // CRITICAL FIX: Query ALL meal records for the school/date range, then filter by student IDs client-side
      // This avoids issues with large IN clauses and ensures data integrity
      const studentIdSet = new Set(filteredStudents.map(s => s.id));
      
      const { data: allRecords, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', format(riceDateRange.start, 'yyyy-MM-dd'))
        .lte('attendance_date', format(riceDateRange.end, 'yyyy-MM-dd'))
        .limit(100000);

      if (error) {
        console.error('Error fetching records:', error);
        throw error;
      }

      // Filter to only include records for students in our filtered list
      const records = (allRecords || []).filter(r => studentIdSet.has(r.student_id));
      
      console.log(`[Excel Export Range] Total records fetched: ${allRecords?.length || 0}, After filtering: ${records.length}, Students: ${filteredStudents.length}`);

      // Get latest report per meal/date/student
      const latestByKey = new Map<string, any>();
      (records || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}-${record.attendance_type}`;
        const existing = latestByKey.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByKey.set(key, record);
        }
      });

      // Build student data - use filteredStudents for class teachers
      const studentData: MealStudentData[] = filteredStudents.map(student => {
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

      // For class teachers, include class name in the title
      const exportTitle = teacherClassName 
        ? `THỐNG KÊ BỮA ĂN LỚP ${teacherClassName}`
        : 'THỐNG KÊ BỮA ĂN HỌC SINH NỘI TRÚ';

      exportMealStatistics(studentData, {
        schoolName: currentSchool.name,
        title: exportTitle,
        dateRange: riceDateRange,
        reporterName: profile?.full_name,
        exportTime: new Date(),
      });
    } catch (error) {
      console.error('Error exporting meal stats:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Export single meal type to Excel
  const handleExportSingleMealExcel = useCallback(async (mealType: AttendanceType) => {
    if (!currentSchool || filteredStudents.length === 0) return;
    setIsExportingSingleMeal(mealType);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const studentIdSet = new Set(filteredStudents.map(s => s.id));

      const { data: allRecords, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('attendance_type', mealType)
        .eq('attendance_date', dateStr)
        .limit(20000);

      if (error) {
        console.error('Error fetching records:', error);
        throw error;
      }

      // Filter to only include records for students in our filtered list
      const records = (allRecords || []).filter(r => studentIdSet.has(r.student_id));

      console.log(`[Single Meal Export] ${mealType} - Total fetched: ${allRecords?.length || 0}, After filtering: ${records.length}`);

      // Get latest report per student
      const latestByKey = new Map<string, any>();
      records.forEach((record: any) => {
        const key = record.student_id;
        const existing = latestByKey.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByKey.set(key, record);
        }
      });

      // Build student data
      const studentData: MealStudentData[] = filteredStudents.map(student => {
        const record = latestByKey.get(student.id);
        const attendanceMap = new Map<string, { breakfast: boolean | null; lunch: boolean | null; dinner: boolean | null }>();
        
        attendanceMap.set(dateStr, {
          breakfast: mealType === 'breakfast' ? (record ? record.status === 'present' : null) : null,
          lunch: mealType === 'lunch' ? (record ? record.status === 'present' : null) : null,
          dinner: mealType === 'dinner' ? (record ? record.status === 'present' : null) : null,
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

      const mealLabel = mealType === 'breakfast' ? 'SÁNG' : mealType === 'lunch' ? 'TRƯA' : 'TỐI';

      exportMealStatistics(studentData, {
        schoolName: currentSchool.name,
        title: `THỐNG KÊ BỮA ${mealLabel} - ${format(selectedDate, 'dd/MM/yyyy')}`,
        dateRange: getDateRange(selectedDate, 'day'),
        reporterName: profile?.full_name,
        exportTime: new Date(),
      });

      toast({
        title: 'Thành công',
        description: `Đã xuất thống kê bữa ${mealLabel.toLowerCase()} ra Excel`,
      });
    } catch (error) {
      console.error('Error exporting single meal stats:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể xuất file Excel',
        variant: 'destructive',
      });
    } finally {
      setIsExportingSingleMeal(null);
    }
  }, [currentSchool, filteredStudents, selectedDate, profile, toast]);

  const renderMealSection = (
    mealType: 'breakfast' | 'lunch' | 'dinner',
    stats: MealStats,
    title: string,
    icon: typeof UtensilsCrossed
  ) => {
    const Icon = icon;
    const isExpanded = expandedSections[mealType];
    const isDeadlineExpired = isMealDeadlineExpired(mealType, selectedDate);
    const hasUnreportedClasses = stats.classesNotReported.length > 0;
    const isFinalizingThisMeal = isFinalizingMeal === mealType;

    // Group absent students by class
    const groupedByClass = new Map<string, AbsentStudent[]>();
    stats.absentStudents.forEach(student => {
      if (!groupedByClass.has(student.className)) {
        groupedByClass.set(student.className, []);
      }
      groupedByClass.get(student.className)!.push(student);
    });

    // For lunch/dinner, also group by meal group
    const groupedByMealGroup = new Map<string, AbsentStudent[]>();
    if (mealType !== 'breakfast') {
      stats.absentStudents.forEach(student => {
        const group = student.mealGroup || 'Chưa phân mâm';
        if (!groupedByMealGroup.has(group)) {
          groupedByMealGroup.set(group, []);
        }
        groupedByMealGroup.get(group)!.push(student);
      });
    }

    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Show Finalize button when: deadline expired + has unreported classes + user can supplement + not class teacher */}
              {!isClassTeacher && canSupplementReports && isDeadlineExpired && hasUnreportedClasses && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleFinalizeMeal(mealType, stats.classesNotReported)}
                  disabled={isFinalizingThisMeal}
                >
                  {isFinalizingThisMeal ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  Chốt ({stats.classesNotReported.length} lớp)
                </Button>
              )}
              {stats.hasReport && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleExportSingleMealExcel(mealType)}
                  disabled={isExportingSingleMeal === mealType}
                >
                  {isExportingSingleMeal === mealType ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3 w-3" />
                  )}
                  Xuất Excel
                </Button>
              )}
              {stats.hasReport ? (
                <Badge variant="default" className="bg-success">Đã báo cáo</Badge>
              ) : (
                <Badge variant="destructive">Chưa báo cáo</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stats.hasReport ? (
            <div className="space-y-3">
              {/* Classes that reported - show with report count */}
              {!isClassTeacher && stats.classReportInfos.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {stats.classReportInfos.map(info => (
                    <Badge 
                      key={info.classId} 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        info.reportCount > 1 && "border-warning text-warning bg-warning/10"
                      )}
                    >
                      {info.className}
                      {info.reportCount > 1 && (
                        <span className="ml-1 font-semibold">(Lần {info.reportCount})</span>
                      )}
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-xs text-muted-foreground">Tổng</div>
                  <div className="text-lg font-bold">{stats.total}</div>
                </div>
                <div className="rounded-lg bg-success/10 p-2">
                  <div className="text-xs text-success">Ăn</div>
                  <div className="text-lg font-bold text-success">{stats.present}</div>
                </div>
                <div className="rounded-lg bg-destructive/10 p-2">
                  <div className="text-xs text-destructive">Vắng</div>
                  <div className="text-lg font-bold text-destructive">{stats.absent}</div>
                </div>
              </div>

              {/* Absent students */}
              {stats.absent > 0 && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => toggleSection(mealType)}
                  >
                    <span className="text-sm font-medium">Danh sách vắng ({stats.absent})</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  
                  {isExpanded && (
                    <div className="mt-2 max-h-60 space-y-2 overflow-y-auto rounded-lg border p-2">
                      {mealType === 'breakfast' ? (
                        // Breakfast: group by class only
                        Array.from(groupedByClass.entries())
                          .sort((a, b) => {
                            const gradeA = a[1][0]?.classGrade || 0;
                            const gradeB = b[1][0]?.classGrade || 0;
                            return gradeA - gradeB;
                          })
                          .map(([className, students]) => (
                            <div key={className} className="rounded bg-muted/50 p-2">
                              <div className="mb-1 text-xs font-medium text-muted-foreground">
                                Lớp {className} ({students.length})
                              </div>
                              <div className="space-y-1">
                                {students.map(s => (
                                  <div key={s.id} className="flex items-center gap-2 text-sm">
                                    <span>{s.name}</span>
                                    {s.mealGroup && (
                                      <span className="text-xs text-muted-foreground">
                                        ({s.mealGroup})
                                      </span>
                                    )}
                                    {s.excused && (
                                      <Badge variant="outline" className="text-xs">P</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                      ) : (
                        // Lunch/Dinner: group by class then by meal group
                        <>
                          <div className="mb-2 text-xs font-semibold text-muted-foreground">Theo lớp:</div>
                          {Array.from(groupedByClass.entries())
                            .sort((a, b) => {
                              const gradeA = a[1][0]?.classGrade || 0;
                              const gradeB = b[1][0]?.classGrade || 0;
                              return gradeA - gradeB;
                            })
                            .map(([className, students]) => (
                              <div key={className} className="rounded bg-muted/50 p-2">
                                <div className="mb-1 text-xs font-medium text-muted-foreground">
                                  Lớp {className} ({students.length})
                                </div>
                                <div className="space-y-1">
                                  {students.map(s => (
                                    <div key={s.id} className="flex items-center gap-2 text-sm">
                                      <span>{s.name}</span>
                                      {s.mealGroup && (
                                        <span className="text-xs text-muted-foreground">
                                          ({s.mealGroup})
                                        </span>
                                      )}
                                      {s.excused && (
                                        <Badge variant="outline" className="text-xs">P</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          
                          <div className="mt-3 border-t pt-2">
                            <div className="mb-2 text-xs font-semibold text-muted-foreground">Theo mâm ăn:</div>
                            {Array.from(groupedByMealGroup.entries())
                              .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
                              .map(([mealGroup, students]) => (
                                <div key={mealGroup} className="rounded bg-muted/50 p-2">
                                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                                    Mâm {mealGroup} ({students.length})
                                  </div>
                                  <div className="space-y-1">
                                    {students.map(s => (
                                      <div key={s.id} className="flex items-center gap-2 text-sm">
                                        <span>{s.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          ({s.className})
                                        </span>
                                        {s.excused && (
                                          <Badge variant="outline" className="text-xs">P</Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Chưa có báo cáo cho bữa này
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!currentSchool) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn trường để tiếp tục</p>
      </div>
    );
  }

  // For class teachers, render dedicated class meal statistics view
  if (isClassTeacher && teacherClassId && teacherClassName) {
    return (
      <div className="content-wrapper animate-fade-in">
        <ClassMealStatistics
          students={students}
          classes={classes}
          teacherClassId={teacherClassId}
          teacherClassName={teacherClassName}
        />
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
          Báo cáo điểm danh và thống kê bữa ăn theo ngày
        </p>
      </div>

      {/* Date Selector */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <span className="text-sm font-medium">Chọn ngày:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'dd/MM/yyyy')}
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
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className={`grid w-full ${isClassTeacher ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            {!isClassTeacher && <TabsTrigger value="rice">Thống kê gạo</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Boarding and Evening Study - only for non-class teachers */}
            {!isClassTeacher && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Latest Boarding Report */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Home className="h-5 w-5 text-primary" />
                        Điểm danh nội trú gần nhất
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => fetchDailyData()}
                        disabled={isLoading}
                      >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {latestBoardingReport ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Người báo:</span>
                          <span className="font-medium">{latestBoardingReport.reporter}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Thời gian:</span>
                          <span>{latestBoardingReport.reportTime}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-muted p-2">
                            <div className="text-xs text-muted-foreground">Tổng</div>
                            <div className="text-lg font-bold">{latestBoardingReport.total}</div>
                          </div>
                          <div className="rounded-lg bg-success/10 p-2">
                            <div className="text-xs text-success">Có mặt</div>
                            <div className="text-lg font-bold text-success">{latestBoardingReport.present}</div>
                          </div>
                          <div className="rounded-lg bg-destructive/10 p-2">
                            <div className="text-xs text-destructive">Vắng</div>
                            <div className="text-lg font-bold text-destructive">{latestBoardingReport.absent}</div>
                          </div>
                        </div>
                        {latestBoardingReport.absent > 0 && (
                          <div className="rounded-lg border p-2">
                            <div className="mb-1 text-xs font-medium text-muted-foreground">
                              Học sinh vắng:
                            </div>
                            <div className="max-h-32 space-y-1 overflow-y-auto text-sm">
                              {latestBoardingReport.absentStudents.map(s => (
                                <div key={s.id} className="flex items-center gap-2">
                                  <span>{s.name}</span>
                                  <span className="text-xs text-muted-foreground">({s.className})</span>
                                  {s.excused && <Badge variant="outline" className="text-xs">P</Badge>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Chưa có báo cáo ngày này
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Latest Evening Study Report */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Điểm danh tự học gần nhất
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => fetchDailyData()}
                        disabled={isLoading}
                      >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {latestStudyReport ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Người báo:</span>
                          <span className="font-medium">{latestStudyReport.reporter}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Thời gian:</span>
                          <span>{latestStudyReport.reportTime}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-muted p-2">
                            <div className="text-xs text-muted-foreground">Tổng</div>
                            <div className="text-lg font-bold">{latestStudyReport.total}</div>
                          </div>
                          <div className="rounded-lg bg-success/10 p-2">
                            <div className="text-xs text-success">Có mặt</div>
                            <div className="text-lg font-bold text-success">{latestStudyReport.present}</div>
                          </div>
                          <div className="rounded-lg bg-destructive/10 p-2">
                            <div className="text-xs text-destructive">Vắng</div>
                            <div className="text-lg font-bold text-destructive">{latestStudyReport.absent}</div>
                          </div>
                        </div>
                        {latestStudyReport.absent > 0 && (
                          <div className="rounded-lg border p-2">
                            <div className="mb-1 text-xs font-medium text-muted-foreground">
                              Học sinh vắng:
                            </div>
                            <div className="max-h-32 space-y-1 overflow-y-auto text-sm">
                              {latestStudyReport.absentStudents.map(s => (
                                <div key={s.id} className="flex items-center gap-2">
                                  <span>{s.name}</span>
                                  <span className="text-xs text-muted-foreground">({s.className})</span>
                                  {s.excused && <Badge variant="outline" className="text-xs">P</Badge>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Chưa có báo cáo ngày này
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Daily Meal Stats */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  {isClassTeacher && teacherClassName 
                    ? `Báo cơm lớp ${teacherClassName} - ${format(selectedDate, 'dd/MM/yyyy')}`
                    : `Báo cơm cả trường - ${format(selectedDate, 'dd/MM/yyyy')}`
                  }
                </h2>
                {filteredMealStats && (filteredMealStats.breakfast.hasReport || filteredMealStats.lunch.hasReport || filteredMealStats.dinner.hasReport) && !isClassTeacher && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Xuất báo cáo
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start"
                          onClick={() => setShareMealDialogOpen(true)}
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Xuất ảnh thống kê
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start"
                          onClick={() => handleExportAbsentByMealGroup()}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          DS vắng theo mâm
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start"
                          onClick={() => handleExportDailyMealExcel()}
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Xuất Excel
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {filteredMealStats && (
                <>
                  {renderMealSection('breakfast', filteredMealStats.breakfast as MealStats, 'Bữa sáng', UtensilsCrossed)}
                  {renderMealSection('lunch', filteredMealStats.lunch as MealStats, 'Bữa trưa', UtensilsCrossed)}
                  {renderMealSection('dinner', filteredMealStats.dinner as MealStats, 'Bữa tối', UtensilsCrossed)}

                  {/* Classes not reported - only show for admins */}
                  {!isClassTeacher && (() => {
                    const allNotReported = new Set([
                      ...((dailyMealStats?.breakfast as MealStats)?.classesNotReported || []),
                      ...((dailyMealStats?.lunch as MealStats)?.classesNotReported || []),
                      ...((dailyMealStats?.dinner as MealStats)?.classesNotReported || []),
                    ]);

                    if (allNotReported.size > 0) {
                      return (
                        <Card className="border-warning/50 bg-warning/5">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="flex items-center gap-2 text-base text-warning">
                                <AlertCircle className="h-5 w-5" />
                                Lớp chưa báo cáo
                              </CardTitle>
                              <Badge variant="outline" className="text-warning">
                                {allNotReported.size} lớp
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-between"
                              onClick={() => toggleSection('notReported')}
                            >
                              <span className="text-sm">Xem chi tiết</span>
                              {expandedSections.notReported ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            
                            {expandedSections.notReported && dailyMealStats && (
                              <div className="mt-2 space-y-2">
                                {['breakfast', 'lunch', 'dinner'].map(meal => {
                                  const stats = dailyMealStats[meal as keyof DailyMealSummary] as MealStats;
                                  const notReported = stats?.classesNotReported || [];
                                  const mealLabel = meal === 'breakfast' ? 'Sáng' : meal === 'lunch' ? 'Trưa' : 'Tối';
                                  
                                  if (notReported.length === 0) return null;
                                  
                                  return (
                                    <div key={meal} className="rounded bg-muted/50 p-2">
                                      <div className="mb-1 text-xs font-medium">
                                        {mealLabel}: {notReported.length} lớp
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {notReported.map(className => (
                                          <Badge key={className} variant="secondary" className="text-xs">
                                            {className}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    }
                    return null;
                  })()}

                  {/* Total rice for the day */}
                  <Card className="mt-4 bg-primary/5">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {isClassTeacher && teacherClassName 
                            ? `Tổng gạo lớp ${teacherClassName} trong ngày`
                            : 'Tổng gạo cần ăn trong ngày'
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">
                          (Trưa: {(filteredMealStats.lunch as MealStats).present} + Tối: {(filteredMealStats.dinner as MealStats).present}) × 0.2kg
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {filteredMealStats.totalRice.toFixed(1)} kg
                        </div>
                        <div className="text-xs text-muted-foreground">
                          (Trưa: {((filteredMealStats.lunch as MealStats).present * 0.2).toFixed(1)}kg / Tối: {((filteredMealStats.dinner as MealStats).present * 0.2).toFixed(1)}kg)
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rice" className="space-y-4">
            {/* Rice Inventory Card */}
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5 text-success" />
                    Gạo đang có
                  </CardTitle>
                  {canSupplementReports && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddRiceForm(!showAddRiceForm)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Nhập gạo
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-success/10 p-3 text-center">
                    <div className="text-xs text-muted-foreground">Tổng nhập</div>
                    <div className="text-xl font-bold text-success">{totalRiceAdded.toFixed(1)} kg</div>
                  </div>
                  <div className="rounded-lg bg-destructive/10 p-3 text-center">
                    <div className="text-xs text-muted-foreground">Đã dùng ({riceDateRange.label.toLowerCase()})</div>
                    <div className="text-xl font-bold text-destructive">{totalRiceInRange.toFixed(1)} kg</div>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${remainingRice >= 0 ? 'bg-primary/10' : 'bg-warning/10'}`}>
                    <div className="text-xs text-muted-foreground">Còn lại</div>
                    <div className={`text-xl font-bold ${remainingRice >= 0 ? 'text-primary' : 'text-warning'}`}>
                      {remainingRice.toFixed(1)} kg
                    </div>
                  </div>
                </div>

                {/* Add rice form */}
                {showAddRiceForm && canSupplementReports && (
                  <div className="rounded-lg border bg-background p-4 space-y-3">
                    <div className="text-sm font-medium">Nhập gạo mới</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Số lượng (kg) *</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="Nhập số kg"
                          value={newRiceAmount}
                          onChange={(e) => setNewRiceAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Ghi chú</label>
                        <Input
                          placeholder="VD: Nhập kho tháng 1"
                          value={newRiceNotes}
                          onChange={(e) => setNewRiceNotes(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddRiceForm(false);
                          setNewRiceAmount('');
                          setNewRiceNotes('');
                        }}
                      >
                        Hủy
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddRice}
                        disabled={isAddingRice || !newRiceAmount}
                      >
                        {isAddingRice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Lưu
                      </Button>
                    </div>
                  </div>
                )}

                {/* Inventory history */}
                {riceInventory.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Lịch sử nhập gạo</div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {riceInventory.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded bg-muted/50 p-2 text-sm"
                        >
                          <div className="flex-1">
                            <span className="font-medium text-success">+{Number(item.amount).toFixed(1)} kg</span>
                            {item.notes && (
                              <span className="ml-2 text-muted-foreground">- {item.notes}</span>
                            )}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')})
                            </span>
                          </div>
                          {canSupplementReports && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteRice(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rice Statistics Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Thống kê gạo đã ăn
                </CardTitle>
                <CardDescription>
                  Thống kê lượng gạo tiêu thụ theo ngày, tuần hoặc tháng
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Date range selector */}
                <div className="flex flex-wrap items-center gap-4">
                  <Select value={riceRangeType} onValueChange={(v) => setRiceRangeType(v as DateRangeType)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Ngày</SelectItem>
                      <SelectItem value="week">Tuần</SelectItem>
                      <SelectItem value="month">Tháng</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[180px]">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {riceDateRange.label}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={riceDate}
                        onSelect={(d) => d && setRiceDate(d)}
                        locale={vi}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="outline"
                    onClick={handleExportMealStats}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                    )}
                    Xuất Excel
                  </Button>
                </div>

                {/* Summary */}
                <Card className="bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Tổng gạo đã dùng {riceDateRange.label.toLowerCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          (Bữa trưa + Bữa tối × 0.2kg/học sinh)
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-primary">
                        {isLoadingRice ? (
                          <Loader2 className="h-8 w-8 animate-spin" />
                        ) : (
                          `${totalRiceInRange.toFixed(1)} kg`
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Daily breakdown */}
                {!isLoadingRice && riceRangeType !== 'day' && riceStats.length > 0 && (
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="p-2 text-left font-medium">Ngày</th>
                          <th className="p-2 text-right font-medium">Gạo (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riceStats.map((item, idx) => (
                          <tr key={item.date} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                            <td className="p-2">{format(new Date(item.date), 'EEEE, dd/MM/yyyy', { locale: vi })}</td>
                            <td className="p-2 text-right font-medium">{item.rice.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t bg-primary/10 font-bold">
                        <tr>
                          <td className="p-2">Tổng cộng</td>
                          <td className="p-2 text-right">{totalRiceInRange.toFixed(1)} kg</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Share Meal Report Dialog */}
      {dailyMealStats && currentSchool && (
        <ShareMealReportDialog
          open={shareMealDialogOpen}
          onOpenChange={setShareMealDialogOpen}
          schoolName={currentSchool.name}
          date={selectedDate}
          reporter={profile?.full_name || 'N/A'}
          breakfast={dailyMealStats.breakfast as MealStats}
          lunch={dailyMealStats.lunch as MealStats}
          dinner={dailyMealStats.dinner as MealStats}
          totalRice={dailyMealStats.totalRice}
          lunchRice={(dailyMealStats.lunch as MealStats).present * 0.2}
          dinnerRice={(dailyMealStats.dinner as MealStats).present * 0.2}
        />
      )}

      {/* Share Absent By Meal Group Dialog */}
      {dailyMealStats && currentSchool && (
        <ShareAbsentByMealGroupDialog
          open={shareAbsentByMealGroupDialogOpen}
          onOpenChange={setShareAbsentByMealGroupDialogOpen}
          schoolName={currentSchool.name}
          date={selectedDate}
          reporter={profile?.full_name || 'N/A'}
          breakfastAbsent={(dailyMealStats.breakfast as MealStats).absentStudents}
          lunchAbsent={(dailyMealStats.lunch as MealStats).absentStudents}
          dinnerAbsent={(dailyMealStats.dinner as MealStats).absentStudents}
        />
      )}
    </div>
  );
}
