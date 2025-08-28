import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { AudioProvider } from "@/contexts/AudioContext";
import { Layout } from "@/components/layout/Layout";
import ProtectedRoute from './components/access-control/ProtectedRoute';
import { PermissionService } from "@/services/PermissionService";
import { useEffect, Suspense } from "react";
import { lazyLoadRoute } from "./utils/routeUtils";

// Lazy load pages with custom loading messages and suspense boundaries
const HomePage = lazyLoadRoute(() => import("./pages/HomePage"), "Loading home page...");
const LoginPage = lazyLoadRoute(() => import("./pages/LoginPage"), "Loading login page...");
const SignupPage = lazyLoadRoute(() => import("./pages/SignupPage"), "Loading signup page...");
const ForgotPasswordPage = lazyLoadRoute(() => import("./pages/ForgotPasswordPage"), "Loading password recovery...");
const DashboardPage = lazyLoadRoute(() => import("./pages/DashboardPage"), "Loading dashboard...");
const ReportFaultPage = lazyLoadRoute(() => import("./pages/ReportFaultPage"), "Loading fault reporting...");
const AnalyticsPage = lazyLoadRoute(() => import("./pages/AnalyticsPage"), "Loading analytics...");
const ControlSystemAnalyticsPage = lazyLoadRoute(() => import("./pages/ControlSystemAnalyticsPage"), "Loading control system analytics...");
const UserManagementPage = lazyLoadRoute(() => import("./pages/UserManagementPage"), "Loading user management...");
const LoadMonitoringPage = lazyLoadRoute(() => import("./pages/asset-management/LoadMonitoringPage"), "Loading load monitoring...");
const SubstationInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/SubstationInspectionPage"), "Loading substation inspection...");
const InspectionManagementPage = lazyLoadRoute(() => import("./pages/asset-management/InspectionManagementPage"), "Loading inspection management...");
const InspectionDetailsPage = lazyLoadRoute(() => import("./pages/asset-management/InspectionDetailsPage"), "Loading inspection details...");
const EditInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/EditInspectionPage"), "Loading edit inspection...");
const VITInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/VITInspectionPage"), "Loading VIT inspection...");
const VITInspectionManagementPage = lazyLoadRoute(() => import("./pages/asset-management/VITInspectionManagementPage"), "Loading VIT inspection management...");
const VITInspectionDetailsPage = lazyLoadRoute(() => import("./pages/asset-management/VITInspectionDetailsPage"), "Loading VIT inspection details...");
const EditVITInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/EditVITInspectionPage"), "Loading edit VIT inspection...");
const VITInspectionFormPage = lazyLoadRoute(() => import("./pages/asset-management/VITInspectionFormPage"), "Loading VIT inspection form...");
const OverheadLineInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/OverheadLineInspectionPage"), "Loading overhead line inspection...");
const NotFound = lazyLoadRoute(() => import("./pages/NotFound"), "Loading page...");
const UnauthorizedPage = lazyLoadRoute(() => import("./pages/UnauthorizedPage"), "Loading unauthorized page...");
const CreateLoadMonitoringPage = lazyLoadRoute(() => import("./pages/asset-management/CreateLoadMonitoringPage"), "Loading create load monitoring...");
const EditLoadMonitoringPage = lazyLoadRoute(() => import("./pages/asset-management/EditLoadMonitoringPage"), "Loading edit load monitoring...");
const LoadMonitoringDetailsPage = lazyLoadRoute(() => import("./pages/asset-management/LoadMonitoringDetailsPage"), "Loading load monitoring details...");
const EditOP5FaultPage = lazyLoadRoute(() => import("@/pages/EditOP5FaultPage"), "Loading edit OP5 fault...");
const EditControlOutagePage = lazyLoadRoute(() => import("@/pages/EditControlOutagePage"), "Loading edit control outage...");
const PermissionManagementPage = lazyLoadRoute(() => import('./pages/system-admin/PermissionManagementPage'), "Loading permission management...");
const SecurityMonitoringPage = lazyLoadRoute(() => import('./pages/system-admin/SecurityMonitoringPage'), "Loading security monitoring...");
const SecurityTestPage = lazyLoadRoute(() => import('./pages/system-admin/SecurityTestPage'), "Loading security test...");
const DistrictPopulationPage = lazyLoadRoute(() => import('./pages/DistrictPopulationPage'), "Loading district population...");
const UserProfilePage = lazyLoadRoute(() => import("./pages/UserProfilePage"), "Loading user profile...");
const EditVITAssetPage = lazyLoadRoute(() => import("./pages/asset-management/EditVITAssetPage"), "Loading edit VIT asset...");
const UserLogsPage = lazyLoadRoute(() => import("@/pages/UserLogsPage"), "Loading user logs...");
const SecondarySubstationInspectionPage = lazyLoadRoute(() => import("./pages/asset-management/SecondarySubstationInspectionPage"), "Loading secondary substation inspection...");
const MusicManagementPage = lazyLoadRoute(() => import("@/pages/admin/MusicManagementPage"), "Loading music management...");
const ImageMigrationPage = lazyLoadRoute(() => import("@/pages/admin/ImageMigrationPage"), "Loading image migration...");
const SubstationMigrationPage = lazyLoadRoute(() => import("@/pages/admin/SubstationMigrationPage"), "Loading substation migration...");
const FeederOfflineTestPage = lazyLoadRoute(() => import("./pages/test/FeederOfflineTestPage"), "Loading feeder offline test...");

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

