import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useImageExport } from '@/hooks/use-image-export';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, CalendarIcon, Check, X, Search, Share2, FileSpreadsheet, Clock, DoorOpen, AlertCircle, Trash2, Undo2, Image, Upload, Paperclip, ExternalLink, Download, FileText, Pencil, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, Class } from '@/types';
import { DormitoryExitImageCard } from '@/components/dormitory/DormitoryExitImageCard';
import { ExitRequestImageCard } from '@/components/dormitory/ExitRequestImageCard';
import * as XLSX from 'xlsx-js-style';
import { fitColumnsToA4, applyProfessionalStyle, getColumnAlignments, applyWarningCellStyle, ExcelColors, ExcelFonts, ExcelBorders } from '@/lib/excel-styles';

interface ExitRequest {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string | null;
  request_date: string;
  exit_date: string | null;
  return_date: string | null;
  exit_time: string;
  expected_return_time: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requester_id: string;
  approver_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  attachment_url: string | null;
  same_day?: boolean;
  delegated_to_teacher?: boolean;
  delegated_to_duty?: boolean;
  returned_at?: string | null;
  created_at: string;
  student?: { full_name: string; student_code: string; class_id: string | null };
  requester?: { full_name: string };
  approver?: { full_name: string };
  class?: { name: string };
}

type FilterRange = 'day' | 'week' | 'month';

