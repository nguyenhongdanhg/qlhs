import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Loader2, Trash2, EyeOff, Plus, CalendarRange } from 'lucide-react';
import { vietnameseNameSortCompare } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HiddenEntry {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  student?: { full_name: string; class?: { name: string } | null } | null;
}

interface StudentRow {
  id: string;
  full_name: string;
  class_id: string | null;
  class?: { name: string; grade: number } | null;
}

interface ClassRow {
  id: string;
  name: string;
  grade: number;
}

export default function HiddenStudentsDialog({ open, onOpenChange }: Props) {
  const { currentSchool } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<HiddenEntry[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);

  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [bulkClassId, setBulkClassId] = useState<string>('');

  useEffect(() => {
    if (open && currentSchool) {
      fetchAll();
    } else {
      setSelectedIds(new Set());
      setSearch('');
      setReason('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentSchool]);

  const fetchAll = async () => {
    if (!currentSchool) return;
    setLoading(true);
    try {
      const [studentsRes, classesRes, entriesRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, class_id, class:classes(name, grade)')
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .limit(5000),
        supabase
          .from('classes')
          .select('id, name, grade')
          .eq('school_id', currentSchool.id)
          .eq('is_active', true)
          .order('grade')
          .order('name'),
        supabase
          .from('student_attendance_hidden')
          .select('id, student_id, start_date, end_date, reason, student:students(full_name, class:classes(name))')
          .eq('school_id', currentSchool.id)
          .order('start_date', { ascending: false }),
      ]);

      const studs = ((studentsRes.data as any[]) || []).map((s) => ({
        ...s,
        class: s.class as any,
      })) as StudentRow[];
      studs.sort((a, b) => {
        const ga = a.class?.grade || 0;
        const gb = b.class?.grade || 0;
        if (ga !== gb) return ga - gb;
        const ca = a.class?.name || '';
        const cb = b.class?.name || '';
        if (ca !== cb) return ca.localeCompare(cb, 'vi');
        return vietnameseNameSortCompare(a.full_name, b.full_name);
      });
      setStudents(studs);
      setClasses((classesRes.data || []) as ClassRow[]);
      setEntries((entriesRes.data as any) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const s = search.trim().toLowerCase();
    return students.filter((st) => {
      if (classFilter !== 'all' && st.class_id !== classFilter) return false;
      if (s && !st.full_name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [students, classFilter, search]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAllVisible = () => {
    const allIn = filteredStudents.every((s) => selectedIds.has(s.id));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (allIn) filteredStudents.forEach((s) => n.delete(s.id));
      else filteredStudents.forEach((s) => n.add(s.id));
      return n;
    });
  };

  const handleSelectWholeClass = () => {
    if (!bulkClassId) return;
    const ids = students.filter((s) => s.class_id === bulkClassId).map((s) => s.id);
    setSelectedIds((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.add(id));
      return n;
    });
    toast({ title: 'Đã chọn', description: `Thêm ${ids.length} học sinh của lớp vào danh sách` });
  };

  const handleSave = async () => {
    if (!currentSchool) return;
    if (selectedIds.size === 0) {
      toast({ title: 'Chưa chọn học sinh', variant: 'destructive' });
      return;
    }
    if (!startDate || !endDate || startDate > endDate) {
      toast({ title: 'Khoảng ngày không hợp lệ', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const rows = Array.from(selectedIds).map((sid) => ({
        school_id: currentSchool.id,
        student_id: sid,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
      }));
      const { error } = await supabase.from('student_attendance_hidden').insert(rows);
      if (error) throw error;
      toast({ title: 'Thành công', description: `Đã ẩn ${rows.length} học sinh từ ${startDate} đến ${endDate}` });
      setSelectedIds(new Set());
      setReason('');
      await fetchAll();
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá đợt ẩn này?')) return;
    const { error } = await supabase.from('student_attendance_hidden').delete().eq('id', id);
    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast({ title: 'Đã xoá' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-primary" />
            Ẩn học sinh khỏi điểm danh
          </DialogTitle>
          <DialogDescription>
            Tạm ẩn học sinh khỏi tất cả màn hình điểm danh (nội trú, bữa ăn, tự học) trong khoảng ngày đã chọn. Áp dụng khi học sinh về nghỉ dài ngày.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create"><Plus className="h-4 w-4 mr-1" />Tạo đợt ẩn</TabsTrigger>
            <TabsTrigger value="list"><CalendarRange className="h-4 w-4 mr-1" />Danh sách ({entries.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Từ ngày</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Đến ngày</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Lý do (tuỳ chọn)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vd: Nghỉ hè đợt 1" />
            </div>

            <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
              <Label className="text-xs">Chọn cả lớp</Label>
              <div className="flex gap-2">
                <Select value={bulkClassId} onValueChange={setBulkClassId}>
                  <SelectTrigger><SelectValue placeholder="Chọn lớp..." /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="secondary" onClick={handleSelectWholeClass} disabled={!bulkClassId}>
                  Thêm cả lớp
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input placeholder="Tìm tên..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả lớp</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Đã chọn: <strong>{selectedIds.size}</strong> / {filteredStudents.length} hiển thị</span>
                <Button type="button" size="sm" variant="ghost" onClick={toggleAllVisible}>
                  {filteredStudents.every((s) => selectedIds.has(s.id)) && filteredStudents.length > 0 ? 'Bỏ chọn hết' : 'Chọn hết'}
                </Button>
              </div>

              <ScrollArea className="h-64 rounded border">
                <div className="divide-y">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Không có học sinh</p>
                  ) : (
                    filteredStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleStudent(s.id)} />
                        <span className="flex-1 text-sm">{s.full_name}</span>
                        {s.class?.name && <Badge variant="outline" className="text-xs">{s.class.name}</Badge>}
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
              <Button onClick={handleSave} disabled={saving || selectedIds.size === 0}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Ẩn {selectedIds.size > 0 ? `${selectedIds.size} HS` : ''}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có đợt ẩn nào</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded border p-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {e.student?.full_name || '—'}
                        {e.student?.class?.name && (
                          <Badge variant="outline" className="ml-2 text-xs">{e.student.class.name}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.start_date} → {e.end_date}
                        {e.reason && ` · ${e.reason}`}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
