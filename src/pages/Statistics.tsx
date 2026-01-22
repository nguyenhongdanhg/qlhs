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
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Student, Class, AttendanceType, AttendanceStatus } from '@/types';
import { DateRangeType, getDateRange, exportMealStatistics, MealStudentData } from '@/lib/excel-export';
import { ShareMealReportDialog } from '@/components/attendance/ShareMealReportDialog';
import { SupplementMealReportDialog } from '@/components/attendance/SupplementMealReportDialog';
import { useToast } from '@/hooks/use-toast';
import { ClassMealStatistics } from '@/components/statistics/ClassMealStatistics';

interface AbsentStudent {
  id: string;
  name: string;
  className: string;
  classGrade: number;
  excused: boolean;
  reason: string;
  mealGroup?: string;
}

interface MealStats {
  total: number;
  present: number;
  absent: number;
  absentStudents: AbsentStudent[];
  classesNotReported: string[];
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
  
  // Rice inventory
  const [riceInventory, setRiceInventory] = useState<{ id: string; amount: number; notes: string; created_at: string }[]>([]);
  const [newRiceAmount, setNewRiceAmount] = useState('');
  const [newRiceNotes, setNewRiceNotes] = useState('');
  const [isAddingRice, setIsAddingRice] = useState(false);
  const [showAddRiceForm, setShowAddRiceForm] = useState(false);
  
  // Share meal report dialog
  const [shareMealDialogOpen, setShareMealDialogOpen] = useState(false);
  
