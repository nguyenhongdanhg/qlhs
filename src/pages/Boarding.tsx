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
  Home,
  CheckCircle2,
  XCircle,
  Save,
  Download,
  FileText,
  Users,
  Plus,
  Trash2,
  Edit3,
  AlertCircle,
  MessageSquare,
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
import { SessionSettingsDialog, detectSessionByTimeConfig, detectSessionLabelByTime } from '@/components/attendance/SessionSettingsDialog';
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
type BoardingSession = { id: string; label: string; start_time?: string | null; end_time?: string | null };

const DEFAULT_SESSIONS: BoardingSession[] = [
  { id: 'morning', label: 'Điểm danh thể dục buổi sáng' },
  { id: 'noon', label: 'Điểm danh giờ ngủ trưa' },
  { id: 'night', label: 'Điểm danh giờ ngủ tối' },
  { id: 'emergency', label: 'Đột xuất' },
];

// Auto-detect session based on time (uses configured sessions)
const detectSessionByTime = (): string => {
  // This is now a placeholder; actual detection uses detectSessionByTimeConfig
  return 'morning';
};

// Detect boarding session label from a report timestamp (placeholder, uses DB sessions)
const detectBoardingSessionLabel = (reportedAt: string): string => {
  return 'Điểm danh';
};

// Database-based history record (replaces localStorage SavedReport)
interface HistoryRecord {
  date: string;
  reportedAt: string;
  reporterId: string;
  reporterName: string;
  total: number;
  present: number;
  absent: number;
  notes?: string;
  absentStudents: {
    id: string;
    name: string;
    className: string;
    excused: boolean;
    reason: string;
  }[];
}

