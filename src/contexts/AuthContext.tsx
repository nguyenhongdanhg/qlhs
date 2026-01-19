import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, SchoolMembership, School, AppRole } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  memberships: SchoolMembership[];
  currentSchool: School | null;
  currentMembership: SchoolMembership | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  selectSchool: (school: School) => void;
  refreshProfile: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isSchoolAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [currentMembership, setCurrentMembership] = useState<SchoolMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Check if super admin
      const { data: globalRole } = await supabase
        .from('global_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      setIsSuperAdmin(globalRole?.role === 'super_admin');

      // Fetch memberships with school data
      const { data: membershipData, error: membershipError } = await supabase
        .from('school_memberships')
        .select(`
          *,
          school:schools(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (membershipError) throw membershipError;

      const typedMemberships = (membershipData || []).map(m => ({
        ...m,
        school: m.school as unknown as School
      })) as SchoolMembership[];

      setMemberships(typedMemberships);

      // Restore saved school from localStorage
      const savedSchoolId = localStorage.getItem('currentSchoolId');
      if (savedSchoolId && typedMemberships.length > 0) {
        const savedMembership = typedMemberships.find(m => m.school_id === savedSchoolId);
        if (savedMembership) {
          setCurrentSchool(savedMembership.school || null);
          setCurrentMembership(savedMembership);
        }
      } else if (typedMemberships.length === 1) {
        // Auto-select if only one school
        setCurrentSchool(typedMemberships[0].school || null);
        setCurrentMembership(typedMemberships[0]);
        localStorage.setItem('currentSchoolId', typedMemberships[0].school_id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer profile fetch with setTimeout to avoid deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setMemberships([]);
          setCurrentSchool(null);
          setCurrentMembership(null);
          setIsSuperAdmin(false);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    localStorage.removeItem('currentSchoolId');
    await supabase.auth.signOut();
  };

  const selectSchool = (school: School) => {
    const membership = memberships.find(m => m.school_id === school.id);
    if (membership) {
      setCurrentSchool(school);
      setCurrentMembership(membership);
      localStorage.setItem('currentSchoolId', school.id);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const hasRole = (role: AppRole): boolean => {
    if (isSuperAdmin) return true;
    return currentMembership?.role === role;
  };

  const isSchoolAdmin = (): boolean => {
    if (isSuperAdmin) return true;
    return currentMembership?.role === 'admin';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        memberships,
        currentSchool,
        currentMembership,
        isLoading,
        isSuperAdmin,
        signIn,
        signUp,
        signOut,
        selectSchool,
        refreshProfile,
        hasRole,
        isSchoolAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
