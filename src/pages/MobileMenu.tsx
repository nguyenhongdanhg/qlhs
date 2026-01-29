import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  CalendarDays,
  UserCog,
  Settings,
  Building2,
  Download,
  ChevronRight,
  LogOut,
  Menu,
  Trophy,
} from 'lucide-react';
import { bottomNavCodes } from '@/components/layout/MobileNav';

interface MenuItem {
  code: string;
  label: string;
  description: string;
  icon: typeof BarChart3;
  path: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  {
    code: 'emulation',
    label: 'Thi đua',
    description: 'Quản lý điểm thi đua',
    icon: Trophy,
    path: '/emulation',
  },
  {
    code: 'statistics',
    label: 'Thống kê',
    description: 'Xem báo cáo thống kê',
    icon: BarChart3,
    path: '/statistics',
  },
  {
    code: 'duty_schedule',
    label: 'Lịch trực',
    description: 'Quản lý lịch trực',
    icon: CalendarDays,
    path: '/duty-schedule',
  },
  {
    code: 'user_management',
    label: 'Quản lý người dùng',
    description: 'Thêm, sửa, xóa người dùng',
    icon: UserCog,
    path: '/user-management',
    adminOnly: true,
  },
  {
    code: 'settings',
    label: 'Cài đặt',
    description: 'Tài khoản & thiết lập',
    icon: Settings,
    path: '/settings',
  },
  {
    code: 'install',
    label: 'Cài đặt ứng dụng',
    description: 'Hướng dẫn cài PWA',
    icon: Download,
    path: '/install',
  },
];

export default function MobileMenu() {
  const { profile, currentMembership, isSuperAdmin, isSchoolAdmin, signOut } = useAuth();
  const { isFeatureEnabled } = useSchool();

  // Filter out items already in bottom nav and apply permission checks
  const filteredItems = menuItems.filter((item) => {
    // Skip items already in bottom nav
    if (bottomNavCodes.includes(item.code)) return false;
    if (item.code === 'settings' || item.code === 'install') return true;
    if (!isFeatureEnabled(item.code)) return false;
    if (item.adminOnly && !isSchoolAdmin()) return false;
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

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

  return (
    <div className="content-wrapper animate-fade-in">
      {/* User Profile Card */}
      <Card className="mb-6 bg-primary text-primary-foreground">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary-foreground/20">
              <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground text-lg font-semibold">
                {profile ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{profile?.full_name || 'Người dùng'}</h2>
              {roleBadge && (
                <Badge 
                  variant={roleBadge.variant}
                  className="mt-1 bg-primary-foreground/20 text-primary-foreground border-0"
                >
                  {roleBadge.label}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Menu className="h-6 w-6" />
          Menu
        </h1>
        <p className="page-description">Tất cả tính năng</p>
      </div>

      <div className="space-y-2">
        {isSuperAdmin && (
          <Link to="/superadmin">
            <Card className="group transition-all hover:border-primary hover:shadow-md border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Quản trị hệ thống</h3>
                  <p className="text-sm text-muted-foreground">Super Admin</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        )}

        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.code} to={item.path}>
              <Card className="group transition-all hover:border-primary hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {/* Logout */}
        <Card 
          className="group cursor-pointer transition-all hover:border-destructive hover:shadow-md"
          onClick={() => signOut()}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-colors group-hover:bg-destructive group-hover:text-destructive-foreground">
              <LogOut className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-destructive">Đăng xuất</h3>
              <p className="text-sm text-muted-foreground">Thoát khỏi tài khoản</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <a 
          href="https://zalo.me/0888770699" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          Thiết kế bởi <span className="font-semibold text-primary">Thầy giáo Nguyễn Hồng Dân</span> - Zalo: 0888 770 699
        </a>
      </div>
    </div>
  );
}
