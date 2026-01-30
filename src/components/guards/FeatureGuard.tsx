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

// Define role-based feature permissions
// Accountant can view statistics and edit meals
const ROLE_FEATURE_PERMISSIONS: Record<string, Record<string, { view?: boolean; create?: boolean; edit?: boolean; delete?: boolean }>> = {
  accountant: {
    statistics: { view: true },
    meals: { view: true, create: true, edit: true },
  },
};

// Hook to use permissions in components
export function useFeaturePermission(featureCode: string) {
  const { hasPermission, isFeatureEnabled } = useSchool();
  const { isSuperAdmin, isSchoolAdmin, currentMembership } = useAuth();

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

  // Check role-based permissions
  const role = currentMembership?.role;
  const rolePerms = role ? ROLE_FEATURE_PERMISSIONS[role]?.[featureCode] : undefined;

  return {
    canView: rolePerms?.view || hasPermission(featureCode, 'view'),
    canCreate: rolePerms?.create || hasPermission(featureCode, 'create'),
    canEdit: rolePerms?.edit || hasPermission(featureCode, 'edit'),
    canDelete: rolePerms?.delete || hasPermission(featureCode, 'delete'),
    isEnabled: isFeatureEnabled(featureCode),
  };
}
