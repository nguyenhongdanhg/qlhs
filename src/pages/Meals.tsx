import { useEffect, useState, useMemo } from 'react';
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
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarIcon,
  Loader2,
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  Save,
  Settings2,
  Sunrise,
  Sun,
  Moon,
  Users,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type AttendanceMap = Record<string, AttendanceStatus>;

const mealTypes: { type: AttendanceType; label: string; icon: typeof Sunrise }[] = [
  { type: 'breakfast', label: 'Bữa sáng', icon: Sunrise },
  { type: 'lunch', label: 'Bữa trưa', icon: Sun },
  { type: 'dinner', label: 'Bữa tối', icon: Moon },
];

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

  useEffect(() => {
    if (!currentSchool) return;
    fetchClasses();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchStudentsAndAttendance();
  }, [currentSchool, date, selectedMeal]);

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

      toast({ title: 'Thành công', description: `Đã lưu điểm danh bữa ăn` });
      fetchStudentsAndAttendance();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'all') return students;
    return students.filter(s => s.class?.name === selectedClass);
  }, [students, selectedClass]);

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;

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

      {/* User Role Badge */}
      <Card className="mb-4">
        <CardContent className="flex items-center gap-3 p-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-medium">{profile?.full_name || 'Quản trị viên'}</span>
            <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-600">Quản trị viên</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full grid grid-cols-2 bg-transparent border-b rounded-none h-12">
            <TabsTrigger value="register" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <UtensilsCrossed className="h-4 w-4 mr-2" />Đăng ký bữa ăn
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Lịch sử & Thống kê
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Ngày</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, 'dd/MM/yyyy', { locale: vi })}
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
                    {classes.map((cls) => <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">&nbsp;</label>
                <Button variant="outline" className="w-full"><Settings2 className="mr-2 h-4 w-4" />Ghi chú</Button>
              </div>
            </div>

            {/* Meal Tabs */}
            <div className="flex gap-2">
              {mealTypes.map(({ type, label, icon: Icon }) => (
                <Button key={type} variant={selectedMeal === type ? 'default' : 'outline'} onClick={() => setSelectedMeal(type)} className="flex-1">
                  <Icon className="h-4 w-4 mr-2" />{label}
                </Button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleMarkAllPresent}><CheckCircle2 className="h-4 w-4 mr-1" />Đủ tất cả</Button>
                <Button variant="outline" size="sm" onClick={handleMarkAllAbsent}><XCircle className="h-4 w-4 mr-1" />Vắng tất cả</Button>
              </div>
              <span className="text-sm text-green-600 font-medium">{presentCount}/{students.length}</span>
            </div>

            {/* Students Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredStudents.map((student) => (
                  <button key={student.id} onClick={() => handleToggleAbsent(student.id)}
                    className={cn('flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                      attendance[student.id] === 'absent' ? 'border-red-300 bg-red-50 text-red-700' : 'border-border hover:border-primary/50')}>
                    <div className={cn('w-5 h-5 rounded-full border-2 flex-shrink-0',
                      attendance[student.id] === 'absent' ? 'border-red-500 bg-red-500' : 'border-muted-foreground')} />
                    <span className="truncate text-sm">{student.full_name}</span>
                  </button>
                ))}
              </div>
            )}

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Lưu
            </Button>
          </TabsContent>

          <TabsContent value="history" className="p-4">
            <div className="text-center py-12 text-muted-foreground">Chức năng đang phát triển</div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
