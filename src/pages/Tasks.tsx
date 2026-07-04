import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Check, Trash2, Pencil, Paperclip, ExternalLink, MessageSquare, AlertTriangle, ClipboardList, Users, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Category = 'dang' | 'chuyen_mon' | 'noi_tru' | 'doan_doi';
type Status = 'pending' | 'done';

const CATEGORIES: { code: Category; label: string }[] = [
  { code: 'dang', label: 'Đảng' },
  { code: 'chuyen_mon', label: 'Chuyên môn' },
  { code: 'noi_tru', label: 'Nội trú' },
  { code: 'doan_doi', label: 'Đoàn - Đội' },
];

interface Task {
  id: string;
  school_id: string;
  category: Category;
  title: string;
  description: string | null;
  assignee_id: string | null;
  deadline: string | null;
  status: Status;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  assignees?: { user_id: string; full_name: string }[];
  creator?: { full_name: string } | null;
  responses?: TaskResponse[];
  attachments?: TaskAttachment[];
}

interface TaskResponse {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { full_name: string } | null;
}

interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  drive_url: string;
  uploaded_by: string | null;
  created_at: string;
}

interface Member {
  user_id: string;
  full_name: string;
}

interface DutyGroup {
  id: string;
  name: string;
  member_ids: string[];
}

