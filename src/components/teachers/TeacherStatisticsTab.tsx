import { useMemo, useState } from 'react';
import { TeacherRow } from './TeacherFormDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  teachers: TeacherRow[];
}

const genderLabel = (g?: string | null) => g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : g === 'other' ? 'Khác' : '—';

function ageFromBirthday(b?: string | null) {
  if (!b) return null;
  const d = new Date(b);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export function TeacherStatisticsTab({ teachers }: Props) {
  const [fLevel, setFLevel] = useState('all');
  const [fGender, setFGender] = useState('all');
  const [fEthnicity, setFEthnicity] = useState('all');
  const [fSubject, setFSubject] = useState('all');
  const [fStatus, setFStatus] = useState('active');

  const ethnicities = Array.from(new Set(teachers.map((t) => t.ethnicity).filter(Boolean))) as string[];
  const subjects = Array.from(new Set(teachers.map((t) => t.subject).filter(Boolean))) as string[];
  const levels = Array.from(new Set(teachers.map((t) => t.education_level).filter(Boolean))) as string[];

  const filtered = useMemo(() => teachers.filter((t) =>
    (fLevel === 'all' || t.education_level === fLevel) &&
    (fGender === 'all' || t.gender === fGender) &&
    (fEthnicity === 'all' || t.ethnicity === fEthnicity) &&
    (fSubject === 'all' || t.subject === fSubject) &&
    (fStatus === 'all' || (fStatus === 'active' ? t.is_active : !t.is_active))
  ), [teachers, fLevel, fGender, fEthnicity, fSubject, fStatus]);

  const counts = useMemo(() => {
    const byGender: Record<string, number> = { male: 0, female: 0, other: 0 };
    const byLevel: Record<string, number> = {};
    const bySubject: Record<string, number> = {};
    const byEthnicity: Record<string, number> = {};
    const byAgeGroup: Record<string, number> = { 'Dưới 30': 0, '30-39': 0, '40-49': 0, '50+': 0, 'Chưa rõ': 0 };
    const bySalaryRank: Record<string, number> = {};

    filtered.forEach((t) => {
      byGender[t.gender || 'other'] = (byGender[t.gender || 'other'] || 0) + 1;
      const lv = t.education_level || 'Chưa phân loại';
      byLevel[lv] = (byLevel[lv] || 0) + 1;
      const sb = t.subject || 'Chưa rõ';
      bySubject[sb] = (bySubject[sb] || 0) + 1;
      const et = t.ethnicity || 'Chưa rõ';
      byEthnicity[et] = (byEthnicity[et] || 0) + 1;
      const age = ageFromBirthday(t.birthday);
      if (age == null) byAgeGroup['Chưa rõ']++;
      else if (age < 30) byAgeGroup['Dưới 30']++;
      else if (age < 40) byAgeGroup['30-39']++;
      else if (age < 50) byAgeGroup['40-49']++;
      else byAgeGroup['50+']++;
      const sr = t.salary_rank || 'Chưa xếp';
      bySalaryRank[sr] = (bySalaryRank[sr] || 0) + 1;
    });

    return { byGender, byLevel, bySubject, byEthnicity, byAgeGroup, bySalaryRank };
  }, [filtered]);

  const exportExcel = () => {
    const rows = filtered.map((t) => ({
      'Họ tên': t.full_name,
      'Ngày sinh': t.birthday || '',
      'Giới tính': genderLabel(t.gender),
      'Dân tộc': t.ethnicity || '',
      'SĐT': t.phone || '',
      'Email': t.email || '',
      'Cấp học': t.education_level || '',
      'Môn dạy': t.subject || '',
      'Chức vụ': t.position || '',
      'Ngày vào ngành': t.joined_at || '',
      'Bậc': t.salary_rank || '',
      'Hạng': t.salary_class || '',
      'Cấp lương': t.salary_level || '',
      'Hệ số': t.salary_coefficient ?? '',
      'Hưởng từ': t.salary_effective_date || '',
      'Quê quán': t.hometown || '',
      'Địa chỉ': t.address || '',
      'Trạng thái': t.is_active ? 'Đang công tác' : 'Đã nghỉ',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Giáo viên');
    XLSX.writeFile(wb, `Danh-sach-giao-vien-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const StatCard = ({ title, data }: { title: string; data: Record<string, number> }) => {
    const entries = Object.entries(data).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {entries.length === 0 ? <p className="text-xs text-muted-foreground">Không có dữ liệu</p> : entries.map(([k, v]) => {
            const pct = total ? Math.round((v / total) * 100) : 0;
            const lbl = title.includes('Giới') ? genderLabel(k) : k;
            return (
              <div key={k}>
                <div className="flex justify-between text-xs mb-0.5"><span>{lbl}</span><span className="font-semibold">{v} ({pct}%)</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Cấp học</Label>
              <Select value={fLevel} onValueChange={setFLevel}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Giới tính</Label>
              <Select value={fGender} onValueChange={setFGender}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="male">Nam</SelectItem>
                  <SelectItem value="female">Nữ</SelectItem>
                  <SelectItem value="other">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Dân tộc</Label>
              <Select value={fEthnicity} onValueChange={setFEthnicity}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {ethnicities.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Môn dạy</Label>
              <Select value={fSubject} onValueChange={setFSubject}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {subjects.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Trạng thái</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="active">Đang công tác</SelectItem>
                  <SelectItem value="inactive">Đã nghỉ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold">Tổng: {filtered.length} giáo viên</span>
        </div>
        <Button onClick={exportExcel} variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Xuất Excel</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard title="Giới tính" data={counts.byGender} />
        <StatCard title="Cấp học" data={counts.byLevel} />
        <StatCard title="Độ tuổi" data={counts.byAgeGroup} />
        <StatCard title="Môn dạy" data={counts.bySubject} />
        <StatCard title="Dân tộc" data={counts.byEthnicity} />
        <StatCard title="Bậc lương" data={counts.bySalaryRank} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Danh sách đã lọc</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Giới</TableHead>
                <TableHead>Cấp</TableHead>
                <TableHead>Môn</TableHead>
                <TableHead>Dân tộc</TableHead>
                <TableHead>Bậc</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell>{genderLabel(t.gender)}</TableCell>
                  <TableCell>{t.education_level || '—'}</TableCell>
                  <TableCell>{t.subject || '—'}</TableCell>
                  <TableCell>{t.ethnicity || '—'}</TableCell>
                  <TableCell>{t.salary_rank || '—'}</TableCell>
                  <TableCell>{t.is_active ? <Badge variant="secondary">Đang công tác</Badge> : <Badge variant="outline">Đã nghỉ</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