// Legacy SavedReport for backwards compatibility during transition
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
  const { currentSchool, user, profile, isSchoolAdmin, isSuperAdmin } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = useFeaturePermission('boarding');
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
  const [sessions, setSessions] = useState<BoardingSession[]>(DEFAULT_SESSIONS);

  // Database-based history records (replaces localStorage)
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
  const [reportToShare, setReportToShare] = useState<HistoryRecord | null>(null);

  // Edit mode tracking - prevents auto-refresh from overwriting data when editing a report
  const [isEditMode, setIsEditMode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [editModeData, setEditModeData] = useState<{attendance: AttendanceMap, excuse: ExcuseMap, notes: string} | null>(null);

  // Admin report on behalf
  const [selectedReporterId, setSelectedReporterId] = useState(user?.id || '');

  // Total boarding students count for accurate stats
  const [totalBoardingStudents, setTotalBoardingStudents] = useState(0);

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

  // Group history records by date for display
  const groupedHistoryRecords = useMemo(() => {
    const groups: Record<string, HistoryRecord[]> = {};
    historyRecords.forEach(record => {
      if (!groups[record.date]) {
        groups[record.date] = [];
      }
      groups[record.date].push(record);
    });
    return groups;
  }, [historyRecords]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchClasses();
    fetchSessions();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchStudentsAndAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchool, date]);

  // Fetch history from database when date range changes
  useEffect(() => {
    if (!currentSchool) return;
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchool, historyDateRange]);

  const fetchSessions = async () => {
    if (!currentSchool) return;
    
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('school_id', currentSchool.id)
      .eq('session_type', 'boarding')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching sessions:', error);
      // Fallback to defaults if no sessions exist
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
        session_type: 'boarding',
        session_id: s.id,
        label: s.label,
        display_order: index,
      }));
      
      await supabase.from('attendance_sessions').insert(defaultInserts);
      setSessions(DEFAULT_SESSIONS);
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

  // Fetch history from database (replaces localStorage-based loadSavedReports)
  const fetchHistory = async () => {
    if (!currentSchool) return;
    setIsLoadingHistory(true);

    try {
      const startDate = format(historyDateRange.start, 'yyyy-MM-dd');
      const endDate = format(historyDateRange.end, 'yyyy-MM-dd');

      // Get total boarding students for accurate denominator
      const { data: boardingStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .eq('is_boarding', true);
      
      const totalBoarding = boardingStudents?.length || 0;
      setTotalBoardingStudents(totalBoarding);

      // Fetch attendance records with reporter and student info
      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('*, reporter:profiles!attendance_records_reporter_id_fkey(full_name), student:students(full_name, class:classes(name))')
        .eq('school_id', currentSchool.id)
        .eq('attendance_type', 'boarding')
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .order('created_at', { ascending: false })
        .limit(50000);

      // Get latest record per student/date (deduplication)
      const latestByStudentDate = new Map<string, any>();
      (recordsData || []).forEach((record: any) => {
        const key = `${record.student_id}-${record.attendance_date}`;
        const existing = latestByStudentDate.get(key);
        if (!existing || new Date(record.created_at) > new Date(existing.created_at)) {
          latestByStudentDate.set(key, record);
        }
      });

      // Group by date for display
      const historyByDate = new Map<string, HistoryRecord>();

      latestByStudentDate.forEach((record) => {
        const key = record.attendance_date;

        if (!historyByDate.has(key)) {
          historyByDate.set(key, {
            date: record.attendance_date,
            reportedAt: record.created_at,
            reporterId: record.reporter_id,
            reporterName: record.reporter?.full_name || 'N/A',
            total: totalBoarding, // Use actual student count, not record count
            present: 0,
            absent: 0,
            notes: record.notes || '',
            absentStudents: [],
          });
        }

        const entry = historyByDate.get(key)!;
        if (record.status === 'present') {
          entry.present++;
        } else {
          entry.absent++;
          entry.absentStudents.push({
            id: record.student_id,
            name: record.student?.full_name || 'N/A',
            className: record.student?.class?.name || 'N/A',
            excused: record.status === 'excused',
            reason: record.excused_reason || '',
          });
        }

        // Keep the latest report time
        if (new Date(record.created_at) > new Date(entry.reportedAt)) {
          entry.reportedAt = record.created_at;
          entry.reporterId = record.reporter_id;
          entry.reporterName = record.reporter?.full_name || 'N/A';
        }
      });

      // Sort absent students by class then name
      historyByDate.forEach((entry) => {
        entry.absentStudents.sort((a, b) => {
          if (a.className !== b.className) return a.className.localeCompare(b.className, 'vi');
          return a.name.localeCompare(b.name, 'vi');
        });
      });

      setHistoryRecords(Array.from(historyByDate.values()).sort((a, b) => 
        b.date.localeCompare(a.date)
      ));
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
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
    // Auto-detect session if not selected
    let sessionToUse = selectedSession;
    if (!sessionToUse) {
      sessionToUse = detectSessionByTime();
      setSelectedSession(sessionToUse);
    }
    return sessionToUse;
  };

  const handleSave = async () => {
    if (!currentSchool || !user) return;
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
        .eq('attendance_type', 'boarding')
        .eq('reporter_id', reporterId);

      const records = students.map((student) => ({
        school_id: currentSchool.id,
        student_id: student.id,
        class_id: student.class_id,
        attendance_date: dateStr,
        attendance_type: 'boarding' as const,
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

      const sessionLabel = sessions.find(s => s.id === sessionToUse)?.label || sessionToUse;

      // Data is already saved to database, just refresh history
      await fetchHistory();

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
    const newSession: BoardingSession = {
      id: newSessionId,
      label: newSessionLabel.trim(),
    };

    // Save to database
    const { error } = await supabase.from('attendance_sessions').insert({
      school_id: currentSchool.id,
      session_type: 'boarding',
      session_id: newSessionId,
      label: newSessionLabel.trim(),
      display_order: sessions.length,
    });

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể thêm buổi điểm danh',
        variant: 'destructive',
      });
      return;
    }

    setSessions([...sessions, newSession]);
    setNewSessionLabel('');
    setIsAddSessionOpen(false);
    toast({
      title: 'Đã thêm buổi',
      description: `Buổi "${newSession.label}" đã được thêm`,
    });
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!currentSchool) return;
    
    if (sessions.length <= 1) {
      toast({
        title: 'Không thể xóa',
        description: 'Phải có ít nhất một buổi điểm danh',
        variant: 'destructive',
      });
      return;
    }

    // Delete from database
    const { error } = await supabase
      .from('attendance_sessions')
      .delete()
      .eq('school_id', currentSchool.id)
      .eq('session_type', 'boarding')
      .eq('session_id', sessionId);

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể xóa buổi điểm danh',
        variant: 'destructive',
      });
      return;
    }

    setSessions(sessions.filter(s => s.id !== sessionId));
    if (selectedSession === sessionId) {
      setSelectedSession('');
    }
    toast({
      title: 'Đã xóa',
      description: 'Đã xóa buổi điểm danh',
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
      title: 'BÁO CÁO ĐIỂM DANH NỘI TRÚ',
      reporterName: profile?.full_name,
      exportTime: new Date(),
    }, 'boarding');
  };

  const handleExportRangeReports = () => {
    if (!currentSchool || historyRecords.length === 0) return;
    setIsExporting(true);

    try {
      const reportData: AttendanceReportData[] = historyRecords.map(record => ({
        date: record.date,
        session: 'boarding',
        sessionLabel: detectBoardingSessionLabel(record.reportedAt),
        reporter: record.reporterName,
        reportTime: format(new Date(record.reportedAt), 'HH:mm dd/MM/yyyy'),
        total: record.total,
        present: record.present,
        absent: record.absent,
        notes: record.notes || '',
        absentStudents: record.absentStudents.map(s => ({
          name: s.name,
          className: s.className,
          excused: s.excused,
          reason: s.reason,
        })),
      }));

      exportAttendanceReport(reportData, {
        schoolName: currentSchool.name,
        title: 'BÁO CÁO ĐIỂM DANH NỘI TRÚ',
        dateRange: historyDateRange,
        reporterName: profile?.full_name,
        exportTime: new Date(),
      }, 'boarding');

      toast({ title: 'Thành công', description: 'Đã xuất file Excel' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
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
        .eq('attendance_type', 'boarding');
      
      if (error) throw error;
      
      // Refresh history from database
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
        .eq('attendance_type', 'boarding');

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
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Buổi {!selectedSession && <span className="text-xs text-muted-foreground">(tự động nhận: {sessions.find(s => s.id === detectSessionByTime())?.label})</span>}
                </label>
                <Select value={selectedSession || '__auto__'} onValueChange={(v) => setSelectedSession(v === '__auto__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tự động theo giờ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Tự động theo giờ</SelectItem>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Class filter buttons */}
              <div className="md:col-span-2">
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
                  Bạn không có quyền tạo báo cáo điểm danh nội trú. Liên hệ quản trị viên để được cấp quyền.
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
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Lưu báo cáo
              </Button>
            )}
          </TabsContent>

          <TabsContent value="history" className="p-4">
            <AttendanceHistoryTab
              attendanceType="boarding"
              typeLabel="Nội trú"
              classes={classes}
              isClassTeacher={false}
              teacherClassId={null}
              teacherClassName={null}
              canEdit={canEdit}
              canDelete={canDelete}
              onEditReport={(record) => {
                // Convert to SavedReport format for handleEditReport
                const savedReport: SavedReport = {
                  id: `${record.date}_boarding_${Date.now()}`,
                  date: record.date,
                  session: 'boarding',
                  sessionLabel: detectBoardingSessionLabel(record.reportedAt),
                  total: record.total,
                  present: record.present,
                  absent: record.absent,
                  reporter: record.reporterName,
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
                placeholder="VD: Ca 3, Thể dục sáng..."
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
          title="BÁO CÁO ĐIỂM DANH NỘI TRÚ"
        />
      )}
    </div>
  );
}
