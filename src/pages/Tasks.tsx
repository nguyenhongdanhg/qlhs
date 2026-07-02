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
import { Loader2, Plus, Check, Trash2, Pencil, Paperclip, ExternalLink, MessageSquare, AlertTriangle, ClipboardList } from 'lucide-react';
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
  assignee?: { full_name: string } | null;
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

export default function Tasks() {
  const { currentSchool, user, isSchoolAdmin } = useAuth();
  const { toast } = useToast();
  const isAdmin = isSchoolAdmin();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('dang');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({
    category: 'dang' as Category,
    title: '',
    description: '',
    assignee_id: '',
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
      const [tasksRes, membersRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name), creator:profiles!tasks_created_by_fkey(full_name), responses:task_responses(*, user:profiles(full_name)), attachments:task_attachments(*)')
          .eq('school_id', currentSchool.id)
          .order('deadline', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('school_memberships')
          .select('user_id, profiles!inner(full_name)')
          .eq('school_id', currentSchool.id)
          .eq('status', 'active'),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (membersRes.error) throw membersRes.error;
      setTasks((tasksRes.data as any[]) || []);
      setMembers(
        ((membersRes.data as any[]) || []).map((m) => ({
          user_id: m.user_id,
          full_name: m.profiles?.full_name || 'Người dùng',
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

  const filteredTasks = useMemo(
    () => tasks.filter((t) => t.category === activeCategory),
    [tasks, activeCategory]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ category: activeCategory, title: '', description: '', assignee_id: '', deadline: '' });
    setFormOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      category: t.category,
      title: t.title,
      description: t.description || '',
      assignee_id: t.assignee_id || '',
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
        assignee_id: form.assignee_id || null,
        deadline: form.deadline || null,
      };
      if (editing) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Đã cập nhật công việc' });
      } else {
        const { error } = await supabase.from('tasks').insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast({ title: 'Đã tạo công việc' });
      }
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

      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.code} value={c.code}>
              {c.label}
              <span className="ml-2 text-xs text-muted-foreground">
                {tasks.filter((t) => t.category === c.code).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {CATEGORIES.find((c) => c.code === activeCategory)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Chưa có công việc nào.</p>
          ) : (
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
                  {filteredTasks.map((t, idx) => {
                    const isAssignee = t.assignee_id === user?.id;
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
                        <TableCell className="text-sm">{t.assignee?.full_name || '—'}</TableCell>
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
          )}
        </CardContent>
      </Card>

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
              <Select value={form.assignee_id || 'none'} onValueChange={(v) => setForm({ ...form, assignee_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Chọn người..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Chưa gán —</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
