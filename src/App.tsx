import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SuperAdminGuard } from "@/components/guards/SuperAdminGuard";
import { FeatureGuard } from "@/components/guards/FeatureGuard";
import { Loader2 } from "lucide-react";

// Core pages - load immediately for fast navigation
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import Boarding from "@/pages/Boarding";
import Meals from "@/pages/Meals";

// Secondary pages - lazy load
const Auth = lazy(() => import("@/pages/Auth"));
const SelectSchool = lazy(() => import("@/pages/SelectSchool"));
const EveningStudy = lazy(() => import("@/pages/EveningStudy"));
const Emulation = lazy(() => import("@/pages/Emulation"));
const Statistics = lazy(() => import("@/pages/Statistics"));
const DutySchedule = lazy(() => import("@/pages/DutySchedule"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const Settings = lazy(() => import("@/pages/Settings"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin"));
const MobileMenu = lazy(() => import("@/pages/MobileMenu"));
const Install = lazy(() => import("@/pages/Install"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Optimized QueryClient with better caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user, isLoading, memberships, currentSchool, isSuperAdmin } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isSuperAdmin) return <Navigate to="/superadmin" replace />;
  if (memberships.length > 1 && !currentSchool) return <Navigate to="/select-school" replace />;
  return <Navigate to="/dashboard" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Root redirect */}
              <Route path="/" element={<RootRedirect />} />
              
              {/* Select school (when user has multiple schools) */}
              <Route
                path="/select-school"
                element={
                  <AuthGuard>
                    <SelectSchool />
                  </AuthGuard>
                }
              />
              
              {/* Super Admin route (outside app layout) */}
              <Route
                path="/superadmin"
                element={
                  <SuperAdminGuard>
                    <SuperAdmin />
                  </SuperAdminGuard>
                }
              />
              
              {/* Protected routes with app layout */}
              <Route
                element={
                  <AuthGuard>
                    <AppLayout />
                  </AuthGuard>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                
                <Route
                  path="/students"
                  element={
                    <FeatureGuard featureCode="students">
                      <Students />
                    </FeatureGuard>
                  }
                />
                
                <Route
                  path="/evening-study"
                  element={
                    <FeatureGuard featureCode="evening_study">
                      <EveningStudy />
                    </FeatureGuard>
                  }
                />
                
                <Route
                  path="/boarding"
                  element={
                    <FeatureGuard featureCode="boarding">
                      <Boarding />
                    </FeatureGuard>
                  }
                />
                
                <Route
                  path="/meals"
                  element={
                    <FeatureGuard featureCode="meals">
                      <Meals />
                    </FeatureGuard>
                  }
                />
                
                <Route
                  path="/emulation"
                  element={
                    <FeatureGuard featureCode="emulation">
                      <Emulation />
                    </FeatureGuard>
                  }
                />
                
                <Route
                  path="/statistics"
                  element={
                    <FeatureGuard featureCode="statistics">
                      <Statistics />
                    </FeatureGuard>
                  }
                />
                
                <Route
                  path="/duty-schedule"
                  element={
                    <FeatureGuard featureCode="duty_schedule">
                      <DutySchedule />
                    </FeatureGuard>
                  }
                />
                
                <Route
                  path="/user-management"
                  element={
                    <FeatureGuard featureCode="user_management" adminOnly>
                      <UserManagement />
                    </FeatureGuard>
                  }
                />
                
                <Route path="/settings" element={<Settings />} />
                <Route path="/menu" element={<MobileMenu />} />
                <Route path="/install" element={<Install />} />
              </Route>
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;