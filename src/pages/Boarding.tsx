import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Student, Class, AttendanceStatus } from '@/types';
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
  Home,
  CheckCircle2,
  XCircle,
  Save,
  Settings2,
  Download,
  Share2,
  FileText,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type AttendanceMap = Record<string, AttendanceStatus>;
type BoardingSession = 'exercise' | 'noon' | 'night';

const sessions: { value: BoardingSession; label: string }[] = [
  { value: 'exercise', label: 'Thể dục' },
  { value: 'noon', label: 'Ngủ trưa' },
  { value: 'night', label: 'Ngủ tối' },
];

export default function Boarding() {
  const { currentSchool, user, profile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'attendance' | 'history'>('attendance');
  const [date, setDate] = useState<Date>(new Date());
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedReport, setSavedReport] = useState<any>(null);

  // Group classes by grade
  const classGroups = useMemo(() => {
    const groups: Record<string, Class[]> = {};
    classes.forEach((cls) => {
      const grade = cls.name.match(/^\d+/)?.[0] || 'Khác';
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(cls);
    });
    return groups;
  }, [classes]);

  const classFilterTabs = useMemo(() => {
    const tabs = ['Tất cả'];
    Object.keys(classGroups)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((grade) => {
        classGroups[grade].forEach((cls) => tabs.push(cls.name));
      });
    return tabs;
  }, [classGroups]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchClasses();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchStudentsAndAttendance();
  }, [currentSchool, date, selectedSession]);

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
        .eq('attendance_type', 'boarding');

      const attendanceMap: AttendanceMap = {};
      (recordsData || []).forEach((record: any) => {
        attendanceMap[record.student_id] = record.status;
      });
      
      // Default all to present
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
        .eq('attendance_type', 'boarding');

      const records = students.map((student) => ({
        school_id: currentSchool.id,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: 'boarding' as const,
        status: attendance[student.id] || 'present',
        reporter_id: user.id,
      }));

      const { error } = await supabase.from('attendance_records').insert(records);
      if (error) throw error;

      const presentCount = Object.values(attendance).filter(s => s === 'present').length;
      const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

      setSavedReport({
        date: dateStr,
        total: students.length,
        present: presentCount,
        absent: absentCount,
        reporter: profile?.full_name,
        time: format(new Date(), 'HH:mm dd/MM/yyyy'),
      });

      setActiveTab('history');

      toast({
        title: 'Lưu báo cáo thành công',
        description: `Báo cáo ngày ${format(date, 'dd/MM/yyyy')} đã được lưu`,
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

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'all' || selectedClass === 'Tất cả') return students;
    return students.filter(s => s.class?.name === selectedClass);
  }, [students, selectedClass]);

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

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
          <Home className="h-7 w-7 text-blue-500" />
          Điểm danh nội trú
        </h1>
        <p className="page-description">
          Báo cáo sỹ số nội trú theo các buổi
        </p>
      </div>

      {/* Main Tabs */}
      <Card className="mb-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full grid grid-cols-2 bg-transparent border-b rounded-none h-12">
            <TabsTrigger
              value="attendance"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <Home className="h-4 w-4 mr-2" />
              Điểm danh
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <FileText className="h-4 w-4 mr-2" />
              Lịch sử
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="p-4 space-y-4">
            {/* Filters */}
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Ngày</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
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
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Buổi</label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn buổi" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Lớp</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tất cả lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lớp</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.name}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">&nbsp;</label>
                <Button variant="outline" className="w-full">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Ghi chú
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="p-4">
            {savedReport ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Báo cáo đã lưu</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Tải ảnh
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Zalo
                    </Button>
                    <Button size="sm" onClick={() => setActiveTab('attendance')}>
                      Báo cáo mới
                    </Button>
                  </div>
                </div>

                <Card className="border-2">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground mb-2">{currentSchool.name}</p>
                    <h2 className="text-xl font-bold text-blue-600 mb-1">
                      BÁO CÁO ĐIỂM DANH NỘI TRÚ ({selectedSession ? sessions.find(s => s.value === selectedSession)?.label : ''})
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Ngày {format(date, 'dd/MM/yyyy')}
                    </p>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-3xl font-bold">{savedReport.total}</p>
                        <p className="text-sm text-muted-foreground">Tổng số</p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-50 text-green-600">
                        <p className="text-3xl font-bold">{savedReport.present}</p>
                        <p className="text-sm">Có mặt</p>
                      </div>
                      <div className="p-4 rounded-lg bg-red-50 text-red-600">
                        <p className="text-3xl font-bold">{savedReport.absent}</p>
                        <p className="text-sm">Vắng</p>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Người báo cáo: {savedReport.reporter}</span>
                      <span>Lúc {savedReport.time}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Chưa có báo cáo nào được lưu
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Student Grid - Only show in attendance tab */}
      {activeTab === 'attendance' && (
        <>
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">
                    Chọn vắng ({absentCount}/{students.length})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleMarkAllPresent}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Đủ
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleMarkAllAbsent}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Vắng
                  </Button>
                </div>
              </div>

              {/* Class Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={selectedClass === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedClass('all')}
                >
                  Tất cả
                </Button>
                {classes.map((cls) => (
                  <Button
                    key={cls.id}
                    variant={selectedClass === cls.name ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedClass(cls.name)}
                  >
                    {cls.name}
                  </Button>
                ))}
              </div>

              {/* Students Grid */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => handleToggleAbsent(student.id)}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                        attendance[student.id] === 'absent'
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        attendance[student.id] === 'absent'
                          ? 'border-red-500 bg-red-500'
                          : 'border-muted-foreground'
                      )}>
                        {attendance[student.id] === 'absent' && (
                          <XCircle className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <span className="truncate text-sm">{student.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom Bar */}
          <Card className="sticky bottom-20 lg:bottom-4">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4 text-sm">
                <span>Tổng: <strong>{students.length}</strong></span>
                <span className="text-green-600">Đủ: <strong>{presentCount}</strong></span>
                <span className="text-red-600">Vắng: <strong>{absentCount}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Zalo
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Lưu
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Users(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
