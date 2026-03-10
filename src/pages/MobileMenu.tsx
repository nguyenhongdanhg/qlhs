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
  ChevronRight,
  LogOut,
  Menu,
  Trophy,
  HelpCircle,
  Heart,
  DoorOpen,
  ChefHat,
  Home,
  BookOpen,
  UtensilsCrossed,
} from 'lucide-react';

interface MenuItem {
  code: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

// Group: Quản lý nội trú
const boardingItems: MenuItem[] = [
  { code: 'duty_schedule', label: 'Lịch trực', description: 'Quản lý lịch trực', icon: CalendarDays, path: '/duty-schedule' },
  { code: 'boarding', label: 'Điểm danh nội trú', description: 'Điểm danh nội trú', icon: Home, path: '/boarding' },
  { code: 'evening_study', label: 'Điểm danh tự học', description: 'Điểm danh giờ tự học', icon: BookOpen, path: '/evening-study' },
  { code: 'dormitory_exit', label: 'Ra vào KTX', description: 'Đăng ký & duyệt ra ngoài', icon: DoorOpen, path: '/dormitory-exit' },
];

// Group: Bữa ăn
const mealItems: MenuItem[] = [
  { code: 'meals', label: 'Báo ăn', description: 'Báo cáo bữa ăn', icon: UtensilsCrossed, path: '/meals' },
  { code: 'meal_menu', label: 'Thực đơn & Kho bếp', description: 'Quản lý thực đơn và kho', icon: ChefHat, path: '/meal-menu' },
];

// Standalone items
const standaloneItems: MenuItem[] = [
  { code: 'emulation', label: 'Thi đua', description: 'Quản lý thi đua các lớp', icon: Trophy, path: '/emulation' },
  { code: 'health', label: 'Sức khỏe', description: 'Quản lý sức khỏe học sinh', icon: Heart, path: '/health' },
  { code: 'statistics', label: 'Thống kê', description: 'Xem báo cáo thống kê', icon: BarChart3, path: '/statistics' },
];

// Group: Cài đặt
const settingsItems: MenuItem[] = [
  { code: 'user_management', label: 'Quản lý người dùng', description: 'Thêm, sửa, xóa người dùng', icon: UserCog, path: '/user-management', adminOnly: true },
  { code: 'settings', label: 'Thiết lập', description: 'Tài khoản & thiết lập', icon: Settings, path: '/settings' },
  { code: 'guide', label: 'Hướng dẫn sử dụng', description: 'Tài liệu hướng dẫn', icon: HelpCircle, path: '/guide' },
];

function MenuSection({ title, items, isFeatureEnabled, isAdmin }: {
  title: string;
  items: MenuItem[];
  isFeatureEnabled: (code: string) => boolean;
  isAdmin: boolean;
}) {
  const filtered = items.filter((item) => {
    if (item.code === 'settings' || item.code === 'guide') return true;
    if (item.adminOnly && !isAdmin) return false;
    return isFeatureEnabled(item.code);
  });

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{title}</h3>
      {filtered.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.code} to={item.path}>
            <Card className="group transition-all hover:border-primary hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{item.label}</h3>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default function MobileMenu() {
  const { profile, currentMembership, isSuperAdmin, isSchoolAdmin, signOut } = useAuth();
  const { isFeatureEnabled } = useSchool();
  const isAdmin = isSchoolAdmin();

  const getInitials = (name: string) => {
    return name.split(' ').slice(-2).map((n) => n[0]).join('').toUpperCase();
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
            <Avatar className="h-14 w-14 border-2 border-primary-foreground/20">
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
      </div>

      <div className="space-y-5">
        {isSuperAdmin && (
          <Link to="/superadmin">
            <Card className="group transition-all hover:border-primary hover:shadow-md border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Quản trị hệ thống</h3>
                  <p className="text-xs text-muted-foreground">Super Admin</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        )}

        <MenuSection title="Quản lý nội trú" items={boardingItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />
        <MenuSection title="Bữa ăn" items={mealItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />
        <MenuSection title="Khác" items={standaloneItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />
        <MenuSection title="Cài đặt" items={settingsItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />

        {/* Logout */}
        <Card
          className="group cursor-pointer transition-all hover:border-destructive hover:shadow-md"
          onClick={() => signOut()}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-colors group-hover:bg-destructive group-hover:text-destructive-foreground">
              <LogOut className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-destructive">Đăng xuất</h3>
              <p className="text-xs text-muted-foreground">Thoát khỏi tài khoản</p>
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
