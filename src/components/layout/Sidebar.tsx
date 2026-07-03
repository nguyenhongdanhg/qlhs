import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import {
  LayoutDashboard,
  Home,
  UtensilsCrossed,
  BarChart3,
  CalendarDays,
  UserCog,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Building2,
  Trophy,
  HelpCircle,
  Heart,
  DoorOpen,
  ChefHat,
  BookOpen,
  Users,
  GraduationCap,
  ClipboardList,
  Apple,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { memo, useState, useMemo, useCallback } from 'react';
import { preloadRoute } from '@/lib/route-preload';

interface NavSubItem {
  code: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  adminOnly?: boolean;
}

interface NavGroup {
  code: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  children?: NavSubItem[];
}

const navGroups: NavGroup[] = [
  { code: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
  {
    code: 'info_schedule_group', label: 'Thông tin & Lịch trình', icon: ClipboardList,
    children: [
      { code: 'tasks', label: 'Công việc & tiến độ', icon: ClipboardList, path: '/tasks' },
      { code: 'students', label: 'Học sinh', icon: Users, path: '/students' },
      { code: 'teachers', label: 'Giáo viên', icon: GraduationCap, path: '/teachers', adminOnly: true },
    ],
  },
  {
    code: 'boarding_group', label: 'Quản lý nội trú', icon: Home,
    children: [
      { code: 'duty_schedule', label: 'Lịch trực', icon: CalendarDays, path: '/duty-schedule' },
      { code: 'boarding', label: 'Điểm danh', icon: Home, path: '/boarding' },
      
      { code: 'meals', label: 'Báo ăn', icon: UtensilsCrossed, path: '/meals' },
      { code: 'dormitory_exit', label: 'Ra vào KTX', icon: DoorOpen, path: '/dormitory-exit' },
    ],
  },
  {
    code: 'emulation_health_group', label: 'Thi đua - Sức khoẻ', icon: Trophy,
    children: [
      { code: 'emulation', label: 'Thi đua', icon: Trophy, path: '/emulation' },
      { code: 'health', label: 'Sức khoẻ', icon: Heart, path: '/health' },
    ],
  },
  {
    code: 'food_group', label: 'Thực phẩm', icon: Apple,
    children: [
      { code: 'meal_menu', label: 'Thực đơn & Kho bếp', icon: ChefHat, path: '/meal-menu' },
    ],
  },
  { code: 'statistics', label: 'Thống kê & Báo cáo', icon: BarChart3, path: '/statistics' },
  {
    code: 'settings_group', label: 'Cài đặt', icon: Settings,
    children: [
      { code: 'user_management', label: 'Quản lý người dùng', icon: UserCog, path: '/user-management', adminOnly: true },
      { code: 'settings', label: 'Thông tin tài khoản', icon: Settings, path: '/settings' },
      { code: 'guide', label: 'Hướng dẫn sử dụng', icon: HelpCircle, path: '/docs' },
    ],
  },
];

function ExpandableSubmenu({ group, isCollapsed, isChildVisible, locationPath }: {
  group: NavGroup;
  isCollapsed: boolean;
  isChildVisible: (child: NavSubItem) => boolean;
  locationPath: string;
}) {
  const Icon = group.icon;
  const visibleChildren = group.children!.filter(isChildVisible);
  const active = visibleChildren.some(c => locationPath === c.path);
  const [open, setOpen] = useState(active);

  if (visibleChildren.length === 0) return null;

  return (
    <li>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'nav-item w-full',
          active ? 'nav-item-active' : 'nav-item-inactive',
          isCollapsed && 'justify-center px-2'
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">{group.label}</span>
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )} />
          </>
        )}
      </button>

      {/* Inline expanded children - pushes items down */}
      {open && !isCollapsed && (
        <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l-2 border-border pl-2">
          {visibleChildren.map((child) => {
            const ChildIcon = child.icon;
            const childActive = locationPath === child.path;
            return (
              <Link
                key={child.code}
                to={child.path}
                onMouseEnter={() => preloadRoute(child.path)}
                onFocus={() => preloadRoute(child.path)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150',
                  childActive
                    ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary -ml-[2px] pl-[12px]'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                )}
              >
                <ChildIcon className="h-4 w-4 flex-shrink-0" />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </li>
  );
}

export const Sidebar = memo(function Sidebar() {
  const location = useLocation();
  const { profile, currentSchool, signOut, isSuperAdmin, isSchoolAdmin } = useAuth();
  const { isFeatureEnabled } = useSchool();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getInitials = useCallback((name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }, []);

  const roleBadge = useMemo(() => {
    if (isSuperAdmin) return 'Super Admin';
    if (isSchoolAdmin()) return 'Quản trị viên';
    return 'Giáo viên';
  }, [isSuperAdmin, isSchoolAdmin]);

  const isGroupFeatureEnabled = useCallback((group: NavGroup) => {
    if (group.code === 'dashboard' || group.code === 'settings_group' || group.code === 'info_schedule_group') return true;
    if (group.children) {
      return group.children.some(child => {
        if (['settings', 'guide', 'teachers', 'tasks', 'students'].includes(child.code)) return true;
        if (child.adminOnly && !isSchoolAdmin()) return false;
        return isFeatureEnabled(child.code);
      });
    }
    return isFeatureEnabled(group.code);
  }, [isFeatureEnabled, isSchoolAdmin]);

  const isChildVisible = useCallback((child: NavSubItem) => {
    if (['settings', 'guide', 'teachers', 'tasks', 'students'].includes(child.code)) return true;
    if (child.adminOnly && !isSchoolAdmin()) return false;
    return isFeatureEnabled(child.code);
  }, [isFeatureEnabled, isSchoolAdmin]);

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
              <h1 className="font-heading text-base font-bold text-sidebar-foreground truncate">Quản lý Nội trú</h1>
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
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || 'Người dùng'}</p>
              <Badge variant="secondary" className="mt-0.5 bg-primary/10 text-primary text-[10px] px-1.5 py-0 font-medium">{roleBadge}</Badge>
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
          {navGroups.filter(isGroupFeatureEnabled).map((group) => {
            const Icon = group.icon;

            // Simple link (no children)
            if (!group.children) {
              const active = location.pathname === group.path;
              return (
                <li key={group.code}>
                  <Link
                    to={group.path!}
                    className={cn(
                      'nav-item w-full group',
                      active ? 'nav-item-active' : 'nav-item-inactive',
                      isCollapsed && 'justify-center px-2'
                    )}
                    title={isCollapsed ? group.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{group.label}</span>}
                  </Link>
                </li>
              );
            }

            return (
              <ExpandableSubmenu
                key={group.code}
                group={group}
                isCollapsed={isCollapsed}
                isChildVisible={isChildVisible}
                locationPath={location.pathname}
              />
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
          <a href="https://zalo.me/0888770699" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-medium">
            Zalo: 0888 770 699
          </a>
        </div>
      )}
    </aside>
  );
});
