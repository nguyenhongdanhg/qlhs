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
  Edit3,
  AlertCircle,
  MessageSquare,
  Users,
  Image,
  Settings2,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn, vietnameseNameSortCompare } from '@/lib/utils';
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
import { AttendanceHistoryTab } from '@/components/attendance/AttendanceHistoryTab';
import { ClassFilterButtons } from '@/components/attendance/ClassFilterButtons';
import { StudentSearchInput } from '@/components/attendance/StudentSearchInput';
import { AdminReportOptions } from '@/components/attendance/AdminReportOptions';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SessionSettingsDialog, detectSessionByTimeConfig, detectSessionLabelByTime, buildReportTitle, isSessionMatchingCurrentTime } from '@/components/attendance/SessionSettingsDialog';
import { AbsentConfirmationDialog } from '@/components/attendance/AbsentConfirmationDialog';
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
type StudySession = { id: string; label: string; start_time?: string | null; end_time?: string | null };

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
  reporterId?: string; // Added for edit permission check
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
  const { currentSchool, user, profile, isSchoolAdmin, isSuperAdmin } = useAuth();
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

  // Session settings dialog
  const [isSessionSettingsOpen, setIsSessionSettingsOpen] = useState(false);

  // Validation warnings
  const [showWarnings, setShowWarnings] = useState(false);

  // History filter
  const [historyDate, setHistoryDate] = useState<Date>(new Date());
  const [historyRangeType, setHistoryRangeType] = useState<DateRangeType>('week');
  const [isExporting, setIsExporting] = useState(false);

  // Share image dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reportToShare, setReportToShare] = useState<SavedReport | null>(null);

  // Edit mode tracking - prevents auto-refresh from overwriting data when editing a report
  const [isEditMode, setIsEditMode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [editModeData, setEditModeData] = useState<{attendance: AttendanceMap, excuse: ExcuseMap, notes: string} | null>(null);

  // Admin report on behalf
  const [selectedReporterId, setSelectedReporterId] = useState(user?.id || '');

  // Confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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
  }, [currentSchool]);

  // Fetch history from database when date range changes (replaces localStorage)
  useEffect(() => {
    if (!currentSchool) return;
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchool, historyDateRange]);

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
      const loadedSessions = data.map(s => ({ id: s.session_id, label: s.label, start_time: (s as any).start_time, end_time: (s as any).end_time }));
      setSessions(loadedSessions);
      // Auto-select based on time
      const autoId = detectSessionByTimeConfig(loadedSessions);
      if (autoId) setSelectedSession(autoId);
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

  // Fetch history from database (stable across devices/accounts)
  const fetchHistory = async () => {
    if (!currentSchool) return;
    try {
      const startDate = format(historyDateRange.start, 'yyyy-MM-dd');
      const endDate = format(historyDateRange.end, 'yyyy-MM-dd');

      // Total students for correct denominator
      const { data: allStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .eq('is_boarding', true);
      const totalStudents = allStudents?.length || 0;

      // Fetch all evening study records in range (may exceed 1000)
      const { data: recordsData, error } = await supabase
        .from('attendance_records')
        .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name), student:students(full_name, class:classes(name))')
        .eq('school_id', currentSchool.id)
        .eq('attendance_type', 'evening_study')
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('created_at', { ascending: false })
        .limit(50000);

      if (error) throw error;

      // Deduplicate latest record per student/date
      const latestByStudentDate = new Map<string, any>();
      (recordsData || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}`;
        const existing = latestByStudentDate.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByStudentDate.set(key, record);
        }
      });

      // Group by date (attendance_records currently has no session_id)
      const reportsByDate = new Map<string, SavedReport>();
      latestByStudentDate.forEach((record: any) => {
        const dateStr = record.attendance_date;
        if (!reportsByDate.has(dateStr)) {
          const reporterName = record.reporter?.full_name || 'N/A';
           const detectStudyLabel = (reportedAt: string): string => {
            return detectSessionLabelByTime(reportedAt, sessions);
          };
          reportsByDate.set(dateStr, {
            id: `${dateStr}_evening_study`,
            date: dateStr,
            session: 'evening_study',
            sessionLabel: detectStudyLabel(record.created_at),
            total: totalStudents,
            present: 0,
            absent: 0,
            reporter: reporterName,
            reporterId: record.reporter_id,
            time: format(new Date(record.created_at), 'HH:mm dd/MM/yyyy'),
            notes: record.notes || '',
            absentStudents: [],
          });
        }

        const entry = reportsByDate.get(dateStr)!;
        if (record.status === 'present') {
          entry.present++;
        } else {
          entry.absent++;
          entry.absentStudents.push({
            name: record.student?.full_name || 'N/A',
            className: record.student?.class?.name || 'N/A',
            excused: record.status === 'excused',
            reason: record.excused_reason || '',
          });
        }

        // Keep latest report meta
        const recordTime = new Date(record.created_at);
        const entryTime = new Date(entry.time.split(' ').slice(0, 1).join(' '));
        if (!Number.isNaN(recordTime.getTime())) {
          entry.time = format(recordTime, 'HH:mm dd/MM/yyyy');
          entry.reporter = record.reporter?.full_name || entry.reporter;
          entry.reporterId = record.reporter_id || entry.reporterId;
        }
      });

      // Sort absent students for each day
      reportsByDate.forEach((r) => {
        r.absentStudents.sort((a, b) => {
          if (a.className !== b.className) return a.className.localeCompare(b.className, 'vi');
          return a.name.localeCompare(b.name, 'vi');
        });
      });

      const reports = Array.from(reportsByDate.values()).sort((a, b) => b.date.localeCompare(a.date));
      setSavedReports(reports);
    } catch (err) {
      console.error('Error fetching evening study history:', err);
    }
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

      // Always start with all students marked as 'present' (no absent by default)
      const freshAttendance: AttendanceMap = {};
      typedStudents.forEach((student) => {
        freshAttendance[student.id] = 'present';
      });

      setAttendance(freshAttendance);
      setExcuseInfo({});
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

  // Collect absent students for confirmation
  const absentStudentsForConfirm = useMemo(() => {
    return students
      .filter(s => attendance[s.id] === 'absent' || attendance[s.id] === 'excused')
      .map(s => ({
        id: s.id,
        name: s.full_name,
        className: s.class?.name || 'Khác',
        excused: excuseInfo[s.id]?.excused || attendance[s.id] === 'excused',
        reason: excuseInfo[s.id]?.reason || '',
      }));
  }, [students, attendance, excuseInfo]);

  const handleSaveClick = () => {
    if (!currentSchool || !user) return;
    validateBeforeSave();
    setShowConfirmDialog(true);
  };

  const handleSave = async () => {
    if (!currentSchool || !user) return;
    setShowConfirmDialog(false);
    const sessionToUse = validateBeforeSave();

    const reporterId = (isSchoolAdmin() || isSuperAdmin) && selectedReporterId ? selectedReporterId : user.id;

    setIsSaving(true);
    setShowWarnings(false);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Only delete records created by the selected reporter
      await supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', 'evening_study')
        .eq('reporter_id', reporterId);

      const records = students.map((student) => ({
        school_id: currentSchool.id,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: 'evening_study' as const,
        status: attendance[student.id] || 'present',
        reporter_id: reporterId,
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

      // Determine session label: manual selection takes priority, then auto-detect
      const sessionLabel = selectedSession 
        ? (sessions.find(s => s.id === selectedSession)?.label || sessionToUse)
        : (sessions.length === 1 ? sessions[0].label : (sessions.find(s => s.id === detectSessionByTimeConfig(sessions))?.label || 'Tự học tối'));
      const isSupplementary = selectedSession ? !isSessionMatchingCurrentTime(selectedSession, sessions) : false;
      const reportTitle = isSupplementary ? `ĐIỂM DANH ${sessionLabel.toUpperCase()} (BỔ SUNG)` : `ĐIỂM DANH ${sessionLabel.toUpperCase()}`;

      const newReport: SavedReport = {
        id: `${dateStr}_${sessionToUse || 'default'}_${Date.now()}`,
        date: dateStr,
        session: sessionToUse || '',
        sessionLabel,
        total: students.length,
        present: presentCount,
        absent: absentCount,
        reporter: profile?.full_name || 'Unknown',
        reporterId: user.id,
        time: format(new Date(), 'HH:mm dd/MM/yyyy'),
        notes: reportNotes,
        absentStudents,
      };

      // History is sourced from database; refresh from DB after saving
      await fetchHistory();

      // Show share dialog immediately after save
      setReportToShare(newReport);
      setShareDialogOpen(true);

      setReportNotes('');
      
      // Reset attendance to all present for next report
      const freshAttendance: AttendanceMap = {};
      students.forEach(s => freshAttendance[s.id] = 'present');
      setAttendance(freshAttendance);
      setExcuseInfo({});
      // Keep selectedSession so share dialog uses correct label

      toast({
        title: 'Lưu báo cáo thành công',
        description: `${reportTitle} - ${format(date, 'dd/MM/yyyy')} đã được lưu`,
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

  // Session management is now handled by SessionSettingsDialog

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
    const currentSessionLabel = report.sessionLabel || 'Tự học tối';
    exportSingleAttendanceReport(reportData, {
      schoolName: currentSchool.name,
      title: `ĐIỂM DANH ${currentSessionLabel.toUpperCase()}`,
      reporterName: profile?.full_name,
      exportTime: new Date(),
    }, 'evening_study', currentSessionLabel.toUpperCase());
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

      const typeLabel = sessions[0]?.label?.toUpperCase() || 'TỰ HỌC TỐI';
      exportAttendanceReport(reportData, {
        schoolName: currentSchool.name,
        title: `ĐIỂM DANH ${typeLabel}`,
        dateRange: historyDateRange,
        reporterName: profile?.full_name,
        exportTime: new Date(),
      }, 'evening_study', typeLabel);

      toast({ title: 'Thành công', description: 'Đã xuất file Excel' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    // History is sourced from database; delete by date (best-effort) and refresh.
    const report = savedReports.find(r => r.id === reportId);
    if (!report) return;
    await handleDeleteDatabaseRecords(report.date);
    toast({
      title: 'Đã xóa báo cáo',
    });
  };

  // Admin function to delete attendance records from database for a specific date
  const handleDeleteDatabaseRecords = async (dateStr: string) => {
    if (!currentSchool || !user) return;
    
    try {
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', 'evening_study');
      
      if (error) throw error;
      
      // Refresh history from DB
      await fetchHistory();
      
      toast({
        title: 'Đã xóa dữ liệu',
        description: `Đã xóa tất cả báo cáo ngày ${format(new Date(dateStr), 'dd/MM/yyyy')}`,
      });
    } catch (error: any) {
      console.error('Error deleting database records:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa dữ liệu',
        variant: 'destructive',
      });
    }
  };

  const handleEditReport = async (report: SavedReport) => {
    if (!currentSchool) return;
    
    // Load attendance data from database for this date BEFORE setting date
    try {
      setIsLoading(true);
      const dateStr = report.date;
      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('attendance_date', dateStr)
        .eq('attendance_type', 'evening_study');

      const attendanceMap: AttendanceMap = {};
      const excuseMap: ExcuseMap = {};
      
      // First, set all students as present
      students.forEach((student) => {
        attendanceMap[student.id] = 'present';
      });
      
      // Then apply saved records
      (recordsData || []).forEach((record: any) => {
        attendanceMap[record.student_id] = record.status;
        if (record.status === 'absent' || record.status === 'excused') {
          excuseMap[record.student_id] = {
            excused: record.status === 'excused',
            reason: record.excused_reason || '',
          };
        }
      });

      // Store edit mode data to apply after date change triggers effect
      setEditModeData({ attendance: attendanceMap, excuse: excuseMap, notes: report.notes || '' });
      setIsEditMode(true);
      
      // Now set the date (this will trigger fetchStudentsAndAttendance, but we'll override it)
      const reportDate = new Date(report.date);
      setDate(reportDate);
      setSelectedSession(report.session);
      setActiveTab('attendance');
      
      toast({
        title: 'Đang sửa báo cáo',
        description: `Ngày ${format(reportDate, 'dd/MM/yyyy')} - ${report.sessionLabel}. Nhấn "Lưu báo cáo" khi hoàn tất.`,
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

  // Apply edit mode data after component updates
  useEffect(() => {
    if (isEditMode && editModeData) {
      setAttendance(editModeData.attendance);
      setExcuseInfo(editModeData.excuse);
      setReportNotes(editModeData.notes);
      setIsEditMode(false);
      setEditModeData(null);
    }
  }, [isEditMode, editModeData]);

  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (selectedClass !== 'all' && selectedClass !== 'Tất cả') {
      filtered = filtered.filter(s => s.class?.name === selectedClass);
    }
    if (studentSearch.trim()) {
      const searchLower = studentSearch.toLowerCase().trim();
      filtered = filtered.filter(s => s.full_name.toLowerCase().includes(searchLower));
    }
    return filtered;
  }, [students, selectedClass, studentSearch]);

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

              {/* Class filter buttons */}
              <div className="md:col-span-2 lg:col-span-3">
                <label className="text-sm text-muted-foreground mb-1.5 block">Chọn lớp</label>
                <ClassFilterButtons
                  classes={sortedClasses}
                  students={students}
                  selectedClass={selectedClass}
                  onSelectClass={setSelectedClass}
                />
              </div>

              {/* Admin: Report on behalf */}
              {(isSchoolAdmin() || isSuperAdmin) && (
                <AdminReportOptions
                  schoolId={currentSchool.id}
                  currentUserId={user?.id || ''}
                  isAdmin={true}
                  selectedReporterId={selectedReporterId}
                  onReporterChange={setSelectedReporterId}
                />
              )}

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Cài đặt ca</label>
                <Button variant="outline" className="w-full" onClick={() => setIsSessionSettingsOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Cài đặt ca học
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

            {/* Student Search */}
            <StudentSearchInput
              value={studentSearch}
              onChange={setStudentSearch}
              resultCount={filteredStudents.length}
              totalCount={students.length}
            />

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
              <Button onClick={handleSaveClick} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Lưu báo cáo
              </Button>
            )}
          </TabsContent>

          <TabsContent value="history" className="p-4">
            <AttendanceHistoryTab
              attendanceType="evening_study"
              typeLabel="Tự học tối"
              classes={classes}
              sessions={sessions}
              isClassTeacher={false}
              teacherClassId={null}
              teacherClassName={null}
              canEdit={canEdit}
              canDelete={canDelete}
              onEditReport={(record) => {
                // Convert to SavedReport format for handleEditReport
                const savedReport: SavedReport = {
                  id: `${record.date}_evening_study_${Date.now()}`,
                  date: record.date,
                  session: 'evening_study',
                  sessionLabel: detectSessionLabelByTime(record.reportedAt, sessions) || 'Tự học tối',
                  total: record.total,
                  present: record.present,
                  absent: record.absent,
                  reporter: record.reporterName,
                  reporterId: record.reporterId,
                  time: format(new Date(record.reportedAt), 'HH:mm dd/MM/yyyy'),
                  notes: record.notes || '',
                  absentStudents: record.absentStudents,
                };
                handleEditReport(savedReport);
              }}
            />
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

      {/* Session Settings Dialog */}
      {currentSchool && (
        <SessionSettingsDialog
          open={isSessionSettingsOpen}
          onOpenChange={setIsSessionSettingsOpen}
          schoolId={currentSchool.id}
          sessionType="evening_study"
          onSessionsUpdated={fetchSessions}
        />
      )}

      {/* Share Report Dialog */}
      {reportToShare && currentSchool && (
        <ShareReportDialog
          open={shareDialogOpen}
          onOpenChange={(open) => {
            setShareDialogOpen(open);
            if (!open) {
              setActiveTab('history');
              setSelectedSession('');
            }
          }}
          report={reportToShare}
          schoolName={currentSchool.name}
          title={`BÁO CÁO ${(reportToShare.sessionLabel || (sessions.find(s => s.id === (selectedSession || sessions[0]?.id))?.label || 'ĐIỂM DANH TỰ HỌC')).toUpperCase()}`}
        />
      )}

      {/* Absent Confirmation Dialog */}
      <AbsentConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleSave}
        isLoading={isSaving}
        title="Xác nhận báo cáo điểm danh Tự học"
        description={`Ngày ${format(date, 'dd/MM/yyyy')} - ${sessions.find(s => s.id === selectedSession)?.label || 'Tự học'}`}
        absentStudents={absentStudentsForConfirm}
        totalStudents={students.length}
      />
    </div>
  );
}
