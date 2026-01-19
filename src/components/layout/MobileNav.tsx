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
  { code: 'evening_study', label: 'Tự học', icon: 'Moon', path: '/evening-study' },
  { code: 'boarding', label: 'Nội trú', icon: 'Home', path: '/boarding' },
  { code: 'menu', label: 'Thêm', icon: 'Menu', path: '/menu' },
];

export function MobileNav() {
  const location = useLocation();
  const { isSchoolAdmin } = useAuth();
  const { isFeatureEnabled } = useSchool();

  const filteredNavItems = navItems.filter((item) => {
    if (item.code === 'menu') return true;
    if (!isFeatureEnabled(item.code)) return false;
    if (item.adminOnly && !isSchoolAdmin()) return false;
    return true;
  }).slice(0, 5); // Max 5 items

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
              'mobile-nav-item',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
