import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeaturePermission } from '@/components/guards/FeatureGuard';
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
  BookOpen,
  CheckCircle2,
  XCircle,
  Save,
  Download,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  MessageSquare,
  Users,
  Image,
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
import { ShareReportDialog } from '@/components/attendance/ShareReportDialog';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DateRangeType,
  getDateRange,
  exportAttendanceReport,
  exportSingleAttendanceReport,
  AttendanceReportData,
} from '@/lib/excel-export';

type AttendanceMap = Record<string, AttendanceStatus>;
type ExcuseInfo = { excused: boolean; reason: string };
type ExcuseMap = Record<string, ExcuseInfo>;
type StudySession = { id: string; label: string };

const DEFAULT_SESSIONS: StudySession[] = [
  { id: 'session_1', label: 'Ca 1' },
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

export default function EveningStudy() {
  const { currentSchool, user, profile } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = useFeaturePermission('evening_study');
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
  const [sessions, setSessions] = useState<StudySession[]>(DEFAULT_SESSIONS);

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

  // History filter
  const [historyDate, setHistoryDate] = useState<Date>(new Date());
  const [historyRangeType, setHistoryRangeType] = useState<DateRangeType>('month');
  const [isExporting, setIsExporting] = useState(false);

  // Share image dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reportToShare, setReportToShare] = useState<SavedReport | null>(null);

  const historyDateRange = useMemo(() => getDateRange(historyDate, historyRangeType), [historyDate, historyRangeType]);

  // Sort classes by grade
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const gradeA = a.grade || parseInt(a.name.match(/^\d+/)?.[0] || '0');
      const gradeB = b.grade || parseInt(b.name.match(/^\d+/)?.[0] || '0');
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a.name.localeCompare(b.name);
    });
  }, [classes]);

  // Filter reports by date range
  const filteredReports = useMemo(() => {
    const startStr = format(historyDateRange.start, 'yyyy-MM-dd');
    const endStr = format(historyDateRange.end, 'yyyy-MM-dd');
    return savedReports.filter(r => r.date >= startStr && r.date <= endStr);
  }, [savedReports, historyDateRange]);

  const groupedReports = useMemo(() => {
    const groups: Record<string, SavedReport[]> = {};
    filteredReports.forEach(report => {
      if (!groups[report.date]) {
        groups[report.date] = [];
      }
      groups[report.date].push(report);
    });
    return groups;
  }, [filteredReports]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchClasses();
    fetchSessions();
    loadSavedReports();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchStudentsAndAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchool, date]);

  const fetchSessions = async () => {
    if (!currentSchool) return;
    
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('school_id', currentSchool.id)
      .eq('session_type', 'evening_study')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching sessions:', error);
      setSessions(DEFAULT_SESSIONS);
      return;
    }

    if (data && data.length > 0) {
      const loadedSessions = data.map(s => ({ id: s.session_id, label: s.label }));
      setSessions(loadedSessions);
      // Auto-select if only 1 session
      if (loadedSessions.length === 1) {
        setSelectedSession(loadedSessions[0].id);
      }
    } else {
      // Initialize default sessions in database for this school
      const defaultInserts = DEFAULT_SESSIONS.map((s, index) => ({
        school_id: currentSchool.id,
        session_type: 'evening_study',
        session_id: s.id,
        label: s.label,
        display_order: index,
      }));
      
      await supabase.from('attendance_sessions').insert(defaultInserts);
      setSessions(DEFAULT_SESSIONS);
      // Auto-select if only 1 default session
      if (DEFAULT_SESSIONS.length === 1) {
        setSelectedSession(DEFAULT_SESSIONS[0].id);
      }
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

  const loadSavedReports = () => {
    if (!currentSchool) return;
    const stored = localStorage.getItem(`evening_study_reports_${currentSchool.id}`);
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
    localStorage.setItem(`evening_study_reports_${currentSchool.id}`, JSON.stringify(reports));
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
        .eq('attendance_type', 'evening_study');

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

  const validateBeforeSave = (): string => {
    // Auto-select if only 1 session exists
    let sessionToUse = selectedSession;
    if (!sessionToUse && sessions.length === 1) {
      sessionToUse = sessions[0].id;
      setSelectedSession(sessionToUse);
    }
    // If still no session selected, use first available or empty
    if (!sessionToUse && sessions.length > 0) {
      sessionToUse = sessions[0].id;
      setSelectedSession(sessionToUse);
      toast({
        title: 'Nhắc nhở',
        description: 'Tự động chọn ca đầu tiên. Bạn có thể chọn lại ca khác trước khi lưu.',
      });
    }
    return sessionToUse || '';
  };

  const handleSave = async () => {
    if (!currentSchool || !user) return;
    const sessionToUse = validateBeforeSave();

    setIsSaving(true);
    setShowWarnings(false);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      await supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', 'evening_study');

      const records = students.map((student) => ({
        school_id: currentSchool.id,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: 'evening_study' as const,
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

      const sessionLabel = sessions.find(s => s.id === sessionToUse)?.label || sessionToUse || 'Không có ca';

      const newReport: SavedReport = {
        id: `${dateStr}_${sessionToUse || 'default'}_${Date.now()}`,
        date: dateStr,
        session: sessionToUse || '',
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
      
      // Reset attendance to all present for next report
      const freshAttendance: AttendanceMap = {};
      students.forEach(s => freshAttendance[s.id] = 'present');
      setAttendance(freshAttendance);
      setExcuseInfo({});
      setSelectedSession('');

      toast({
        title: 'Lưu báo cáo thành công',
        description: `Báo cáo ngày ${format(date, 'dd/MM/yyyy')} - ${sessionLabel} đã được lưu`,
      });
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

  const handleAddSession = async () => {
    if (!newSessionLabel.trim() || !currentSchool) return;
    
    const newSessionId = `session_${Date.now()}`;
    const newSession: StudySession = {
      id: newSessionId,
      label: newSessionLabel.trim(),
    };

    // Save to database
    const { error } = await supabase.from('attendance_sessions').insert({
      school_id: currentSchool.id,
      session_type: 'evening_study',
      session_id: newSessionId,
      label: newSessionLabel.trim(),
      display_order: sessions.length,
    });

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể thêm ca học',
        variant: 'destructive',
      });
      return;
    }

    setSessions([...sessions, newSession]);
    setNewSessionLabel('');
    setIsAddSessionOpen(false);
    toast({
      title: 'Đã thêm ca học',
      description: `Ca "${newSession.label}" đã được thêm`,
    });
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!currentSchool) return;
    
    if (sessions.length <= 1) {
      toast({
        title: 'Không thể xóa',
        description: 'Phải có ít nhất một ca học',
        variant: 'destructive',
      });
      return;
    }

    // Delete from database
    const { error } = await supabase
      .from('attendance_sessions')
      .delete()
      .eq('school_id', currentSchool.id)
      .eq('session_type', 'evening_study')
      .eq('session_id', sessionId);

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa ca học',
        variant: 'destructive',
      });
      return;
    }

    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);
    if (selectedSession === sessionId) {
      setSelectedSession(newSessions.length === 1 ? newSessions[0].id : '');
    }
    toast({
      title: 'Đã xóa',
      description: 'Đã xóa ca học',
    });
  };

  const handleExportSingleReport = (report: SavedReport) => {
    if (!currentSchool) return;
    const reportData: AttendanceReportData = {
      date: report.date,
      session: report.session,
      sessionLabel: report.sessionLabel,
      reporter: report.reporter,
      reportTime: report.time,
      total: report.total,
      present: report.present,
      absent: report.absent,
      notes: report.notes,
      absentStudents: report.absentStudents,
    };
    exportSingleAttendanceReport(reportData, {
      schoolName: currentSchool.name,
      title: 'BÁO CÁO ĐIỂM DANH TỰ HỌC TỐI',
      reporterName: profile?.full_name,
      exportTime: new Date(),
    }, 'evening_study');
  };

  const handleExportRangeReports = () => {
    if (!currentSchool || filteredReports.length === 0) return;
    setIsExporting(true);

    try {
      const reportData: AttendanceReportData[] = filteredReports.map(report => ({
        date: report.date,
        session: report.session,
        sessionLabel: report.sessionLabel,
        reporter: report.reporter,
        reportTime: report.time,
        total: report.total,
        present: report.present,
        absent: report.absent,
        notes: report.notes,
        absentStudents: report.absentStudents,
      }));

      exportAttendanceReport(reportData, {
        schoolName: currentSchool.name,
        title: 'BÁO CÁO ĐIỂM DANH TỰ HỌC TỐI',
        dateRange: historyDateRange,
        reporterName: profile?.full_name,
        exportTime: new Date(),
      }, 'evening_study');

      toast({ title: 'Thành công', description: 'Đã xuất file Excel' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
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
          <BookOpen className="h-7 w-7 text-blue-500" />
          Điểm danh tự học tối
        </h1>
        <p className="page-description">
          Báo cáo sỹ số học sinh tự học buổi tối
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
              <BookOpen className="h-4 w-4 mr-2" />
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
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Ca học {sessions.length === 1 && <span className="text-xs text-green-600">(tự động)</span>}
                </label>
                {sessions.length === 1 ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{sessions[0].label}</span>
                  </div>
                ) : (
                  <Select value={selectedSession} onValueChange={setSelectedSession}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn ca học" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Chọn lớp</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tất cả lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lớp ({students.length} HS)</SelectItem>
                    {sortedClasses.map((cls) => {
                      const count = students.filter(s => s.class?.name === cls.name).length;
                      return (
                        <SelectItem key={cls.id} value={cls.name}>
                          {cls.name} ({count} HS)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Quản lý ca</label>
                <Button variant="outline" className="w-full" onClick={() => setIsAddSessionOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm ca học
                </Button>
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

            {/* Statistics Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{students.length}</p>
                <p className="text-xs text-muted-foreground">Tổng số</p>
              </Card>
              <Card className="p-3 text-center bg-green-50">
                <p className="text-2xl font-bold text-green-600">{presentCount}</p>
                <p className="text-xs text-muted-foreground">Có mặt</p>
              </Card>
              <Card className="p-3 text-center bg-red-50">
                <p className="text-2xl font-bold text-red-600">{absentCount}</p>
                <p className="text-xs text-muted-foreground">Vắng</p>
              </Card>
            </div>

            {/* Permission Warning */}
            {!canCreate && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Bạn không có quyền tạo báo cáo điểm danh tự học tối. Liên hệ quản trị viên để được cấp quyền.
                </AlertDescription>
              </Alert>
            )}

            {/* Quick Actions */}
            {canCreate && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleMarkAllPresent}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />Đủ tất cả
                </Button>
                <Button variant="outline" size="sm" onClick={handleMarkAllAbsent}>
                  <XCircle className="h-4 w-4 mr-1" />Vắng tất cả
                </Button>
              </div>
            )}

            {/* Students List - Compact for mobile */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Chọn lớp để xem danh sách học sinh</p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto border rounded-lg">
                <div className="divide-y">
                  {filteredStudents.map((student) => {
                    const status = attendance[student.id];
                    const isAbsent = status === 'absent' || status === 'excused';
                    const excuse = excuseInfo[student.id];
                    return (
                      <button
                        key={student.id}
                        onClick={() => canCreate && handleToggleAbsent(student)}
                        disabled={!canCreate}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-left transition-all',
                          isAbsent ? 'bg-destructive/10' : 'hover:bg-muted/50',
                          !canCreate && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                          isAbsent ? 'border-destructive bg-destructive' : 'border-primary bg-primary'
                        )}>
                          {!isAbsent && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("font-medium text-sm truncate", isAbsent && "text-destructive")}>{student.full_name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{student.class?.name}</span>
                          </div>
                          {isAbsent && excuse && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant={excuse.excused ? 'secondary' : 'destructive'} className="text-[10px] px-1 py-0 h-4">
                                {excuse.excused ? 'Có phép' : 'KP'}
                              </Badge>
                              {excuse.reason && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{excuse.reason}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save Button */}
            {canCreate && (
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Lưu báo cáo
              </Button>
            )}
          </TabsContent>

          <TabsContent value="history" className="p-4 space-y-4">
            {/* Date Range Filter */}
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
                  <label className="text-sm text-muted-foreground mb-1.5 block">Chọn thời gian</label>
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
              </div>
              <Button onClick={handleExportRangeReports} variant="outline" disabled={isExporting || filteredReports.length === 0}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Xuất Excel ({filteredReports.length} báo cáo)
              </Button>
            </div>

            {/* Statistics Summary */}
            {filteredReports.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center bg-blue-50">
                  <p className="text-2xl font-bold text-blue-600">{filteredReports.length}</p>
                  <p className="text-xs text-muted-foreground">Số báo cáo</p>
                </Card>
                <Card className="p-4 text-center bg-green-50">
                  <p className="text-2xl font-bold text-green-600">{filteredReports.reduce((s, r) => s + r.present, 0)}</p>
                  <p className="text-xs text-muted-foreground">Tổng có mặt</p>
                </Card>
                <Card className="p-4 text-center bg-red-50">
                  <p className="text-2xl font-bold text-red-600">{filteredReports.reduce((s, r) => s + r.absent, 0)}</p>
                  <p className="text-xs text-muted-foreground">Tổng vắng</p>
                </Card>
              </div>
            )}

            {/* Reports List */}
            {Object.keys(groupedReports).length > 0 ? (
              <div className="space-y-6">
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
                                <Button variant="outline" size="sm" onClick={() => {
                                  setReportToShare(report);
                                  setShareDialogOpen(true);
                                }}>
                                  <Image className="h-4 w-4 mr-1" />
                                  Ảnh
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleExportSingleReport(report)}>
                                  <Download className="h-4 w-4 mr-1" />
                                  Excel
                                </Button>
                                {canDelete && (
                                  <Button variant="outline" size="sm" onClick={() => handleDeleteReport(report.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
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
                Chưa có báo cáo nào trong khoảng thời gian này
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

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
        onOpenChange={(open) => {
          setIsExcuseDialogOpen(open);
          if (!open) setSelectedStudentForExcuse(null);
        }}
        studentName={selectedStudentForExcuse?.full_name || ''}
        onSave={handleSaveExcuse}
      />

      {/* Add Session Dialog */}
      <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm buổi điểm danh</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên buổi</Label>
              <Input
                value={newSessionLabel}
                onChange={(e) => setNewSessionLabel(e.target.value)}
                placeholder="VD: Ca 3, Tự học thêm..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSessionOpen(false)}>Hủy</Button>
            <Button onClick={handleAddSession}>Thêm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Report Dialog */}
      {reportToShare && currentSchool && (
        <ShareReportDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          report={reportToShare}
          schoolName={currentSchool.name}
          title="BÁO CÁO ĐIỂM DANH TỰ HỌC TỐI"
        />
      )}
    </div>
  );
}
