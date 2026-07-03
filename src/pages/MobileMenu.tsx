import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
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
  Trophy,
  HelpCircle,
  Heart,
  DoorOpen,
  ChefHat,
  Home,
  BookOpen,
  UtensilsCrossed,
  GraduationCap,
  ClipboardList,
  Users,
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

// 1. Thông tin & Lịch trình
const tasksItems: MenuItem[] = [
  { code: 'tasks', label: 'Công việc & tiến độ', description: 'Giao việc, hạn hoàn thành, tài liệu', icon: ClipboardList, path: '/tasks' },
  { code: 'students', label: 'Học sinh', description: 'Danh sách học sinh', icon: Users, path: '/students' },
  { code: 'teachers', label: 'Giáo viên', description: 'Hồ sơ, chấm công, thành tích GV', icon: GraduationCap, path: '/teachers', adminOnly: true },
];

// 2. Quản lý nội trú
const boardingItems: MenuItem[] = [
  { code: 'duty_schedule', label: 'Lịch trực', description: 'Quản lý lịch trực', icon: CalendarDays, path: '/duty-schedule' },
  { code: 'boarding', label: 'Điểm danh', description: 'Điểm danh nội trú', icon: Home, path: '/boarding' },
  
  { code: 'meals', label: 'Báo ăn', description: 'Báo cáo bữa ăn', icon: UtensilsCrossed, path: '/meals' },
  { code: 'dormitory_exit', label: 'Ra vào KTX', description: 'Đăng ký & duyệt ra ngoài', icon: DoorOpen, path: '/dormitory-exit' },
];

// 3. Thi đua - Sức khoẻ
const emulationHealthItems: MenuItem[] = [
  { code: 'emulation', label: 'Thi đua', description: 'Quản lý thi đua các lớp', icon: Trophy, path: '/emulation' },
  { code: 'health', label: 'Sức khoẻ', description: 'Quản lý sức khỏe học sinh', icon: Heart, path: '/health' },
];

// 4. Thực phẩm
const foodItems: MenuItem[] = [
  { code: 'meal_menu', label: 'Thực đơn & Kho bếp', description: 'Quản lý thực đơn và kho', icon: ChefHat, path: '/meal-menu' },
];

// 5. Thống kê & Báo cáo
const statisticsItems: MenuItem[] = [
  { code: 'statistics', label: 'Thống kê & Báo cáo', description: 'Báo cáo & xuất Excel', icon: BarChart3, path: '/statistics' },
];

// 6. Cài đặt
const settingsItems: MenuItem[] = [
  { code: 'students', label: 'Học sinh', description: 'Danh sách học sinh', icon: Users, path: '/students' },
  { code: 'teachers', label: 'Giáo viên', description: 'Hồ sơ, chấm công, thành tích GV', icon: GraduationCap, path: '/teachers', adminOnly: true },
  { code: 'user_management', label: 'Quản lý người dùng', description: 'Thêm, sửa, xóa người dùng', icon: UserCog, path: '/user-management', adminOnly: true },
  { code: 'settings', label: 'Thông tin tài khoản', description: 'Tài khoản & thiết lập', icon: Settings, path: '/settings' },
  { code: 'guide', label: 'Hướng dẫn sử dụng', description: 'Tài liệu hướng dẫn', icon: HelpCircle, path: '/docs' },
];

function MenuSection({ title, items, isFeatureEnabled, isAdmin }: {
  title: string;
  items: MenuItem[];
  isFeatureEnabled: (code: string) => boolean;
  isAdmin: boolean;
}) {
  const filtered = items.filter((item) => {
    if (item.code === 'settings' || item.code === 'guide' || item.code === 'teachers' || item.code === 'tasks') return true;
    if (item.adminOnly && !isAdmin) return false;
    return isFeatureEnabled(item.code);
  });

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">{title}</h3>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {filtered.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.code}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted active:bg-muted/80"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
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
      {/* User Profile */}
      <div className="flex items-center gap-3 mb-5 px-1">
        <Avatar className="h-11 w-11 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {profile ? getInitials(profile.full_name) : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{profile?.full_name || 'Người dùng'}</h2>
          {roleBadge && (
            <Badge variant={roleBadge.variant} className="text-[10px] px-1.5 py-0">
              {roleBadge.label}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isSuperAdmin && (
          <Link
            to="/superadmin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-primary/20 bg-primary/5 transition-colors hover:bg-primary/10"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm font-medium">Quản trị hệ thống</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        )}

        <MenuSection title="Công việc & tiến độ" items={tasksItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />
        <MenuSection title="Quản lý nội trú" items={boardingItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />
        <MenuSection title="Thi đua - Sức khoẻ" items={emulationHealthItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />
        <MenuSection title="Thực phẩm" items={foodItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />
        <MenuSection title="Thống kê & Báo cáo" items={statisticsItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />
        <MenuSection title="Cài đặt" items={settingsItems} isFeatureEnabled={isFeatureEnabled} isAdmin={isAdmin} />


        {/* Logout */}
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl border border-border transition-colors hover:bg-destructive/5 hover:border-destructive/30"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <LogOut className="h-4 w-4" />
          </div>
          <span className="flex-1 text-sm font-medium text-destructive text-left">Đăng xuất</span>
        </button>
      </div>

      <div className="mt-6 text-center">
        <a
          href="https://zalo.me/0888770699"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          Thiết kế bởi <span className="font-semibold text-primary">Thầy Nguyễn Hồng Dân</span>
        </a>
      </div>
    </div>
  );
}
