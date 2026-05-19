import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeacherRow } from './TeacherFormDialog';

interface Props {
  schoolId: string;
  teachers: TeacherRow[];
}

const ABSENCE_TYPES = [
  { v: 'leave', l: 'Nghỉ phép', color: 'bg-blue-500' },
  { v: 'sick', l: 'Nghỉ ốm', color: 'bg-amber-500' },
  { v: 'unpaid', l: 'Không phép', color: 'bg-red-500' },
  { v: 'business', l: 'Công tác', color: 'bg-purple-500' },
];

function monthDates(year: number, month: number) {
  const days: Date[] = [];
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(year, month, d));
  return days;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TeacherAbsenceTab({ schoolId, teachers }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [absences, setAbsences] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ teacher: TeacherRow; date: string; existing?: any } | null>(null);
  const [type, setType] = useState('leave');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => monthDates(year, month), [year, month]);

  const load = async () => {
    setLoading(true);
    const start = toDateStr(new Date(year, month, 1));
    const end = toDateStr(new Date(year, month + 1, 0));
    const { data } = await supabase
      .from('teacher_absences')
      .select('*')
      .eq('school_id', schoolId)
      .gte('absence_date', start)
      .lte('absence_date', end);
    setAbsences(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [year, month, schoolId]);

  const map = useMemo(() => {
    const m: Record<string, any> = {};
    for (const a of absences) m[`${a.teacher_id}_${a.absence_date}`] = a;
    return m;
  }, [absences]);

  const openCell = (teacher: TeacherRow, date: string) => {
    const existing = map[`${teacher.id}_${date}`];
    setEditing({ teacher, date, existing });
    setType(existing?.absence_type || 'leave');
    setReason(existing?.reason || '');
  };

  const saveCell = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { teacher, date, existing } = editing;
      if (existing) {
        const { error } = await supabase.from('teacher_absences').update({
          absence_type: type, reason: reason || null
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teacher_absences').insert({
          school_id: schoolId, teacher_id: teacher.id, absence_date: date,
          absence_type: type, reason: reason || null, reporter_id: user?.id,
        });
        if (error) throw error;
      }
      toast({ title: 'Đã lưu' });
      setEditing(null);
      load();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteCell = async () => {
    if (!editing?.existing) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('teacher_absences').delete().eq('id', editing.existing.id);
      if (error) throw error;
      toast({ title: 'Đã xoá' });
      setEditing(null);
      load();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totalByTeacher = (tId: string) => {
    const list = absences.filter((a) => a.teacher_id === tId);
    const totals: Record<string, number> = {};
    list.forEach((a) => { totals[a.absence_type] = (totals[a.absence_type] || 0) + 1; });
    return totals;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(year, month - 1, 1);
          setYear(d.getFullYear()); setMonth(d.getMonth());
        }}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="font-semibold text-lg">Tháng {month + 1}/{year}</div>
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(year, month + 1, 1);
          setYear(d.getFullYear()); setMonth(d.getMonth());
        }}><ChevronRight className="h-4 w-4" /></Button>
        <div className="ml-auto flex flex-wrap gap-2 text-xs">
          {ABSENCE_TYPES.map((t) => (
            <div key={t.v} className="flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded-sm', t.color)} />{t.l}
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-auto">
        {loading ? (
          <div className="p-8 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <table className="text-xs min-w-full">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="sticky left-0 bg-muted px-2 py-2 text-left min-w-[180px] z-10 border-r">Giáo viên</th>
                {days.map((d) => (
                  <th key={d.getDate()} className={cn('px-1 py-1 text-center min-w-[28px]',
                    [0, 6].includes(d.getDay()) && 'bg-red-50 text-red-600'
                  )}>{d.getDate()}</th>
                ))}
                <th className="px-2 py-2 text-center min-w-[80px] border-l bg-muted">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => {
                const totals = totalByTeacher(t.id!);
                const totalAbsent = Object.values(totals).reduce((a, b) => a + b, 0);
                return (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="sticky left-0 bg-background hover:bg-muted/30 px-2 py-1 font-medium border-r">{t.full_name}</td>
                    {days.map((d) => {
                      const ds = toDateStr(d);
                      const a = map[`${t.id}_${ds}`];
                      const color = a ? (ABSENCE_TYPES.find((x) => x.v === a.absence_type)?.color || 'bg-gray-500') : '';
                      return (
                        <td key={ds} className="px-0.5 py-0.5 text-center">
                          <button
                            onClick={() => openCell(t, ds)}
                            className={cn(
                              'h-6 w-6 rounded text-white text-[10px] font-bold transition-all',
                              a ? color : 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground'
                            )}
                            title={a?.reason || ''}
                          >
                            {a ? a.absence_type.charAt(0).toUpperCase() : ''}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center font-semibold border-l bg-muted/30">{totalAbsent}</td>
                  </tr>
                );
              })}
              {teachers.length === 0 && (
                <tr><td colSpan={days.length + 2} className="text-center py-8 text-muted-foreground">Chưa có giáo viên</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ghi vắng — {editing?.teacher.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Ngày</Label><Input value={editing?.date || ''} readOnly /></div>
            <div>
              <Label>Loại vắng</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ABSENCE_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lý do</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing?.existing && (
              <Button variant="destructive" onClick={deleteCell} disabled={saving}>Xoá</Button>
            )}
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Đóng</Button>
            <Button onClick={saveCell} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
