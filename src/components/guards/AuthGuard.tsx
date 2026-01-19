import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading, currentSchool, memberships, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Super admin can access everything
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // If user has multiple schools and no school selected, redirect to select
  if (memberships.length > 1 && !currentSchool && location.pathname !== '/select-school') {
    return <Navigate to="/select-school" replace />;
  }

  // If user has no schools, show error
  if (memberships.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Không có quyền truy cập</h1>
          <p className="mt-2 text-muted-foreground">
            Bạn chưa được thêm vào trường nào. Vui lòng liên hệ quản trị viên.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
