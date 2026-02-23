import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
import { Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';

interface CreateSchoolAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  school: { id: string; name: string } | null;
  onComplete: () => void;
}

export default function CreateSchoolAdminDialog({
  open,
  onOpenChange,
  school,
  onComplete,
}: CreateSchoolAdminDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    password: '123456',
  });

  const handleCreate = async () => {
    if (!school) return;

    if (!formData.full_name.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập họ và tên', variant: 'destructive' });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập số điện thoại', variant: 'destructive' });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: 'Lỗi', description: 'Mật khẩu phải có ít nhất 6 ký tự', variant: 'destructive' });
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
          school_id: school.id,
          role: 'admin',
        },
      });

      if (error) throw error;

      if (data?.error) {
        if (data.code === 'USER_EXISTS') {
          toast({ title: 'Thông báo', description: 'Tài khoản với SĐT này đã tồn tại' });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      toast({
        title: 'Thành công',
        description: `Đã tạo tài khoản admin cho ${formData.full_name} tại ${school.name}`,
      });

      setFormData({ full_name: '', phone: '', password: '123456' });
      onOpenChange(false);
      onComplete();
    } catch (error: any) {
      console.error('Error creating admin:', error);
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
            Tạo Admin cho trường
          </DialogTitle>
          <DialogDescription>
            Tạo tài khoản quản trị viên cho <strong>{school?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Họ và tên <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Nguyễn Văn A"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Số điện thoại (đăng nhập) <span className="text-destructive">*</span></Label>
            <Input
              placeholder="0901234567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Mật khẩu <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
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
            <p className="text-xs text-muted-foreground">Mặc định: 123456</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tạo Admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
