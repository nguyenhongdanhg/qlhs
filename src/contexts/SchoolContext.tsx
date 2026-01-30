import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SchoolFeature, AppFeature } from '@/types';

type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

interface UserPermission {
  feature_code: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface SchoolContextType {
  features: SchoolFeature[];
  appFeatures: AppFeature[];
  userPermissions: UserPermission[];
  isFeatureEnabled: (featureCode: string) => boolean;
  hasPermission: (featureCode: string, action: PermissionAction) => boolean;
  isLoading: boolean;
  refetchFeatures: () => Promise<void>;
  refetchPermissions: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const { currentSchool, user, isSuperAdmin, isSchoolAdmin } = useAuth();
  const [features, setFeatures] = useState<SchoolFeature[]>([]);
  const [appFeatures, setAppFeatures] = useState<AppFeature[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeatures = async () => {
    try {
      // Fetch app features (global)
      const { data: appFeaturesData } = await supabase
        .from('app_features')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      setAppFeatures((appFeaturesData || []) as AppFeature[]);

      // Fetch school-specific features if school selected
      if (currentSchool) {
        const { data: schoolFeaturesData } = await supabase
          .from('school_features')
          .select('*')
          .eq('school_id', currentSchool.id);

        setFeatures((schoolFeaturesData || []) as SchoolFeature[]);
      }
    } catch (error) {
      console.error('Error fetching features:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPermissions = useCallback(async () => {
    if (!user || !currentSchool) {
      setUserPermissions([]);
      return;
    }

    try {
      // Get user's permission groups for this school
      const { data: userGroups, error: groupsError } = await supabase
        .from('user_permission_groups')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('school_id', currentSchool.id);

      if (groupsError) {
        console.error('Error fetching user permission groups:', groupsError);
        return;
      }

      console.log('User permission groups:', userGroups);

      if (!userGroups || userGroups.length === 0) {
        console.log('No permission groups assigned to user');
        setUserPermissions([]);
        return;
      }

      const groupIds = userGroups.map(g => g.group_id);

      // Get permissions for all user's groups
      const { data: groupPermissions, error: permError } = await supabase
        .from('permission_group_permissions')
        .select('feature_code, can_view, can_create, can_edit, can_delete')
        .in('group_id', groupIds);

      if (permError) {
        console.error('Error fetching group permissions:', permError);
        return;
      }

      console.log('Group permissions:', groupPermissions);

      // Merge permissions from all groups (OR logic - any group grants permission)
      const mergedPermissions: Record<string, UserPermission> = {};

      (groupPermissions || []).forEach(perm => {
        if (!mergedPermissions[perm.feature_code]) {
          mergedPermissions[perm.feature_code] = {
            feature_code: perm.feature_code,
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
          };
        }
        // OR logic: if any group grants the permission, user has it
        mergedPermissions[perm.feature_code].can_view = 
          mergedPermissions[perm.feature_code].can_view || (perm.can_view ?? false);
        mergedPermissions[perm.feature_code].can_create = 
          mergedPermissions[perm.feature_code].can_create || (perm.can_create ?? false);
        mergedPermissions[perm.feature_code].can_edit = 
          mergedPermissions[perm.feature_code].can_edit || (perm.can_edit ?? false);
        mergedPermissions[perm.feature_code].can_delete = 
          mergedPermissions[perm.feature_code].can_delete || (perm.can_delete ?? false);
      });

      console.log('Merged user permissions:', Object.values(mergedPermissions));
      setUserPermissions(Object.values(mergedPermissions));
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  }, [user, currentSchool]);

  useEffect(() => {
    fetchFeatures();
  }, [currentSchool]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const isFeatureEnabled = useCallback((featureCode: string): boolean => {
    // Check if feature is globally active
    const appFeature = appFeatures.find(f => f.code === featureCode);
    if (!appFeature || !appFeature.is_active) return false;

    // Check if feature is enabled for current school
    const schoolFeature = features.find(f => f.feature_code === featureCode);
    // If no school-specific setting, default to enabled
    if (!schoolFeature) return true;
    
    return schoolFeature.is_enabled;
  }, [appFeatures, features]);

  const hasPermission = useCallback((featureCode: string, action: PermissionAction): boolean => {
    // Super admin has all permissions
    if (isSuperAdmin) return true;

    // School admin has all permissions for their school
    if (isSchoolAdmin()) return true;

    // Check feature is enabled first
    if (!isFeatureEnabled(featureCode)) return false;

    // Find user's permission for this feature
    const permission = userPermissions.find(p => p.feature_code === featureCode);
    
    if (!permission) {
      // No specific permission assigned - deny access for non-admins
      return false;
    }

    switch (action) {
      case 'view':
        return permission.can_view;
      case 'create':
        return permission.can_create;
      case 'edit':
        return permission.can_edit;
      case 'delete':
        return permission.can_delete;
      default:
        return false;
    }
  }, [isSuperAdmin, isSchoolAdmin, userPermissions, isFeatureEnabled]);

  // Memoize context value
  const contextValue = useMemo(() => ({
    features,
    appFeatures,
    userPermissions,
    isFeatureEnabled,
    hasPermission,
    isLoading,
    refetchFeatures: fetchFeatures,
    refetchPermissions: fetchUserPermissions,
  }), [features, appFeatures, userPermissions, isFeatureEnabled, hasPermission, isLoading, fetchUserPermissions]);

  return (
    <SchoolContext.Provider value={contextValue}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
}
