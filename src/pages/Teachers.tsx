import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GraduationCap, Plus, Pencil, Trash2, Loader2, Search, Upload } from 'lucide-react';
import { TeacherFormDialog, TeacherRow } from '@/components/teachers/TeacherFormDialog';
import { TeacherAbsenceTab } from '@/components/teachers/TeacherAbsenceTab';
import { TeacherAchievementsTab } from '@/components/teachers/TeacherAchievementsTab';
import { TeacherSalaryTab } from '@/components/teachers/TeacherSalaryTab';
import { TeacherStatisticsTab } from '@/components/teachers/TeacherStatisticsTab';
import type { TeacherImportRow } from '@/lib/excel-utils';

const TeacherImportDialog = lazy(() =>
  import('@/components/teachers/TeacherImportDialog').then(m => ({ default: m.TeacherImportDialog }))
);

export default function Teachers() {
  const { currentSchool, isSchoolAdmin } = useAuth();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const isAdmin = isSchoolAdmin();

  const load = async () => {
    if (!currentSchool) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('school_id', currentSchool.id)
      .order('full_name');
    if (error) toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    setTeachers((data || []) as TeacherRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentSchool?.id]);

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá hồ sơ giáo viên này? Các bản ghi vắng và thành tích cũng sẽ bị xoá.')) return;
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (error) toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Đã xoá' }); load(); }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return teachers.filter((t) => !s
      || t.full_name.toLowerCase().includes(s)
      || (t.phone || '').toLowerCase().includes(s)
      || (t.subject || '').toLowerCase().includes(s)
    );
  }, [teachers, search]);

  if (!currentSchool) return <div className="content-wrapper">Chưa chọn trường.</div>;

  return (
    <div className="content-wrapper space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Quản lý giáo viên</h1>
          <p className="text-sm text-muted-foreground">Hồ sơ, chấm công, thành tích, bậc lương & thống kê</p>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="absence">Chấm công</TabsTrigger>
          <TabsTrigger value="achievements">Thành tích</TabsTrigger>
          <TabsTrigger value="salary">Bậc lương</TabsTrigger>
          <TabsTrigger value="stats">Thống kê</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Tìm tên, SĐT, môn..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {isAdmin && (
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />Thêm giáo viên
              </Button>
            )}
          </div>

          <Card className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Họ tên</TableHead>
                    <TableHead>Giới tính</TableHead>
                    <TableHead>Cấp</TableHead>
                    <TableHead>Môn</TableHead>
                    <TableHead>Chức vụ</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    {isAdmin && <TableHead className="text-right">Thao tác</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.full_name}</TableCell>
                      <TableCell>{t.gender === 'male' ? 'Nam' : t.gender === 'female' ? 'Nữ' : '—'}</TableCell>
                      <TableCell>{t.education_level || '—'}</TableCell>
                      <TableCell>{t.subject || '—'}</TableCell>
                      <TableCell>{t.position || '—'}</TableCell>
                      <TableCell>{t.phone || '—'}</TableCell>
                      <TableCell>{t.is_active ? <Badge variant="secondary">Đang công tác</Badge> : <Badge variant="outline">Đã nghỉ</Badge>}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-8">Chưa có giáo viên</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="absence"><TeacherAbsenceTab schoolId={currentSchool.id} teachers={teachers} /></TabsContent>
        <TabsContent value="achievements"><TeacherAchievementsTab schoolId={currentSchool.id} teachers={teachers} /></TabsContent>
        <TabsContent value="salary"><TeacherSalaryTab schoolId={currentSchool.id} teachers={teachers} reload={load} /></TabsContent>
        <TabsContent value="stats"><TeacherStatisticsTab teachers={teachers} /></TabsContent>
      </Tabs>

      <TeacherFormDialog open={open} onOpenChange={setOpen} schoolId={currentSchool.id} teacher={editing} onSaved={load} />
    </div>
  );
}
