import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Home,
  UtensilsCrossed,
  BarChart3,
  CalendarDays,
  UserCog,
  Settings,
  LogOut,
  ChevronLeft,
  Building2,
  Trophy,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { memo, useState, useMemo, useCallback } from 'react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  BookOpen,
  Home,
  UtensilsCrossed,
  BarChart3,
  CalendarDays,
  UserCog,
  Settings,
  Trophy,
  HelpCircle,
};

interface NavItem {
  code: string;
  label: string;
  icon: string;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { code: 'dashboard', label: 'Bảng tin', icon: 'LayoutDashboard', path: '/dashboard' },
  { code: 'duty_schedule', label: 'Lịch trực', icon: 'CalendarDays', path: '/duty-schedule' },
  { code: 'students', label: 'Thông tin học sinh', icon: 'Users', path: '/students' },
  { code: 'boarding', label: 'Điểm danh nội trú', icon: 'Home', path: '/boarding' },
  { code: 'evening_study', label: 'Điểm danh giờ học', icon: 'BookOpen', path: '/evening-study' },
  { code: 'meals', label: 'Báo cáo bữa ăn', icon: 'UtensilsCrossed', path: '/meals' },
  { code: 'emulation', label: 'Thi đua', icon: 'Trophy', path: '/emulation' },
  { code: 'statistics', label: 'Thống kê', icon: 'BarChart3', path: '/statistics' },
  { code: 'user_management', label: 'Quản lý tài khoản', icon: 'UserCog', path: '/user-management', adminOnly: true },
  { code: 'settings', label: 'Cài đặt', icon: 'Settings', path: '/settings' },
  { code: 'guide', label: 'Hướng dẫn sử dụng', icon: 'HelpCircle', path: '/guide' },
];

export const Sidebar = memo(function Sidebar() {
  const location = useLocation();
  const { profile, currentSchool, signOut, isSuperAdmin, isSchoolAdmin } = useAuth();
  const { isFeatureEnabled } = useSchool();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const roleBadge = useMemo(() => {
    if (isSuperAdmin) return 'Super Admin';
    if (isSchoolAdmin()) return 'Quản trị viên';
    return 'Giáo viên';
  }, [isSuperAdmin, isSchoolAdmin]);

  const filteredNavItems = useMemo(() => navItems.filter((item) => {
    if (!isFeatureEnabled(item.code)) return false;
    if (item.adminOnly && !isSchoolAdmin()) return false;
    return true;
  }), [isFeatureEnabled, isSchoolAdmin]);


  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col bg-sidebar transition-all duration-300 lg:flex',
        isCollapsed ? 'w-[72px]' : 'w-[280px]'
      )}
    >
      {/* Logo & Toggle */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-base font-bold text-sidebar-foreground truncate">
                Quản lý Nội trú
              </h1>
              {currentSchool && (
                <p className="text-xs text-muted-foreground truncate">{currentSchool.code || currentSchool.name}</p>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'h-7 w-7 text-muted-foreground hover:bg-sidebar-accent hover:text-primary transition-all duration-300',
            isCollapsed && 'absolute -right-3 top-6 rounded-full bg-white border border-border shadow-md'
          )}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform duration-300', isCollapsed && 'rotate-180')} />
        </Button>
      </div>

      {/* User Info */}
      <div className={cn('border-b border-sidebar-border px-4 py-3', isCollapsed && 'px-2')}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-medium">
                {profile?.full_name ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || 'Người dùng'}
              </p>
              <Badge variant="secondary" className="mt-0.5 bg-primary/10 text-primary text-[10px] px-1.5 py-0 font-medium">
                {roleBadge}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-medium">
                {profile?.full_name ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      {/* Super Admin Link */}
      {isSuperAdmin && (
        <div className={cn('px-3 py-2', isCollapsed && 'px-2')}>
          <Link
            to="/superadmin"
            className={cn(
              'nav-item w-full',
              location.pathname === '/superadmin' ? 'nav-item-active' : 'nav-item-inactive',
              isCollapsed && 'justify-center px-2'
            )}
            title={isCollapsed ? 'Quản trị hệ thống' : undefined}
          >
            <Building2 className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Quản trị hệ thống</span>}
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.code}>
                  <Link
                    to={item.path}
                    className={cn(
                      'nav-item w-full group',
                      isActive ? 'nav-item-active' : 'nav-item-inactive',
                      isCollapsed && 'justify-center px-2'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className={cn('border-t border-sidebar-border px-3 py-3', isCollapsed && 'px-2')}>
        <button
          onClick={signOut}
          className={cn(
            'nav-item nav-item-inactive w-full hover:text-destructive',
            isCollapsed && 'justify-center px-2'
          )}
          title={isCollapsed ? 'Đăng xuất' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>Đăng xuất</span>}
        </button>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t border-sidebar-border px-4 py-3 bg-gradient-to-r from-primary/5 to-accent/5">
          <p className="text-[11px] text-muted-foreground">Thiết kế bởi</p>
          <p className="text-xs font-medium text-sidebar-foreground">Thầy Nguyễn Hồng Dân</p>
          <a 
            href="https://zalo.me/0888770699" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline font-medium"
          >
            Zalo: 0888 770 699
          </a>
        </div>
      )}
    </aside>
  );
});
