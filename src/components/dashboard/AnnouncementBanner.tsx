import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Megaphone, Plus, Pencil, Trash2, CheckCheck, Star, ChevronDown, ChevronUp,
  Clock, CheckCircle2, Circle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, parseISO, isPast, isFuture } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const WEEKDAYS_VI = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const getWeekdayVi = (d: Date) => WEEKDAYS_VI[d.getDay()];

interface Announcement {
  id: string;
  school_id: string;
  title: string;
  content: string;
  start_at: string;
  expire_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  event_time: string | null;
  assignee: string | null;
  priority: boolean;
  completed_at: string | null;
  completed_by: string | null;
}

const SEEN_KEY = 'seen_announcements_v2';

export function AnnouncementBanner() {
  const { currentSchool, user, isSchoolAdmin, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const canManage = isSuperAdmin || isSchoolAdmin();

  const { data: announcements = [] } = useQuery({
    queryKey: ['bulletin', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool) return [];
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('announcements' as any)
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .lte('start_at', now);
      if (error) throw error;
      const list = ((data || []) as any[]).filter(
        (a) => !a.expire_at || !isPast(parseISO(a.expire_at))
      ) as Announcement[];
      // Sort: priority first, then by event_time (or start_at) desc
      return list.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        const ta = new Date(a.event_time || a.start_at).getTime();
        const tb = new Date(b.event_time || b.start_at).getTime();
        return tb - ta;
      });
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60,
  });

  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['bulletin-all', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool) return [];
      const { data, error } = await supabase
        .from('announcements' as any)
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('priority', { ascending: false })
        .order('event_time', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Announcement[];
    },
    enabled: !!currentSchool && manageOpen,
  });

  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(SEEN_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const markAsSeen = (id: string) => {
    setSeenIds(prev => {
      const next = new Set(prev).add(id);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      return next;
    });
  };
  const markAllSeen = () => {
    const next = new Set(seenIds);
    announcements.forEach(a => next.add(a.id));
    setSeenIds(next);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
  };

  const toggleDone = useMutation({
    mutationFn: async (a: Announcement) => {
      const payload = a.completed_at
        ? { completed_at: null, completed_by: null }
        : { completed_at: new Date().toISOString(), completed_by: user?.id ?? null };
      const { error } = await supabase.from('announcements' as any).update(payload).eq('id', a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin'] });
      queryClient.invalidateQueries({ queryKey: ['bulletin-all'] });
    },
    onError: (e: any) => toast.error(e.message || 'Lỗi cập nhật'),
  });

  const visible = announcements;
  const unseenCount = visible.filter(a => !seenIds.has(a.id) && !a.completed_at).length;

  if (visible.length === 0 && !canManage) return null;

  return (
    <>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-md overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b bg-primary/5">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Megaphone className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-foreground">Bảng tin</h3>
                  {unseenCount > 0 && (
                    <Badge className="h-5 px-1.5 text-[10px] bg-destructive">{unseenCount} mới</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {visible.length} mục · Sắp xếp theo ưu tiên & thời gian
                </p>
              </div>
              {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </button>
            <div className="flex items-center gap-1">
              {visible.length > 0 && unseenCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllSeen}>
                  <CheckCheck className="h-3.5 w-3.5 mr-1" /> Đã xem hết
                </Button>
              )}
              {canManage && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setManageOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Quản lý
                </Button>
              )}
            </div>
          </div>

          {/* Body */}
          {!collapsed && (
            <div>
              {visible.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Chưa có nội dung bảng tin.
                  {canManage && (
                    <Button size="sm" variant="outline" className="ml-2" onClick={() => { setEditItem(null); setFormOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Tạo mới
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Column headers */}
                  <div className="hidden sm:grid grid-cols-[140px_1fr_140px_120px] gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30 border-b">
                    <div>Thời gian</div>
                    <div>Nội dung</div>
                    <div>Người thực hiện</div>
                    <div className="text-center">Trạng thái</div>
                  </div>
                  <ScrollArea className="max-h-[360px]">
                    <div className="divide-y">
                      {visible.map(a => {
                        const seen = seenIds.has(a.id);
                        const done = !!a.completed_at;
                        const t = a.event_time || a.start_at;
                        return (
                          <div
                            key={a.id}
                            className={cn(
                              'grid sm:grid-cols-[140px_1fr_140px_120px] gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40',
                              !seen && !done && 'bg-primary/5',
                              done && 'opacity-60',
                            )}
                          >
                            {/* Time */}
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-foreground">{format(parseISO(t), 'HH:mm')}</div>
                                <div className="text-[10px]">{format(parseISO(t), 'dd/MM/yy')}</div>
                              </div>
                            </div>
                            {/* Content */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {a.priority && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 flex-shrink-0" />}
                                <span className={cn('font-semibold text-sm text-foreground', done && 'line-through')}>
                                  {a.title}
                                </span>
                                {!seen && !done && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                                )}
                              </div>
                              {a.content && (
                                <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{a.content}</p>
                              )}
                              <div className="flex flex-wrap gap-1.5 mt-1.5 sm:hidden">
                                {a.assignee && (
                                  <Badge variant="outline" className="text-[10px] h-5">{a.assignee}</Badge>
                                )}
                              </div>
                            </div>
                            {/* Assignee */}
                            <div className="hidden sm:flex items-start text-xs text-foreground">
                              {a.assignee || <span className="text-muted-foreground italic">—</span>}
                            </div>
                            {/* Actions */}
                            <div className="flex sm:flex-col items-center sm:items-stretch gap-1">
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] px-2 flex-1"
                                  onClick={() => { setEditItem(a); setFormOpen(true); }}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" /> Sửa
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={done ? 'default' : 'outline'}
                                className="h-7 text-[11px] px-2 flex-1"
                                onClick={() => toggleDone.mutate(a)}
                                disabled={toggleDone.isPending}
                              >
                                {done ? (
                                  <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Đã làm</>
                                ) : (
                                  <><Circle className="h-3.5 w-3.5 mr-1" /> Chưa làm</>
                                )}
                              </Button>
                              {!seen && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] px-2 flex-1"
                                  onClick={() => markAsSeen(a.id)}
                                >
                                  <CheckCheck className="h-3.5 w-3.5 mr-1" /> Đã xem
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <AnnouncementManageDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          announcements={allAnnouncements}
          onEdit={(a) => { setEditItem(a); setFormOpen(true); }}
          onNew={() => { setEditItem(null); setFormOpen(true); }}
        />
      )}

      {canManage && (
        <AnnouncementFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          item={editItem}
          schoolId={currentSchool?.id || ''}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['bulletin'] });
            queryClient.invalidateQueries({ queryKey: ['bulletin-all'] });
            setFormOpen(false);
          }}
        />
      )}
    </>
  );
}

function AnnouncementManageDialog({
  open, onOpenChange, announcements, onEdit, onNew,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  announcements: Announcement[];
  onEdit: (a: Announcement) => void;
  onNew: () => void;
}) {
  const queryClient = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin'] });
      queryClient.invalidateQueries({ queryKey: ['bulletin-all'] });
      toast.success('Đã xóa');
    },
  });
  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('announcements' as any).update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin'] });
      queryClient.invalidateQueries({ queryKey: ['bulletin-all'] });
    },
  });

  const getStatus = (a: Announcement) => {
    if (!a.is_active) return { label: 'Tắt', color: 'bg-muted text-muted-foreground' };
    if (isFuture(parseISO(a.start_at))) return { label: 'Chờ hiện', color: 'bg-amber-100 text-amber-700' };
    if (a.expire_at && isPast(parseISO(a.expire_at))) return { label: 'Hết hạn', color: 'bg-red-100 text-red-700' };
    if (a.completed_at) return { label: 'Đã làm', color: 'bg-green-100 text-green-700' };
    return { label: 'Đang hiện', color: 'bg-primary/15 text-primary' };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Quản lý bảng tin
          </DialogTitle>
        </DialogHeader>
        <Button size="sm" onClick={onNew} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Thêm mục mới
        </Button>
        <div className="space-y-2 mt-2">
          {announcements.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Chưa có mục nào</p>
          ) : (
            announcements.map(a => {
              const status = getStatus(a);
              return (
                <div key={a.id} className="flex items-start gap-2 p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {a.priority && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                      <span className="font-semibold text-sm">{a.title}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', status.color)}>{status.label}</span>
                    </div>
                    {a.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.content}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-1">
                      {a.event_time && <span>🕐 {format(parseISO(a.event_time), 'dd/MM/yy HH:mm')}</span>}
                      {a.assignee && <span>👤 {a.assignee}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={a.is_active}
                      onCheckedChange={(v) => toggleMut.mutate({ id: a.id, is_active: v })}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementFormDialog({
  open, onOpenChange, item, schoolId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: Announcement | null;
  schoolId: string;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [expireAt, setExpireAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      if (item) {
        setTitle(item.title);
        setContent(item.content);
        setEventTime(item.event_time ? format(parseISO(item.event_time), "yyyy-MM-dd'T'HH:mm") : format(parseISO(item.start_at), "yyyy-MM-dd'T'HH:mm"));
        setAssignee(item.assignee || '');
        setPriority(item.priority);
        setStartAt(format(parseISO(item.start_at), "yyyy-MM-dd'T'HH:mm"));
        setExpireAt(item.expire_at ? format(parseISO(item.expire_at), "yyyy-MM-dd'T'HH:mm") : '');
        setIsActive(item.is_active);
      } else {
        const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");
        setTitle(''); setContent(''); setEventTime(now); setAssignee(''); setPriority(false);
        setStartAt(now); setExpireAt(''); setIsActive(true);
      }
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        school_id: schoolId,
        title: title.trim(),
        content: content.trim(),
        event_time: eventTime ? new Date(eventTime).toISOString() : null,
        assignee: assignee.trim(),
        priority,
        start_at: startAt ? new Date(startAt).toISOString() : new Date().toISOString(),
        expire_at: expireAt ? new Date(expireAt).toISOString() : null,
        is_active: isActive,
      };
      if (item) {
        const { error } = await supabase.from('announcements' as any).update(payload).eq('id', item.id);
        if (error) throw error;
        toast.success('Đã cập nhật');
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from('announcements' as any).insert(payload);
        if (error) throw error;
        toast.success('Đã tạo');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Sửa mục bảng tin' : 'Thêm mục bảng tin'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nội dung / Tiêu đề <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Họp giao ban đầu tuần" className="mt-1" />
          </div>
          <div>
            <Label>Mô tả chi tiết</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Thời gian <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" value={eventTime} onChange={e => setEventTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Người thực hiện</Label>
              <Input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="VD: Thầy Nam" className="mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
            <Switch checked={priority} onCheckedChange={setPriority} />
            <Label className="cursor-pointer flex items-center gap-1 text-sm">
              <Star className={cn('h-4 w-4', priority && 'fill-amber-400 text-amber-500')} />
              Đánh dấu ưu tiên
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bắt đầu hiện</Label>
              <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Hết hiệu lực</Label>
              <Input type="datetime-local" value={expireAt} onChange={e => setExpireAt(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="cursor-pointer">Kích hoạt</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : (item ? 'Cập nhật' : 'Tạo')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
