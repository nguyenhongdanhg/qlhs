import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useImageExport } from '@/hooks/use-image-export';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, CalendarIcon, Check, X, Search, Download, Share2, FileSpreadsheet, Clock, DoorOpen, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, Class } from '@/types';
import * as XLSX from 'xlsx-js-style';

interface ExitRequest {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string | null;
  request_date: string;
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
  const reportRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState('requests');
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterRange, setFilterRange] = useState<FilterRange>('day');
  const [searchQuery, setSearchQuery] = useState('');

  // Create request dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [exitTime, setExitTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [reason, setReason] = useState('');
  const [requestDate, setRequestDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Reject dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const isClassTeacher = currentMembership?.role === 'class_teacher';
  const canApprove = isSchoolAdmin() || isSuperAdmin || hasPermission('dormitory_exit', 'edit');
  const canCreate = isClassTeacher || isSchoolAdmin() || isSuperAdmin;

  // Fetch data
  useEffect(() => {
    if (!currentSchool) return;
    fetchData();
  }, [currentSchool]);

  useEffect(() => {
    if (!currentSchool) return;
    fetchRequests();
  }, [currentSchool, selectedDate, filterRange]);

  // Realtime subscription
  useEffect(() => {
    if (!currentSchool) return;
    const channel = supabase
      .channel('dormitory-exit-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dormitory_exit_requests',
        filter: `school_id=eq.${currentSchool.id}`,
      }, () => fetchRequests())
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

  // Filtered students for class teacher
  const availableStudents = useMemo(() => {
    let filtered = students;
    if (isClassTeacher && currentMembership?.class_id) {
      const teacherClass = classes.find(c => c.name === currentMembership.class_id);
      if (teacherClass) filtered = students.filter(s => s.class_id === teacherClass.id);
    }
    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      filtered = filtered.filter(s => s.full_name.toLowerCase().includes(q));
    }
    return filtered;
  }, [students, isClassTeacher, currentMembership, classes, studentSearch]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(r =>
      r.student?.full_name?.toLowerCase().includes(q) ||
      r.class?.name?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  const pendingRequests = useMemo(() => filteredRequests.filter(r => r.status === 'pending'), [filteredRequests]);
  const approvedRequests = useMemo(() => filteredRequests.filter(r => r.status === 'approved'), [filteredRequests]);
  const rejectedRequests = useMemo(() => filteredRequests.filter(r => r.status === 'rejected'), [filteredRequests]);

  // Create requests
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
          request_date: format(requestDate, 'yyyy-MM-dd'),
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
      setReason('');
      fetchRequests();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Approve request
  const handleApprove = async (requestId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'approved', approver_id: user.id, approved_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;

      // Auto-mark attendance as excused (RP) for approved request
      const request = requests.find(r => r.id === requestId);
      if (request) {
        await autoMarkExcused(request);
      }

      toast({ title: 'Đã duyệt', description: 'Đơn ra ngoài đã được phê duyệt' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  // Auto mark excused in attendance
  const autoMarkExcused = async (request: ExitRequest) => {
    if (!currentSchool || !user) return;
    const attendanceTypes: Array<'boarding' | 'breakfast' | 'lunch' | 'dinner' | 'evening_study'> = [
      'boarding', 'breakfast', 'lunch', 'dinner', 'evening_study'
    ];

    // Determine which attendance types overlap with exit time
    const exitMinutes = timeToMinutes(request.exit_time);
    const returnMinutes = timeToMinutes(request.expected_return_time);

    const mealTimes: Record<string, [number, number]> = {
      breakfast: [360, 480],    // 6:00 - 8:00
      lunch: [660, 780],       // 11:00 - 13:00
      dinner: [1020, 1140],    // 17:00 - 19:00
      boarding: [360, 1380],   // 6:00 - 23:00
      evening_study: [1140, 1320], // 19:00 - 22:00
    };

    const overlapping = attendanceTypes.filter(type => {
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
      notes: `Ra ngoài KTX: ${request.exit_time} - ${request.expected_return_time}${request.reason ? ` (${request.reason})` : ''}`,
      reporter_id: user.id,
    }));

    await supabase.from('attendance_records').insert(records);
  };

  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Reject request
  const handleReject = async () => {
    if (!rejectingId || !user) return;
    try {
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'rejected', approver_id: user.id, rejection_reason: rejectionReason || null })
        .eq('id', rejectingId);
      if (error) throw error;
      toast({ title: 'Đã từ chối', description: 'Đơn ra ngoài đã bị từ chối' });
      setShowRejectDialog(false);
      setRejectingId(null);
      setRejectionReason('');
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }
  };

  // Approve all pending
  const handleApproveAll = async () => {
    if (!user || pendingRequests.length === 0) return;
    try {
      const ids = pendingRequests.map(r => r.id);
      const { error } = await supabase
        .from('dormitory_exit_requests')
        .update({ status: 'approved', approver_id: user.id, approved_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;

      // Auto-mark for all
      for (const req of pendingRequests) {
        await autoMarkExcused(req);
      }

      toast({ title: 'Đã duyệt tất cả', description: `${ids.length} đơn đã được phê duyệt` });
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

    // Set column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
      { wch: 8 }, { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
    ];

    const rangeLabel = filterRange === 'day'
      ? format(selectedDate, 'dd-MM-yyyy')
      : filterRange === 'week'
        ? `Tuan_${format(selectedDate, 'dd-MM-yyyy')}`
        : format(selectedDate, 'MM-yyyy');

    XLSX.writeFile(wb, `Ra_vao_KTX_${rangeLabel}.xlsx`);
    toast({ title: 'Đã xuất Excel', description: 'File đã được tải xuống' });
  };

  // Share image
  const handleShareImage = () => {
    if (reportRef.current) {
      exportAndShare(reportRef, `Ra vào KTX - ${format(selectedDate, 'dd/MM/yyyy')}`, 'Danh sách học sinh ra ngoài KTX', 'share');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Chờ duyệt</Badge>;
      case 'approved': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Đã duyệt</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Từ chối</Badge>;
      default: return null;
    }
  };

  const getClassName = (classId: string | null) => {
    if (!classId) return '';
    return classes.find(c => c.id === classId)?.name || '';
  };

  const dateLabel = filterRange === 'day'
    ? format(selectedDate, 'dd/MM/yyyy')
    : filterRange === 'week'
      ? `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`
      : format(selectedDate, 'MM/yyyy');

  return (
    <div className="space-y-4 p-4 pb-24 lg:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-primary" />
            Ra vào KTX
          </h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Đăng ký
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3">
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

            <div className="flex-1 min-w-[150px]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm học sinh..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={approvedRequests.length === 0}>
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleShareImage} disabled={approvedRequests.length === 0 || isExporting}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests" className="text-xs sm:text-sm">
            Chờ duyệt {pendingRequests.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px]" variant="destructive">{pendingRequests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs sm:text-sm">
            Đã duyệt ({approvedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs sm:text-sm">
            Từ chối ({rejectedRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending tab */}
        <TabsContent value="requests" className="space-y-2 mt-2">
          {canApprove && pendingRequests.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleApproveAll}>
                <Check className="h-4 w-4 mr-1" /> Duyệt tất cả ({pendingRequests.length})
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : pendingRequests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Không có đơn chờ duyệt</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map(req => (
                <Card key={req.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{req.student?.full_name}</span>
                          <Badge variant="secondary" className="text-[10px]">{req.class?.name}</Badge>
                          {getStatusBadge(req.status)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{format(new Date(req.request_date), 'dd/MM/yyyy')}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{req.exit_time?.slice(0, 5)} → {req.expected_return_time?.slice(0, 5)}</span>
                        </div>
                        {req.reason && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Lý do: {req.reason}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">GVCN: {req.requester?.full_name}</p>
                      </div>
                      {canApprove && (
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="default" className="h-8 px-2" onClick={() => handleApprove(req.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 px-2 text-destructive" onClick={() => { setRejectingId(req.id); setShowRejectDialog(true); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Approved tab */}
        <TabsContent value="approved" className="mt-2">
          <div ref={reportRef} className="bg-background">
            {approvedRequests.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Không có đơn đã duyệt</CardContent></Card>
            ) : (
              <Card>
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="text-sm">
                    Danh sách ra ngoài KTX - {dateLabel}
                    {currentSchool && <span className="font-normal text-muted-foreground ml-1">({currentSchool.name})</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-center text-xs">STT</TableHead>
                          <TableHead className="text-xs">Họ và tên</TableHead>
                          <TableHead className="text-xs">Lớp</TableHead>
                          <TableHead className="text-xs text-center">Ngày</TableHead>
                          <TableHead className="text-xs text-center">Ra</TableHead>
                          <TableHead className="text-xs text-center">Về</TableHead>
                          <TableHead className="text-xs">Lý do</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvedRequests.map((req, idx) => (
                          <TableRow key={req.id}>
                            <TableCell className="text-center text-xs">{idx + 1}</TableCell>
                            <TableCell className="text-xs font-medium">{req.student?.full_name}</TableCell>
                            <TableCell className="text-xs">{req.class?.name}</TableCell>
                            <TableCell className="text-xs text-center">{format(new Date(req.request_date), 'dd/MM')}</TableCell>
                            <TableCell className="text-xs text-center">{req.exit_time?.slice(0, 5)}</TableCell>
                            <TableCell className="text-xs text-center">{req.expected_return_time?.slice(0, 5)}</TableCell>
                            <TableCell className="text-xs">{req.reason || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Rejected tab */}
        <TabsContent value="rejected" className="mt-2 space-y-2">
          {rejectedRequests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Không có đơn bị từ chối</CardContent></Card>
          ) : rejectedRequests.map(req => (
            <Card key={req.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{req.student?.full_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{req.class?.name}</Badge>
                  {getStatusBadge(req.status)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{format(new Date(req.request_date), 'dd/MM/yyyy')}</span>
                  <span>{req.exit_time?.slice(0, 5)} → {req.expected_return_time?.slice(0, 5)}</span>
                </div>
                {req.reason && <p className="text-xs text-muted-foreground mt-1">Lý do: {req.reason}</p>}
                {req.rejection_reason && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Lý do từ chối: {req.rejection_reason}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create request dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Đăng ký ra ngoài KTX</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Ngày ra ngoài</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(requestDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={requestDate} onSelect={(d) => d && setRequestDate(d)} locale={vi} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-sm">Giờ ra</Label>
                  <Input type="time" value={exitTime} onChange={(e) => setExitTime(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Giờ về dự kiến</Label>
                  <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm">Lý do (không bắt buộc)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do ra ngoài..." className="mt-1" rows={2} />
            </div>

            <div>
              <Label className="text-sm">Chọn học sinh ({selectedStudents.length} đã chọn)</Label>
              <Input
                placeholder="Tìm kiếm học sinh..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="mt-1 mb-2"
              />
              <div className="border rounded-md max-h-[250px] overflow-y-auto divide-y">
                {availableStudents.map(student => (
                  <label key={student.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={selectedStudents.includes(student.id)}
                      onCheckedChange={(checked) => {
                        setSelectedStudents(prev =>
                          checked ? [...prev, student.id] : prev.filter(id => id !== student.id)
                        );
                      }}
                    />
                    <span className="text-sm flex-1">{student.full_name}</span>
                    <span className="text-xs text-muted-foreground">{getClassName(student.class_id || null)}</span>
                  </label>
                ))}
                {availableStudents.length === 0 && (
                  <p className="text-center py-4 text-sm text-muted-foreground">Không tìm thấy học sinh</p>
                )}
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
    </div>
  );
}