export default function DormitoryExit() {
  const { user, currentSchool, currentMembership, isSchoolAdmin, isSuperAdmin } = useAuth();
  const { hasPermission } = useSchool();
  const { toast } = useToast();
  const { exportAndShare, isExporting } = useImageExport();
  const imageRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState('requests');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterRange, setFilterRange] = useState<FilterRange>('week');
  const [searchQuery, setSearchQuery] = useState('');

  // Create request dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Per-student registration data
  interface RegisteredStudent {
    studentId: string;
    exitDate: Date;
    exitTime: string;
    returnDate: Date;
    returnTime: string;
    reason: string;
    sameDay: boolean;
    attachmentFile?: File | null;
  }
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [editAttachmentFile, setEditAttachmentFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [currentEditStudentId, setCurrentEditStudentId] = useState<string | null>(null);
  const [editExitDate, setEditExitDate] = useState<Date>(new Date());
  const [editExitTime, setEditExitTime] = useState('');
  const [editReturnDate, setEditReturnDate] = useState<Date>(new Date());
  const [editReturnTime, setEditReturnTime] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editSameDay, setEditSameDay] = useState(false);

  // Reject dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Share dialog
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [imageVariant, setImageVariant] = useState<'approved' | 'rejected'>('approved');

  // Delete confirm dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Approved list filter
  type ApprovedFilter = 'all' | 'not_returned' | 'returned' | 'expired';
  const [approvedFilter, setApprovedFilter] = useState<ApprovedFilter>('all');
  const [approvedClassFilter, setApprovedClassFilter] = useState<string>('all');

  // Live clock — ticks each minute so "đã hết hạn" badge updates
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Statistics dialog (period range)
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [statsFromDate, setStatsFromDate] = useState<Date>(startOfMonth(new Date()));
  const [statsToDate, setStatsToDate] = useState<Date>(new Date());
  const [statsData, setStatsData] = useState<ExitRequest[] | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Approve dialog (with delegation options)
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvingIds, setApprovingIds] = useState<string[]>([]);
  const [approveDelegateTeacher, setApproveDelegateTeacher] = useState(false);
  const [approveDelegateDuty, setApproveDelegateDuty] = useState(false);
  const [isApprovingDialog, setIsApprovingDialog] = useState(false);

  // Edit & resubmit rejected dialog
  const [showEditRejectedDialog, setShowEditRejectedDialog] = useState(false);
  const [editingRejected, setEditingRejected] = useState<ExitRequest | null>(null);
  const [editRejExitDate, setEditRejExitDate] = useState<Date>(new Date());
  const [editRejExitTime, setEditRejExitTime] = useState('');
  const [editRejReturnDate, setEditRejReturnDate] = useState<Date>(new Date());
  const [editRejReturnTime, setEditRejReturnTime] = useState('');
  const [editRejReason, setEditRejReason] = useState('');
  const [editRejAttachmentFile, setEditRejAttachmentFile] = useState<File | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);

  // Batch selection for pending requests
  const [selectedPending, setSelectedPending] = useState<string[]>([]);

  // Batch reject dialog
  const [showBatchRejectDialog, setShowBatchRejectDialog] = useState(false);
  const [batchRejectionReason, setBatchRejectionReason] = useState('');

  // Exit request share dialog
  const [showExitRequestShare, setShowExitRequestShare] = useState(false);
  const exitRequestImageRef = useRef<HTMLDivElement>(null);
  const [lastCreatedStudents, setLastCreatedStudents] = useState<{
    name: string;
    className: string;
    exitDate: string;
    exitTime: string;
    returnDate: string;
    returnTime: string;
    reason?: string;
    hasAttachment?: boolean;
  }[]>([]);
  const [lastRequesterName, setLastRequesterName] = useState('');

  const isClassTeacher = currentMembership?.role === 'class_teacher';
  const canApprove = isSchoolAdmin() || isSuperAdmin || hasPermission('dormitory_exit', 'edit');
  const canDelete = isSchoolAdmin() || isSuperAdmin;
  const canCreate = isClassTeacher || isSchoolAdmin() || isSuperAdmin || hasPermission('dormitory_exit', 'create');
  // GVCN có thể sửa đơn pending/rejected của lớp mình; người tạo đơn cũng có thể sửa; admin luôn được sửa.
  const canEditRequest = (req: ExitRequest) => {
    if (req.status !== 'pending' && req.status !== 'rejected') return false;
    if (isSchoolAdmin() || isSuperAdmin) return true;
    if (req.requester_id === user?.id) return true;
    if (isClassTeacher && currentMembership?.class_id && req.class_id === currentMembership.class_id) return true;
    return false;
  };

  useEffect(() => {
    if (!currentSchool) return;
    fetchData();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchRequests();
  }, [currentSchool, selectedDate, filterRange]);

  useEffect(() => {
    if (!currentSchool) return;
    const channel = supabase
      .channel('dormitory-exit-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dormitory_exit_requests', filter: `school_id=eq.${currentSchool.id}` }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentSchool, selectedDate, filterRange]);

  const fetchData = async () => {
    if (!currentSchool) return;
    const [classRes, studentRes] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', currentSchool.id).eq('is_active', true).order('name'),
      supabase.from('students').select('*').eq('school_id', currentSchool.id).eq('is_active', true).eq('is_boarding', true).order('full_name'),
    ]);
    setClasses((classRes.data || []) as Class[]);
    setStudents((studentRes.data || []) as Student[]);
  };

  const fetchRequests = async () => {
    if (!currentSchool) return;
    setIsLoading(true);
    let startDate: string, endDate: string;
    const d = selectedDate;
    if (filterRange === 'day') {
      startDate = endDate = format(d, 'yyyy-MM-dd');
    } else if (filterRange === 'week') {
      startDate = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      endDate = format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else {
      startDate = format(startOfMonth(d), 'yyyy-MM-dd');
      endDate = format(endOfMonth(d), 'yyyy-MM-dd');
    }

    const { data, error } = await supabase
      .from('dormitory_exit_requests')
      .select('*, student:students(full_name, student_code, class_id), requester:profiles!dormitory_exit_requests_requester_id_fkey(full_name), approver:profiles!dormitory_exit_requests_approver_id_fkey(full_name), class:classes(name)')
      .eq('school_id', currentSchool.id)
      .gte('request_date', startDate)
      .lte('request_date', endDate)
      .order('request_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error) setRequests((data || []) as unknown as ExitRequest[]);
    setIsLoading(false);
  };

  // For class teachers, only show their class students
  const teacherClassId = useMemo(() => {
    if (isSchoolAdmin() || isSuperAdmin) return null;
    if (currentMembership?.class_id) {
      return currentMembership.class_id;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMembership, isSuperAdmin]);

  const availableStudents = useMemo(() => {
    let filtered = students;
    if (teacherClassId) {
      filtered = students.filter(s => s.class_id === teacherClassId);
    }
    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      filtered = filtered.filter(s => s.full_name.toLowerCase().includes(q));
    }
    return filtered;
  }, [students, teacherClassId, studentSearch]);

  const filteredRequests = useMemo(() => {
    let filtered = requests;
    
    // GVCN only sees pending/rejected for their own class, but ALL accounts see approved
    if (teacherClassId) {
      filtered = filtered.filter(r => 
        r.status === 'approved' || r.class_id === teacherClassId || r.requester_id === user?.id
      );
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.student?.full_name?.toLowerCase().includes(q) ||
        r.class?.name?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [requests, searchQuery, teacherClassId, user]);

  const pendingRequests = useMemo(() => filteredRequests.filter(r => r.status === 'pending'), [filteredRequests]);
  const approvedRequests = useMemo(() => filteredRequests.filter(r => r.status === 'approved'), [filteredRequests]);
  const rejectedRequests = useMemo(() => filteredRequests.filter(r => r.status === 'rejected'), [filteredRequests]);

  // Filter approved by return-status (uses `now` so updates with the minute timer)
  const filteredApprovedRequests = useMemo(() => {
    let list = approvedRequests;
    if (approvedClassFilter !== 'all') {
      list = list.filter(r => (r.class_id || '') === approvedClassFilter);
    }
    if (approvedFilter === 'all') return list;
    return list.filter(req => {
      const isReturned = !!req.returned_at;
      if (approvedFilter === 'returned') return isReturned;
      if (approvedFilter === 'not_returned') return !isReturned;
      if (approvedFilter === 'expired') {
        if (isReturned) return false;
        if (!req.expected_return_time) return false;
        const dateStr = req.return_date || req.exit_date || req.request_date;
        if (!dateStr) return false;
        try {
          const [h, m] = req.expected_return_time.split(':').map(Number);
          const ret = new Date(dateStr);
          ret.setHours(h || 0, m || 0, 0, 0);
          return ret.getTime() < now.getTime();
        } catch { return false; }
      }
      return true;
    });
  }, [approvedRequests, approvedFilter, approvedClassFilter, now]);

  // Counters for filter chips
  const approvedCounts = useMemo(() => {
    let returned = 0, notReturned = 0, expired = 0;
    approvedRequests.forEach(req => {
      const isReturned = !!req.returned_at;
      if (isReturned) { returned++; return; }
      notReturned++;
      if (!req.expected_return_time) return;
      const dateStr = req.return_date || req.exit_date || req.request_date;
      if (!dateStr) return;
      try {
        const [h, m] = req.expected_return_time.split(':').map(Number);
        const ret = new Date(dateStr);
        ret.setHours(h || 0, m || 0, 0, 0);
        if (ret.getTime() < now.getTime()) expired++;
      } catch {}
    });
    return { all: approvedRequests.length, returned, notReturned, expired };
  }, [approvedRequests, now]);

  // Teacher's homeroom class name (for "Lớp chủ nhiệm" label & sort priority)
  const teacherClassName = useMemo(() => {
    if (!isClassTeacher || !teacherClassId) return '';
    return classes.find(c => c.id === teacherClassId)?.name || '';
  }, [isClassTeacher, teacherClassId, classes]);

  // Group approved by class for stats display (using filtered list)
  const approvedByClass = useMemo(() => {
    const map = new Map<string, ExitRequest[]>();
    filteredApprovedRequests.forEach(r => {
      const cls = r.class?.name || 'Không rõ';
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(r);
    });
    return map;
  }, [filteredApprovedRequests]);

  const handleSelectStudent = (studentId: string) => {
    // If already registered, ignore
    if (registeredStudents.some(r => r.studentId === studentId)) return;
    // Set as current edit student with defaults
    setCurrentEditStudentId(studentId);
    setEditExitDate(new Date());
    setEditExitTime('');
    setEditReturnDate(new Date());
    setEditReturnTime('');
    setEditReason('');
    setEditSameDay(false);
    setEditAttachmentFile(null);
  };

  const handleConfirmStudent = () => {
    if (!currentEditStudentId || !editExitTime || !editReturnTime) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng nhập giờ ra và giờ vào', variant: 'destructive' });
      return;
    }
    setRegisteredStudents(prev => [...prev, {
      studentId: currentEditStudentId,
      exitDate: editExitDate,
      exitTime: editExitTime,
      returnDate: editReturnDate,
      returnTime: editReturnTime,
      reason: editReason,
      sameDay: editSameDay,
      attachmentFile: editAttachmentFile,
    }]);
    setCurrentEditStudentId(null);
    setEditSameDay(false);
    setEditAttachmentFile(null);
  };

  const handleRemoveRegistered = (studentId: string) => {
    setRegisteredStudents(prev => prev.filter(r => r.studentId !== studentId));
  };

  // Upload đơn ảnh lên Google Drive
  const uploadAttachment = async (file: File, requestId?: string): Promise<string | null> => {
    if (!currentSchool) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Chưa đăng nhập');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('school_id', currentSchool.id);
      fd.append('school_name', currentSchool.name);
      if (requestId) fd.append('request_id', requestId);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/upload-exit-attachment`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Upload thất bại');
      return json.url as string;
    } catch (err: any) {
      toast({ title: 'Lỗi upload', description: err.message, variant: 'destructive' });
      return null;
    }
  };

  const handleUploadForRequest = async (requestId: string, file: File) => {
    setUploadingId(requestId);
    const url = await uploadAttachment(file, requestId);
    if (url) {
      toast({ title: 'Đã tải lên', description: 'Ảnh đơn đã lưu vào Google Drive' });
      fetchRequests();
    }
    setUploadingId(null);
  };

  const handleCreateRequest = async () => {
    if (!currentSchool || !user || registeredStudents.length === 0) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng thêm ít nhất 1 học sinh', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const records = registeredStudents.map(reg => {
        const student = students.find(s => s.id === reg.studentId);
        return {
          school_id: currentSchool.id,
          student_id: reg.studentId,
          class_id: student?.class_id || null,
          request_date: format(reg.exitDate, 'yyyy-MM-dd'),
          exit_date: format(reg.exitDate, 'yyyy-MM-dd'),
          return_date: format(reg.returnDate, 'yyyy-MM-dd'),
          exit_time: reg.exitTime,
          expected_return_time: reg.returnTime,
          reason: reg.reason || null,
          same_day: reg.sameDay,
          requester_id: user.id,
        };
      });
      const { data: inserted, error } = await supabase.from('dormitory_exit_requests').insert(records).select('id');
      if (error) throw error;

      // Upload đính kèm cho từng đơn (nếu có)
      const withFiles = registeredStudents
        .map((reg, idx) => ({ reg, id: inserted?.[idx]?.id }))
        .filter(x => x.reg.attachmentFile && x.id);
      if (withFiles.length > 0) {
        toast({ title: 'Đang tải ảnh đơn...', description: `${withFiles.length} ảnh sẽ được lưu lên Google Drive` });
        await Promise.all(withFiles.map(x => uploadAttachment(x.reg.attachmentFile!, x.id!)));
      }

      // Save data for image export
      const createdStudents = registeredStudents.map(reg => {
        const s = students.find(st => st.id === reg.studentId);
        return {
          name: s?.full_name || '',
          className: s?.class_id ? (classes.find(c => c.id === s.class_id)?.name || '') : '',
          exitDate: format(reg.exitDate, 'yyyy-MM-dd'),
          exitTime: reg.exitTime,
          returnDate: format(reg.returnDate, 'yyyy-MM-dd'),
          returnTime: reg.returnTime,
          reason: reg.reason || undefined,
          sameDay: reg.sameDay,
          hasAttachment: !!reg.attachmentFile,
        };
      });
      const profileRes = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      setLastCreatedStudents(createdStudents);
      setLastRequesterName(profileRes.data?.full_name || '');

      toast({ title: 'Đã gửi đơn', description: `Đã đăng ký ${registeredStudents.length} học sinh ra ngoài` });
      setShowCreateDialog(false);
      setShowExitRequestShare(true);
      setRegisteredStudents([]);
      setCurrentEditStudentId(null);
      fetchRequests();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const openApproveDialog = (ids: string[]) => {
    if (ids.length === 0) return;
    setApprovingIds(ids);
    setApproveDelegateTeacher(false);
    setApproveDelegateDuty(false);
    setShowApproveDialog(true);
  };

  const handleConfirmApprove = async () => {
    if (!user || approvingIds.length === 0) return;
    setIsApprovingDialog(true);
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({
          status: 'approved',
          approver_id: user.id,
          approved_at: new Date().toISOString(),
          delegated_to_teacher: approveDelegateTeacher,
          delegated_to_duty: approveDelegateDuty,
        })
        .in('id', approvingIds);
      if (error) throw error;
      toast({ title: 'Đã duyệt', description: `${approvingIds.length} đơn đã được phê duyệt` });
      setShowApproveDialog(false);
      setApprovingIds([]);
      setSelectedPending([]);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsApprovingDialog(false);
    }
  };

  const openEditRejected = (req: ExitRequest) => {
    setEditingRejected(req);
    setEditRejExitDate(req.exit_date ? new Date(req.exit_date) : new Date());
    setEditRejExitTime(req.exit_time?.slice(0, 5) || '');
    setEditRejReturnDate(req.return_date ? new Date(req.return_date) : new Date());
    setEditRejReturnTime(req.expected_return_time?.slice(0, 5) || '');
    setEditRejReason(req.reason || '');
    setEditRejAttachmentFile(null);
    setShowEditRejectedDialog(true);
  };

  const handleResubmitRejected = async () => {
    if (!editingRejected || !user) return;
    if (!editRejExitTime || !editRejReturnTime) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng nhập giờ ra và giờ vào', variant: 'destructive' });
      return;
    }
    setIsResubmitting(true);
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({
          status: 'pending',
          approver_id: null,
          approved_at: null,
          rejection_reason: null,
          exit_date: format(editRejExitDate, 'yyyy-MM-dd'),
          return_date: format(editRejReturnDate, 'yyyy-MM-dd'),
          request_date: format(editRejExitDate, 'yyyy-MM-dd'),
          exit_time: editRejExitTime,
          expected_return_time: editRejReturnTime,
          reason: editRejReason || null,
        })
        .eq('id', editingRejected.id);
      if (error) throw error;

      if (editRejAttachmentFile) {
        await uploadAttachment(editRejAttachmentFile, editingRejected.id);
      }

      toast({
        title: editingRejected.status === 'rejected' ? 'Đã gửi lại' : 'Đã cập nhật',
        description: 'Đơn đã chuyển về trạng thái chờ duyệt',
      });
      setShowEditRejectedDialog(false);
      setEditingRejected(null);
      fetchRequests();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsResubmitting(false);
    }
  };
  const handleReject = async () => {
    if (!rejectingId || !user) return;
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'rejected', approver_id: user.id, rejection_reason: rejectionReason || null })
        .eq('id', rejectingId);
      if (error) throw error;
      toast({ title: 'Đã từ chối' });
      setShowRejectDialog(false);
      setRejectingId(null);
      setRejectionReason('');
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleApproveAll = async () => {
    if (!user || pendingRequests.length === 0) return;
    try {
      const ids = pendingRequests.map(r => r.id);
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'approved', approver_id: user.id, approved_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      toast({ title: 'Đã duyệt tất cả', description: `${ids.length} đơn đã được phê duyệt` });
      setSelectedPending([]);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleBatchApprove = async () => {
    if (!user || selectedPending.length === 0) return;
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'approved', approver_id: user.id, approved_at: new Date().toISOString() })
        .in('id', selectedPending);
      if (error) throw error;
      toast({ title: 'Đã duyệt', description: `${selectedPending.length} đơn đã được phê duyệt` });
      setSelectedPending([]);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const handleBatchReject = async () => {
    if (!user || selectedPending.length === 0) return;
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'rejected', approver_id: user.id, rejection_reason: batchRejectionReason || null })
        .in('id', selectedPending);
      if (error) throw error;
      toast({ title: 'Đã từ chối', description: `${selectedPending.length} đơn đã bị từ chối` });
      setSelectedPending([]);
      setShowBatchRejectDialog(false);
      setBatchRejectionReason('');
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  // Revoke approved → back to pending
  const handleRevoke = async (requestId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'pending', approver_id: null, approved_at: null })
        .eq('id', requestId);
      if (error) throw error;
      toast({ title: 'Đã thu hồi', description: 'Đơn đã chuyển về trạng thái chờ duyệt' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  // Toggle "đã vào" status
  const handleToggleReturned = async (req: ExitRequest) => {
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ returned_at: req.returned_at ? null : new Date().toISOString() } as any)
        .eq('id', req.id);
      if (error) throw error;
      toast({ title: req.returned_at ? 'Đã bỏ đánh dấu' : 'Đã đánh dấu học sinh đã vào' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  // Delete request
  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('dormitory_exit_requests').delete().eq('id', deletingId);
      if (error) throw error;
      toast({ title: 'Đã xóa' });
      setShowDeleteDialog(false);
      setDeletingId(null);
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const rangeLabel = filterRange === 'day' ? format(selectedDate, 'dd-MM-yyyy') : filterRange === 'week' ? `Tuan_${format(selectedDate, 'dd-MM-yyyy')}` : format(selectedDate, 'MM-yyyy');
    const titleLabel = filterRange === 'day' ? `Ngày ${format(selectedDate, 'dd/MM/yyyy')}` : filterRange === 'week' ? `Tuần ${format(selectedDate, 'dd/MM/yyyy')}` : `Tháng ${format(selectedDate, 'MM/yyyy')}`;

    const headers = ['STT', 'Họ và tên', 'Lớp', 'Trong ngày', 'Ngày ra', 'Giờ ra', 'Ngày vào', 'Giờ vào', 'Trạng thái', 'Đã vào', 'Lý do', 'GVCN', 'Người duyệt', 'Thẩm quyền'];
    const statuses: Array<{ expired: boolean; label: string; minutes: number } | null> = [];
    const returnedFlags: boolean[] = [];

    const rows = approvedRequests.map((r, i) => {
      const rs = getReturnStatus(r);
      const isReturned = !!r.returned_at;
      // Hide expired status if student has returned
      const effectiveStatus = isReturned ? null : rs;
      statuses.push(effectiveStatus);
      returnedFlags.push(isReturned);
      return [
        i + 1,
        r.student?.full_name || '',
        r.class?.name || '',
        r.same_day ? '✓' : '',
        r.exit_date ? format(new Date(r.exit_date), 'dd/MM/yyyy') : format(new Date(r.request_date), 'dd/MM/yyyy'),
        r.exit_time?.slice(0, 5) || '',
        r.return_date ? format(new Date(r.return_date), 'dd/MM/yyyy') : '',
        r.expected_return_time?.slice(0, 5) || '',
        effectiveStatus ? (effectiveStatus.expired ? `Quá hạn ${effectiveStatus.label}` : `Còn ${effectiveStatus.label}`) : '',
        isReturned ? '✓' : '',
        r.reason || '',
        r.requester?.full_name || '',
        r.approver?.full_name || '',
        [r.delegated_to_teacher && 'GVCN', r.delegated_to_duty && 'Ca trực'].filter(Boolean).join(', '),
      ];
    });

    // Build sheet: title rows + header + data
    const aoa: any[][] = [
      ['DANH SÁCH HỌC SINH RA NGOÀI KTX'],
      [titleLabel],
      [`Tổng: ${approvedRequests.length} đơn  •  Đã vào: ${returnedFlags.filter(Boolean).length}  •  Xuất lúc: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Merge title rows across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    ];

    const headerRowIndex = 4;
    const dataStartRow = 5;

    applyProfessionalStyle(ws, {
      headerRowIndex,
      dataStartRow,
      dataRowCount: rows.length,
      numCols: headers.length,
      columnAlignments: getColumnAlignments(headers),
      numTitleRows: 3,
    });

    // Highlight "Trong ngày" column (index 3) with amber when ✓
    rows.forEach((row, idx) => {
      if (row[3] === '✓') {
        const cellRef = XLSX.utils.encode_cell({ r: dataStartRow + idx, c: 3 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: { fgColor: { rgb: 'FFE0B2' } },
            font: { ...ExcelFonts.cellBold, color: { rgb: 'E65100' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: ExcelBorders.thin,
          };
        }
      }
    });

    // Highlight "Trạng thái" column (index 8): red if expired, green if còn
    statuses.forEach((rs, idx) => {
      if (!rs) return;
      const cellRef = XLSX.utils.encode_cell({ r: dataStartRow + idx, c: 8 });
      if (!ws[cellRef]) return;
      const isExpired = rs.expired;
      ws[cellRef].s = {
        fill: { fgColor: { rgb: isExpired ? 'FFCDD2' : 'C8E6C9' } },
        font: { bold: true, sz: 10, color: { rgb: isExpired ? 'C62828' : '2E7D32' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: ExcelBorders.thin,
      };
    });

    // Highlight "Đã vào" column (index 9) with green when returned
    returnedFlags.forEach((isReturned, idx) => {
      if (!isReturned) return;
      const cellRef = XLSX.utils.encode_cell({ r: dataStartRow + idx, c: 9 });
      if (!ws[cellRef]) return;
      ws[cellRef].s = {
        fill: { fgColor: { rgb: 'C8E6C9' } },
        font: { bold: true, sz: 10, color: { rgb: '2E7D32' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: ExcelBorders.thin,
      };
    });

    fitColumnsToA4(ws, [5, 22, 8, 10, 11, 8, 11, 8, 16, 14, 22, 16, 16, 14]);

    // Set row heights for title and data
    ws['!rows'] = [
      { hpt: 24 }, // Title
      { hpt: 18 }, // Subtitle
      { hpt: 16 }, // Info
      { hpt: 8 },  // Spacer
      { hpt: 22 }, // Header
      ...rows.map(() => ({ hpt: 20 })),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ra vào KTX');
    XLSX.writeFile(wb, `Ra_vao_KTX_${rangeLabel}.xlsx`);
    toast({ title: 'Đã xuất Excel' });
  };

  const handleShareDownload = (mode: 'share' | 'download') => {
    if (imageRef.current) {
      const label = imageVariant === 'rejected' ? 'Tu choi ra KTX' : 'Ra vao KTX';
      const desc = imageVariant === 'rejected' ? 'Danh sách đơn bị từ chối' : 'Danh sách học sinh ra ngoài KTX';
      const title = `${label} - ${format(selectedDate, 'dd/MM/yyyy')}`;
      exportAndShare(imageRef, title, desc, mode);
    }
  };

  const getClassName = (classId: string | null) => {
    if (!classId) return '';
    return classes.find(c => c.id === classId)?.name || '';
  };

  // (live `now` clock declared earlier near other state)

  // Compute return-time status compared to current time
  const getReturnStatus = (req: ExitRequest): { expired: boolean; label: string; minutes: number } | null => {
    if (!req.expected_return_time) return null;
    const dateStr = req.return_date || req.exit_date || req.request_date;
    if (!dateStr) return null;
    try {
      const [h, m] = req.expected_return_time.split(':').map(Number);
      const ret = new Date(dateStr);
      ret.setHours(h || 0, m || 0, 0, 0);
      const diffMin = Math.round((ret.getTime() - now.getTime()) / 60000);
      const expired = diffMin < 0;
      const abs = Math.abs(diffMin);
      const days = Math.floor(abs / 1440);
      const hours = Math.floor((abs % 1440) / 60);
      const mins = abs % 60;
      let label = '';
      if (days > 0) label = `${days} ngày${hours > 0 ? ` ${hours}g` : ''}`;
      else if (hours > 0) label = `${hours}g${mins > 0 ? ` ${mins}p` : ''}`;
      else label = `${mins}p`;
      return { expired, label, minutes: diffMin };
    } catch {
      return null;
    }
  };

  // Helper to format exit/return date-time display
  const formatExitReturn = (req: ExitRequest) => {
    const eDateStr = req.exit_date ? format(new Date(req.exit_date), 'dd/MM') : format(new Date(req.request_date), 'dd/MM');
    const rDateStr = req.return_date ? format(new Date(req.return_date), 'dd/MM') : eDateStr;
    const eTime = req.exit_time?.slice(0, 5) || '';
    const rTime = req.expected_return_time?.slice(0, 5) || '';
    const sameDate = eDateStr === rDateStr;
    if (sameDate) return `${eDateStr} ${eTime} → ${rTime}`;
    return `${eDateStr} ${eTime} → ${rDateStr} ${rTime}`;
  };

  const dateLabel = filterRange === 'day'
    ? format(selectedDate, 'EEEE, dd/MM/yyyy', { locale: vi })
    : filterRange === 'week'
      ? `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`
      : `Tháng ${format(selectedDate, 'MM/yyyy')}`;

  const imageStudents = approvedRequests.map(r => ({
    name: r.student?.full_name || '',
    className: r.class?.name || '',
    exitDate: r.exit_date || r.request_date,
    exitTime: r.exit_time || '',
    returnDate: r.return_date || r.exit_date || r.request_date,
    returnTime: r.expected_return_time || '',
    reason: r.reason || undefined,
    sameDay: r.same_day,
    delegatedToTeacher: r.delegated_to_teacher,
    delegatedToDuty: r.delegated_to_duty,
  }));

  const rejectedImageStudents = rejectedRequests.map(r => ({
    name: r.student?.full_name || '',
    className: r.class?.name || '',
    exitDate: r.exit_date || r.request_date,
    exitTime: r.exit_time || '',
    returnDate: r.return_date || r.exit_date || r.request_date,
    returnTime: r.expected_return_time || '',
    reason: r.reason || undefined,
    sameDay: r.same_day,
    rejectionReason: r.rejection_reason || undefined,
  }));

  return (
    <div className="space-y-4 p-4 pb-24 lg:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-primary" />
            Ra vào KTX
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-400 gap-1.5"
            onClick={async () => {
              try {
                const res = await fetch('/mau-don-xin-nghi-ve-nha.docx');
                if (!res.ok) throw new Error('Không tải được file');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Mau-don-xin-nghi-ve-nha.docx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                toast({ title: 'Đã tải xuống', description: 'Mẫu đơn xin nghỉ về nhà đã được lưu vào máy.' });
              } catch (err: any) {
                toast({ title: 'Lỗi tải mẫu đơn', description: err.message, variant: 'destructive' });
              }
            }}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Tải mẫu đơn</span>
            <span className="sm:hidden">Mẫu đơn</span>
          </Button>
          {canCreate && (
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Đăng ký
            </Button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="cursor-pointer" onClick={() => setActiveTab('requests')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{pendingRequests.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Chờ duyệt</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setActiveTab('approved')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{approvedRequests.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Đã duyệt</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setActiveTab('rejected')}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-destructive">{rejectedRequests.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Từ chối</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, 'dd/MM/yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} locale={vi} />
          </PopoverContent>
        </Popover>

        <Select value={filterRange} onValueChange={(v) => setFilterRange(v as FilterRange)}>
          <SelectTrigger className="w-[100px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Ngày</SelectItem>
            <SelectItem value="week">Tuần</SelectItem>
            <SelectItem value="month">Tháng</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1 min-w-[120px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tìm HS..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
        </div>

        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => { setStatsData(null); setShowStatsDialog(true); }} title="Thống kê theo giai đoạn">
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={approvedRequests.length === 0} title="Xuất Excel">
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)} disabled={approvedRequests.length === 0 && rejectedRequests.length === 0} title="Xuất ảnh">
            <Image className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests" className="text-xs sm:text-sm">
            Chờ duyệt {pendingRequests.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]" variant="destructive">{pendingRequests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs sm:text-sm">Đã duyệt</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs sm:text-sm">Từ chối</TabsTrigger>
        </TabsList>

        {/* Pending tab */}
        <TabsContent value="requests" className="space-y-2 mt-2">
          {canApprove && pendingRequests.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedPending.length === pendingRequests.length && pendingRequests.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedPending(pendingRequests.map(r => r.id));
                    } else {
                      setSelectedPending([]);
                    }
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedPending.length > 0 ? `Đã chọn ${selectedPending.length}/${pendingRequests.length}` : 'Chọn tất cả'}
                </span>
              </div>
              <div className="flex gap-1">
                {selectedPending.length > 0 ? (
                  <>
                    <Button size="sm" onClick={() => openApproveDialog(selectedPending)}>
                      <Check className="h-4 w-4 mr-1" /> Duyệt ({selectedPending.length})
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setShowBatchRejectDialog(true)}>
                      <X className="h-4 w-4 mr-1" /> Từ chối ({selectedPending.length})
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => openApproveDialog(pendingRequests.map(r => r.id))}>
                    <Check className="h-4 w-4 mr-1" /> Duyệt tất cả ({pendingRequests.length})
                  </Button>
                )}
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : pendingRequests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Không có đơn chờ duyệt</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <Card key={req.id} className={cn(selectedPending.includes(req.id) && "ring-1 ring-primary")}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      {canApprove && (
                        <Checkbox
                          checked={selectedPending.includes(req.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPending(prev => [...prev, req.id]);
                            } else {
                              setSelectedPending(prev => prev.filter(id => id !== req.id));
                            }
                          }}
                          className="mt-1 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{req.student?.full_name}</span>
                          <Badge variant="secondary" className="text-[10px]">{req.class?.name}</Badge>
                          {req.same_day && <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Trong ngày</Badge>}
                          {req.delegated_to_teacher && <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">GVCN</Badge>}
                          {req.delegated_to_duty && <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">Ca trực</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatExitReturn(req)}</span>
                        </div>
                        {req.reason && <p className="text-xs text-muted-foreground mt-1">Lý do: {req.reason}</p>}
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <p className="text-[10px] text-muted-foreground">GVCN: {req.requester?.full_name}</p>
                          {req.attachment_url && (
                            <a href={req.attachment_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary inline-flex items-center gap-0.5 hover:underline">
                              <Paperclip className="h-3 w-3" /> Xem ảnh đơn
                            </a>
                          )}
                          {(canCreate || canApprove) && (
                            <label className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 cursor-pointer hover:text-primary">
                              {uploadingId === req.id ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Đang tải...</>
                              ) : (
                                <><Upload className="h-3 w-3" /> {req.attachment_url ? 'Thay ảnh' : 'Tải ảnh đơn'}</>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingId === req.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadForRequest(req.id, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {canApprove && (
                          <>
                            <Button size="icon" variant="default" className="h-8 w-8" onClick={() => openApproveDialog([req.id])} title="Duyệt">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={() => { setRejectingId(req.id); setShowRejectDialog(true); }} title="Từ chối">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {canEditRequest(req) && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => openEditRejected(req)} title="Sửa đơn">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete ? (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(req.id); setShowDeleteDialog(true); }} title="Xóa">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : req.requester_id === user?.id && (
                          <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => { setDeletingId(req.id); setShowDeleteDialog(true); }} title="Rút đơn">
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Rút đơn
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Approved tab */}
        <TabsContent value="approved" className="mt-2 space-y-2">
          {approvedRequests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Không có đơn đã duyệt</CardContent></Card>
          ) : (
            <>
              {/* Filter chips */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: 'all' as const, label: 'Tất cả', count: approvedCounts.all, cls: 'border-border' },
                  { key: 'not_returned' as const, label: 'Chưa vào', count: approvedCounts.notReturned, cls: 'border-amber-300 text-amber-800 data-[on=true]:bg-amber-100' },
                  { key: 'returned' as const, label: 'Đã vào', count: approvedCounts.returned, cls: 'border-emerald-300 text-emerald-800 data-[on=true]:bg-emerald-100' },
                  { key: 'expired' as const, label: 'Quá hạn', count: approvedCounts.expired, cls: 'border-red-300 text-red-800 data-[on=true]:bg-red-100' },
                ]).map(opt => {
                  const on = approvedFilter === opt.key;
                  return (
                    <Button
                      key={opt.key}
                      type="button"
                      data-on={on}
                      variant={on ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 text-xs px-2 ${on ? '' : opt.cls}`}
                      onClick={() => setApprovedFilter(opt.key)}
                    >
                      {opt.label} <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{opt.count}</Badge>
                    </Button>
                  );
                })}
                {(() => {
                  const classOpts = Array.from(
                    new Map(
                      approvedRequests
                        .filter(r => r.class_id)
                        .map(r => [r.class_id as string, r.class?.name || '—'])
                    ).entries()
                  ).sort((a, b) => a[1].localeCompare(b[1], 'vi'));
                  if (classOpts.length <= 1) return null;
                  return (
                    <Select value={approvedClassFilter} onValueChange={setApprovedClassFilter}>
                      <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs px-2">
                        <SelectValue placeholder="Lớp" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả lớp</SelectItem>
                        {classOpts.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
              {filteredApprovedRequests.length === 0 && (
                <Card><CardContent className="py-6 text-center text-muted-foreground text-xs">Không có học sinh phù hợp với bộ lọc</CardContent></Card>
              )}
              {Array.from(approvedByClass.entries())
                .sort((a, b) => {
                  // Teacher's homeroom class first
                  if (teacherClassName) {
                    if (a[0] === teacherClassName) return -1;
                    if (b[0] === teacherClassName) return 1;
                  }
                  return a[0].localeCompare(b[0], 'vi');
                })
                .map(([className, classReqs]) => (
                  <Card key={className} className={teacherClassName && className === teacherClassName ? 'border-primary/60 bg-primary/5' : ''}>
                    <CardHeader className="pb-1 px-3 pt-3">
                      <CardTitle className="text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                          {className}
                          {teacherClassName && className === teacherClassName && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-primary/15 text-primary border-primary/30">Lớp chủ nhiệm</Badge>
                          )}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{classReqs.length} HS</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-1">
                      <div className="space-y-1.5">
                        {classReqs.map(req => {
                          const rs = getReturnStatus(req);
                          const isReturned = !!req.returned_at;
                          return (
                          <div key={req.id} className={`flex items-center justify-between text-xs border-b last:border-0 pb-1.5 last:pb-0 ${isReturned ? 'opacity-70' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <span className={`font-medium ${isReturned ? 'line-through' : ''}`}>{req.student?.full_name}</span>
                              <span className="text-muted-foreground ml-2">
                                {formatExitReturn(req)}
                              </span>
                              {isReturned ? (
                                <Badge className="ml-1.5 text-[9px] px-1 py-0 border bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200" title={`Đã vào lúc ${format(new Date(req.returned_at!), 'HH:mm dd/MM')}`}>
                                  ✓ Đã vào
                                </Badge>
                              ) : rs && (
                                <Badge
                                  className={`ml-1.5 text-[9px] px-1 py-0 border ${
                                    rs.expired
                                      ? 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200'
                                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
                                  }`}
                                  title={rs.expired ? 'Đã quá giờ về' : 'Còn lại đến giờ về'}
                                >
                                  {rs.expired ? `Quá hạn ${rs.label}` : `Còn ${rs.label}`}
                                </Badge>
                              )}
                              {req.same_day && <Badge className="ml-1.5 text-[9px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 px-1 py-0">Trong ngày</Badge>}
                              {req.delegated_to_teacher && <Badge variant="outline" className="ml-1 text-[9px] border-blue-300 text-blue-700 px-1 py-0">GVCN</Badge>}
                              {req.delegated_to_duty && <Badge variant="outline" className="ml-1 text-[9px] border-purple-300 text-purple-700 px-1 py-0">Ca trực</Badge>}
                              {req.reason && <span className="text-muted-foreground"> • {req.reason}</span>}
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              {(() => {
                                const canMark = isSuperAdmin || isSchoolAdmin() || hasPermission('dormitory_exit', 'edit') ||
                                  (isClassTeacher && currentMembership?.class_id && req.class_id === currentMembership.class_id);
                                if (!canMark) return null;
                                return (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={`h-6 w-6 ${isReturned ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground'}`}
                                    onClick={() => handleToggleReturned(req)}
                                    title={isReturned ? 'Bỏ đánh dấu đã vào' : 'Đánh dấu đã vào'}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                );
                              })()}
                              {canDelete && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-600" onClick={() => handleRevoke(req.id)} title="Thu hồi">
                                    <Undo2 className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { setDeletingId(req.id); setShowDeleteDialog(true); }} title="Xóa">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </>
          )}
        </TabsContent>

        {/* Rejected tab */}
        <TabsContent value="rejected" className="mt-2 space-y-2">
          {rejectedRequests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Không có đơn bị từ chối</CardContent></Card>
          ) : rejectedRequests.map(req => (
            <Card key={req.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{req.student?.full_name}</span>
                      <Badge variant="secondary" className="text-[10px]">{req.class?.name}</Badge>
                      {req.same_day && <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Trong ngày</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatExitReturn(req)}</span>
                    </div>
                    {req.reason && <p className="text-xs text-muted-foreground mt-1">Lý do: {req.reason}</p>}
                    {req.rejection_reason && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {req.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEditRequest(req) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-primary border-primary/40 hover:bg-primary/10"
                        onClick={() => openEditRejected(req)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Sửa & gửi lại
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(req.id); setShowDeleteDialog(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create request dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) { setRegisteredStudents([]); setCurrentEditStudentId(null); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Đăng ký ra ngoài KTX</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Current student edit form */}
            {currentEditStudentId && (() => {
              const s = students.find(st => st.id === currentEditStudentId);
              if (!s) return null;
              return (
                <Card className="border-primary">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">{s.full_name}</span>
                        <Badge variant="secondary" className="ml-2 text-[10px]">{getClassName(s.class_id || null)}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentEditStudentId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Ngày ra</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal mt-1 h-9 text-sm">
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {format(editExitDate, 'dd/MM/yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={editExitDate} onSelect={(d) => { if (d) { setEditExitDate(d); if (d > editReturnDate) setEditReturnDate(d); }}} locale={vi} className="pointer-events-auto" /></PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs">Giờ ra</Label>
                        <Input type="time" value={editExitTime} onChange={(e) => setEditExitTime(e.target.value)} className="mt-1 h-9 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Ngày vào</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal mt-1 h-9 text-sm">
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {format(editReturnDate, 'dd/MM/yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={editReturnDate} onSelect={(d) => d && setEditReturnDate(d)} locale={vi} className="pointer-events-auto" /></PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs">Giờ vào</Label>
                        <Input type="time" value={editReturnTime} onChange={(e) => setEditReturnTime(e.target.value)} className="mt-1 h-9 text-sm" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
                      <Checkbox
                        checked={editSameDay}
                        onCheckedChange={(c) => setEditSameDay(c as boolean)}
                      />
                      <span className="text-xs font-medium text-amber-900">Xin ra trong ngày</span>
                    </label>
                    <div>
                      <Label className="text-xs">Lý do (không bắt buộc)</Label>
                      <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Nhập lý do..." className="mt-1 text-sm" rows={2} />
                    </div>
                    <div>
                      <Label className="text-xs">Ảnh đơn (tải lên Google Drive)</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <label
                          htmlFor="exit-attachment-input"
                          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-colors"
                        >
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Upload className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {editAttachmentFile ? (
                              <>
                                <p className="text-xs font-medium text-blue-700 truncate">📎 {editAttachmentFile.name}</p>
                                <p className="text-[10px] text-muted-foreground">Bấm để chọn ảnh khác</p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs font-medium text-blue-700">Chọn ảnh đơn từ thiết bị</p>
                                <p className="text-[10px] text-muted-foreground">Hoặc chụp ảnh trực tiếp</p>
                              </>
                            )}
                          </div>
                          <input
                            id="exit-attachment-input"
                            type="file"
                            accept="image/*"
                            onChange={(e) => setEditAttachmentFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                        {editAttachmentFile && (
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setEditAttachmentFile(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button size="sm" className="w-full" onClick={handleConfirmStudent} disabled={!editExitTime || !editReturnTime}>
                      <Check className="h-4 w-4 mr-1" /> Xác nhận
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Registered students list */}
            {registeredStudents.length > 0 && (
              <div className="border rounded-md bg-primary/5 p-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-primary">Đã thêm ({registeredStudents.length} HS)</span>
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setRegisteredStudents([])}>
                    <X className="h-3 w-3 mr-0.5" />Xoá tất cả
                  </Button>
                </div>
                <div className="space-y-1">
                  {registeredStudents.map(reg => {
                    const s = students.find(st => st.id === reg.studentId);
                    if (!s) return null;
                    const cls = getClassName(s.class_id || null);
                    return (
                      <div key={reg.studentId} className="flex items-center justify-between bg-background rounded px-2 py-1 text-xs">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{s.full_name}</span>
                          {cls && <span className="text-muted-foreground ml-1.5">({cls})</span>}
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {format(reg.exitDate, 'dd/MM')} {reg.exitTime} → {format(reg.returnDate, 'dd/MM')} {reg.returnTime}
                            </span>
                            {reg.reason && <span>• {reg.reason}</span>}
                            {reg.attachmentFile && <span className="text-primary">📎 {reg.attachmentFile.name}</span>}
                            {reg.sameDay && <span className="text-amber-700 font-medium">• Trong ngày</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleRemoveRegistered(reg.studentId)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Student picker - only show when not editing a student */}
            {!currentEditStudentId && (
              <div>
                <Label className="text-xs">Chọn học sinh để thêm</Label>
                <Input placeholder="Tìm học sinh..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="mt-1 mb-1.5 h-8 text-sm" />
                <div className="border rounded-md max-h-[250px] overflow-y-auto">
                  {(() => {
                    const registeredIds = registeredStudents.map(r => r.studentId);
                    const unregistered = availableStudents.filter(s => !registeredIds.includes(s.id));
                    const grouped = new Map<string, typeof unregistered>();
                    unregistered.forEach(s => {
                      const clsName = getClassName(s.class_id || null) || 'Khác';
                      if (!grouped.has(clsName)) grouped.set(clsName, []);
                      grouped.get(clsName)!.push(s);
                    });
                    const entries = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));

                    if (entries.length === 0) return <p className="text-center py-4 text-sm text-muted-foreground">Không còn học sinh</p>;

                    return entries.map(([clsName, group]) => (
                      <div key={clsName} className="border-b last:border-b-0">
                        <div className="flex items-center gap-2 p-2 bg-muted/30">
                          <span className="font-medium text-sm">{clsName}</span>
                          <Badge variant="secondary" className="text-[10px]">{group.length}</Badge>
                        </div>
                        <div className="px-2 pb-2">
                          <div className="grid grid-cols-3 gap-0.5">
                            {group.map(student => (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => handleSelectStudent(student.id)}
                                className="flex items-center gap-1 px-1.5 py-1 rounded text-left transition-colors hover:bg-primary/10 hover:text-primary"
                              >
                                <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="truncate text-[11px] leading-tight">{student.full_name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Hủy</Button>
            <Button onClick={handleCreateRequest} disabled={isSaving || registeredStudents.length === 0}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Kết thúc & Chia sẻ ({registeredStudents.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog with delegation */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duyệt đơn ra ngoài</DialogTitle>
            <DialogDescription>
              Phê duyệt {approvingIds.length} đơn. Có thể chuyển thẩm quyền giám sát cho GVCN và/hoặc Ca trực.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Chuyển thẩm quyền (tuỳ chọn)</Label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors">
              <Checkbox checked={approveDelegateTeacher} onCheckedChange={(c) => setApproveDelegateTeacher(c as boolean)} />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900">GVCN</div>
                <div className="text-[11px] text-blue-700">Giáo viên chủ nhiệm chịu trách nhiệm theo dõi</div>
              </div>
            </label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-purple-200 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors">
              <Checkbox checked={approveDelegateDuty} onCheckedChange={(c) => setApproveDelegateDuty(c as boolean)} />
              <div className="flex-1">
                <div className="text-sm font-medium text-purple-900">Ca trực</div>
                <div className="text-[11px] text-purple-700">Người trực ngày đó chịu trách nhiệm theo dõi</div>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={isApprovingDialog}>Hủy</Button>
            <Button onClick={handleConfirmApprove} disabled={isApprovingDialog}>
              {isApprovingDialog && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Check className="h-4 w-4 mr-1" /> Duyệt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Từ chối đơn ra ngoài</DialogTitle></DialogHeader>
          <div>
            <Label>Lý do từ chối (không bắt buộc)</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Nhập lý do..." className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleReject}>Từ chối</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch reject dialog */}
      <Dialog open={showBatchRejectDialog} onOpenChange={setShowBatchRejectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Từ chối {selectedPending.length} đơn</DialogTitle></DialogHeader>
          <div>
            <Label>Lý do từ chối (không bắt buộc)</Label>
            <Textarea value={batchRejectionReason} onChange={(e) => setBatchRejectionReason(e.target.value)} placeholder="Nhập lý do..." className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchRejectDialog(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleBatchReject}>Từ chối ({selectedPending.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit & resubmit rejected dialog */}
      <Dialog open={showEditRejectedDialog} onOpenChange={setShowEditRejectedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> {editingRejected?.status === 'pending' ? 'Sửa đơn' : 'Sửa & gửi lại đơn'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingRejected?.student?.full_name} {editingRejected?.class?.name && `(${editingRejected.class.name})`}
            </DialogDescription>
          </DialogHeader>
          {editingRejected?.rejection_reason && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2 text-xs text-destructive flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span><span className="font-semibold">Lý do từ chối:</span> {editingRejected.rejection_reason}</span>
            </div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ngày ra</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start mt-1 h-9 text-xs font-normal">
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {format(editRejExitDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editRejExitDate} onSelect={(d) => d && setEditRejExitDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Giờ ra</Label>
                <Input type="time" value={editRejExitTime} onChange={(e) => setEditRejExitTime(e.target.value)} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Ngày về</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start mt-1 h-9 text-xs font-normal">
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {format(editRejReturnDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editRejReturnDate} onSelect={(d) => d && setEditRejReturnDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Giờ về</Label>
                <Input type="time" value={editRejReturnTime} onChange={(e) => setEditRejReturnTime(e.target.value)} className="mt-1 h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Lý do</Label>
              <Textarea value={editRejReason} onChange={(e) => setEditRejReason(e.target.value)} className="mt-1 text-sm" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Ảnh đơn (tùy chọn — thay thế ảnh cũ nếu chọn)</Label>
              <div className="flex items-center gap-2 mt-1">
                <label className="flex-1">
                  <Button type="button" variant="outline" size="sm" className="w-full h-9 text-xs cursor-pointer" asChild>
                    <span>
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      {editRejAttachmentFile ? editRejAttachmentFile.name : 'Chọn ảnh đơn'}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditRejAttachmentFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {editRejAttachmentFile && (
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setEditRejAttachmentFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditRejectedDialog(false)}>Hủy</Button>
            <Button onClick={handleResubmitRejected} disabled={isResubmitting}>
              {isResubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingRejected?.status === 'pending' ? 'Lưu' : 'Gửi lại'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Xác nhận xóa</DialogTitle></DialogHeader>
          <DialogDescription>Bạn có chắc chắn muốn xóa đơn này? Hành động này không thể hoàn tác.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Request Image Share Dialog */}
      <Dialog open={showExitRequestShare} onOpenChange={setShowExitRequestShare}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Xuất ảnh đơn xin ra ngoài
            </DialogTitle>
          </DialogHeader>
          {lastCreatedStudents.length > 0 && (
            <>
              <div className="flex justify-center overflow-x-auto py-4">
                <div className="scale-75 origin-top">
                  <ExitRequestImageCard
                    ref={exitRequestImageRef}
                    schoolName={currentSchool?.name || ''}
                    requesterName={lastRequesterName}
                    students={lastCreatedStudents}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => exportAndShare(exitRequestImageRef, `Don_xin_ra_ngoai`, 'Đơn xin ra ngoài KTX', 'download')} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                  Tải ảnh
                </Button>
                <Button className="flex-1" onClick={() => exportAndShare(exitRequestImageRef, `Don_xin_ra_ngoai`, 'Đơn xin ra ngoài KTX', 'share')} disabled={isExporting}>
                  {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
                  Chia sẻ
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Share/Download image dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Xuất ảnh báo cáo
            </DialogTitle>
          </DialogHeader>
          <Tabs value={imageVariant} onValueChange={(v) => setImageVariant(v as 'approved' | 'rejected')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="approved" className="text-xs">
                Danh sách duyệt ({approvedRequests.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs">
                Danh sách từ chối ({rejectedRequests.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex justify-center overflow-x-auto py-4">
            <div className="scale-75 origin-top">
              <DormitoryExitImageCard
                ref={imageRef}
                schoolName={currentSchool?.name || ''}
                title={imageVariant === 'rejected' ? 'ĐƠN XIN RA KTX BỊ TỪ CHỐI' : 'DANH SÁCH DUYỆT RA KTX'}
                date={format(selectedDate, 'yyyy-MM-dd')}
                totalApproved={imageVariant === 'rejected' ? rejectedRequests.length : approvedRequests.length}
                students={imageVariant === 'rejected' ? rejectedImageStudents : imageStudents}
                variant={imageVariant}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleShareDownload('download')} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Tải ảnh
            </Button>
            <Button className="flex-1" onClick={() => handleShareDownload('share')} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
              Chia sẻ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Statistics by period dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Thống kê ra vào theo giai đoạn</DialogTitle>
            <DialogDescription>Chọn khoảng thời gian để thống kê đơn đã duyệt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Từ ngày</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-9 text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(statsFromDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={statsFromDate} onSelect={(d) => d && setStatsFromDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Đến ngày</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-9 text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(statsToDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={statsToDate} onSelect={(d) => d && setStatsToDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  if (!currentSchool) return;
                  setIsLoadingStats(true);
                  try {
                    const from = format(statsFromDate, 'yyyy-MM-dd');
                    const to = format(statsToDate, 'yyyy-MM-dd');
                    const { data, error } = await supabase
                      .from('dormitory_exit_requests')
                      .select('*, student:students(full_name, student_code, class_id), class:classes(name)')
                      .eq('school_id', currentSchool.id)
                      .eq('status', 'approved')
                      .gte('request_date', from)
                      .lte('request_date', to);
                    if (error) throw error;
                    setStatsData((data || []) as any);
                  } catch (e: any) {
                    toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
                  } finally {
                    setIsLoadingStats(false);
                  }
                }}
                disabled={isLoadingStats}
              >
                {isLoadingStats ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Thống kê
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const today = new Date();
                setStatsFromDate(startOfWeek(today, { weekStartsOn: 1 }));
                setStatsToDate(endOfWeek(today, { weekStartsOn: 1 }));
              }}>Tuần này</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const today = new Date();
                setStatsFromDate(startOfMonth(today));
                setStatsToDate(endOfMonth(today));
              }}>Tháng này</Button>
            </div>

            {statsData && (() => {
              const total = statsData.length;
              let returned = 0, notReturned = 0, expired = 0;
              const byClass = new Map<string, { total: number; returned: number; notReturned: number; expired: number }>();
              statsData.forEach(req => {
                const isReturned = !!req.returned_at;
                const cls = req.class?.name || 'Không rõ';
                if (!byClass.has(cls)) byClass.set(cls, { total: 0, returned: 0, notReturned: 0, expired: 0 });
                const entry = byClass.get(cls)!;
                entry.total++;
                if (isReturned) { returned++; entry.returned++; }
                else {
                  notReturned++; entry.notReturned++;
                  if (req.expected_return_time) {
                    const dateStr = req.return_date || req.exit_date || req.request_date;
                    if (dateStr) {
                      try {
                        const [h, m] = req.expected_return_time.split(':').map(Number);
                        const ret = new Date(dateStr);
                        ret.setHours(h || 0, m || 0, 0, 0);
                        if (ret.getTime() < now.getTime()) { expired++; entry.expired++; }
                      } catch {}
                    }
                  }
                }
              });
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    <Card><CardContent className="p-2 text-center"><div className="text-[10px] text-muted-foreground">Tổng đơn</div><div className="text-lg font-bold">{total}</div></CardContent></Card>
                    <Card><CardContent className="p-2 text-center"><div className="text-[10px] text-muted-foreground">Đã vào</div><div className="text-lg font-bold text-emerald-600">{returned}</div></CardContent></Card>
                    <Card><CardContent className="p-2 text-center"><div className="text-[10px] text-muted-foreground">Chưa vào</div><div className="text-lg font-bold text-amber-600">{notReturned}</div></CardContent></Card>
                    <Card><CardContent className="p-2 text-center"><div className="text-[10px] text-muted-foreground">Quá hạn</div><div className="text-lg font-bold text-red-600">{expired}</div></CardContent></Card>
                  </div>
                  {byClass.size > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Lớp</TableHead>
                            <TableHead className="text-xs text-center">Tổng</TableHead>
                            <TableHead className="text-xs text-center">Đã vào</TableHead>
                            <TableHead className="text-xs text-center">Chưa vào</TableHead>
                            <TableHead className="text-xs text-center">Quá hạn</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from(byClass.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([cls, s]) => (
                            <TableRow key={cls}>
                              <TableCell className="text-xs font-medium py-1.5">{cls}</TableCell>
                              <TableCell className="text-xs text-center py-1.5">{s.total}</TableCell>
                              <TableCell className="text-xs text-center py-1.5 text-emerald-700">{s.returned}</TableCell>
                              <TableCell className="text-xs text-center py-1.5 text-amber-700">{s.notReturned}</TableCell>
                              <TableCell className="text-xs text-center py-1.5 text-red-700">{s.expired}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {total === 0 && <div className="text-center text-xs text-muted-foreground py-4">Không có dữ liệu trong khoảng thời gian này</div>}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
