import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, MessageCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleClose = () => {
    setPhone('');
    setSubmitted(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quên mật khẩu</DialogTitle>
          <DialogDescription>
            Liên hệ quản trị viên để được cấp lại mật khẩu
          </DialogDescription>
        </DialogHeader>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="Nhập số điện thoại của bạn"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Do hệ thống đăng nhập bằng số điện thoại, bạn cần liên hệ quản trị viên trường học để được cấp lại mật khẩu.
              </AlertDescription>
            </Alert>

            <Button type="submit" className="w-full">
              Tiếp tục
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert className="border-primary/20 bg-primary/5">
              <MessageCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                <p className="font-medium mb-2">Hướng dẫn lấy lại mật khẩu:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Liên hệ quản trị viên trường học của bạn</li>
                  <li>Cung cấp số điện thoại: <strong>{phone}</strong></li>
                  <li>Yêu cầu cấp lại mật khẩu mới</li>
                  <li>Đăng nhập với mật khẩu mới và đổi mật khẩu trong Cài đặt</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              <a
                href="https://zalo.me/0888770699"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button variant="outline" className="w-full gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Liên hệ hỗ trợ qua Zalo
                </Button>
              </a>
              <Button variant="ghost" onClick={handleClose} className="w-full">
                Đóng
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
