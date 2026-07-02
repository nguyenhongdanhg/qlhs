import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Loader2,
  Download,
  Phone,
  Mail,
} from 'lucide-react';
import { MealSettingsCard } from '@/components/settings/MealSettingsCard';
import { NotificationSettingsCard } from '@/components/settings/NotificationSettingsCard';
import { GoogleSheetsSettingsCard } from '@/components/settings/GoogleSheetsSettingsCard';
import { ReportSyncSettingsCard } from '@/components/settings/ReportSyncSettingsCard';
import { AcademicYearsCard } from '@/components/settings/AcademicYearsCard';

export default function Settings() {
  const { profile, currentMembership, user, refreshProfile, isSuperAdmin, currentSchool } = useAuth();
  const { toast } = useToast();

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [username, setUsername] = useState(profile?.username || '');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(-2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const getRoleBadge = () => {
    if (isSuperAdmin) return { label: 'Super Admin', variant: 'destructive' as const };
    if (!currentMembership) return null;
    
    const roleMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      admin: { label: 'Quản trị', variant: 'default' },
      teacher: { label: 'Giáo viên', variant: 'secondary' },
      class_teacher: { label: 'GVCN', variant: 'secondary' },
      accountant: { label: 'Kế toán', variant: 'outline' },
      kitchen: { label: 'Nhà bếp', variant: 'outline' },
    };
    
    return roleMap[currentMembership.role] || { label: currentMembership.role, variant: 'outline' as const };
  };

  const roleBadge = getRoleBadge();

  const handleUpdateProfile = async () => {
    if (!profile) return;
    if (!fullName.trim()) {
      toast({
        title: 'Lỗi',
        description: 'Họ tên không được để trống',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          username: username.trim() || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast({ title: 'Thành công', description: 'Đã cập nhật thông tin' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật thông tin',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập mật khẩu mới',
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

    if (newPassword.length < 6) {
      toast({
        title: 'Lỗi',
        description: 'Mật khẩu phải có ít nhất 6 ký tự',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Thành công', description: 'Đã đổi mật khẩu' });
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể đổi mật khẩu',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-primary" />
          Cài đặt
        </h1>
        <p className="page-description">
          Quản lý tài khoản và thiết lập cá nhân
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* User Profile Card */}
        <Card className="bg-primary text-primary-foreground overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-primary-foreground/20">
                <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground text-xl font-semibold">
                  {profile ? getInitials(profile.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{profile?.full_name || 'Người dùng'}</h2>
                <div className="flex items-center gap-2 mt-1 text-primary-foreground/80">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{user?.email}</span>
                </div>
                {roleBadge && (
                  <Badge 
                    variant={roleBadge.variant}
                    className="mt-2 bg-primary-foreground/20 text-primary-foreground border-0"
                  >
                    {roleBadge.label}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Thông tin cá nhân
            </CardTitle>
            <CardDescription>
              Cập nhật thông tin hồ sơ của bạn
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Họ và tên *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nguyenvana"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0901234567"
              />
            </div>

            <Button onClick={handleUpdateProfile} disabled={isUpdatingProfile}>
              {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Đổi mật khẩu
            </CardTitle>
            <CardDescription>
              Đảm bảo tài khoản của bạn được bảo mật
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
              {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đổi mật khẩu
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <NotificationSettingsCard />

        {/* Academic Years - Only for admin/super_admin */}
        {(isSuperAdmin || currentMembership?.role === 'admin') && currentSchool && (
          <AcademicYearsCard />
        )}

        {/* Meal Settings - Only for admin/super_admin */}
        {(isSuperAdmin || currentMembership?.role === 'admin') && currentSchool && (
          <MealSettingsCard />
        )}

        {/* Google Sheets Integration - Only for admin/super_admin */}
        {(isSuperAdmin || currentMembership?.role === 'admin') && currentSchool && (
          <GoogleSheetsSettingsCard />
        )}

        {/* Report Sync to Google Sheets - Only for admin/super_admin */}
        {(isSuperAdmin || currentMembership?.role === 'admin') && currentSchool && (
          <ReportSyncSettingsCard />
        )}

        {/* PWA Install */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Cài đặt ứng dụng
            </CardTitle>
            <CardDescription>
              Cài đặt EduBoard như một ứng dụng trên điện thoại
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Bạn có thể cài đặt ứng dụng này trên điện thoại để truy cập nhanh hơn:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 mb-4">
              <li>• <strong>iPhone:</strong> Nhấn nút Chia sẻ → Thêm vào Màn hình chính</li>
              <li>• <strong>Android:</strong> Nhấn menu (⋮) → Cài đặt ứng dụng</li>
            </ul>
            <Button variant="outline" asChild>
              <a href="/install">Xem hướng dẫn chi tiết</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