function App() {
  useEffect(() => {
    // Initialize permissions
    const permissionService = PermissionService.getInstance();
    permissionService.initialize().catch(console.error);
  }, []);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <DataProvider>
            <AudioProvider>
              <TooltipProvider>
                <BrowserRouter>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/unauthorized" element={<UnauthorizedPage />} />

                    {/* Protected routes (feature-based) */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute requiredFeature="analytics_dashboard">
                        <DashboardPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/report-fault" element={
                      <ProtectedRoute requiredFeature="fault_reporting">
                        <ReportFaultPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/analytics" element={
                      <ProtectedRoute requiredFeature="analytics_page">
                        <AnalyticsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/control-system-analytics" element={
                      <ProtectedRoute requiredFeature="analytics_page">
                        <ControlSystemAnalyticsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/user-management" element={
                      <ProtectedRoute requiredFeature="user_management">
                        <UserManagementPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/district-population" element={
                      <ProtectedRoute requiredFeature="district_population">
                        <DistrictPopulationPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/load-monitoring" element={
                      <ProtectedRoute requiredFeature="load_monitoring">
                        <LoadMonitoringPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/load-monitoring-details/:id" element={
                      <ProtectedRoute requiredFeature="load_monitoring">
                        <LoadMonitoringDetailsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/load-monitoring/edit/:id" element={
                      <ProtectedRoute requiredFeature="load_monitoring_update">
                        <EditLoadMonitoringPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/create-load-monitoring" element={
                      <ProtectedRoute requiredFeature="load_monitoring">
                        <CreateLoadMonitoringPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/inspection-management" element={
                      <ProtectedRoute requiredFeature="inspection_management">
                        <InspectionManagementPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/inspection-details/:id" element={
                      <ProtectedRoute requiredFeature="inspection_management">
                        <InspectionDetailsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/substation-inspection" element={
                      <ProtectedRoute requiredFeature="substation_inspection">
                        <SubstationInspectionPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/secondary-substation-inspection" element={
                      <ProtectedRoute requiredFeature="substation_inspection">
                        <SecondarySubstationInspectionPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/secondary-substation-inspection/:id" element={
                      <ProtectedRoute requiredFeature="substation_inspection">
                        <SecondarySubstationInspectionPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/edit-inspection/:id" element={
                      <ProtectedRoute requiredFeature="inspection_management_update">
                        <EditInspectionPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/vit-inspection" element={
                      <ProtectedRoute requiredFeature="vit_inspection">
                        <VITInspectionPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/vit-inspection-management" element={
                      <ProtectedRoute requiredFeature="vit_inspection">
                        <VITInspectionManagementPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/vit-inspection-details/:id" element={
                      <ProtectedRoute requiredFeature="vit_inspection">
                        <VITInspectionDetailsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/edit-vit-inspection/:id" element={
                      <ProtectedRoute requiredFeature="vit_inspection_update">
                        <EditVITInspectionPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/edit-vit-asset/:id" element={
                      <ProtectedRoute requiredFeature="vit_inspection_update">
                        <EditVITAssetPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/vit-inspection-form/:id" element={
                      <ProtectedRoute requiredFeature="vit_inspection">
                        <VITInspectionFormPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/overhead-line" element={
                      <ProtectedRoute requiredFeature="overhead_line_inspection">
                        <OverheadLineInspectionPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/overhead-line/details/:id" element={
                      <ProtectedRoute requiredFeature="overhead_line_inspection">
                        <InspectionDetailsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/asset-management/overhead-line/edit/:id" element={
                      <ProtectedRoute requiredFeature="overhead_line_inspection_update">
                        <EditInspectionPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/edit-op5-fault/:id" element={
                      <ProtectedRoute requiredFeature="fault_reporting_update">
                        <EditOP5FaultPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/edit-control-outage/:id" element={
                      <ProtectedRoute requiredFeature="fault_reporting_update">
                        <EditControlOutagePage />
                      </ProtectedRoute>
                    } />

                    <Route path="/system-admin/permissions" element={
                      <ProtectedRoute requiredFeature="permission_management">
                        <PermissionManagementPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/system-admin/security" element={
                      <ProtectedRoute requiredFeature="security_monitoring">
                        <SecurityMonitoringPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/test/security" element={
                      <ProtectedRoute requiredFeature="security_testing">
                        <SecurityTestPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/profile" element={<UserProfilePage />} />

                    <Route path="/user-logs" element={
                      <ProtectedRoute requiredFeature="user_logs">
                        <UserLogsPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/music" element={
                      <ProtectedRoute requiredFeature="music_management">
                        <MusicManagementPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/music-management" element={
                      <ProtectedRoute requiredFeature="music_management">
                        <MusicManagementPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/admin/image-migration" element={<ImageMigrationPage />} />
                    <Route path="/admin/substation-migration" element={<SubstationMigrationPage />} />

                    <Route path="/test/feeder-offline" element={
                      <ProtectedRoute requiredFeature="feeder_offline_testing">
                        <FeederOfflineTestPage />
                      </ProtectedRoute>
                    } />

                    {/* Catch all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
                <Toaster />
                <Sonner />
              </TooltipProvider>
            </AudioProvider>
          </DataProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Suspense>
  );
}

export default App;