  // Supplement meal report dialog
  const [supplementDialogOpen, setSupplementDialogOpen] = useState(false);
  const [supplementMealType, setSupplementMealType] = useState<AttendanceType>('breakfast');
  const [isSavingSupplement, setIsSavingSupplement] = useState(false);

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
  const filteredMealStats = useMemo((): DailyMealSummary | null => {
    if (!dailyMealStats) return null;
    
    // If not a class teacher, return all stats
    if (!isClassTeacher || !teacherClassName) return dailyMealStats;
    
    // Filter meal stats for class teacher's class
    const filterMealForClass = (stats: MealStats): MealStats => {
      const classAbsentStudents = stats.absentStudents.filter(s => s.className === teacherClassName);
      const classTotal = filteredStudents.length;
      
      if (!stats.hasReport) {
        return {
          ...stats,
          total: classTotal,
          classesNotReported: stats.classesNotReported.filter(c => c === teacherClassName),
        };
      }
      
      // Calculate class-specific counts from attendance records
      const classPresent = classTotal - classAbsentStudents.length;
      
      return {
        total: classTotal,
        present: classPresent,
        absent: classAbsentStudents.length,
        absentStudents: classAbsentStudents,
        classesNotReported: stats.classesNotReported.filter(c => c === teacherClassName),
        hasReport: stats.hasReport,
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

      // Fetch all attendance records for the date
      const { data: records } = await supabase
        .from('attendance_records')
        .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name)')
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr);

      const allRecords = records || [];

      // NEW LOGIC: Get latest report per CLASS per meal type
      // This aggregates reports from all class teachers, taking the latest report for each class
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

      // Helper function to get latest report batch for boarding/study (single reporter for whole school)
      const getLatestReportBatch = (records: any[]) => {
        if (records.length === 0) return [];
        
        // Group records by reporter_id and find the latest session per reporter
        const reporterSessions: Map<string, { reporter: string; maxTime: number; minTime: number }> = new Map();
        
        records.forEach(r => {
          const reporterId = r.reporter_id || 'unknown';
          const time = new Date(r.created_at || 0).getTime();
          const existing = reporterSessions.get(reporterId);
          
          if (!existing) {
            reporterSessions.set(reporterId, { 
              reporter: reporterId, 
              maxTime: time, 
              minTime: time 
            });
          } else {
            if (time > existing.maxTime) existing.maxTime = time;
            if (time < existing.minTime) existing.minTime = time;
          }
        });
        
        // Find the reporter with the latest max time
        let latestReporter = '';
        let latestMaxTime = 0;
        reporterSessions.forEach((session, reporterId) => {
          if (session.maxTime > latestMaxTime) {
            latestMaxTime = session.maxTime;
            latestReporter = reporterId;
          }
        });
        
        // Get all records from the latest reporter
        return records.filter(r => (r.reporter_id || 'unknown') === latestReporter);
      };

      // Process boarding report (latest reporter batch)
      const boardingRecords = allRecords.filter(r => r.attendance_type === 'boarding');
      const latestBoardingRecords = getLatestReportBatch(boardingRecords);
      
      if (latestBoardingRecords.length > 0) {
        const presentCount = latestBoardingRecords.filter(r => r.status === 'present').length;
        const absentRecords = latestBoardingRecords.filter(r => r.status === 'absent' || r.status === 'excused');
        
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

        // Find the most recent record for time display
        const sortedByTime = [...latestBoardingRecords].sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        setLatestBoardingReport({
          date: dateStr,
          session: '',
          sessionLabel: 'Nội trú',
          reporter: (sortedByTime[0] as any).reporter?.full_name || 'N/A',
          reportTime: format(new Date(sortedByTime[0].created_at || new Date()), 'HH:mm dd/MM/yyyy'),
          total: latestBoardingRecords.length,
          present: presentCount,
          absent: absentRecords.length,
          absentStudents,
        });
      } else {
        setLatestBoardingReport(null);
      }

      // Process evening study report (latest reporter batch)
      const studyRecords = allRecords.filter(r => r.attendance_type === 'evening_study');
      const latestStudyRecords = getLatestReportBatch(studyRecords);
      
      if (latestStudyRecords.length > 0) {
        const presentCount = latestStudyRecords.filter(r => r.status === 'present').length;
        const absentRecords = latestStudyRecords.filter(r => r.status === 'absent' || r.status === 'excused');
        
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

        const sortedByTime = [...latestStudyRecords].sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        setLatestStudyReport({
          date: dateStr,
          session: '',
          sessionLabel: 'Tự học tối',
          reporter: (sortedByTime[0] as any).reporter?.full_name || 'N/A',
          reportTime: format(new Date(sortedByTime[0].created_at || new Date()), 'HH:mm dd/MM/yyyy'),
          total: latestStudyRecords.length,
          present: presentCount,
          absent: absentRecords.length,
          absentStudents,
        });
      } else {
        setLatestStudyReport(null);
      }

      // Process meal statistics
      const mealStats: DailyMealSummary = {
        breakfast: { total: 0, present: 0, absent: 0, absentStudents: [], classesNotReported: [], hasReport: false },
        lunch: { total: 0, present: 0, absent: 0, absentStudents: [], classesNotReported: [], hasReport: false },
        dinner: { total: 0, present: 0, absent: 0, absentStudents: [], classesNotReported: [], hasReport: false },
        totalRice: 0,
      };

      const mealTypes: AttendanceType[] = ['breakfast', 'lunch', 'dinner'];
      
      for (const mealType of mealTypes) {
        const mealRecords = allRecords.filter(r => r.attendance_type === mealType);
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

  const handleExportMealStats = async () => {
    if (!currentSchool || filteredStudents.length === 0) return;
    setIsExporting(true);

    try {
      const days = eachDayOfInterval({ start: riceDateRange.start, end: riceDateRange.end });

      const { data: records } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', format(riceDateRange.start, 'yyyy-MM-dd'))
        .lte('attendance_date', format(riceDateRange.end, 'yyyy-MM-dd'));

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

  const renderMealSection = (
    mealType: 'breakfast' | 'lunch' | 'dinner',
    stats: MealStats,
    title: string,
    icon: typeof UtensilsCrossed
  ) => {
    const Icon = icon;
    const isExpanded = expandedSections[mealType];

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
            {stats.hasReport ? (
              <Badge variant="default" className="bg-success">Đã báo cáo</Badge>
            ) : (
              <Badge variant="destructive">Chưa báo cáo</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {stats.hasReport ? (
            <div className="space-y-3">
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
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Home className="h-5 w-5 text-primary" />
                      Điểm danh nội trú gần nhất
                    </CardTitle>
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
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Điểm danh tự học gần nhất
                    </CardTitle>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShareMealDialogOpen(true)}
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Xuất ảnh
                  </Button>
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
                      <div className="text-2xl font-bold text-primary">
                        {filteredMealStats.totalRice.toFixed(1)} kg
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
        />
      )}
    </div>
  );
}
