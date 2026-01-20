import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserIds: string[];
  onResetComplete: () => void;
}

export default function ResetPasswordDialog({
  open,
  onOpenChange,
  selectedUserIds,
  onResetComplete,
}: ResetPasswordDialogProps) {
  const { currentSchool } = useAuth();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!currentSchool) return;

    if (newPassword.length < 6) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu xác nhận không khớp',
        variant: 'destructive',
      });
      return;
    }

    setIsResetting(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          user_ids: selectedUserIds,
          new_password: newPassword,
          school_id: currentSchool.id,
        },
      });

      if (error) throw error;

      if (data.summary) {
        const { success, failed } = data.summary;
        
        if (failed === 0) {
          toast({
            title: 'Thành công',
            description: `Đã reset mật khẩu cho ${success} người dùng`,
          });
        } else if (success > 0) {
          toast({
            title: 'Hoàn thành một phần',
            description: `Reset thành công: ${success}, thất bại: ${failed}`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Lỗi',
            description: 'Không thể reset mật khẩu cho bất kỳ người dùng nào',
            variant: 'destructive',
          });
        }
      }

      setNewPassword('');
      setConfirmPassword('');
      onOpenChange(false);
      onResetComplete();
    } catch (error: any) {
      console.error('Error resetting passwords:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể reset mật khẩu',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset mật khẩu hàng loạt
          </DialogTitle>
          <DialogDescription>
            Đặt mật khẩu mới cho {selectedUserIds.length} người dùng đã chọn
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="border-warning/50 bg-warning/10 text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Tất cả người dùng được chọn sẽ có cùng một mật khẩu mới. Hãy thông báo cho họ sau khi reset.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isResetting}
          >
            Hủy
          </Button>
          <Button
            onClick={handleReset}
            disabled={isResetting || !newPassword || !confirmPassword}
          >
            {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset mật khẩu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
