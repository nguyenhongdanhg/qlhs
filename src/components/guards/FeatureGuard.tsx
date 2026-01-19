import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface FeatureGuardProps {
  children: ReactNode;
  featureCode: string;
  adminOnly?: boolean;
}

export function FeatureGuard({ children, featureCode, adminOnly = false }: FeatureGuardProps) {
  const { isFeatureEnabled, isLoading } = useSchool();
  const { isSuperAdmin, isSchoolAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Super admin bypass
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check admin requirement
  if (adminOnly && !isSchoolAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check feature enabled
  if (!isFeatureEnabled(featureCode)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
