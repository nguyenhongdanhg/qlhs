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
  Download,
  Share2,
  FileText,
  Users,
  Plus,
  Trash2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NotesDialog } from '@/components/attendance/NotesDialog';
import { ExcuseReasonDialog } from '@/components/attendance/ExcuseReasonDialog';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as XLSX from 'xlsx';

type AttendanceMap = Record<string, AttendanceStatus>;
type ExcuseInfo = { excused: boolean; reason: string };
type ExcuseMap = Record<string, ExcuseInfo>;
type BoardingSession = { id: string; label: string };

const DEFAULT_SESSIONS: BoardingSession[] = [
  { id: 'exercise', label: 'Thể dục' },
  { id: 'noon', label: 'Ngủ trưa' },
  { id: 'night', label: 'Ngủ tối' },
];

interface SavedReport {
  id: string;
  date: string;
  session: string;
  sessionLabel: string;
  total: number;
  present: number;
  absent: number;
  reporter: string;
  time: string;
  notes: string;
  absentStudents: {
    name: string;
    className: string;
    excused: boolean;
    reason: string;
  }[];
}

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
  const [excuseInfo, setExcuseInfo] = useState<ExcuseMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [sessions, setSessions] = useState<BoardingSession[]>(DEFAULT_SESSIONS);

  // Notes dialog
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [reportNotes, setReportNotes] = useState('');

  // Excuse reason dialog
  const [isExcuseDialogOpen, setIsExcuseDialogOpen] = useState(false);
  const [selectedStudentForExcuse, setSelectedStudentForExcuse] = useState<Student | null>(null);

  // Add session dialog
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState('');

  // Validation warnings
  const [showWarnings, setShowWarnings] = useState(false);

  // Sort classes by grade
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const gradeA = a.grade || parseInt(a.name.match(/^\d+/)?.[0] || '0');
      const gradeB = b.grade || parseInt(b.name.match(/^\d+/)?.[0] || '0');
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a.name.localeCompare(b.name);
    });
  }, [classes]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchClasses();
    loadSavedReports();
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
      .order('grade', { ascending: true })
      .order('name', { ascending: true });

    setClasses((data || []) as Class[]);
  };

  const loadSavedReports = () => {
    if (!currentSchool) return;
    const stored = localStorage.getItem(`boarding_reports_${currentSchool.id}`);
    if (stored) {
      try {
        setSavedReports(JSON.parse(stored));
      } catch {
        setSavedReports([]);
      }
    }
  };

  const saveReportsToStorage = (reports: SavedReport[]) => {
    if (!currentSchool) return;
    localStorage.setItem(`boarding_reports_${currentSchool.id}`, JSON.stringify(reports));
    setSavedReports(reports);
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
      const excuseMap: ExcuseMap = {};
      (recordsData || []).forEach((record: any) => {
        attendanceMap[record.student_id] = record.status;
        if (record.status === 'absent' || record.status === 'excused') {
          excuseMap[record.student_id] = {
            excused: record.status === 'excused',
            reason: record.excused_reason || '',
          };
        }
      });
      
      typedStudents.forEach((student) => {
        if (!attendanceMap[student.id]) {
          attendanceMap[student.id] = 'present';
        }
      });

      setAttendance(attendanceMap);
      setExcuseInfo(excuseMap);
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

  const handleToggleAbsent = (student: Student) => {
    const currentStatus = attendance[student.id];
    if (currentStatus === 'absent' || currentStatus === 'excused') {
      setAttendance(prev => ({ ...prev, [student.id]: 'present' }));
      setExcuseInfo(prev => {
        const newMap = { ...prev };
        delete newMap[student.id];
        return newMap;
      });
    } else {
      setSelectedStudentForExcuse(student);
      setIsExcuseDialogOpen(true);
    }
  };

  const handleSaveExcuse = (excused: boolean, reason: string) => {
    if (!selectedStudentForExcuse) return;
    setAttendance(prev => ({
      ...prev,
      [selectedStudentForExcuse.id]: excused ? 'excused' : 'absent',
    }));
    setExcuseInfo(prev => ({
      ...prev,
      [selectedStudentForExcuse.id]: { excused, reason },
    }));
    setSelectedStudentForExcuse(null);
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

  const validateBeforeSave = (): boolean => {
    if (!selectedSession) {
      setShowWarnings(true);
      toast({
        title: 'Chưa chọn buổi',
        description: 'Vui lòng chọn buổi điểm danh trước khi lưu',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!currentSchool || !user) return;
    if (!validateBeforeSave()) return;

    setIsSaving(true);
    setShowWarnings(false);
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
        excused_reason: excuseInfo[student.id]?.reason || null,
        notes: reportNotes || null,
      }));

      const { error } = await supabase.from('attendance_records').insert(records);
      if (error) throw error;

      const presentCount = Object.values(attendance).filter(s => s === 'present').length;
      const absentCount = Object.values(attendance).filter(s => s === 'absent' || s === 'excused').length;

      const absentStudents = students
        .filter(s => attendance[s.id] === 'absent' || attendance[s.id] === 'excused')
        .map(s => ({
          name: s.full_name,
          className: s.class?.name || 'Khác',
          excused: excuseInfo[s.id]?.excused || false,
          reason: excuseInfo[s.id]?.reason || '',
        }));

      const sessionLabel = sessions.find(s => s.id === selectedSession)?.label || selectedSession;

      const newReport: SavedReport = {
        id: `${dateStr}_${selectedSession}_${Date.now()}`,
        date: dateStr,
        session: selectedSession,
        sessionLabel,
        total: students.length,
        present: presentCount,
        absent: absentCount,
        reporter: profile?.full_name || 'Unknown',
        time: format(new Date(), 'HH:mm dd/MM/yyyy'),
        notes: reportNotes,
        absentStudents,
      };

      const updatedReports = [newReport, ...savedReports.slice(0, 99)];
      saveReportsToStorage(updatedReports);

      setActiveTab('history');
      setReportNotes('');

      toast({
        title: 'Lưu báo cáo thành công',
        description: `Báo cáo ngày ${format(date, 'dd/MM/yyyy')} - ${sessionLabel} đã được lưu`,
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

  const handleAddSession = () => {
    if (!newSessionLabel.trim()) return;
    const newSession: BoardingSession = {
      id: `session_${Date.now()}`,
      label: newSessionLabel.trim(),
    };
    setSessions([...sessions, newSession]);
    setNewSessionLabel('');
    setIsAddSessionOpen(false);
    toast({
      title: 'Đã thêm buổi',
      description: `Buổi "${newSession.label}" đã được thêm`,
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    if (sessions.length <= 1) {
      toast({
        title: 'Không thể xóa',
        description: 'Phải có ít nhất một buổi điểm danh',
        variant: 'destructive',
      });
      return;
    }
    setSessions(sessions.filter(s => s.id !== sessionId));
    if (selectedSession === sessionId) {
      setSelectedSession('');
    }
  };

  const handleExportExcel = (report: SavedReport) => {
    const wsData = [
      ['BÁO CÁO ĐIỂM DANH NỘI TRÚ'],
      [`Ngày: ${format(new Date(report.date), 'dd/MM/yyyy')}`],
      [`Buổi: ${report.sessionLabel}`],
      [`Người báo cáo: ${report.reporter}`],
      [`Thời gian báo cáo: ${report.time}`],
      [],
      ['THỐNG KÊ'],
      ['Tổng số', report.total],
      ['Có mặt', report.present],
      ['Vắng', report.absent],
      [],
    ];

    if (report.notes) {
      wsData.push(['Ghi chú:', report.notes]);
      wsData.push([]);
    }

    if (report.absentStudents.length > 0) {
      wsData.push(['DANH SÁCH HỌC SINH VẮNG']);
      wsData.push(['STT', 'Họ tên', 'Lớp', 'Phép/Không phép', 'Lý do']);
      report.absentStudents.forEach((s, idx) => {
        wsData.push([
          idx + 1,
          s.name,
          s.className,
          s.excused ? 'Có phép' : 'Không phép',
          s.reason,
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Báo cáo');
    XLSX.writeFile(wb, `Diem_danh_noi_tru_${report.date}_${report.session}.xlsx`);
  };

  const handleDeleteReport = (reportId: string) => {
    const updatedReports = savedReports.filter(r => r.id !== reportId);
    saveReportsToStorage(updatedReports);
    toast({
      title: 'Đã xóa báo cáo',
    });
  };

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'all' || selectedClass === 'Tất cả') return students;
    return students.filter(s => s.class?.name === selectedClass);
  }, [students, selectedClass]);

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent' || s === 'excused').length;

  const groupedReports = useMemo(() => {
    const groups: Record<string, SavedReport[]> = {};
    savedReports.forEach(report => {
      if (!groups[report.date]) {
        groups[report.date] = [];
      }
      groups[report.date].push(report);
    });
    return groups;
  }, [savedReports]);

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
            {/* Validation Warnings */}
            {showWarnings && !selectedSession && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Vui lòng chọn buổi điểm danh trước khi lưu báo cáo
                </AlertDescription>
              </Alert>
            )}

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
                <label className="text-sm text-muted-foreground mb-1.5 block">Buổi *</label>
                <div className="flex gap-2">
                  <Select value={selectedSession} onValueChange={setSelectedSession}>
                    <SelectTrigger className={cn(showWarnings && !selectedSession && 'border-red-500')}>
                      <SelectValue placeholder="Chọn buổi" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setIsAddSessionOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Lớp</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tất cả lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lớp</SelectItem>
                    {sortedClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.name}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">&nbsp;</label>
                <Button 
                  variant="outline" 
                  className={cn("w-full", reportNotes && "border-primary text-primary")}
                  onClick={() => setIsNotesOpen(true)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {reportNotes ? 'Đã có ghi chú' : 'Ghi chú'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="p-4">
            {Object.keys(groupedReports).length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Lịch sử báo cáo</h3>
                  <Button size="sm" onClick={() => setActiveTab('attendance')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Báo cáo mới
                  </Button>
                </div>

                {Object.entries(groupedReports)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([dateStr, reports]) => (
                    <div key={dateStr} className="space-y-3">
                      <h4 className="font-medium text-muted-foreground">
                        {format(new Date(dateStr), 'EEEE, dd/MM/yyyy', { locale: vi })}
                      </h4>
                      {reports.map((report) => (
                        <Card key={report.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <h5 className="font-semibold">{report.sessionLabel}</h5>
                                <p className="text-sm text-muted-foreground">
                                  Người báo cáo: {report.reporter} - Lúc {report.time}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleExportExcel(report)}>
                                  <Download className="h-4 w-4 mr-1" />
                                  Excel
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleDeleteReport(report.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="p-3 rounded-lg bg-muted/50 text-center">
                                <p className="text-2xl font-bold">{report.total}</p>
                                <p className="text-xs text-muted-foreground">Tổng số</p>
                              </div>
                              <div className="p-3 rounded-lg bg-green-50 text-green-600 text-center">
                                <p className="text-2xl font-bold">{report.present}</p>
                                <p className="text-xs">Có mặt</p>
                              </div>
                              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-center">
                                <p className="text-2xl font-bold">{report.absent}</p>
                                <p className="text-xs">Vắng</p>
                              </div>
                            </div>

                            {report.notes && (
                              <div className="mb-4 p-3 rounded-lg bg-muted/30 border">
                                <p className="text-sm font-medium mb-1">Ghi chú:</p>
                                <p className="text-sm text-muted-foreground">{report.notes}</p>
                              </div>
                            )}

                            {report.absentStudents.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Danh sách vắng:</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-12">STT</TableHead>
                                      <TableHead>Họ tên</TableHead>
                                      <TableHead>Lớp</TableHead>
                                      <TableHead>P/KP</TableHead>
                                      <TableHead>Lý do</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {report.absentStudents.map((s, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell>{s.name}</TableCell>
                                        <TableCell>{s.className}</TableCell>
                                        <TableCell>
                                          <Badge variant={s.excused ? 'secondary' : 'destructive'}>
                                            {s.excused ? 'P' : 'KP'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{s.reason || '-'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ))}
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

              {/* Class Filter Tabs - Sorted by grade */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={selectedClass === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedClass('all')}
                >
                  Tất cả
                </Button>
                {sortedClasses.map((cls) => (
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
                  {filteredStudents.map((student) => {
                    const status = attendance[student.id];
                    const isAbsent = status === 'absent' || status === 'excused';
                    const excuse = excuseInfo[student.id];
                    return (
                      <button
                        key={student.id}
                        onClick={() => handleToggleAbsent(student)}
                        className={cn(
                          'flex flex-col gap-1 p-3 rounded-lg border text-left transition-all',
                          isAbsent
                            ? excuse?.excused
                              ? 'border-orange-300 bg-orange-50 text-orange-700'
                              : 'border-red-300 bg-red-50 text-red-700'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                            isAbsent
                              ? excuse?.excused
                                ? 'border-orange-500 bg-orange-500'
                                : 'border-red-500 bg-red-500'
                              : 'border-muted-foreground'
                          )}>
                            {isAbsent && (
                              <XCircle className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <span className="truncate text-sm font-medium">{student.full_name}</span>
                        </div>
                        {isAbsent && excuse && (
                          <div className="text-xs ml-7">
                            <Badge variant={excuse.excused ? 'secondary' : 'destructive'} className="text-[10px] h-4">
                              {excuse.excused ? 'P' : 'KP'}
                            </Badge>
                            {excuse.reason && (
                              <span className="ml-1 text-muted-foreground truncate">{excuse.reason}</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
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

      {/* Notes Dialog */}
      <NotesDialog
        open={isNotesOpen}
        onOpenChange={setIsNotesOpen}
        notes={reportNotes}
        onSave={setReportNotes}
      />

      {/* Excuse Reason Dialog */}
      <ExcuseReasonDialog
        open={isExcuseDialogOpen}
        onOpenChange={setIsExcuseDialogOpen}
        studentName={selectedStudentForExcuse?.full_name || ''}
        onSave={handleSaveExcuse}
      />

      {/* Add Session Dialog */}
      <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm buổi điểm danh</DialogTitle>
            <DialogDescription>
              Nhập tên buổi điểm danh mới
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sessionLabel">Tên buổi</Label>
              <Input
                id="sessionLabel"
                placeholder="Ví dụ: Thể dục chiều, Sinh hoạt..."
                value={newSessionLabel}
                onChange={(e) => setNewSessionLabel(e.target.value)}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Các buổi hiện có:</p>
              <div className="flex flex-wrap gap-2">
                {sessions.map((s) => (
                  <Badge key={s.id} variant="secondary" className="flex items-center gap-1">
                    {s.label}
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSessionOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleAddSession} disabled={!newSessionLabel.trim()}>
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
