import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYears, AcademicYearStatus } from '@/hooks/useAcademicYears';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarRange, Loader2, Plus, Check, Lock, Unlock, Archive } from 'lucide-react';

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
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!currentSchool || !isAdmin) return null;

  const reset = () => {
    setName(''); setStartDate(''); setEndDate(''); setNotes('');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Lỗi', description: 'Nhập tên năm học (VD: 2025-2026)', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('academic_years').insert({
        school_id: currentSchool.id,
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes.trim() || null,
        status: 'open',
        is_active: false,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast({ title: 'Đã tạo năm học', description: name.trim() });
      reset();
      setOpen(false);
      await refresh();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Thêm
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo năm học mới</DialogTitle>
              <DialogDescription>
                Sau khi tạo, bấm "Đặt mặc định" để hệ thống dùng năm này cho dữ liệu mới.
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
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
