import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import {
  LayoutDashboard,
  Home,
  UtensilsCrossed,
  Menu,
  CalendarDays,
  BookOpen,
  DoorOpen,
  ClipboardList,
  BarChart3,
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
  { code: 'tasks', label: 'Thông tin', icon: ClipboardList, path: '/tasks' },
  {
    code: 'boarding_group', label: 'Nội trú', icon: Home,
    children: [
      { code: 'duty_schedule', label: 'Lịch trực', icon: CalendarDays, path: '/duty-schedule' },
      { code: 'boarding', label: 'Điểm danh', icon: Home, path: '/boarding' },
      
      { code: 'meals', label: 'Báo ăn', icon: UtensilsCrossed, path: '/meals' },
      { code: 'dormitory_exit', label: 'Ra vào KTX', icon: DoorOpen, path: '/dormitory-exit' },
    ],
  },
  { code: 'statistics', label: 'Thống kê', icon: BarChart3, path: '/statistics' },
  { code: 'menu', label: 'Thêm', icon: Menu, path: '/menu' },
];

// Derived from `children[].code` of each group in navItems — keep in sync so the
// group button only appears when at least one child is actually available.
const groupFeatureCodes: Record<string, string[]> = {
  boarding_group: ['duty_schedule', 'boarding', 'meals', 'dormitory_exit'],
};

export const bottomNavCodes = ['dashboard', 'tasks', 'boarding', 'statistics'];

export const MobileNav = memo(function MobileNav() {
  const location = useLocation();
  const { isSchoolAdmin } = useAuth();
  const { isFeatureEnabled } = useSchool();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close popup on route change
  useEffect(() => {
    setOpenGroup(null);
  }, [location.pathname]);

  // Close popup on outside click
  useEffect(() => {
    if (!openGroup) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler as EventListener);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler as EventListener);
    };
  }, [openGroup]);

  const filteredNavItems = useMemo(() => navItems.filter((item) => {
    if (item.code === 'dashboard' || item.code === 'menu' || item.code === 'tasks' || item.code === 'statistics') return true;
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
    if (item.code === 'menu') {
      return location.pathname === '/menu';
    }
    return location.pathname === item.path;
  };

  const isChildVisible = (child: SubItem) => {
    if (child.adminOnly && !isSchoolAdmin()) return false;
    return isFeatureEnabled(child.code);
  };

  return (
    <nav ref={navRef} className="mobile-nav lg:hidden">
      {/* Popup for group sub-items */}
      {openGroup && (() => {
        const group = navItems.find(n => n.code === openGroup);
        if (!group?.children) return null;
        const visible = group.children.filter(isChildVisible);
        if (visible.length === 0) return null;

        return (
          <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 rounded-xl border-2 border-border bg-background p-2 shadow-2xl animate-in slide-in-from-bottom-2 duration-200 z-50">
            <div className="flex items-center gap-2 mb-1.5 px-2 py-1">
              {(() => { const GIcon = group.icon; return <GIcon className="h-4 w-4 text-primary" />; })()}
              <p className="text-xs font-bold text-primary uppercase tracking-wider">{group.label}</p>
            </div>
            <div className="space-y-1">
              {visible.map((child) => {
                const ChildIcon = child.icon;
                const childActive = location.pathname === child.path;
                return (
                  <Link
                    key={child.code}
                    to={child.path}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 border',
                      childActive
                        ? 'bg-primary/10 text-primary font-semibold border-primary/30 shadow-sm'
                        : 'bg-card text-foreground border-border hover:bg-muted active:scale-[0.98]'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                      childActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      <ChildIcon className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{child.label}</span>
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

        if (item.children) {
          return (
            <button
              key={item.code}
              onClick={() => {
                setOpenGroup(prev => prev === item.code ? null : item.code);
              }}
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
          );
        }

        return (
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
