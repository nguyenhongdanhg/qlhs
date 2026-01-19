import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Student, Class, AttendanceRecord, AttendanceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  Moon,
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AttendanceMap = Record<string, AttendanceStatus>;

export default function EveningStudy() {
  const { currentSchool, user } = useAuth();
  const { toast } = useToast();

  const [date, setDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [existingRecords, setExistingRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentSchool) return;
    fetchClasses();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchStudentsAndAttendance();
  }, [currentSchool, date, selectedClass]);

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
      // Fetch students
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

      // Fetch existing attendance records
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', 'evening_study');

      const records = (recordsData || []) as AttendanceRecord[];
      setExistingRecords(records);

      // Map existing records to attendance state
      const attendanceMap: AttendanceMap = {};
      records.forEach((record) => {
        attendanceMap[record.student_id] = record.status;
      });
      
      // Set default status for students without records
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
      
      // Delete existing records for this date and type
      await supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', 'evening_study');

      // Insert new records
      const records = students.map((student) => ({
        school_id: currentSchool.id,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: 'evening_study' as const,
        status: attendance[student.id] || 'present',
        reporter_id: user.id,
      }));

      const { error } = await supabase.from('attendance_records').insert(records);
      if (error) throw error;

      toast({
        title: 'Thành công',
        description: `Đã lưu điểm danh cho ${students.length} học sinh`,
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

  const statusButtons: { status: AttendanceStatus; label: string; icon: typeof CheckCircle2; className: string }[] = [
    { status: 'present', label: 'Có mặt', icon: CheckCircle2, className: 'status-present' },
    { status: 'absent', label: 'Vắng', icon: XCircle, className: 'status-absent' },
    { status: 'late', label: 'Muộn', icon: Clock, className: 'status-late' },
    { status: 'excused', label: 'Phép', icon: FileCheck, className: 'status-excused' },
  ];

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
          <Moon className="h-7 w-7 text-primary" />
          Điểm danh tự học tối
        </h1>
        <p className="page-description">
          Ghi nhận học sinh tự học buổi tối
        </p>
      </div>

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
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {statusButtons.map(({ status, label, icon: Icon, className }) => (
          <Card key={status} className={cn('border', className.replace('text-', 'border-'))}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className={cn('h-5 w-5', className.split(' ')[1])} />
              <div>
                <p className="text-2xl font-bold">{getStatusCount(status)}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attendance List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Moon className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">Không có học sinh nội trú</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <Card key={student.id} className="transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{student.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {student.class?.name} • {student.student_code}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusButtons.map(({ status, label, icon: Icon, className }) => (
                    <Button
                      key={status}
                      variant={attendance[student.id] === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStatusChange(student.id, status)}
                      className={cn(
                        'flex-1',
                        attendance[student.id] === status && className
                      )}
                    >
                      <Icon className="mr-1 h-3 w-3" />
                      {label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
