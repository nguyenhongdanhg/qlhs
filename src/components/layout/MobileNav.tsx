import { memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import {
  LayoutDashboard,
  Home,
  UtensilsCrossed,
  Trophy,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  code: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const navItems: NavItem[] = [
  { code: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
  { code: 'emulation', label: 'Thi đua', icon: Trophy, path: '/emulation' },
  { code: 'boarding_group', label: 'Nội trú', icon: Home, path: '/boarding' },
  { code: 'meal_group', label: 'Bữa ăn', icon: UtensilsCrossed, path: '/meals' },
  { code: 'menu', label: 'Thêm', icon: Menu, path: '/menu' },
];

// Feature codes that map to groups for bottom nav visibility
const groupFeatureCodes: Record<string, string[]> = {
  boarding_group: ['boarding', 'evening_study', 'duty_schedule', 'dormitory_exit'],
  meal_group: ['meals', 'meal_menu'],
};

// Items shown in bottom nav - used by MobileMenu to exclude
export const bottomNavCodes = ['dashboard', 'emulation', 'boarding', 'meals'];

export const MobileNav = memo(function MobileNav() {
  const location = useLocation();
  const { isSchoolAdmin } = useAuth();
  const { isFeatureEnabled } = useSchool();

  const filteredNavItems = useMemo(() => navItems.filter((item) => {
    if (item.code === 'dashboard' || item.code === 'menu') return true;
    const featureCodes = groupFeatureCodes[item.code];
    if (featureCodes) {
      return featureCodes.some(code => isFeatureEnabled(code));
    }
    return isFeatureEnabled(item.code);
  }), [isFeatureEnabled, isSchoolAdmin]);

  const isActive = (item: NavItem) => {
    if (item.code === 'boarding_group') {
      return ['/boarding', '/evening-study', '/duty-schedule', '/dormitory-exit'].includes(location.pathname);
    }
    if (item.code === 'meal_group') {
      return ['/meals', '/meal-menu'].includes(location.pathname);
    }
    return location.pathname === item.path;
  };

  return (
    <nav className="mobile-nav lg:hidden">
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);

        return (
          <Link
            key={item.code}
            to={item.path}
            className={cn(
              'mobile-nav-item tap-target',
              active
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className={cn(
              'rounded-xl p-1.5 transition-all duration-200',
              active ? 'bg-primary/10' : 'bg-transparent'
            )}>
              <Icon className={cn('h-5 w-5', active && 'scale-110')} />
            </div>
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
});
