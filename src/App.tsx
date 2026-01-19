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

// Pages
import Auth from "@/pages/Auth";
import SelectSchool from "@/pages/SelectSchool";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import EveningStudy from "@/pages/EveningStudy";
import Boarding from "@/pages/Boarding";
import Meals from "@/pages/Meals";
import Statistics from "@/pages/Statistics";
import DutySchedule from "@/pages/DutySchedule";
import UserManagement from "@/pages/UserManagement";
import Settings from "@/pages/Settings";
import SuperAdmin from "@/pages/SuperAdmin";
import MobileMenu from "@/pages/MobileMenu";
import Install from "@/pages/Install";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function RootRedirect() {
  const { user, isLoading, memberships, currentSchool, isSuperAdmin } = useAuth();

  if (isLoading) return null;
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
