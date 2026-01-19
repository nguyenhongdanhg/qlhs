import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Student, Class, AttendanceStatus, AttendanceType, MealSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, subDays, isAfter, isBefore, setHours, setMinutes } from 'date-fns';
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
import * as XLSX from 'xlsx';

type AttendanceMap = Record<string, AttendanceStatus>;

interface MealDeadline {
  type: AttendanceType;
  deadlineHour: number;
  deadlineMinute: number;
  dayOffset: number; // -1 for previous day, 0 for same day
  label: string;
  description: string;
}

const MEAL_DEADLINES: MealDeadline[] = [
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
  const [historyMonth, setHistoryMonth] = useState<Date>(new Date());
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Sort classes by grade then name
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [classes]);

  // Check if meal can be reported based on deadline
  const getMealDeadlineInfo = useCallback((mealType: AttendanceType, targetDate: Date) => {
    const deadline = MEAL_DEADLINES.find(d => d.type === mealType);
    if (!deadline) return { canReport: false, remainingTime: '', isExpired: true };

    const now = new Date();
    let deadlineDate = new Date(targetDate);
    
    if (deadline.dayOffset === -1) {
      // Previous day deadline (for breakfast)
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
  }, []);

  const currentMealDeadline = useMemo(() => {
    return getMealDeadlineInfo(selectedMeal, date);
  }, [selectedMeal, date, getMealDeadlineInfo]);

  // Get upcoming deadlines for reminder bar
  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    return MEAL_DEADLINES.map(deadline => {
      let targetDate = deadline.type === 'breakfast' ? tomorrow : today;
      const info = getMealDeadlineInfo(deadline.type, targetDate);
      return {
        ...deadline,
        ...info,
        targetDate,
      };
    }).filter(d => d.canReport);
  }, [getMealDeadlineInfo]);

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
  }, [currentSchool, activeTab, historyMonth]);

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
      const startDate = format(startOfMonth(historyMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(historyMonth), 'yyyy-MM-dd');

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

  // Mark all 3 meals at once
  const handleMarkAll3Meals = async (markPresent: boolean) => {
    if (!currentSchool || !user) return;
    setIsSaving(true);
    
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const mealTypesToSave: AttendanceType[] = ['breakfast', 'lunch', 'dinner'];
      
      // Check deadlines for each meal
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

  const handleExportMonthlyExcel = async () => {
    if (!currentSchool) return;
    
    try {
      const startDate = startOfMonth(historyMonth);
      const endDate = endOfMonth(historyMonth);
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Fetch all attendance records for the month
      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .in('attendance_type', ['breakfast', 'lunch', 'dinner'])
        .gte('attendance_date', format(startDate, 'yyyy-MM-dd'))
        .lte('attendance_date', format(endDate, 'yyyy-MM-dd'));

      // Create attendance map: studentId -> date -> meal -> status
      const attendanceByStudent = new Map<string, Map<string, Map<string, boolean>>>();
      (recordsData || []).forEach((record: any) => {
        if (!attendanceByStudent.has(record.student_id)) {
          attendanceByStudent.set(record.student_id, new Map());
        }
        const studentMap = attendanceByStudent.get(record.student_id)!;
        if (!studentMap.has(record.attendance_date)) {
          studentMap.set(record.attendance_date, new Map());
        }
        const dateMap = studentMap.get(record.attendance_date)!;
        dateMap.set(record.attendance_type, record.status === 'present');
      });

      // Build Excel data
      const headerRow1 = ['STT', 'Họ và tên', 'Lớp', 'Phòng', 'Mâm'];
      const headerRow2 = ['', '', '', '', ''];
      
      days.forEach(day => {
        headerRow1.push(format(day, 'dd'));
        headerRow2.push('S/T/C');
      });
      headerRow1.push('Tổng S', 'Tổng T', 'Tổng C', 'Tổng gạo (kg)');
      headerRow2.push('', '', '', '');

      const dataRows: any[][] = [];
      
      students.forEach((student, index) => {
        const row: any[] = [
          index + 1,
          student.full_name,
          student.class?.name || '',
          student.room_number || '',
          student.meal_group || '',
        ];
        
        let breakfastCount = 0;
        let lunchCount = 0;
        let dinnerCount = 0;
        
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const studentData = attendanceByStudent.get(student.id);
          const dateData = studentData?.get(dateStr);
          
          const b = dateData?.get('breakfast') ?? true;
          const l = dateData?.get('lunch') ?? true;
          const d = dateData?.get('dinner') ?? true;
          
          if (b) breakfastCount++;
          if (l) lunchCount++;
          if (d) dinnerCount++;
          
          const display = `${b ? 'x' : 'o'}${l ? 'x' : 'o'}${d ? 'x' : 'o'}`;
          row.push(display);
        });
        
        const totalRice = (lunchCount + dinnerCount) * 0.2;
        row.push(breakfastCount, lunchCount, dinnerCount, totalRice.toFixed(1));
        
        dataRows.push(row);
      });

      // Calculate totals
      const totalsRow = ['', 'TỔNG CỘNG', '', '', ''];
      let totalBreakfast = 0, totalLunch = 0, totalDinner = 0;
      
      days.forEach(() => totalsRow.push(''));
      
      dataRows.forEach(row => {
        totalBreakfast += row[row.length - 4] as number;
        totalLunch += row[row.length - 3] as number;
        totalDinner += row[row.length - 2] as number;
      });
      
      const totalRiceAll = (totalLunch + totalDinner) * 0.2;
      totalsRow.push(String(totalBreakfast), String(totalLunch), String(totalDinner), totalRiceAll.toFixed(1));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const wsData = [
        [`THỐNG KÊ BỮA ĂN THÁNG ${format(historyMonth, 'MM/yyyy')}`],
        [`Trường: ${currentSchool.name}`],
        [],
        headerRow1,
        headerRow2,
        ...dataRows,
        [],
        totalsRow,
        [],
        ['Ghi chú: x = ăn, o = vắng. Mỗi ô thể hiện: Sáng/Trưa/Chiều (S/T/C)'],
        ['Lượng gạo: 0.2kg/học sinh cho mỗi bữa trưa và tối'],
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 5 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
        ...days.map(() => ({ wch: 6 })),
        { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 },
      ];

      // Apply red background to cells with absences
      const startRow = 6; // 1-indexed, where data starts
      dataRows.forEach((row, rowIdx) => {
        days.forEach((_, dayIdx) => {
          const cellValue = row[5 + dayIdx] as string;
          if (cellValue && cellValue.includes('o')) {
            const cellRef = XLSX.utils.encode_cell({ r: startRow + rowIdx - 1, c: 5 + dayIdx });
            if (!ws[cellRef]) ws[cellRef] = { v: cellValue, t: 's' };
            ws[cellRef].s = { fill: { fgColor: { rgb: 'FF6B6B' } } };
          }
        });
      });

      XLSX.utils.book_append_sheet(wb, ws, 'Thống kê bữa ăn');
      XLSX.writeFile(wb, `thong-ke-bua-an-${format(historyMonth, 'MM-yyyy')}.xlsx`);
      
      toast({ title: 'Thành công', description: 'Đã xuất file Excel' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
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
          
          {/* Upcoming Deadlines */}
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
            {/* Month Selection and Export */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Tháng</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Tháng {format(historyMonth, 'MM/yyyy', { locale: vi })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar 
                      mode="single" 
                      selected={historyMonth} 
                      onSelect={(d) => d && setHistoryMonth(d)} 
                      className="pointer-events-auto" 
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleExportMonthlyExcel} variant="outline">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Xuất Excel tháng
              </Button>
            </div>

            {/* History Records */}
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Không có báo cáo trong tháng này
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
