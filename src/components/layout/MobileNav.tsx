import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import {
  LayoutDashboard,
  Home,
  UtensilsCrossed,
  Trophy,
  Settings,
  CalendarDays,
  BookOpen,
  DoorOpen,
  ChefHat,
  UserCog,
  HelpCircle,
  Heart,
  BarChart3,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubItem {
  code: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  adminOnly?: boolean;
}

interface NavItem {
  code: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  children?: SubItem[];
}

const navItems: NavItem[] = [
  { code: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
  {
    code: 'boarding_group', label: 'Nội trú', icon: Home,
    children: [
      { code: 'duty_schedule', label: 'Lịch trực', icon: CalendarDays, path: '/duty-schedule' },
      { code: 'boarding', label: 'Điểm danh nội trú', icon: Home, path: '/boarding' },
      { code: 'evening_study', label: 'Điểm danh tự học', icon: BookOpen, path: '/evening-study' },
      { code: 'dormitory_exit', label: 'Ra vào KTX', icon: DoorOpen, path: '/dormitory-exit' },
    ],
  },
  {
    code: 'meal_group', label: 'Bữa ăn', icon: UtensilsCrossed,
    children: [
      { code: 'meals', label: 'Báo ăn', icon: UtensilsCrossed, path: '/meals' },
      { code: 'meal_menu', label: 'Thực đơn & Kho', icon: ChefHat, path: '/meal-menu' },
    ],
  },
  { code: 'emulation', label: 'Thi đua', icon: Trophy, path: '/emulation' },
  { code: 'menu', label: 'Thêm', icon: Menu, path: '/menu' },
];

// Feature codes that map to groups for bottom nav visibility
const groupFeatureCodes: Record<string, string[]> = {
  boarding_group: ['boarding', 'evening_study', 'duty_schedule', 'dormitory_exit'],
  meal_group: ['meals', 'meal_menu'],
};

export const bottomNavCodes = ['dashboard', 'emulation', 'boarding', 'meals'];

export const MobileNav = memo(function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSchoolAdmin } = useAuth();
  const { isFeatureEnabled } = useSchool();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup on route change or outside click
  useEffect(() => {
    setOpenGroup(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!openGroup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler as any);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler as any);
    };
  }, [openGroup]);

  const filteredNavItems = useMemo(() => navItems.filter((item) => {
    if (item.code === 'dashboard' || item.code === 'menu') return true;
    const featureCodes = groupFeatureCodes[item.code];
    if (featureCodes) {
      return featureCodes.some(code => isFeatureEnabled(code));
    }
    return isFeatureEnabled(item.code);
  }), [isFeatureEnabled]);

  const isActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some(c => location.pathname === c.path);
    }
    return location.pathname === item.path;
  };

  const isChildVisible = (child: SubItem) => {
    if (child.adminOnly && !isSchoolAdmin()) return false;
    return isFeatureEnabled(child.code);
  };

  const handleItemClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.children) {
      e.preventDefault();
      setOpenGroup(prev => prev === item.code ? null : item.code);
    } else {
      setOpenGroup(null);
    }
  };

  return (
    <nav className="mobile-nav lg:hidden">
      {/* Popup for group sub-items */}
      {openGroup && (() => {
        const group = navItems.find(n => n.code === openGroup);
        if (!group?.children) return null;
        const visible = group.children.filter(isChildVisible);
        if (visible.length === 0) return null;

        return (
          <div
            ref={popupRef}
            className="absolute bottom-full left-0 right-0 mb-1 mx-3 rounded-xl border border-border bg-popover p-2 shadow-xl animate-in slide-in-from-bottom-2 duration-200 z-50"
          >
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</p>
            <div className="grid grid-cols-2 gap-1">
              {visible.map((child) => {
                const ChildIcon = child.icon;
                const childActive = location.pathname === child.path;
                return (
                  <Link
                    key={child.code}
                    to={child.path}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      childActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-popover-foreground hover:bg-muted'
                    )}
                  >
                    <ChildIcon className="h-4 w-4 flex-shrink-0" />
                    <span>{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}

      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        const isOpen = openGroup === item.code;

        return item.children ? (
          <button
            key={item.code}
            onClick={(e) => handleItemClick(item, e)}
            className={cn(
              'mobile-nav-item tap-target',
              active || isOpen
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className={cn(
              'rounded-xl p-1.5 transition-all duration-200',
              active || isOpen ? 'bg-primary/10' : 'bg-transparent'
            )}>
              <Icon className={cn('h-5 w-5', (active || isOpen) && 'scale-110')} />
            </div>
            <span className="font-medium">{item.label}</span>
          </button>
        ) : (
          <Link
            key={item.code}
            to={item.path!}
            onClick={() => setOpenGroup(null)}
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
