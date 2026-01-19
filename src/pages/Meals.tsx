import { useEffect, useState } from 'react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AttendanceMap = Record<string, AttendanceStatus>;

const mealTypes: { type: AttendanceType; label: string; icon: typeof Sunrise }[] = [
  { type: 'breakfast', label: 'Sáng', icon: Sunrise },
  { type: 'lunch', label: 'Trưa', icon: Sun },
  { type: 'dinner', label: 'Tối', icon: Moon },
];

export default function Meals() {
  const { currentSchool, user } = useAuth();
  const { toast } = useToast();

  const [date, setDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedMeal, setSelectedMeal] = useState<AttendanceType>('lunch');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentSchool) return;
    fetchClasses();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchStudentsAndAttendance();
  }, [currentSchool, date, selectedClass, selectedMeal]);

  const fetchClasses = async () => {
    if (!currentSchool) return;

    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', currentSchool.id)
      .eq('is_active', true)
      .order('name');

    setClasses((data || []) as Class[]);
  };

  const fetchStudentsAndAttendance = async () => {
    if (!currentSchool) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('students')
        .select('*, class:classes(*)')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .eq('is_boarding', true)
        .order('full_name');

      if (selectedClass !== 'all') {
        query = query.eq('class_id', selectedClass);
      }

      const { data: studentsData } = await query;
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
      toast({
        title: 'Lỗi',
        description: 'Không thể tải dữ liệu điểm danh',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSave = async () => {
    if (!currentSchool || !user) return;

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

      const mealLabel = mealTypes.find(m => m.type === selectedMeal)?.label || '';
      toast({
        title: 'Thành công',
        description: `Đã lưu điểm danh bữa ${mealLabel.toLowerCase()} cho ${students.length} học sinh`,
      });

      fetchStudentsAndAttendance();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu điểm danh',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusCount = (status: AttendanceStatus) => {
    return Object.values(attendance).filter((s) => s === status).length;
  };

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
          <UtensilsCrossed className="h-7 w-7 text-warning" />
          Điểm danh bữa ăn
        </h1>
        <p className="page-description">
          Ghi nhận học sinh ăn các bữa trong ngày
        </p>
      </div>

      {/* Meal Tabs */}
      <Tabs value={selectedMeal} onValueChange={(v) => setSelectedMeal(v as AttendanceType)} className="mb-6">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-grid">
          {mealTypes.map(({ type, label, icon: Icon }) => (
            <TabsTrigger key={type} value={type} className="gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start md:w-[200px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, 'dd/MM/yyyy', { locale: vi })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Chọn lớp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả lớp</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={isSaving || students.length === 0}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lưu điểm danh
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-2xl font-bold">{getStatusCount('present')}</p>
              <p className="text-sm text-muted-foreground">Có ăn</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{getStatusCount('absent')}</p>
              <p className="text-sm text-muted-foreground">Không ăn</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">Không có học sinh nội trú</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {students.map((student) => (
            <Card 
              key={student.id} 
              className={cn(
                "transition-all cursor-pointer hover:shadow-md",
                attendance[student.id] === 'present' 
                  ? "border-success/50 bg-success/5" 
                  : "border-destructive/50 bg-destructive/5"
              )}
              onClick={() => handleStatusChange(
                student.id, 
                attendance[student.id] === 'present' ? 'absent' : 'present'
              )}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  attendance[student.id] === 'present' 
                    ? "bg-success text-success-foreground" 
                    : "bg-destructive text-destructive-foreground"
                )}>
                  {attendance[student.id] === 'present' 
                    ? <CheckCircle2 className="h-5 w-5" />
                    : <XCircle className="h-5 w-5" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{student.full_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {student.class?.name} • {student.student_code}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
