import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYears, AcademicYear, AcademicYearStatus } from '@/hooks/useAcademicYears';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarRange, Loader2, Plus, Check, Lock, Unlock, Archive, Trash2, Pencil } from 'lucide-react';

const CLONE_GROUPS = [
  { key: 'classes_students', label: 'Danh sách lớp + học sinh (giữ nguyên lớp cũ)' },
  { key: 'teachers', label: 'Giáo viên (danh sách + thông tin)' },
  { key: 'permissions', label: 'Nhóm quyền + phân quyền người dùng' },
  { key: 'menu_kitchen', label: 'Thực đơn + nhà cung cấp bếp' },
  { key: 'emulation_duty', label: 'Cấu hình thi đua + trực ban' },
  { key: 'catalogs', label: 'Danh mục thuốc + cấu hình chung' },
] as const;

type CloneKey = typeof CLONE_GROUPS[number]['key'];
type CloneOpts = Record<CloneKey, boolean>;

const DEFAULT_CLONE: CloneOpts = {
  classes_students: true,
  teachers: true,
  permissions: true,
  menu_kitchen: false,
  emulation_duty: false,
  catalogs: false,
};

export function AcademicYearsCard() {
  const { currentSchool, isSuperAdmin, currentMembership, user } = useAuth();
  const { years, isLoading, refresh } = useAcademicYears();
  const { toast } = useToast();

  const isAdmin = isSuperAdmin || currentMembership?.role === 'admin';

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceYearId, setSourceYearId] = useState<string>('none');
  const [cloneOpts, setCloneOpts] = useState<CloneOpts>(DEFAULT_CLONE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<AcademicYear | null>(null);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNotes, setEditNotes] = useState('');

  if (!currentSchool || !isAdmin) return null;

  const reset = () => {
    setName(''); setStartDate(''); setEndDate(''); setNotes('');
    setSourceYearId('none');
    setCloneOpts(DEFAULT_CLONE);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Lỗi', description: 'Nhập tên năm học (VD: 2025-2026)', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        school_id: currentSchool.id,
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes.trim() || null,
        status: 'open',
        is_active: false,
        created_by: user?.id ?? null,
        cloned_from_year_id: sourceYearId !== 'none' ? sourceYearId : null,
        clone_options: sourceYearId !== 'none' ? cloneOpts : {},
      };
      const { error } = await (supabase.from('academic_years') as any).insert(payload);
      if (error) throw error;
      toast({
        title: 'Đã tạo năm học',
        description: sourceYearId !== 'none'
          ? `${name.trim()} · đã ghi nhận tuỳ chọn sao chép`
          : name.trim(),
      });
      reset();
      setOpen(false);
      await refresh();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (y: AcademicYear) => {
    setEditTarget(y);
    setEditName(y.name);
    setEditStart(y.start_date ?? '');
    setEditEnd(y.end_date ?? '');
    setEditNotes(y.notes ?? '');
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      toast({ title: 'Lỗi', description: 'Tên năm học không được trống', variant: 'destructive' });
      return;
    }
    setBusyId(editTarget.id);
    try {
      const { error } = await supabase
        .from('academic_years')
        .update({
          name: editName.trim(),
          start_date: editStart || null,
          end_date: editEnd || null,
          notes: editNotes.trim() || null,
        })
        .eq('id', editTarget.id);
      if (error) throw error;
      toast({ title: 'Đã cập nhật năm học' });
      setEditTarget(null);
      await refresh();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const setActive = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase.rpc('set_active_academic_year', { year_id: id });
      if (error) throw error;
      toast({ title: 'Đã đặt làm năm học mặc định' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const updateStatus = async (id: string, status: AcademicYearStatus) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from('academic_years')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      toast({ title: status === 'open' ? 'Đã mở lại' : status === 'closed' ? 'Đã đóng' : 'Đã lưu trữ' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const { error } = await supabase.from('academic_years').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: 'Đã xoá năm học', description: deleteTarget.name });
      setDeleteTarget(null);
      await refresh();
    } catch (e: any) {
      toast({ title: 'Không thể xoá', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (s: AcademicYearStatus) => {
    const map: Record<AcademicYearStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      open: { label: 'Đang mở', variant: 'default' },
      closed: { label: 'Đã đóng', variant: 'secondary' },
      archived: { label: 'Lưu trữ', variant: 'outline' },
    };
    return map[s];
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5" />
            Năm học
          </CardTitle>
          <CardDescription>
            Quản lý các năm học của trường. Chỉ 1 năm được đặt mặc định.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Thêm
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tạo năm học mới</DialogTitle>
                <DialogDescription>
                  Có thể sao chép cấu hình từ một năm đã có. Sau khi tạo, bấm "Đặt mặc định" để dùng năm này.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label>Tên năm học *</Label>
                  <Input placeholder="2026-2027" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label>Ngày bắt đầu</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Ngày kết thúc</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-2 pt-2 border-t">
                  <Label>Sao chép dữ liệu từ năm</Label>
                  <Select value={sourceYearId} onValueChange={setSourceYearId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Không sao chép" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không sao chép (bắt đầu trắng)</SelectItem>
                      {years.map(y => (
                        <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {sourceYearId !== 'none' && (
                  <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                    <div className="text-sm font-medium">Chọn nhóm dữ liệu sao chép</div>
                    {CLONE_GROUPS.map(g => (
                      <label key={g.key} className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={cloneOpts[g.key]}
                          onCheckedChange={(v) =>
                            setCloneOpts(prev => ({ ...prev, [g.key]: v === true }))
                          }
                        />
                        <span>{g.label}</span>
                      </label>
                    ))}
                    <div className="text-xs text-muted-foreground pt-1">
                      Việc lên lớp/ra trường thực hiện ở mục Học sinh bằng cách tích chọn học sinh rồi chọn lớp đích.
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Ghi chú</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Hủy</Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Tạo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </div>
        ) : years.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
            Chưa có năm học nào. Bấm "Thêm" để tạo năm học đầu tiên.
          </div>
        ) : (
          <div className="space-y-2">
            {years.map((y) => {
              const badge = statusBadge(y.status);
              const isBusy = busyId === y.id;
              const canDelete = y.status === 'closed' && !y.is_active;
              return (
                <div
                  key={y.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{y.name}</span>
                      {y.is_active && (
                        <Badge className="bg-primary text-primary-foreground">Mặc định</Badge>
                      )}
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    {(y.start_date || y.end_date) && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {y.start_date ?? '...'} → {y.end_date ?? '...'}
                      </div>
                    )}
                    {y.notes && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{y.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(y)} disabled={isBusy}>
                      <Pencil className="h-4 w-4 mr-1" /> Sửa
                    </Button>
                    {!y.is_active && (
                      <Button size="sm" variant="outline" onClick={() => setActive(y.id)} disabled={isBusy}>
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                        Đặt mặc định
                      </Button>
                    )}
                    {y.status === 'open' && !y.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(y.id, 'closed')} disabled={isBusy}>
                        <Lock className="h-4 w-4 mr-1" /> Đóng
                      </Button>
                    )}
                    {y.status === 'closed' && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(y.id, 'open')} disabled={isBusy}>
                        <Unlock className="h-4 w-4 mr-1" /> Mở lại
                      </Button>
                    )}
                    {y.status !== 'archived' && !y.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(y.id, 'archived')} disabled={isBusy}>
                        <Archive className="h-4 w-4 mr-1" /> Lưu trữ
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: y.id, name: y.name })}
                        disabled={isBusy}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Xoá
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa năm học</DialogTitle>
            <DialogDescription>Cập nhật tên, thời gian và ghi chú.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Tên năm học *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Ngày bắt đầu</Label>
                <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Ngày kết thúc</Label>
                <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Ghi chú</Label>
              <Textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Hủy</Button>
            <Button onClick={handleEditSave} disabled={busyId === editTarget?.id}>
              {busyId === editTarget?.id && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá năm học "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Chỉ xoá được khi năm học đã đóng và chưa phát sinh dữ liệu ở các phân hệ
              (điểm danh, thi đua, thuốc, y tế, kho bếp, kho gạo, trực ban, ra vào nội trú,
              vắng ăn, vắng GV, thành tích GV). Nếu còn dữ liệu, hệ thống sẽ từ chối và bạn
              nên dùng "Lưu trữ" thay vì xoá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
