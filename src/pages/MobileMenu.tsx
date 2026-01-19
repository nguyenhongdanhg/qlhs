import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  UtensilsCrossed,
  BarChart3,
  CalendarDays,
  UserCog,
  Settings,
  Building2,
  Download,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  code: string;
  label: string;
  description: string;
  icon: typeof UtensilsCrossed;
  path: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  {
    code: 'meals',
    label: 'Bữa ăn',
    description: 'Điểm danh bữa ăn',
    icon: UtensilsCrossed,
    path: '/meals',
  },
  {
    code: 'statistics',
    label: 'Thống kê',
    description: 'Xem báo cáo thống kê',
    icon: BarChart3,
    path: '/statistics',
  },
  {
    code: 'duty_schedule',
    label: 'Lịch trực',
    description: 'Quản lý lịch trực',
    icon: CalendarDays,
    path: '/duty-schedule',
  },
  {
    code: 'user_management',
    label: 'Người dùng',
    description: 'Quản lý người dùng',
    icon: UserCog,
    path: '/user-management',
    adminOnly: true,
  },
  {
    code: 'settings',
    label: 'Cài đặt',
    description: 'Tài khoản & thiết lập',
    icon: Settings,
    path: '/settings',
  },
  {
    code: 'install',
    label: 'Cài đặt ứng dụng',
    description: 'Hướng dẫn cài PWA',
    icon: Download,
    path: '/install',
  },
];

export default function MobileMenu() {
  const { isSuperAdmin, isSchoolAdmin } = useAuth();
  const { isFeatureEnabled } = useSchool();

  const filteredItems = menuItems.filter((item) => {
    if (item.code === 'settings' || item.code === 'install') return true;
    if (!isFeatureEnabled(item.code)) return false;
    if (item.adminOnly && !isSchoolAdmin()) return false;
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

  return (
    <div className="content-wrapper animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Menu</h1>
        <p className="page-description">Tất cả tính năng</p>
      </div>

      <div className="space-y-3">
        {isSuperAdmin && (
          <Link to="/superadmin">
            <Card className="group transition-all hover:border-primary hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Quản trị hệ thống</h3>
                  <p className="text-sm text-muted-foreground">Super Admin</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        )}

        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.code} to={item.path}>
              <Card className="group transition-all hover:border-primary hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
