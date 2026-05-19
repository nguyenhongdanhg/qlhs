import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, Upload, ExternalLink } from 'lucide-react';
import { TeacherRow } from './TeacherFormDialog';

interface Props {
  schoolId: string;
  teachers: TeacherRow[];
}

const CATEGORIES = ['Giáo viên giỏi', 'Bồi dưỡng HSG', 'Sáng kiến kinh nghiệm', 'Chiến sĩ thi đua', 'Khen thưởng khác'];
const LEVELS = ['Trường', 'Huyện', 'Tỉnh', 'Quốc gia'];

export function TeacherAchievementsTab({ schoolId, teachers }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('teacher_achievements')
      .select('*')
      .eq('school_id', schoolId)
      .order('award_date', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [schoolId]);

  const handleSave = async () => {
    if (!editing.teacher_id || !editing.title) {
      toast({ title: 'Thiếu thông tin', description: 'Cần chọn giáo viên và nhập tiêu đề', variant: 'destructive' });
      return;
    }
    try {
      const payload = { ...editing, school_id: schoolId };
      delete payload.id;
      Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

      const { error } = editing.id
        ? await supabase.from('teacher_achievements').update(payload).eq('id', editing.id)
        : await supabase.from('teacher_achievements').insert(payload);
      if (error) throw error;
      toast({ title: 'Đã lưu' });
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e?.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá thành tích này?')) return;
    const { error } = await supabase.from('teacher_achievements').delete().eq('id', id);
    if (error) toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Đã xoá' }); load(); }
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const path = `${schoolId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('teacher-files').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('teacher-files').getPublicUrl(path);
      setEditing((e: any) => ({ ...e, attachment_url: data.publicUrl }));
      toast({ title: 'Đã tải lên' });
    } catch (e: any) {
      toast({ title: 'Lỗi tải lên', description: e?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const tName = (id: string) => teachers.find((t) => t.id === id)?.full_name || '—';

  const years = Array.from(new Set(items.map((i) => i.school_year).filter(Boolean))).sort();
  const filtered = items.filter((i) =>
    (filterTeacher === 'all' || i.teacher_id === filterTeacher) &&
    (filterYear === 'all' || i.school_year === filterYear)
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterTeacher} onValueChange={setFilterTeacher}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tất cả GV" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả giáo viên</SelectItem>
            {teachers.map((t) => <SelectItem key={t.id} value={t.id!}>{t.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Năm học" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả năm học</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => { setEditing({ teacher_id: '', title: '', category: '', level: '', school_year: '', award_date: '', notes: '', attachment_url: '' }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />Thêm thành tích
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Giáo viên</TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Cấp</TableHead>
                <TableHead>Năm học</TableHead>
                <TableHead>Ngày khen</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{tName(i.teacher_id)}</TableCell>
                  <TableCell>{i.title}</TableCell>
                  <TableCell><Badge variant="secondary">{i.category || '—'}</Badge></TableCell>
                  <TableCell>{i.level || '—'}</TableCell>
                  <TableCell>{i.school_year || '—'}</TableCell>
                  <TableCell>{i.award_date || '—'}</TableCell>
                  <TableCell>{i.attachment_url ? <a href={i.attachment_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />Xem</a> : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Chưa có dữ liệu</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? 'Sửa thành tích' : 'Thêm thành tích'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Giáo viên *</Label>
                <Select value={editing.teacher_id} onValueChange={(v) => setEditing({ ...editing, teacher_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Chọn GV" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => <SelectItem key={t.id} value={t.id!}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>Tiêu đề *</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div>
                <Label>Loại</Label>
                <Select value={editing.category || ''} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cấp khen</Label>
                <Select value={editing.level || ''} onValueChange={(v) => setEditing({ ...editing, level: v })}>
                  <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
                  <SelectContent>{LEVELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Năm học</Label><Input placeholder="VD: 2025-2026" value={editing.school_year || ''} onChange={(e) => setEditing({ ...editing, school_year: e.target.value })} /></div>
              <div><Label>Ngày khen</Label><Input type="date" value={editing.award_date || ''} onChange={(e) => setEditing({ ...editing, award_date: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Ghi chú</Label><Textarea rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
              <div className="md:col-span-2">
                <Label>File đính kèm</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} disabled={uploading} />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {editing.attachment_url && <a href={editing.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary mt-1 inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />File hiện tại</a>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button onClick={handleSave}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
