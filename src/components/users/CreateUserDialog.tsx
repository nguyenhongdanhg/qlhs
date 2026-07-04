import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppRole, Class } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { getDefaultPassword } from '@/lib/default-password';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateComplete: () => void;
}

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'board', label: 'Ban giám hiệu' },
  { value: 'teacher', label: 'Giáo viên' },
  { value: 'class_teacher', label: 'Giáo viên chủ nhiệm' },
  { value: 'accountant', label: 'Kế toán' },
  { value: 'kitchen', label: 'Nhà bếp' },
  { value: 'staff', label: 'Nhân viên' },
];

export default function CreateUserDialog({
  open,
  onOpenChange,
  onCreateComplete,
}: CreateUserDialogProps) {
  const { currentSchool } = useAuth();
  const { toast } = useToast();

  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    password: '',
    role: 'teacher' as AppRole,
    class_id: '',
  });
  const [passwordEdited, setPasswordEdited] = useState(false);

  useEffect(() => {
    if (open && currentSchool) {
      fetchClasses();
    }
  }, [open, currentSchool]);

  const fetchClasses = async () => {
    if (!currentSchool) return;
    
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', currentSchool.id)
        .eq('is_active', true)
        .order('grade', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const handleCreate = async () => {
    if (!currentSchool) return;

    // Validate
    if (!formData.full_name.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập họ và tên',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.phone.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập số điện thoại',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }

    if (formData.role === 'class_teacher' && !formData.class_id) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn lớp chủ nhiệm',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: `${formData.phone.replace(/\D/g, '')}@phone.local`,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone,
          school_id: currentSchool.id,
          role: formData.role,
          class_id: formData.role === 'class_teacher' ? formData.class_id : null,
        },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.code === 'USER_EXISTS') {
          toast({
            title: 'Thông báo',
            description: 'Tài khoản với số điện thoại này đã tồn tại',
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      toast({
        title: 'Thành công',
        description: `Đã tạo tài khoản cho ${formData.full_name}`,
      });

      // Reset form
      setFormData({
        full_name: '',
        phone: '',
        password: '123456',
        role: 'teacher',
        class_id: '',
      });

      onOpenChange(false);
      onCreateComplete();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tạo tài khoản',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Thêm tài khoản mới
          </DialogTitle>
          <DialogDescription>
            Tạo tài khoản người dùng mới trong trường
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Họ và tên <span className="text-destructive">*</span></Label>
            <Input
              id="full_name"
              placeholder="Nguyễn Văn A"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Số điện thoại <span className="text-destructive">*</span></Label>
            <Input
              id="phone"
              placeholder="0901234567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Số điện thoại được dùng để đăng nhập
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Mật khẩu <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="******"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mật khẩu mặc định: 123456
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Chức vụ <span className="text-destructive">*</span></Label>
            <Select
              value={formData.role}
              onValueChange={(v) => setFormData({ ...formData, role: v as AppRole, class_id: '' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'class_teacher' && (
            <div className="grid gap-2">
              <Label htmlFor="class_id">Lớp chủ nhiệm <span className="text-destructive">*</span></Label>
              <Select
                value={formData.class_id}
                onValueChange={(v) => setFormData({ ...formData, class_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn lớp" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo tài khoản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
