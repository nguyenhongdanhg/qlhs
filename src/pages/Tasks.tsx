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
  const [attachForm, setAttachForm] = useState({ file_name: '', drive_url: '' });

  const fetchAll = async () => {
    if (!currentSchool) return;
    setLoading(true);
    try {
      const [tasksRes, membersRes, groupsRes, groupMembersRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('school_id', currentSchool.id)
          .order('deadline', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('school_memberships')
          .select('user_id, profiles!inner(full_name)')
          .eq('school_id', currentSchool.id)
          .eq('status', 'active'),
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
      setMembers(
        ((membersRes.data as any[]) || []).map((m) => ({
          user_id: m.user_id,
          full_name: m.profiles?.full_name || 'Người dùng',
        }))
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
    setAttachForm({ file_name: '', drive_url: '' });
    setAttachOpen(true);
  };

  const handleSaveAttach = async () => {
    if (!attachTask || !user) return;
    if (!attachForm.file_name.trim() || !attachForm.drive_url.trim()) {
      toast({ title: 'Nhập tên file và link Google Drive', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('task_attachments').insert({
      task_id: attachTask.id,
      file_name: attachForm.file_name.trim(),
      drive_url: attachForm.drive_url.trim(),
      uploaded_by: user.id,
    });
    if (error) toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Đã thêm tài liệu' });
      setAttachOpen(false);
      fetchAll();
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
                          <TableHead>Người thực hiện</TableHead>
                          <TableHead>Hạn</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead>Tài liệu</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((t, idx) => {
                          const isAssignee = (t.assignees || []).some((a) => a.user_id === user?.id);
                          const canEdit = isAdmin || t.created_by === user?.id;
                          return (
                            <TableRow key={t.id} className={cn(t.status === 'done' && 'opacity-70')}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>
                                <div className="font-medium">{t.title}</div>
                                {t.description && (
                                  <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.description}</div>
                                )}
                                {t.responses && t.responses.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {t.responses.map((r) => (
                                      <div key={r.id} className="text-xs bg-muted/50 rounded px-2 py-1">
                                        <span className="font-medium">{r.user?.full_name}:</span> {r.content}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {t.assignees && t.assignees.length > 0
                                  ? t.assignees.map((a) => a.full_name).join(', ')
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy', { locale: vi }) : '—'}
                              </TableCell>
                              <TableCell>{deadlineBadge(t) || (
                                t.status === 'done'
                                  ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Hoàn thành</Badge>
                                  : <Badge variant="secondary">Đang thực hiện</Badge>
                              )}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {t.attachments?.map((a) => (
                                    <a
                                      key={a.id}
                                      href={a.drive_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                      {a.file_name}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {(isAssignee || canEdit) && (
                                    <Button size="icon" variant="ghost" title="Đánh dấu hoàn thành" onClick={() => handleToggleDone(t)}>
                                      <Check className={cn('h-4 w-4', t.status === 'done' && 'text-emerald-600')} />
                                    </Button>
                                  )}
                                  {(isAssignee || canEdit) && (
                                    <Button size="icon" variant="ghost" title="Phản hồi" onClick={() => openResponse(t)}>
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button size="icon" variant="ghost" title="Thêm tài liệu" onClick={() => openAttach(t)}>
                                    <Paperclip className="h-4 w-4" />
                                  </Button>
                                  {canEdit && (
                                    <Button size="icon" variant="ghost" title="Sửa" onClick={() => openEdit(t)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canEdit && (
                                    <Button size="icon" variant="ghost" title="Xoá" onClick={() => handleDelete(t)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
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
              Upload file lên Google Drive, đặt quyền chia sẻ, rồi dán link vào đây.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tên tài liệu</Label>
              <Input value={attachForm.file_name} onChange={(e) => setAttachForm({ ...attachForm, file_name: e.target.value })} placeholder="VD: Kế hoạch tuần" />
            </div>
            <div>
              <Label>Link Google Drive</Label>
              <Input value={attachForm.drive_url} onChange={(e) => setAttachForm({ ...attachForm, drive_url: e.target.value })} placeholder="https://drive.google.com/..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAttachOpen(false)}>Huỷ</Button>
            <Button onClick={handleSaveAttach}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
