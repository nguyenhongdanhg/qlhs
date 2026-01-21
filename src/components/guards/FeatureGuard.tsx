import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

interface FeatureGuardProps {
  children: ReactNode;
  featureCode: string;
  action?: PermissionAction;
  adminOnly?: boolean;
  fallback?: ReactNode;
}

export function FeatureGuard({ 
  children, 
  featureCode, 
  action = 'view',
  adminOnly = false,
  fallback
}: FeatureGuardProps) {
  const { isFeatureEnabled, hasPermission, isLoading } = useSchool();
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
    return fallback ? <>{fallback}</> : <Navigate to="/dashboard" replace />;
  }

  // Check feature enabled
  if (!isFeatureEnabled(featureCode)) {
    return fallback ? <>{fallback}</> : <Navigate to="/dashboard" replace />;
  }

  // Check user permission for this feature and action
  if (!hasPermission(featureCode, action)) {
    return fallback ? <>{fallback}</> : <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Hook to use permissions in components
export function useFeaturePermission(featureCode: string) {
  const { hasPermission, isFeatureEnabled } = useSchool();
  const { isSuperAdmin, isSchoolAdmin } = useAuth();

  // Super admin and school admin have all permissions
  if (isSuperAdmin || isSchoolAdmin()) {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      isEnabled: isFeatureEnabled(featureCode),
    };
  }

  return {
    canView: hasPermission(featureCode, 'view'),
    canCreate: hasPermission(featureCode, 'create'),
    canEdit: hasPermission(featureCode, 'edit'),
    canDelete: hasPermission(featureCode, 'delete'),
    isEnabled: isFeatureEnabled(featureCode),
  };
}
