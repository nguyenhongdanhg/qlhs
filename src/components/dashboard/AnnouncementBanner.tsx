import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Megaphone, Plus, Pencil, Trash2, X, Clock, Bell, CheckCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format, parseISO, isPast, isFuture } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
}

export function AnnouncementBanner() {
  const { currentSchool, isSchoolAdmin, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const canManage = isSuperAdmin || isSchoolAdmin();

  // Fetch active announcements visible now
  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool) return [];
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .lte('start_at', now)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Filter out expired ones client-side
      return (data || []).filter((a: any) => !a.expire_at || !isPast(parseISO(a.expire_at))) as Announcement[];
    },
    enabled: !!currentSchool,
    staleTime: 1000 * 60 * 2,
  });

  // Fetch all announcements for management
  const { data: allAnnouncements = [] } = useQuery({
    queryKey: ['announcements-all', currentSchool?.id],
    queryFn: async () => {
      if (!currentSchool) return [];
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('school_id', currentSchool.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Announcement[];
    },
    enabled: !!currentSchool && manageOpen,
  });

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const visibleAnnouncements = announcements.filter(a => !dismissedIds.has(a.id));

  if (visibleAnnouncements.length === 0 && !canManage) return null;

  return (
    <>
      {/* Display banners */}
      {visibleAnnouncements.length > 0 && (
        <div className="space-y-2">
          {visibleAnnouncements.map(a => (
            <Card key={a.id} className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 shadow-md animate-fade-in overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center mt-0.5">
                    <Megaphone className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-foreground text-sm sm:text-base">{a.title}</h3>
                      {a.expire_at && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 text-muted-foreground border-muted">
                          <Clock className="h-2.5 w-2.5" />
                          {format(parseISO(a.expire_at), 'dd/MM HH:mm')}
                        </Badge>
                      )}
                    </div>
                    {a.content && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{a.content}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setDismissedIds(prev => new Set(prev).add(a.id))}
                    className="flex-shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors p-0.5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Manage button for admins */}
      {canManage && visibleAnnouncements.length === 0 && (
        <button
          onClick={() => setManageOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-primary/30 text-primary/70 hover:bg-primary/5 hover:text-primary transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          Thêm thông báo
        </button>
      )}

      {canManage && visibleAnnouncements.length > 0 && (
        <div className="flex justify-end -mt-2">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => setManageOpen(true)}>
            <Pencil className="h-3 w-3 mr-1" />
            Quản lý thông báo
          </Button>
        </div>
      )}

      {/* Management Dialog */}
      {canManage && (
        <AnnouncementManageDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          announcements={allAnnouncements}
          schoolId={currentSchool?.id || ''}
          onEdit={(a) => { setEditItem(a); setFormOpen(true); }}
          onNew={() => { setEditItem(null); setFormOpen(true); }}
        />
      )}

      {/* Create/Edit Dialog */}
      {canManage && (
        <AnnouncementFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          item={editItem}
          schoolId={currentSchool?.id || ''}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['announcements'] });
            queryClient.invalidateQueries({ queryKey: ['announcements-all'] });
            setFormOpen(false);
          }}
        />
      )}
    </>
  );
}

// --- Management Dialog ---
function AnnouncementManageDialog({
  open, onOpenChange, announcements, schoolId, onEdit, onNew,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  announcements: Announcement[];
  schoolId: string;
  onEdit: (a: Announcement) => void;
  onNew: () => void;
}) {
  const queryClient = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements-all'] });
      toast.success('Đã xóa thông báo');
    },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('announcements').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements-all'] });
    },
  });

  const getStatus = (a: Announcement) => {
    if (!a.is_active) return { label: 'Tắt', color: 'bg-muted text-muted-foreground' };
    const now = new Date();
    if (isFuture(parseISO(a.start_at))) return { label: 'Chờ hiện', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' };
    if (a.expire_at && isPast(parseISO(a.expire_at))) return { label: 'Hết hạn', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' };
    return { label: 'Đang hiện', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Quản lý thông báo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Button size="sm" onClick={onNew} className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            Tạo thông báo mới
          </Button>
          {announcements.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Chưa có thông báo nào</p>
          ) : (
            announcements.map(a => {
              const status = getStatus(a);
              return (
                <div key={a.id} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm truncate">{a.title}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', status.color)}>{status.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{a.content || '(không có nội dung)'}</p>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                      <span>Từ: {format(parseISO(a.start_at), 'dd/MM/yy HH:mm')}</span>
                      {a.expire_at && <span>Đến: {format(parseISO(a.expire_at), 'dd/MM/yy HH:mm')}</span>}
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

// --- Form Dialog ---
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
  const [startAt, setStartAt] = useState('');
  const [expireAt, setExpireAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reset form when opening
  const handleOpenChange = (v: boolean) => {
    if (v) {
      if (item) {
        setTitle(item.title);
        setContent(item.content);
        setStartAt(format(parseISO(item.start_at), "yyyy-MM-dd'T'HH:mm"));
        setExpireAt(item.expire_at ? format(parseISO(item.expire_at), "yyyy-MM-dd'T'HH:mm") : '');
        setIsActive(item.is_active);
      } else {
        setTitle('');
        setContent('');
        setStartAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        setExpireAt('');
        setIsActive(true);
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
        start_at: startAt ? new Date(startAt).toISOString() : new Date().toISOString(),
        expire_at: expireAt ? new Date(expireAt).toISOString() : null,
        is_active: isActive,
      };
      if (item) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', item.id);
        if (error) throw error;
        toast.success('Đã cập nhật thông báo');
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from('announcements').insert(payload);
        if (error) throw error;
        toast.success('Đã tạo thông báo');
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Sửa thông báo' : 'Tạo thông báo mới'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tiêu đề <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Họp phụ huynh ngày 10/04" className="mt-1" />
          </div>
          <div>
            <Label>Nội dung</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Chi tiết thông báo..." rows={3} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bắt đầu hiện</Label>
              <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Hết hiệu lực</Label>
              <Input type="datetime-local" value={expireAt} onChange={e => setExpireAt(e.target.value)} className="mt-1" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Để trống = hiện mãi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="cursor-pointer">Kích hoạt ngay</Label>
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
