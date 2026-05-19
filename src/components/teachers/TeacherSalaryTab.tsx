import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { TeacherRow } from './TeacherFormDialog';

interface Props {
  schoolId: string;
  teachers: TeacherRow[];
  reload: () => void;
}

export function TeacherSalaryTab({ teachers, reload }: Props) {
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, Partial<TeacherRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const update = (id: string, patch: Partial<TeacherRow>) => {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  };

  const save = async (t: TeacherRow) => {
    const patch = edits[t.id!];
    if (!patch) return;
    setSavingId(t.id!);
    try {
      const payload: any = { ...patch };
      if (payload.salary_coefficient === '' || payload.salary_coefficient == null) payload.salary_coefficient = null;
      else payload.salary_coefficient = Number(payload.salary_coefficient);
      if (payload.salary_effective_date === '') payload.salary_effective_date = null;
      const { error } = await supabase.from('teachers').update(payload).eq('id', t.id!);
      if (error) throw error;
      toast({ title: 'Đã lưu', description: t.full_name });
      setEdits((e) => { const n = { ...e }; delete n[t.id!]; return n; });
      reload();
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return teachers.filter((t) => !s || t.full_name.toLowerCase().includes(s));
  }, [teachers, search]);

  const val = (t: TeacherRow, key: keyof TeacherRow) => {
    const e = edits[t.id!];
    if (e && key in e) return (e as any)[key] ?? '';
    return (t as any)[key] ?? '';
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Tìm theo tên..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Giáo viên</TableHead>
              <TableHead>Bậc</TableHead>
              <TableHead>Hạng</TableHead>
              <TableHead>Cấp</TableHead>
              <TableHead>Hệ số</TableHead>
              <TableHead>Hưởng từ ngày</TableHead>
              <TableHead className="text-right">Lưu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const dirty = !!edits[t.id!];
              return (
                <TableRow key={t.id} className={dirty ? 'bg-amber-50' : ''}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell><Input value={val(t, 'salary_rank')} onChange={(e) => update(t.id!, { salary_rank: e.target.value })} className="h-8" /></TableCell>
                  <TableCell><Input value={val(t, 'salary_class')} onChange={(e) => update(t.id!, { salary_class: e.target.value })} className="h-8" /></TableCell>
                  <TableCell><Input value={val(t, 'salary_level')} onChange={(e) => update(t.id!, { salary_level: e.target.value })} className="h-8" /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={val(t, 'salary_coefficient')} onChange={(e) => update(t.id!, { salary_coefficient: e.target.value as any })} className="h-8 w-24" /></TableCell>
                  <TableCell><Input type="date" value={val(t, 'salary_effective_date')} onChange={(e) => update(t.id!, { salary_effective_date: e.target.value })} className="h-8 w-40" /></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant={dirty ? 'default' : 'ghost'} disabled={!dirty || savingId === t.id} onClick={() => save(t)}>
                      {savingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Không có giáo viên</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
