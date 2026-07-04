import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export interface TeacherRow {
  id?: string;
  school_id: string;
  user_id?: string | null;
  full_name: string;
  birthday?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  phone?: string | null;
  email?: string | null;
  hometown?: string | null;
  address?: string | null;
  education_level?: string | null;
  subject?: string | null;
  position?: string | null;
  joined_at?: string | null;
  salary_rank?: string | null;
  salary_class?: string | null;
  salary_level?: string | null;
  salary_coefficient?: number | null;
  salary_effective_date?: string | null;
  salary_raise_years?: number | null;
  seniority_effective_date?: string | null;
  seniority_raise_years?: number | null;
  notes?: string | null;
  is_active?: boolean;
}

interface ProfileOption {
  id: string;
  full_name: string;
  username?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  teacher?: TeacherRow | null;
  onSaved: () => void;
}

const EDUCATION_LEVELS = ['Tiểu học', 'THCS', 'THPT'];
const GENDERS = [{ v: 'male', l: 'Nam' }, { v: 'female', l: 'Nữ' }, { v: 'other', l: 'Khác' }];

export function TeacherFormDialog({ open, onOpenChange, schoolId, teacher, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<ProfileOption[]>([]);
  const [form, setForm] = useState<TeacherRow>({
    school_id: schoolId,
    full_name: '',
    is_active: true,
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      teacher
        ? { ...teacher }
        : { school_id: schoolId, full_name: '', is_active: true }
    );
    // Load school members (profiles) for linking
    (async () => {
      const { data: memberships } = await supabase
        .from('school_memberships')
        .select('user_id')
        .eq('school_id', schoolId)
        .eq('status', 'active');
      const ids = (memberships || []).map((m: any) => m.user_id);
      if (ids.length === 0) {
        setAccounts([]);
        return;
      }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', ids);
      setAccounts((profiles || []) as ProfileOption[]);
    })();
  }, [open, teacher, schoolId]);

  const update = (patch: Partial<TeacherRow>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast({ title: 'Thiếu thông tin', description: 'Họ tên là bắt buộc', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let linkedUserId: string | null = form.user_id || null;
      const cleanPhone = (form.phone || '').replace(/\D/g, '');

      // Auto-create/link user account when phone is provided and not yet linked
      if (!linkedUserId && cleanPhone) {
        const { data: createRes, error: fnError } = await supabase.functions.invoke('create-user', {
          body: {
            phone: cleanPhone,
            password: '123456',
            full_name: form.full_name.trim(),
            school_id: schoolId,
            role: 'teacher',
          },
        });
        if (fnError) throw fnError;
        if (createRes?.error) throw new Error(createRes.error);
        linkedUserId = createRes?.user_id || null;
        if (createRes?.user_id && !createRes?.existing) {
          toast({ title: 'Đã tạo tài khoản', description: `SĐT: ${cleanPhone} • Mật khẩu mặc định: 123456` });
        }
      }

      // Sync linked profile with the latest full_name / phone
      if (linkedUserId) {
        await supabase.from('profiles').update({
          full_name: form.full_name.trim(),
          ...(cleanPhone ? { phone: cleanPhone, username: cleanPhone } : {}),
        }).eq('id', linkedUserId);
      }

      const payload: any = {
        ...form,
        school_id: schoolId,
        salary_coefficient: form.salary_coefficient ? Number(form.salary_coefficient) : null,
        salary_raise_years: form.salary_raise_years ? Number(form.salary_raise_years) : 3,
        seniority_raise_years: form.seniority_raise_years ? Number(form.seniority_raise_years) : 1,
        user_id: linkedUserId,
        birthday: form.birthday || null,
        joined_at: form.joined_at || null,
        salary_effective_date: form.salary_effective_date || null,
        seniority_effective_date: form.seniority_effective_date || null,
      };
      Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

      let error;
      if (teacher?.id) {
        ({ error } = await supabase.from('teachers').update(payload).eq('id', teacher.id));
      } else {
        ({ error } = await supabase.from('teachers').insert(payload));
      }
      if (error) throw error;
      toast({ title: 'Đã lưu', description: 'Cập nhật hồ sơ giáo viên thành công' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: 'Lỗi',
        description: e?.message?.includes('duplicate') ? 'Tài khoản này đã có hồ sơ giáo viên' : e?.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{teacher?.id ? 'Sửa hồ sơ giáo viên' : 'Thêm giáo viên'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Tài khoản liên kết</Label>
            <Select value={form.user_id || 'none'} onValueChange={(v) => {
              const sel = accounts.find((a) => a.id === v);
              update({ user_id: v === 'none' ? null : v, full_name: form.full_name || sel?.full_name || '' });
            }}>
              <SelectTrigger><SelectValue placeholder="Chọn tài khoản (tuỳ chọn)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Không liên kết —</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name} {a.username ? `(${a.username})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Họ tên *</Label>
            <Input value={form.full_name} onChange={(e) => update({ full_name: e.target.value })} />
          </div>
          <div>
            <Label>Ngày sinh</Label>
            <Input type="date" value={form.birthday || ''} onChange={(e) => update({ birthday: e.target.value })} />
          </div>
          <div>
            <Label>Giới tính</Label>
            <Select value={form.gender || ''} onValueChange={(v) => update({ gender: v })}>
              <SelectTrigger><SelectValue placeholder="Chọn" /></SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dân tộc</Label>
            <Input value={form.ethnicity || ''} onChange={(e) => update({ ethnicity: e.target.value })} />
          </div>
          <div>
            <Label>SĐT</Label>
            <Input value={form.phone || ''} onChange={(e) => update({ phone: e.target.value })} />
            {!form.user_id && (
              <p className="text-[11px] text-muted-foreground mt-1">Nếu nhập SĐT, hệ thống sẽ tự tạo tài khoản (mật khẩu mặc định: 123456) hoặc ghép với tài khoản cùng SĐT.</p>
            )}
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email || ''} onChange={(e) => update({ email: e.target.value })} />
          </div>
          <div>
            <Label>Quê quán</Label>
            <Input value={form.hometown || ''} onChange={(e) => update({ hometown: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Địa chỉ</Label>
            <Input value={form.address || ''} onChange={(e) => update({ address: e.target.value })} />
          </div>

          <div>
            <Label>Cấp học</Label>
            <Select value={form.education_level || ''} onValueChange={(v) => update({ education_level: v })}>
              <SelectTrigger><SelectValue placeholder="Chọn cấp" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Môn dạy</Label>
            <Input value={form.subject || ''} onChange={(e) => update({ subject: e.target.value })} />
          </div>
          <div>
            <Label>Chức vụ</Label>
            <Input value={form.position || ''} onChange={(e) => update({ position: e.target.value })} />
          </div>
          <div>
            <Label>Ngày vào ngành</Label>
            <Input type="date" value={form.joined_at || ''} onChange={(e) => update({ joined_at: e.target.value })} />
          </div>

          <div className="md:col-span-2 border-t pt-3">
            <Label className="text-base font-semibold">Bậc lương</Label>
          </div>
          <div>
            <Label>Bậc</Label>
            <Input value={form.salary_rank || ''} onChange={(e) => update({ salary_rank: e.target.value })} placeholder="VD: Bậc 3" />
          </div>
          <div>
            <Label>Hạng</Label>
            <Input value={form.salary_class || ''} onChange={(e) => update({ salary_class: e.target.value })} placeholder="VD: Hạng II" />
          </div>
          <div>
            <Label>Cấp</Label>
            <Input value={form.salary_level || ''} onChange={(e) => update({ salary_level: e.target.value })} placeholder="VD: Cấp THCS" />
          </div>
          <div>
            <Label>Hệ số</Label>
            <Input type="number" step="0.01" value={form.salary_coefficient ?? ''} onChange={(e) => update({ salary_coefficient: e.target.value as any })} />
          </div>
          <div>
            <Label>Hưởng lương từ ngày</Label>
            <Input type="date" value={form.salary_effective_date || ''} onChange={(e) => update({ salary_effective_date: e.target.value })} />
          </div>
          <div>
            <Label>Chu kỳ nâng lương (năm)</Label>
            <Input type="number" min="1" step="1" value={form.salary_raise_years ?? 3} onChange={(e) => update({ salary_raise_years: e.target.value as any })} placeholder="Mặc định 3 năm" />
          </div>
          <div>
            <Label>Hưởng thâm niên từ ngày</Label>
            <Input type="date" value={form.seniority_effective_date || ''} onChange={(e) => update({ seniority_effective_date: e.target.value })} />
          </div>
          <div>
            <Label>Chu kỳ nâng thâm niên (năm)</Label>
            <Input type="number" min="1" step="1" value={form.seniority_raise_years ?? 1} onChange={(e) => update({ seniority_raise_years: e.target.value as any })} placeholder="Mặc định 1 năm" />
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={!!form.is_active} onCheckedChange={(v) => update({ is_active: v })} />
            <Label>Đang công tác</Label>
          </div>

          <div className="md:col-span-2">
            <Label>Ghi chú</Label>
            <Textarea value={form.notes || ''} onChange={(e) => update({ notes: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Huỷ</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
