import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SchoolFeature, AppFeature } from '@/types';

interface SchoolContextType {
  features: SchoolFeature[];
  appFeatures: AppFeature[];
  isFeatureEnabled: (featureCode: string) => boolean;
  isLoading: boolean;
  refetchFeatures: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const { currentSchool } = useAuth();
  const [features, setFeatures] = useState<SchoolFeature[]>([]);
  const [appFeatures, setAppFeatures] = useState<AppFeature[]>([]);
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

  useEffect(() => {
    fetchFeatures();
  }, [currentSchool]);

  const isFeatureEnabled = (featureCode: string): boolean => {
    // Check if feature is globally active
    const appFeature = appFeatures.find(f => f.code === featureCode);
    if (!appFeature || !appFeature.is_active) return false;

    // Check if feature is enabled for current school
    const schoolFeature = features.find(f => f.feature_code === featureCode);
    // If no school-specific setting, default to enabled
    if (!schoolFeature) return true;
    
    return schoolFeature.is_enabled;
  };

  return (
    <SchoolContext.Provider
      value={{
        features,
        appFeatures,
        isFeatureEnabled,
        isLoading,
        refetchFeatures: fetchFeatures,
      }}
    >
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
