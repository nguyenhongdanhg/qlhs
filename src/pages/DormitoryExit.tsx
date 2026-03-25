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
import { Loader2, Plus, CalendarIcon, Check, X, Search, Share2, FileSpreadsheet, Clock, DoorOpen, AlertCircle, Trash2, Undo2, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, Class } from '@/types';
import { DormitoryExitImageCard } from '@/components/dormitory/DormitoryExitImageCard';
import * as XLSX from 'xlsx-js-style';

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
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [exitTime, setExitTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [reason, setReason] = useState('');
  const [requestDate, setRequestDate] = useState<Date>(new Date());
  const [exitDate, setExitDate] = useState<Date>(new Date());
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Reject dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Share dialog
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Delete confirm dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Batch selection for pending requests
  const [selectedPending, setSelectedPending] = useState<string[]>([]);

  // Batch reject dialog
  const [showBatchRejectDialog, setShowBatchRejectDialog] = useState(false);
  const [batchRejectionReason, setBatchRejectionReason] = useState('');

  const isClassTeacher = currentMembership?.role === 'class_teacher';
  const canApprove = isSchoolAdmin() || isSuperAdmin || hasPermission('dormitory_exit', 'edit');
  const canDelete = isSchoolAdmin() || isSuperAdmin;
  const canCreate = isClassTeacher || isSchoolAdmin() || isSuperAdmin || hasPermission('dormitory_exit', 'create');

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

  // Group approved by class for stats display
  const approvedByClass = useMemo(() => {
    const map = new Map<string, ExitRequest[]>();
    approvedRequests.forEach(r => {
      const cls = r.class?.name || 'Không rõ';
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(r);
    });
    return map;
  }, [approvedRequests]);

  const handleCreateRequest = async () => {
    if (!currentSchool || !user || selectedStudents.length === 0 || !exitTime || !returnTime) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng chọn học sinh, giờ ra và giờ về', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const records = selectedStudents.map(studentId => {
        const student = students.find(s => s.id === studentId);
        return {
          school_id: currentSchool.id,
          student_id: studentId,
          class_id: student?.class_id || null,
          request_date: format(exitDate, 'yyyy-MM-dd'),
          exit_date: format(exitDate, 'yyyy-MM-dd'),
          return_date: format(returnDate, 'yyyy-MM-dd'),
          exit_time: exitTime,
          expected_return_time: returnTime,
          reason: reason || null,
          requester_id: user.id,
        };
      });
      const { error } = await supabase.from('dormitory_exit_requests').insert(records);
      if (error) throw error;
      toast({ title: 'Đã gửi đơn', description: `Đã đăng ký ${selectedStudents.length} học sinh ra ngoài` });
      setShowCreateDialog(false);
      setSelectedStudents([]);
      setExitTime('');
      setReturnTime('');
      setExitDate(new Date());
      setReturnDate(new Date());
      setReason('');
      fetchRequests();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'approved', approver_id: user.id, approved_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;
      const request = requests.find(r => r.id === requestId);
      if (request) await autoMarkExcused(request);
      toast({ title: 'Đã duyệt', description: 'Đơn ra ngoài đã được phê duyệt' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  const autoMarkExcused = async (request: ExitRequest) => {
    if (!currentSchool || !user) return;
    const exitMinutes = timeToMinutes(request.exit_time);
    const returnMinutes = timeToMinutes(request.expected_return_time);
    const mealTimes: Record<string, [number, number]> = {
      breakfast: [360, 480], lunch: [660, 780], dinner: [1020, 1140],
      boarding: [360, 1380], evening_study: [1140, 1320],
    };
    const types: Array<'boarding' | 'breakfast' | 'lunch' | 'dinner' | 'evening_study'> = ['boarding', 'breakfast', 'lunch', 'dinner', 'evening_study'];
    const overlapping = types.filter(type => {
      const [start, end] = mealTimes[type];
      return exitMinutes < end && returnMinutes > start;
    });
    if (overlapping.length === 0) return;
    const records = overlapping.map(type => ({
      school_id: currentSchool.id,
      student_id: request.student_id,
      class_id: request.class_id,
      attendance_date: request.request_date,
      attendance_type: type,
      status: 'excused' as const,
      excused_reason: 'RP',
      notes: `Ra ngoài KTX: ${request.exit_time?.slice(0,5)} - ${request.expected_return_time?.slice(0,5)}${request.reason ? ` (${request.reason})` : ''}`,
      reporter_id: user.id,
    }));
    await supabase.from('attendance_records').insert(records);
  };

  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
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
      for (const req of pendingRequests) await autoMarkExcused(req);
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
      const selected = pendingRequests.filter(r => selectedPending.includes(r.id));
      for (const req of selected) await autoMarkExcused(req);
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
    const data = approvedRequests.map((r, i) => ({
      'STT': i + 1,
      'Họ và tên': r.student?.full_name || '',
      'Lớp': r.class?.name || '',
      'Ngày': format(new Date(r.request_date), 'dd/MM/yyyy'),
      'Giờ ra': r.exit_time?.slice(0, 5) || '',
      'Giờ về': r.expected_return_time?.slice(0, 5) || '',
      'Lý do': r.reason || '',
      'GVCN': r.requester?.full_name || '',
      'Người duyệt': r.approver?.full_name || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ra vào KTX');
    ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 20 }];
    const rangeLabel = filterRange === 'day' ? format(selectedDate, 'dd-MM-yyyy') : filterRange === 'week' ? `Tuan_${format(selectedDate, 'dd-MM-yyyy')}` : format(selectedDate, 'MM-yyyy');
    XLSX.writeFile(wb, `Ra_vao_KTX_${rangeLabel}.xlsx`);
    toast({ title: 'Đã xuất Excel' });
  };

  const handleShareDownload = (mode: 'share' | 'download') => {
    if (imageRef.current) {
      const title = `Ra vào KTX - ${format(selectedDate, 'dd/MM/yyyy')}`;
      exportAndShare(imageRef, title, 'Danh sách học sinh ra ngoài KTX', mode);
    }
  };

  const getClassName = (classId: string | null) => {
    if (!classId) return '';
    return classes.find(c => c.id === classId)?.name || '';
  };

  const dateLabel = filterRange === 'day'
    ? format(selectedDate, 'EEEE, dd/MM/yyyy', { locale: vi })
    : filterRange === 'week'
      ? `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`
      : `Tháng ${format(selectedDate, 'MM/yyyy')}`;

  const imageStudents = approvedRequests.map(r => ({
    name: r.student?.full_name || '',
    className: r.class?.name || '',
    exitTime: r.exit_time?.slice(0, 5) || '',
    returnTime: r.expected_return_time?.slice(0, 5) || '',
    reason: r.reason || undefined,
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
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Đăng ký
          </Button>
        )}
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
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={approvedRequests.length === 0} title="Xuất Excel">
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)} disabled={approvedRequests.length === 0} title="Xuất ảnh">
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
                    <Button size="sm" onClick={handleBatchApprove}>
                      <Check className="h-4 w-4 mr-1" /> Duyệt ({selectedPending.length})
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setShowBatchRejectDialog(true)}>
                      <X className="h-4 w-4 mr-1" /> Từ chối ({selectedPending.length})
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleApproveAll}>
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
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{format(new Date(req.request_date), 'dd/MM')}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{req.exit_time?.slice(0, 5)} → {req.expected_return_time?.slice(0, 5)}</span>
                        </div>
                        {req.reason && <p className="text-xs text-muted-foreground mt-1">Lý do: {req.reason}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">GVCN: {req.requester?.full_name}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {canApprove && (
                          <>
                            <Button size="icon" variant="default" className="h-8 w-8" onClick={() => handleApprove(req.id)} title="Duyệt">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={() => { setRejectingId(req.id); setShowRejectDialog(true); }} title="Từ chối">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {canDelete && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { setDeletingId(req.id); setShowDeleteDialog(true); }} title="Xóa">
                            <Trash2 className="h-4 w-4" />
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
              {/* Group by class */}
              {Array.from(approvedByClass.entries())
                .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
                .map(([className, classReqs]) => (
                  <Card key={className}>
                    <CardHeader className="pb-1 px-3 pt-3">
                      <CardTitle className="text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                          {className}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{classReqs.length} HS</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-1">
                      <div className="space-y-1.5">
                        {classReqs.map(req => (
                          <div key={req.id} className="flex items-center justify-between text-xs border-b last:border-0 pb-1.5 last:pb-0">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{req.student?.full_name}</span>
                              <span className="text-muted-foreground ml-2">
                                {req.exit_time?.slice(0, 5)} → {req.expected_return_time?.slice(0, 5)}
                              </span>
                              {req.reason && <span className="text-muted-foreground"> • {req.reason}</span>}
                            </div>
                            {canDelete && (
                              <div className="flex gap-1 shrink-0 ml-2">
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-600" onClick={() => handleRevoke(req.id)} title="Thu hồi">
                                  <Undo2 className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { setDeletingId(req.id); setShowDeleteDialog(true); }} title="Xóa">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
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
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{format(new Date(req.request_date), 'dd/MM')}</span>
                      <span>{req.exit_time?.slice(0, 5)} → {req.expected_return_time?.slice(0, 5)}</span>
                    </div>
                    {req.reason && <p className="text-xs text-muted-foreground mt-1">Lý do: {req.reason}</p>}
                    {req.rejection_reason && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {req.rejection_reason}
                      </p>
                    )}
                  </div>
                  {canDelete && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => { setDeletingId(req.id); setShowDeleteDialog(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create request dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Đăng ký ra ngoài KTX</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Ngày ra</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(exitDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={exitDate} onSelect={(d) => { if (d) { setExitDate(d); if (d > returnDate) setReturnDate(d); }}} locale={vi} className="pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm">Giờ ra</Label>
                <Input type="time" value={exitTime} onChange={(e) => setExitTime(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Ngày vào</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(returnDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={returnDate} onSelect={(d) => d && setReturnDate(d)} locale={vi} className="pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm">Giờ vào</Label>
                <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Lý do (không bắt buộc)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do..." className="mt-1" rows={2} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm">Chọn học sinh</Label>
                <span className="text-xs font-medium text-primary">{selectedStudents.length} đã chọn</span>
              </div>
              <Input placeholder="Tìm học sinh..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="mb-2 h-8 text-sm" />
              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                {(() => {
                  // Group students by class
                  const grouped = new Map<string, { className: string; students: typeof availableStudents }>();
                  availableStudents.forEach(s => {
                    const clsName = getClassName(s.class_id || null) || 'Khác';
                    if (!grouped.has(clsName)) grouped.set(clsName, { className: clsName, students: [] });
                    grouped.get(clsName)!.students.push(s);
                  });
                  const entries = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
                  
                  if (entries.length === 0) return <p className="text-center py-4 text-sm text-muted-foreground">Không tìm thấy</p>;

                  return entries.map(([clsName, group]) => {
                    const allSelected = group.students.every(s => selectedStudents.includes(s.id));
                    const someSelected = group.students.some(s => selectedStudents.includes(s.id));
                    const selectedCount = group.students.filter(s => selectedStudents.includes(s.id)).length;

                    const toggleAll = () => {
                      if (allSelected) {
                        setSelectedStudents(prev => prev.filter(id => !group.students.some(s => s.id === id)));
                      } else {
                        const newIds = group.students.map(s => s.id).filter(id => !selectedStudents.includes(id));
                        setSelectedStudents(prev => [...prev, ...newIds]);
                      }
                    };

                    return (
                      <div key={clsName} className="border-b last:border-b-0">
                        <button
                          type="button"
                          onClick={toggleAll}
                          className="w-full flex items-center justify-between p-2 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox checked={allSelected} className={cn(someSelected && !allSelected && "opacity-50")} />
                            <span className="font-medium text-sm">{clsName}</span>
                            <Badge variant="secondary" className="text-[10px]">{group.students.length}</Badge>
                          </div>
                          {selectedCount > 0 && (
                            <Badge variant="default" className="text-[10px]">{selectedCount} chọn</Badge>
                          )}
                        </button>
                        <div className="px-2 pb-2">
                          <div className="grid grid-cols-3 gap-0.5">
                            {group.students.map(student => (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => setSelectedStudents(prev =>
                                  prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]
                                )}
                                className={cn(
                                  "flex items-center gap-1 px-1.5 py-1 rounded text-left transition-colors",
                                  selectedStudents.includes(student.id)
                                    ? "bg-primary/15 text-primary"
                                    : "hover:bg-muted/50"
                                )}
                              >
                                <div className={cn(
                                  "w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center",
                                  selectedStudents.includes(student.id)
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground/50"
                                )}>
                                  {selectedStudents.includes(student.id) && (
                                    <span className="text-primary-foreground text-[8px] font-bold">✓</span>
                                  )}
                                </div>
                                <span className="truncate text-[11px] leading-tight">{student.full_name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Hủy</Button>
            <Button onClick={handleCreateRequest} disabled={isSaving || selectedStudents.length === 0 || !exitTime || !returnTime}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Gửi đơn ({selectedStudents.length})
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

      {/* Share/Download image dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Xuất ảnh báo cáo
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center overflow-x-auto py-4">
            <div className="scale-75 origin-top">
              <DormitoryExitImageCard
                ref={imageRef}
                schoolName={currentSchool?.name || ''}
                title="RA NGOÀI KÝ TÚC XÁ"
                date={format(selectedDate, 'yyyy-MM-dd')}
                totalApproved={approvedRequests.length}
                students={imageStudents}
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
    </div>
  );
}
