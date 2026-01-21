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
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  Menu,
};

interface NavItem {
  code: string;
  label: string;
  icon: string;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { code: 'dashboard', label: 'Tổng quan', icon: 'LayoutDashboard', path: '/dashboard' },
  { code: 'students', label: 'Học sinh', icon: 'Users', path: '/students' },
  { code: 'meals', label: 'Bữa ăn', icon: 'UtensilsCrossed', path: '/meals' },
  { code: 'boarding', label: 'Nội trú', icon: 'Home', path: '/boarding' },
  { code: 'evening_study', label: 'Tự học', icon: 'Moon', path: '/evening-study' },
  { code: 'menu', label: 'Thêm', icon: 'Menu', path: '/menu' },
];

// Items already in bottom nav - to exclude from menu page
export const bottomNavCodes = ['dashboard', 'students', 'meals', 'boarding', 'evening_study'];

export function MobileNav() {
  const location = useLocation();
  const { isSchoolAdmin } = useAuth();
  const { isFeatureEnabled } = useSchool();

  const filteredNavItems = navItems.filter((item) => {
    if (item.code === 'menu') return true;
    if (!isFeatureEnabled(item.code)) return false;
    if (item.adminOnly && !isSchoolAdmin()) return false;
    return true;
  }).slice(0, 6); // Max 6 items

  return (
    <nav className="mobile-nav lg:hidden">
      {filteredNavItems.map((item) => {
        const Icon = iconMap[item.icon] || LayoutDashboard;
        const isActive = location.pathname === item.path;

        return (
          <Link
            key={item.code}
            to={item.path}
            className={cn(
              'mobile-nav-item tap-target',
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className={cn(
              'rounded-xl p-1.5 transition-all duration-200',
              isActive ? 'bg-primary/10' : 'bg-transparent'
            )}>
              <Icon className={cn('h-5 w-5', isActive && 'scale-110')} />
            </div>
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
