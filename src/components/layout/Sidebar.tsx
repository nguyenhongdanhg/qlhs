import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import {
  LayoutDashboard,
  Users,
  Moon,
  Home,
  UtensilsCrossed,
  BarChart3,
  CalendarDays,
  UserCog,
  Settings,
  LogOut,
  ChevronDown,
  GraduationCap,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Moon,
  Home,
  UtensilsCrossed,
  BarChart3,
  CalendarDays,
  UserCog,
  Settings,
};

interface NavItem {
  code: string;
  label: string;
  icon: string;
  path: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { code: 'dashboard', label: 'Tổng quan', icon: 'LayoutDashboard', path: '/dashboard' },
  { code: 'students', label: 'Học sinh', icon: 'Users', path: '/students' },
  { code: 'evening_study', label: 'Tự học tối', icon: 'Moon', path: '/evening-study' },
  { code: 'boarding', label: 'Nội trú', icon: 'Home', path: '/boarding' },
  { code: 'meals', label: 'Bữa ăn', icon: 'UtensilsCrossed', path: '/meals' },
  { code: 'statistics', label: 'Thống kê', icon: 'BarChart3', path: '/statistics' },
  { code: 'duty_schedule', label: 'Lịch trực', icon: 'CalendarDays', path: '/duty-schedule' },
  { code: 'user_management', label: 'Người dùng', icon: 'UserCog', path: '/user-management', adminOnly: true },
  { code: 'settings', label: 'Cài đặt', icon: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, currentSchool, memberships, signOut, isSuperAdmin, isSchoolAdmin, selectSchool } = useAuth();
  const { isFeatureEnabled } = useSchool();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredNavItems = navItems.filter((item) => {
    // Check if feature is enabled for the school
    if (!isFeatureEnabled(item.code)) return false;
    // Check admin-only items
    if (item.adminOnly && !isSchoolAdmin()) return false;
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[280px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Logo & School Selector */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary">
          <GraduationCap className="h-6 w-6 text-sidebar-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-lg font-bold text-sidebar-foreground truncate">
            EduBoard
          </h1>
          {currentSchool && (
            <p className="text-xs text-sidebar-muted truncate">{currentSchool.name}</p>
          )}
        </div>
      </div>

      {/* School Switcher (if multiple schools) */}
      {memberships.length > 1 && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <span className="flex items-center gap-2 truncate">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{currentSchool?.name || 'Chọn trường'}</span>
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[248px]">
              {memberships.map((membership) => (
                <DropdownMenuItem
                  key={membership.id}
                  onClick={() => membership.school && selectSchool(membership.school)}
                  className={cn(
                    membership.school_id === currentSchool?.id && 'bg-accent'
                  )}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {membership.school?.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Super Admin Link */}
      {isSuperAdmin && (
        <div className="px-4 py-2">
          <Link
            to="/superadmin"
            className={cn(
              'nav-item w-full',
              location.pathname === '/superadmin'
                ? 'nav-item-active'
                : 'nav-item-inactive'
            )}
          >
            <Building2 className="h-5 w-5" />
            <span>Quản trị hệ thống</span>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.code}>
                <Link
                  to={item.path}
                  className={cn(
                    'nav-item w-full',
                    isActive ? 'nav-item-active' : 'nav-item-inactive'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Menu */}
      <div className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.full_name || 'Người dùng'}
                </p>
                <p className="text-xs text-sidebar-muted truncate">
                  {isSuperAdmin ? 'Super Admin' : currentSchool?.name}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-sidebar-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Cài đặt tài khoản
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