export default function Tasks() {
  const { currentSchool, user, isSchoolAdmin } = useAuth();
  const { toast } = useToast();
  const isAdmin = isSchoolAdmin();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dutyGroups, setDutyGroups] = useState<DutyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<Status>('pending');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({
    category: 'dang' as Category,
    title: '',
    description: '',
    assigneeIds: [] as string[],
    deadline: '',
  });

  const [responseOpen, setResponseOpen] = useState(false);
  const [responseTask, setResponseTask] = useState<Task | null>(null);
  const [responseText, setResponseText] = useState('');

  const [attachOpen, setAttachOpen] = useState(false);
  const [attachTask, setAttachTask] = useState<Task | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [detailTask, setDetailTask] = useState<Task | null>(null);


  const fetchAll = async () => {
    if (!currentSchool) return;
    setLoading(true);
    try {
      const [tasksRes, membersRes, teachersRes, groupsRes, groupMembersRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('school_id', currentSchool.id)
          .order('deadline', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('school_memberships')
          .select('user_id, profiles(full_name, phone)')
          .eq('school_id', currentSchool.id)
          .eq('status', 'active'),
        supabase
          .from('teachers')
          .select('user_id, full_name, phone')
          .eq('school_id', currentSchool.id),
        supabase
          .from('duty_groups')
          .select('id, name, display_order')
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('duty_group_members')
          .select('group_id, user_id')
          .eq('school_id', currentSchool.id),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (membersRes.error) throw membersRes.error;
      if (teachersRes.error) throw teachersRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (groupMembersRes.error) throw groupMembersRes.error;


      const taskRows = (tasksRes.data as any[]) || [];
      const taskIds = taskRows.map((t) => t.id);

      const [respRes, attRes, assigneesRes] = await Promise.all([
        taskIds.length
          ? supabase.from('task_responses').select('*').in('task_id', taskIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        taskIds.length
          ? supabase.from('task_attachments').select('*').in('task_id', taskIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        taskIds.length
          ? supabase.from('task_assignees').select('task_id, user_id').in('task_id', taskIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (respRes.error) throw respRes.error;
      if (attRes.error) throw attRes.error;
      if (assigneesRes.error) throw assigneesRes.error;

      const responses = (respRes.data as any[]) || [];
      const attachments = (attRes.data as any[]) || [];
      const assigneeRows = (assigneesRes.data as any[]) || [];

      // Collect all user ids for name lookup
      const userIds = new Set<string>();
      taskRows.forEach((t) => {
        if (t.assignee_id) userIds.add(t.assignee_id);
        if (t.created_by) userIds.add(t.created_by);
      });
      assigneeRows.forEach((a) => userIds.add(a.user_id));
      responses.forEach((r) => r.user_id && userIds.add(r.user_id));

      let profileMap = new Map<string, string>();
      if (userIds.size > 0) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));
        if (pErr) throw pErr;
        (profs || []).forEach((p: any) => profileMap.set(p.id, p.full_name));
      }

      const tasksMerged: Task[] = taskRows.map((t) => {
        const list = assigneeRows
          .filter((a) => a.task_id === t.id)
          .map((a) => ({ user_id: a.user_id, full_name: profileMap.get(a.user_id) || 'Người dùng' }));
        // Backward compat: nếu chưa migrate, dùng assignee_id cũ
        if (list.length === 0 && t.assignee_id) {
          list.push({ user_id: t.assignee_id, full_name: profileMap.get(t.assignee_id) || 'Người dùng' });
        }
        return {
          ...t,
          assignees: list,
          creator: t.created_by ? { full_name: profileMap.get(t.created_by) || 'Người dùng' } : null,
          responses: responses
            .filter((r) => r.task_id === t.id)
            .map((r) => ({ ...r, user: { full_name: profileMap.get(r.user_id) || 'Người dùng' } })),
          attachments: attachments.filter((a) => a.task_id === t.id),
        };
      });

      setTasks(tasksMerged);
      // Hợp nhất danh sách người thực hiện: tài khoản (school_memberships) + giáo viên đã liên kết
      // Ghép cùng người theo user_id (khi giáo viên đã liên kết) hoặc theo số điện thoại
      const normPhone = (p?: string | null) => (p || '').replace(/\D/g, '');
      const byUserId = new Map<string, { user_id: string; full_name: string; phone: string }>();
      const byPhone = new Map<string, { user_id: string; full_name: string; phone: string }>();

      const upsert = (uid: string | null | undefined, name: string, phone: string) => {
        if (!uid) return;
        const existing = byUserId.get(uid);
        const merged = {
          user_id: uid,
          full_name: name || existing?.full_name || 'Người dùng',
          phone: phone || existing?.phone || '',
        };
        byUserId.set(uid, merged);
        if (merged.phone) byPhone.set(merged.phone, merged);
      };

      ((membersRes.data as any[]) || []).forEach((m) => {
        upsert(m.user_id, m.profiles?.full_name || 'Người dùng', normPhone(m.profiles?.phone));
      });
      ((teachersRes.data as any[]) || []).forEach((t) => {
        const phone = normPhone(t.phone);
        // Nếu giáo viên đã liên kết account → cập nhật tên theo hồ sơ giáo viên
        if (t.user_id) {
          upsert(t.user_id, t.full_name, phone);
        } else if (phone && byPhone.has(phone)) {
          // Cùng SĐT với 1 account đã có → xem là cùng người, dùng tên giáo viên cho rõ hơn
          const acc = byPhone.get(phone)!;
          upsert(acc.user_id, t.full_name, phone);
        }
      });

      setMembers(
        Array.from(byUserId.values())
          .map((m) => ({ user_id: m.user_id, full_name: m.full_name }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
      );

      const gm = (groupMembersRes.data as any[]) || [];
      setDutyGroups(
        ((groupsRes.data as any[]) || []).map((g) => ({
          id: g.id,
          name: g.name,
          member_ids: gm.filter((m) => m.group_id === g.id).map((m) => m.user_id),

        }))
      );
    } catch (e: any) {
      toast({ title: 'Lỗi tải công việc', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSchool?.id]);

  const sortByDeadline = (a: Task, b: Task) => {
    // pending: sắp đến hạn trước (nulls sau); done: hoàn thành gần nhất trước
    if (a.status === 'done' && b.status === 'done') {
      return (b.completed_at || '').localeCompare(a.completed_at || '');
    }
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  };

  const tasksByStatus = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending').sort(sortByDeadline);
    const done = tasks.filter((t) => t.status === 'done').sort(sortByDeadline);
    return { pending, done };
  }, [tasks]);

  const currentList = activeStatus === 'pending' ? tasksByStatus.pending : tasksByStatus.done;

  const openCreate = () => {
    setEditing(null);
    setForm({ category: 'dang', title: '', description: '', assigneeIds: [], deadline: '' });
    setFormOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      category: t.category,
      title: t.title,
      description: t.description || '',
      assigneeIds: (t.assignees || []).map((a) => a.user_id),
      deadline: t.deadline || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!currentSchool || !user) return;
    if (!form.title.trim()) {
      toast({ title: 'Nhập nội dung công việc', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        school_id: currentSchool.id,
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || null,
        assignee_id: form.assigneeIds[0] || null, // giữ lại cho tương thích
        deadline: form.deadline || null,
      };
      let taskId: string;
      if (editing) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', editing.id);
        if (error) throw error;
        taskId = editing.id;
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert({ ...payload, created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        taskId = data.id;
      }

      // Đồng bộ danh sách người thực hiện
      await supabase.from('task_assignees').delete().eq('task_id', taskId);
      if (form.assigneeIds.length > 0) {
        const rows = form.assigneeIds.map((uid) => ({ task_id: taskId, user_id: uid }));
        const { error: aErr } = await supabase.from('task_assignees').insert(rows);
        if (aErr) throw aErr;
      }

      toast({ title: editing ? 'Đã cập nhật công việc' : 'Đã tạo công việc' });
      setFormOpen(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (t: Task) => {
    if (!confirm(`Xoá công việc "${t.title}"?`)) return;
    const { error } = await supabase.from('tasks').delete().eq('id', t.id);
    if (error) toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Đã xoá' });
      fetchAll();
    }
  };

  const handleToggleDone = async (t: Task) => {
    const newStatus: Status = t.status === 'done' ? 'pending' : 'done';
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', t.id);
    if (error) toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  const openResponse = (t: Task) => {
    setResponseTask(t);
    setResponseText('');
    setResponseOpen(true);
  };

  const handleSaveResponse = async () => {
    if (!responseTask || !user || !responseText.trim()) return;
    const { error } = await supabase.from('task_responses').insert({
      task_id: responseTask.id,
      user_id: user.id,
      content: responseText.trim(),
    });
    if (error) toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Đã gửi phản hồi' });
      setResponseOpen(false);
      fetchAll();
    }
  };

  const openAttach = (t: Task) => {
    setAttachTask(t);
    setAttachFile(null);
    setAttachOpen(true);
  };

  const handleSaveAttach = async () => {
    if (!attachTask || !user || !currentSchool) return;
    if (!attachFile) {
      toast({ title: 'Chọn file tài liệu', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', attachFile);
      fd.append('task_id', attachTask.id);
      fd.append('school_id', currentSchool.id);
      fd.append('school_name', currentSchool.name || 'Truong');
      fd.append('category', attachTask.category);
      const { data, error } = await supabase.functions.invoke('upload-task-attachment', {
        body: fd,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Upload thất bại');
      toast({ title: 'Đã tải lên Google Drive', description: attachFile.name });
      setAttachOpen(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Lỗi tải lên', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const deadlineBadge = (t: Task) => {
    if (!t.deadline) return null;
    const d = parseISO(t.deadline);
    const days = differenceInCalendarDays(d, new Date());
    if (t.status === 'done') {
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Hoàn thành</Badge>;
    }
    if (days < 0) return <Badge variant="destructive">Quá hạn {Math.abs(days)} ngày</Badge>;
    if (days <= 2)
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Còn {days === 0 ? 'hôm nay' : `${days} ngày`}
        </Badge>
      );
    return <Badge variant="outline">Còn {days} ngày</Badge>;
  };

  return (
    <div className="content-wrapper animate-fade-in space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Công việc & tiến độ
          </h1>
          <p className="text-sm text-muted-foreground">Giao việc, theo dõi hạn hoàn thành, phản hồi và tài liệu.</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Thêm công việc
          </Button>
        )}
      </div>

      <Tabs value={activeStatus} onValueChange={(v) => setActiveStatus(v as Status)}>
        <TabsList className="grid grid-cols-2 w-full sm:w-auto">
          <TabsTrigger value="pending">
            Cần thực hiện
            <span className="ml-2 text-xs text-muted-foreground">{tasksByStatus.pending.length}</span>
          </TabsTrigger>
          <TabsTrigger value="done">
            Đã thực hiện
            <span className="ml-2 text-xs text-muted-foreground">{tasksByStatus.done.length}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : currentList.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-sm text-muted-foreground">
              {activeStatus === 'pending' ? 'Không có công việc nào cần thực hiện.' : 'Chưa có công việc nào được hoàn thành.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const rows = currentList.filter((t) => t.category === cat.code);
            if (rows.length === 0) return null;
            return (
              <Card key={cat.code}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {cat.label}
                    <Badge variant="secondary">{rows.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">STT</TableHead>
                          <TableHead>Nội dung</TableHead>
                          <TableHead className="hidden sm:table-cell">Người thực hiện</TableHead>
                          <TableHead className="hidden sm:table-cell">Hạn</TableHead>
                          <TableHead>Trạng thái</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((t, idx) => {
                          const assigneesText = t.assignees && t.assignees.length > 0
                            ? t.assignees.map((a) => a.full_name).join(', ')
                            : '—';
                          return (
                            <TableRow
                              key={t.id}
                              className={cn('cursor-pointer hover:bg-muted/50', t.status === 'done' && 'opacity-70')}
                              onClick={() => setDetailTask(t)}
                            >
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>
                                <div className="font-medium line-clamp-1">{t.title}</div>
                                <div className="text-xs text-muted-foreground sm:hidden mt-0.5 truncate">
                                  {assigneesText}
                                  {t.deadline && ' • ' + format(parseISO(t.deadline), 'dd/MM/yyyy', { locale: vi })}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm hidden sm:table-cell truncate max-w-[220px]">
                                {assigneesText}
                              </TableCell>
                              <TableCell className="text-sm hidden sm:table-cell">
                                {t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy', { locale: vi }) : '—'}
                              </TableCell>
                              <TableCell>{deadlineBadge(t) || (
                                t.status === 'done'
                                  ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Hoàn thành</Badge>
                                  : <Badge variant="secondary">Đang thực hiện</Badge>
                              )}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Task detail dialog */}
      <Dialog open={!!detailTask} onOpenChange={(v) => !v && setDetailTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailTask && (() => {
            const t = detailTask;
            const isAssignee = (t.assignees || []).some((a) => a.user_id === user?.id);
            const canEdit = isAdmin || t.created_by === user?.id;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8">{t.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="flex flex-wrap gap-2 items-center">
                    {deadlineBadge(t) || (
                      t.status === 'done'
                        ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Hoàn thành</Badge>
                        : <Badge variant="secondary">Đang thực hiện</Badge>
                    )}
                    <Badge variant="outline">{CATEGORIES.find((c) => c.code === t.category)?.label || t.category}</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Người giao</div>
                      <div>{t.creator?.full_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Hạn hoàn thành</div>
                      <div>{t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy', { locale: vi }) : '—'}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs text-muted-foreground">Người thực hiện</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.assignees && t.assignees.length > 0
                          ? t.assignees.map((a) => <Badge key={a.user_id} variant="secondary">{a.full_name}</Badge>)
                          : <span className="text-muted-foreground">—</span>}
                      </div>
                    </div>
                  </div>

                  {t.description && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Mô tả</div>
                      <div className="whitespace-pre-wrap bg-muted/40 rounded p-3">{t.description}</div>
                    </div>
                  )}

                  {t.attachments && t.attachments.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Tài liệu</div>
                      <div className="space-y-1">
                        {t.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={a.drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Paperclip className="h-3 w-3" />
                            {a.file_name}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {t.responses && t.responses.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Phản hồi</div>
                      <div className="space-y-1">
                        {t.responses.map((r) => (
                          <div key={r.id} className="text-xs bg-muted/50 rounded px-2 py-1">
                            <span className="font-medium">{r.user?.full_name}:</span> {r.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex-wrap gap-2">
                  {(isAssignee || canEdit) && (
                    <Button variant="outline" onClick={() => { handleToggleDone(t); setDetailTask(null); }}>
                      <Check className={cn('h-4 w-4 mr-2', t.status === 'done' && 'text-emerald-600')} />
                      {t.status === 'done' ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
                    </Button>
                  )}
                  {(isAssignee || canEdit) && (
                    <Button variant="outline" onClick={() => { setDetailTask(null); openResponse(t); }}>
                      <MessageSquare className="h-4 w-4 mr-2" /> Phản hồi
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setDetailTask(null); openAttach(t); }}>
                    <Paperclip className="h-4 w-4 mr-2" /> Tài liệu
                  </Button>
                  {canEdit && (
                    <Button variant="outline" onClick={() => { setDetailTask(null); openEdit(t); }}>
                      <Pencil className="h-4 w-4 mr-2" /> Sửa
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="destructive" onClick={() => { handleDelete(t); setDetailTask(null); }}>
                      <Trash2 className="h-4 w-4 mr-2" /> Xoá
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa công việc' : 'Thêm công việc'}</DialogTitle>
            <DialogDescription>Giao việc cho một thành viên trong trường và đặt hạn hoàn thành.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Danh mục</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nội dung *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Mô tả</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Người thực hiện</Label>
              <div className="mt-1 space-y-2">
                {dutyGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground self-center mr-1">
                      <Users className="h-3 w-3 inline mr-1" />
                      Gán nhanh nhóm:
                    </span>
                    {dutyGroups.map((g) => {
                      const allIn = g.member_ids.length > 0 && g.member_ids.every((id) => form.assigneeIds.includes(id));
                      return (
                        <Button
                          key={g.id}
                          type="button"
                          size="sm"
                          variant={allIn ? 'default' : 'outline'}
                          className="h-7 text-xs"
                          onClick={() => {
                            setForm((prev) => {
                              const set = new Set(prev.assigneeIds);
                              if (allIn) g.member_ids.forEach((id) => set.delete(id));
                              else g.member_ids.forEach((id) => set.add(id));
                              return { ...prev, assigneeIds: Array.from(set) };
                            });
                          }}
                        >
                          {g.name} ({g.member_ids.length})
                        </Button>
                      );
                    })}
                  </div>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {form.assigneeIds.length === 0
                          ? 'Chọn người...'
                          : `Đã chọn ${form.assigneeIds.length} người`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <ScrollArea className="max-h-64">
                      <div className="p-2 space-y-1">
                        {members.length === 0 && (
                          <div className="text-xs text-muted-foreground p-2">Chưa có thành viên</div>
                        )}
                        {members.map((m) => {
                          const checked = form.assigneeIds.includes(m.user_id);
                          return (
                            <label
                              key={m.user_id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  setForm((prev) => ({
                                    ...prev,
                                    assigneeIds: v
                                      ? [...prev.assigneeIds, m.user_id]
                                      : prev.assigneeIds.filter((id) => id !== m.user_id),
                                  }));
                                }}
                              />
                              <span className="text-sm">{m.full_name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                {form.assigneeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.assigneeIds.map((id) => {
                      const m = members.find((x) => x.user_id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {m?.full_name || 'Người dùng'}
                          <button
                            type="button"
                            className="ml-0.5 hover:text-destructive"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                assigneeIds: prev.assigneeIds.filter((x) => x !== id),
                              }))
                            }
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>Hạn hoàn thành</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Huỷ</Button>
            <Button onClick={handleSave}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response dialog */}
      <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phản hồi: {responseTask?.title}</DialogTitle>
          </DialogHeader>
          <Textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={4} placeholder="Nhập phản hồi..." />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResponseOpen(false)}>Huỷ</Button>
            <Button onClick={handleSaveResponse}>Gửi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment dialog */}
      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm tài liệu: {attachTask?.title}</DialogTitle>
            <DialogDescription>
              Chọn file, hệ thống sẽ tự tải lên Google Drive và lưu link chia sẻ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>File tài liệu</Label>
              <Input
                type="file"
                onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
              {attachFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {attachFile.name} · {(attachFile.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAttachOpen(false)} disabled={uploading}>Huỷ</Button>
            <Button onClick={handleSaveAttach} disabled={uploading || !attachFile}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Đang tải lên...</> : 'Tải lên Drive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
