import "./App.css";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { loginPathFor, returnTarget } from "./lib/returnTo";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
const Setup = lazy(() => import("./pages/Setup"));
const SetupAccount = lazy(() => import("./pages/SetupAccount"));
const Signup = lazy(() => import("./pages/Signup"));
const Home = lazy(() => import("./pages/Home"));
const Accounts = lazy(() => import("./pages/Accounts"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const Attendance = lazy(() => import("./pages/attendance/Attendance"));
const QRDisplay = lazy(() => import("./pages/attendance/QRDisplay"));
const ClockIn = lazy(() => import("./pages/attendance/ClockIn"));
const Calendar = lazy(() => import("./pages/Calendar"));
const UnifiedCalendar = lazy(() => import("./pages/UnifiedCalendar"));
const Devices = lazy(() => import("./pages/Devices"));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const PayrollDashboard = lazy(() => import("./pages/payroll/Dashboard"));
const PMSAllTasks = lazy(() => import("./pages/pms/AllTasks"));
const PMSDashboard = lazy(() => import("./pages/pms/Dashboard"));
const PMSMyTasks = lazy(() => import("./pages/pms/MyTasks"));
const PMSProjects = lazy(() => import("./pages/pms/Projects"));
const AgileBacklogPage = lazy(() => import("./pages/pms/AgileBacklogPage"));
const ProjectGanttPage = lazy(() => import("./pages/pms/ProjectGanttPage"));
const ProjectCalendarPage = lazy(() => import("./pages/pms/ProjectCalendarPage"));
const PMSTeam = lazy(() => import("./pages/pms/Team"));
const PMSTeams = lazy(() => import("./pages/pms/Teams"));
const PMSTeamDashboard = lazy(() => import("./pages/pms/TeamDashboard"));
const PMSReports = lazy(() => import("./pages/pms/Reports"));
const MySchedule = lazy(() => import("./pages/attendance/MySchedule"));
const ReviewQueue = lazy(() => import("./pages/pms/ReviewQueue"));
import EnterpriseLayout from "./layouts/EnterpriseLayout";
const DelegationsPage = lazy(() => import("./pages/DelegationsPage"));
import { AppearanceSettings } from "./components/settings/AppearanceSettings";
const LeaveRequests = lazy(() => import("./pages/leave/LeaveRequests"));
const MyLeaveRequests = lazy(() => import("./pages/leave/MyRequests"));
const LeaveBalances = lazy(() => import("./pages/leave/LeaveBalances"));
const MyPayslip = lazy(() => import("./pages/payroll/MyPayslip"));
const RunPayroll = lazy(() => import("./pages/payroll/RunPayroll"));
const SchedulingDashboard = lazy(() => import("./pages/scheduling/SchedulingDashboard"));
const OpportunitiesHub = lazy(() => import("./pages/scheduling/OpportunitiesHub"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Events = lazy(() => import("./pages/Events"));
const OvertimeMonitor = lazy(() => import("./pages/attendance/OvertimeMonitor").then((m) => ({ default: m.OvertimeMonitor })));
const PMSSettings = lazy(() => import("./pages/pms/PMSSettings"));
const SystemLogs = lazy(() => import("./pages/SystemLogs").then((m) => ({ default: m.SystemLogs })));
const PerDiemClaims = lazy(() => import("./pages/PerDiemClaims").then((m) => ({ default: m.PerDiemClaims })));
const AdminPerDiemClaims = lazy(() => import("./pages/admin/AdminPerDiemClaims").then((m) => ({ default: m.AdminPerDiemClaims })));
const LoanManagement = lazy(() => import("./pages/admin/LoanManagement"));
const LoanWorkflowSettings = lazy(() => import("./pages/admin/LoanWorkflowSettings"));
const LeaveWorkflowSettings = lazy(() => import("./pages/admin/LeaveWorkflowSettings"));
const MyLoans = lazy(() => import("./pages/MyLoans"));
import LandingPage from "./pages/LandingPage";
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
import ComingSoonModulePage from "./components/common/ComingSoonModulePage";
const OrganizationSettings = lazy(() => import("./pages/settings/OrganizationSettings"));
const HRSettingsPage = lazy(() => import("./pages/hrms/HRSettingsPage"));
const HRReportsDashboard = lazy(() => import("./pages/hrms/HRReportsDashboard"));
const HRDocumentsPage = lazy(() => import("./pages/hrms/HRDocumentsPage"));
const OnboardingPage = lazy(() => import("./pages/hrms/OnboardingPage"));
const WelcomePortalPage = lazy(() => import("./pages/hrms/onboarding/WelcomePortalPage"));

const GrievancesPage = lazy(() => import("./pages/hrms/GrievancesPage"));
const SelfServicePage = lazy(() => import("./pages/self-service/SelfServicePage"));
const BenefitsPage = lazy(() => import("./pages/hrms/BenefitsPage"));
const TrainingPage = lazy(() => import("./pages/hrms/TrainingPage"));
const ReviewsPage = lazy(() => import("./pages/pms/ReviewsPage"));
const ExpensesPage = lazy(() => import("./pages/hrms/ExpensesPage"));
const AssetsPage = lazy(() => import("./pages/hrms/AssetsPage"));
const SurveysPage = lazy(() => import("./pages/hrms/SurveysPage"));
const ImportExportPage = lazy(() => import("./pages/settings/ImportExportPage"));
const NotificationPreferencesPage = lazy(() => import("./pages/settings/NotificationPreferencesPage"));
const NotificationReportsPage = lazy(() => import("./pages/settings/NotificationReportsPage"));
const ApprovalsPage = lazy(() => import("./pages/approvals/ApprovalsPage"));
const ApprovalSettingsPage = lazy(() => import("./pages/settings/ApprovalSettingsPage"));
const DeveloperApiPage = lazy(() => import("./pages/settings/DeveloperApiPage"));
const AiSettingsPage = lazy(() => import("./pages/ai/AiSettingsPage"));
const ESignProviderPage = lazy(() => import("./pages/settings/ESignProviderPage"));
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage"));


function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isAuthenticated) {
    // Already signed in (e.g. opened /login?next=...): go straight to the requested page.
    return <Navigate to={returnTarget(location.search)} replace />;
  }

  return <>{children}</>;
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Keep the page they opened (a shared link, a bookmark) so sign-in returns them to it.
    return <Navigate to={loginPathFor(location)} replace />;
  }

  return <>{children}</>;
}

import { type ERPModuleKey } from "./context/ModuleContext";
import { PageGuard } from "./components/PageGuard";

// Permission & Module Subscription-based Route wrapper
function PermissionRoute({
  children,
  module,
  moduleKey,
  permission,
  permissions,
}: {
  children: React.ReactNode;
  module?: ERPModuleKey | string;
  moduleKey?: ERPModuleKey | string;
  permission?: string;
  permissions?: string[];
}) {
  return (
    <PageGuard
      module={module || moduleKey}
      permission={permission}
      permissions={permissions}
    >
      {children}
    </PageGuard>
  );
}

const ProductsPage = lazy(() => import("./pages/products/ProductsPage"));
const ProductCategoriesPage = lazy(() => import("./pages/products/CategoriesPage"));
const ProductUnitsPage = lazy(() => import("./pages/products/UnitsPage"));
const ProductAttributesPage = lazy(() => import("./pages/products/AttributesPage"));
const ProductPriceListsPage = lazy(() => import("./pages/products/PriceListsPage"));
const ProductLabelsPage = lazy(() => import("./pages/products/LabelsPage"));
const ProductReportsPage = lazy(() => import("./pages/products/ProductReportsPage"));
const ProductSettingsPage = lazy(() => import("./pages/products/ProductSettingsPage"));
const CrmLeadsPage = lazy(() => import("./pages/crm/LeadsPage"));
const InventoryStockPage = lazy(() => import("./pages/inventory/StockPage"));
const InventoryWarehousesPage = lazy(() => import("./pages/inventory/WarehousesPage"));
const InventoryLocationsPage = lazy(() => import("./pages/inventory/LocationsPage"));
const InventoryTransfersPage = lazy(() => import("./pages/inventory/TransfersPage"));
const InventoryMovementsPage = lazy(() => import("./pages/inventory/MovementsPage"));
const CrmOpportunitiesPage = lazy(() => import("./pages/crm/OpportunitiesPage"));
const CrmActivitiesPage = lazy(() => import("./pages/crm/ActivitiesPage"));
const CrmForecastPage = lazy(() => import("./pages/crm/ForecastPage"));
const CrmSetupPage = lazy(() => import("./pages/crm/CrmSetupPage"));
const ContactsPage = lazy(() => import("./pages/contacts/ContactsPage"));
const CustomersPage = lazy(() => import("./pages/contacts/ContactsPage").then((m) => ({ default: m.CustomersPage })));
const ContactCategoriesPage = lazy(() => import("./pages/contacts/ContactCategoriesPage"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const Recruitment = lazy(() => import("./pages/Recruitment"));
const Apply = lazy(() => import("./pages/Apply"));
const OrgChart = lazy(() => import("./pages/hrms/OrgChart"));

// Shown only while a page's code is loading for the first time.
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/setup-account" element={<SetupAccount />} />

      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/apply/:token" element={<Apply />} />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <EnterpriseLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Home />} />
        <Route path="/settings/appearance" element={<AppearanceSettings />} />
        <Route path="/settings/organization" element={
          <PermissionRoute permissions={["view_companies", "manage_companies", "view_branches", "manage_branches"]}>
            <OrganizationSettings />
          </PermissionRoute>
        } />
        <Route path="/recruitment" element={
          <PermissionRoute module="recruitment" permissions={["manage_recruitment", "view_hrm_settings"]}>
            <Recruitment />
          </PermissionRoute>
        } />
        <Route path="/hrms/recruitment" element={
          <PermissionRoute module="recruitment" permissions={["manage_recruitment", "view_hrm_settings"]}>
            <Recruitment />
          </PermissionRoute>
        } />
        <Route path="/hrms/recruitment/reports" element={
          <PermissionRoute module="recruitment" permissions={["manage_recruitment", "view_hrm_settings"]}>
            <Recruitment />
          </PermissionRoute>
        } />
        <Route path="/recruitment/jobs/:jobId/leaderboard" element={
          <PermissionRoute module="recruitment" permissions={["manage_recruitment", "view_hrm_settings"]}>
            <Leaderboard />
          </PermissionRoute>
        } />
        <Route path="/recruitment/jobs/:jobId/form-builder" element={
          <PermissionRoute module="recruitment" permissions={["manage_recruitment", "view_hrm_settings"]}>
            <FormBuilder />
          </PermissionRoute>
        } />
        <Route path="/accounts" element={
          <PermissionRoute module="users" permissions={["view_users", "edit_users", "create_users", "delete_users"]}>
            <Accounts />
          </PermissionRoute>
        } />
        <Route path="/hrms/org-chart" element={
          <PermissionRoute module="hrms" permissions={["view_users"]}>
            <OrgChart />
          </PermissionRoute>
        } />
        <Route path="/org-chart" element={
          <PermissionRoute module="hrms" permissions={["view_users"]}>
            <OrgChart />
          </PermissionRoute>
        } />
        <Route path="/accesscontrol" element={
          <PermissionRoute module="users" permissions={["view_roles", "edit_roles", "create_roles", "delete_roles"]}>
            <AccessControl />
          </PermissionRoute>
        } />
        <Route path="/attendance/view" element={
          <PermissionRoute module="attendance" permissions={["view_attendance"]}>
            <Attendance />
          </PermissionRoute>
        } />
        <Route path="/attendance/my-attendance" element={
          <PermissionRoute module="attendance" permissions={["view_my_attendance", "view_attendance"]}>
            <MySchedule />
          </PermissionRoute>
        } />
        <Route path="/attendance/my-schedule" element={
          <PermissionRoute module="attendance" permissions={["view_my_attendance", "view_attendance"]}>
            <MySchedule />
          </PermissionRoute>
        } />
        <Route path="/attendance/schedule" element={
          <PermissionRoute module="attendance" permissions={["view_my_attendance", "view_attendance"]}>
            <MySchedule />
          </PermissionRoute>
        } />
        <Route path="/attendance/qr-display" element={
          <PermissionRoute module="attendance" permissions={["view_qr_display", "view_attendance"]}>
            <QRDisplay />
          </PermissionRoute>
        } />
        <Route path="/attendance/clock-in" element={
          <PermissionRoute module="attendance" permissions={["clock_in_out", "view_my_attendance"]}>
            <ClockIn />
          </PermissionRoute>
        } />
        <Route path="/attendance/overtime-monitor" element={
          <PermissionRoute module="attendance" permissions={["view_overtime_workers"]}>
            <OvertimeMonitor />
          </PermissionRoute>
        } />
        <Route path="/leave/requests" element={
          <PermissionRoute module="leave" permissions={["view_leave", "approve_leave"]}>
            <LeaveRequests />
          </PermissionRoute>
        } />
        <Route path="/leave/my-requests" element={
          <PermissionRoute module="leave" permissions={["view_my_leave", "request_leave"]}>
            <MyLeaveRequests />
          </PermissionRoute>
        } />
        <Route path="/leave/balances" element={
          <PermissionRoute module="leave" permissions={["manage_leave", "view_leave"]}>
            <LeaveBalances />
          </PermissionRoute>
        } />
        <Route path="/leave/workflow" element={
          <PermissionRoute module="leave" permissions={["manage_leave", "approve_leave"]}>
            <LeaveWorkflowSettings />
          </PermissionRoute>
        } />
        <Route path="/calendar" element={<UnifiedCalendar />} />
        <Route path="/attendance/calendar" element={<Calendar />} />
        <Route path="/hr/scheduling" element={
          <PermissionRoute module="hrms" permissions={["manage_roster", "view_roster", "view_shifts", "manage_shifts", "manage_schedules", "view_wfm_opportunities"]}>
            <SchedulingDashboard />
          </PermissionRoute>
        } />
        <Route path="/scheduling" element={<Navigate to="/hr/scheduling" replace />} />
        <Route path="/scheduling/opportunities" element={
          <PermissionRoute module="hrms" permissions={["view_wfm_opportunities"]}>
            <OpportunitiesHub />
          </PermissionRoute>
        } />
        <Route path="/hr/scheduling/opportunities" element={<Navigate to="/scheduling/opportunities" replace />} />
        <Route path="/devices" element={
          <PermissionRoute module="attendance" permissions={["view_devices", "manage_devices"]}>
            <Devices />
          </PermissionRoute>
        } />
        <Route path="/settings" element={
          <PermissionRoute permissions={["view_general_settings", "edit_general_settings", "view_company_settings", "view_accounts_privacy_settings", "view_notification_preferences"]}>
            <Settings />
          </PermissionRoute>
        } />
        <Route path="/hr/settings" element={
          <PermissionRoute module="hrms" permissions={["view_hrm_settings", "edit_hrm_settings", "view_payroll_settings"]}>
            <HRSettingsPage />
          </PermissionRoute>
        } />
        <Route path="/hrms/settings" element={<Navigate to="/hr/settings" replace />} />
        <Route path="/payroll/dashboard" element={
          <PermissionRoute module="payroll" permissions={["view_payroll_dashboard", "view_payroll"]}>
            <PayrollDashboard />
          </PermissionRoute>
        } />
        <Route path="/payroll/my-payslip" element={
          <PermissionRoute module="payroll" permissions={["view_my_payslip", "view_payroll"]}>
            <MyPayslip />
          </PermissionRoute>
        } />
        <Route path="/payroll/run" element={
          <PermissionRoute module="payroll" permissions={["run_payroll"]}>
            <RunPayroll />
          </PermissionRoute>
        } />
        <Route path="/pms/dashboard" element={
          <PermissionRoute moduleKey="pms" permissions={["view_pms_dashboard", "view_pms"]}>
            <PMSDashboard />
          </PermissionRoute>
        } />
        <Route path="/pms/my-tasks" element={
          <PermissionRoute moduleKey="pms" permissions={["view_my_tasks", "view_pms"]}>
            <PMSMyTasks />
          </PermissionRoute>
        } />
        <Route path="/pms/all-tasks" element={
          <PermissionRoute moduleKey="pms" permissions={["view_all_tasks", "view_pms"]}>
            <PMSAllTasks />
          </PermissionRoute>
        } />
        <Route path="/pms/review-queue" element={
          <PermissionRoute moduleKey="pms" permissions={["review_tasks"]}>
            <ReviewQueue />
          </PermissionRoute>
        } />
        <Route path="/pms/reports" element={
          <PermissionRoute moduleKey="pms" permissions={["view_pms_reports", "view_pms"]}>
            <PMSReports />
          </PermissionRoute>
        } />
        {/* 360 Performance Reviews & Feedback */}
        <Route path="/pms/reviews" element={
          <PermissionRoute moduleKey="pms" permissions={["view_reviews", "view_my_reviews", "view_pms"]}>
            <ReviewsPage />
          </PermissionRoute>
        } />
        <Route path="/hrms/reviews" element={
          <PermissionRoute moduleKey="hrms" permissions={["view_reviews", "view_my_reviews"]}>
            <ReviewsPage />
          </PermissionRoute>
        } />
        <Route path="/reviews" element={<Navigate to="/pms/reviews" replace />} />
        <Route path="/pms/projects" element={
          <PermissionRoute moduleKey="pms" permissions={["view_projects", "view_pms"]}>
            <PMSProjects />
          </PermissionRoute>
        } />
        <Route path="/pms/backlog" element={
          <PermissionRoute moduleKey="pms" permissions={["view_sprints", "view_pms"]}>
            <AgileBacklogPage />
          </PermissionRoute>
        } />
        <Route path="/pms/gantt" element={
          <PermissionRoute moduleKey="pms" permissions={["view_tasks", "view_pms"]}>
            <ProjectGanttPage />
          </PermissionRoute>
        } />
        <Route path="/pms/calendar" element={
          <PermissionRoute moduleKey="pms" permissions={["view_tasks", "view_pms"]}>
            <ProjectCalendarPage />
          </PermissionRoute>
        } />
        <Route path="/pms/team" element={
          <PermissionRoute moduleKey="pms" permissions={["view_pms_team", "view_pms"]}>
            <PMSTeam />
          </PermissionRoute>
        } />
        <Route path="/pms/teams" element={
          <PermissionRoute moduleKey="pms" permissions={["view_teams", "view_pms"]}>
            <PMSTeams />
          </PermissionRoute>
        } />
        <Route path="/pms/teams/:id" element={
          <PermissionRoute moduleKey="pms" permissions={["view_team_dashboard", "view_teams", "view_pms"]}>
            <PMSTeamDashboard />
          </PermissionRoute>
        } />
        <Route path="/pms/settings" element={
          <PermissionRoute moduleKey="pms" permissions={["manage_pms_settings"]}>
            <PMSSettings />
          </PermissionRoute>
        } />
        <Route path="/announcements" element={
          <PermissionRoute moduleKey="hrms" permissions={["view_announcements"]}>
            <Announcements />
          </PermissionRoute>
        } />
        <Route path="/events" element={
          <PermissionRoute moduleKey="hrms" permissions={["view_events"]}>
            <Events />
          </PermissionRoute>
        } />
        <Route path="/system-logs" element={
          <PermissionRoute moduleKey="hrms" permissions={["view_logs"]}>
            <SystemLogs />
          </PermissionRoute>
        } />
        <Route path="/per-diem-claims" element={
          <PermissionRoute module="payroll" permissions={["view_my_payslip", "view_payroll"]}>
            <PerDiemClaims />
          </PermissionRoute>
        } />
        <Route path="/admin/per-diem-claims" element={
          <PermissionRoute module="payroll" permissions={["manage_payroll"]}>
            <AdminPerDiemClaims />
          </PermissionRoute>
        } />
        <Route path="/payroll/loans" element={
          <PermissionRoute module="payroll" permissions={["manage_payroll"]}>
            <LoanManagement />
          </PermissionRoute>
        } />
        <Route path="/payroll/loan-workflow" element={
          <PermissionRoute module="payroll" permissions={["manage_payroll"]}>
            <LoanWorkflowSettings />
          </PermissionRoute>
        } />
        <Route path="/my-loans" element={
          <PermissionRoute module="payroll" permissions={["view_payroll"]}>
            <MyLoans />
          </PermissionRoute>
        } />

        {/* Helper Navigation Redirects */}
        <Route path="/attendance" element={<Navigate to="/attendance/view" replace />} />
        <Route path="/leave" element={<Navigate to="/leave/requests" replace />} />
        <Route path="/loans" element={<Navigate to="/payroll/loans" replace />} />
        <Route path="/audit-logs" element={<PermissionRoute permissions={["view_logs"]}><SystemLogs /></PermissionRoute>} />

        {/* HRMS Reports & People Analytics */}
        <Route path="/hrms/reports" element={
          <PermissionRoute module="hrms" permissions={["view_hrms_reports"]}>
            <HRReportsDashboard />
          </PermissionRoute>
        } />
        <Route path="/reports/hrms" element={<Navigate to="/hrms/reports" replace />} />

        {/* HRMS Document Vault & Dynamic Letters */}
        <Route path="/hrms/documents" element={
          <PermissionRoute module="hrms" permissions={["view_employee_documents", "view_my_documents"]}>
            <HRDocumentsPage />
          </PermissionRoute>
        } />
        <Route path="/documents" element={<Navigate to="/hrms/documents" replace />} />

        {/* HRMS Onboarding & Offboarding */}
        <Route path="/hrms/onboarding" element={
          <PermissionRoute module="hrms" permissions={["view_onboarding", "manage_onboarding"]}>
            <OnboardingPage />
          </PermissionRoute>
        } />
        <Route path="/hrms/onboarding/welcome" element={
          <PermissionRoute module="hrms" permissions={["view_onboarding"]}>
            <WelcomePortalPage />
          </PermissionRoute>
        } />
        <Route path="/onboarding" element={<Navigate to="/hrms/onboarding" replace />} />


        {/* Employee Self-Service (ESS) Portal */}
        <Route path="/self-service" element={
          <PermissionRoute module="hrms" permissions={["view_self_service"]}>
            <SelfServicePage />
          </PermissionRoute>
        } />
        <Route path="/me" element={<Navigate to="/self-service" replace />} />
        <Route path="/portal" element={<Navigate to="/self-service" replace />} />

        {/* HRMS Employee Grievance & Whistleblower System */}
        <Route path="/hrms/grievances" element={
          <PermissionRoute module="hrms" permissions={["view_grievances", "manage_grievances", "file_grievance"]}>
            <GrievancesPage />
          </PermissionRoute>
        } />
        <Route path="/grievances" element={<Navigate to="/hrms/grievances" replace />} />

        {/* HRMS Benefits & Insurance Management */}
        <Route path="/hrms/benefits" element={
          <PermissionRoute module="hrms" permissions={["view_benefit_plans", "view_my_benefits", "manage_benefits"]}>
            <BenefitsPage />
          </PermissionRoute>
        } />
        <Route path="/benefits" element={<Navigate to="/hrms/benefits" replace />} />

        {/* HRMS Training & Learning Management (LMS) */}
        <Route path="/hrms/training" element={
          <PermissionRoute module="hrms" permissions={["view_training_courses", "view_my_training", "manage_training"]}>
            <TrainingPage />
          </PermissionRoute>
        } />
        <Route path="/training" element={<Navigate to="/hrms/training" replace />} />

        {/* HRMS Expense Management */}
        <Route path="/hrms/expenses" element={
          <PermissionRoute module="hrms" permissions={["view_expenses", "view_my_expenses", "submit_expenses"]}>
            <ExpensesPage />
          </PermissionRoute>
        } />
        <Route path="/expenses" element={<Navigate to="/hrms/expenses" replace />} />

        {/* HRMS Asset & Equipment Tracking */}
        <Route path="/hrms/assets" element={
          <PermissionRoute module="hrms" permissions={["view_assets", "view_my_assets"]}>
            <AssetsPage />
          </PermissionRoute>
        } />
        <Route path="/assets" element={<Navigate to="/hrms/assets" replace />} />

        {/* HRMS Pulse Surveys & Engagement */}
        <Route path="/hrms/surveys" element={
          <PermissionRoute module="hrms" permissions={["view_surveys", "participate_survey"]}>
            <SurveysPage />
          </PermissionRoute>
        } />
        <Route path="/surveys" element={<Navigate to="/hrms/surveys" replace />} />

        {/* Bulk Import / Export Engine */}
        <Route path="/settings/import-export" element={
          <PermissionRoute module="hrms" permissions={["view_import_export", "manage_import", "manage_export"]}>
            <ImportExportPage />
          </PermissionRoute>
        } />
        <Route path="/hrms/import-export" element={<Navigate to="/settings/import-export" replace />} />
        <Route path="/import-export" element={<Navigate to="/settings/import-export" replace />} />

        {/* Authority Delegations */}
        <Route path="/delegations" element={
          <ProtectedRoute>
            <DelegationsPage />
          </ProtectedRoute>
        } />

        {/* Notification Preferences & Reports */}
        <Route path="/settings/notifications" element={
          <PermissionRoute module="notifications" permissions={["view_notification_preferences"]}>
            <NotificationPreferencesPage />
          </PermissionRoute>
        } />
        <Route path="/settings/notifications/reports" element={
          <PermissionRoute module="notifications" permissions={["view_notification_reports"]}>
            <NotificationReportsPage />
          </PermissionRoute>
        } />
        <Route path="/notifications/preferences" element={<Navigate to="/settings/notifications" replace />} />
        <Route path="/notifications/reports" element={<Navigate to="/settings/notifications/reports" replace />} />

        {/* Dynamic Approval Workflow Engine */}
        <Route path="/approvals" element={
          <PermissionRoute permissions={["view_approval_requests", "approve_requests"]}>
            <ApprovalsPage />
          </PermissionRoute>
        } />
        <Route path="/settings/approvals" element={
          <PermissionRoute permissions={["manage_approval_rules"]}>
            <ApprovalSettingsPage />
          </PermissionRoute>
        } />

        {/* Webhooks & Developer API Portal */}
        <Route path="/settings/developer-api" element={
          <PermissionRoute permissions={["view_developer_api", "manage_developer_api"]}>
            <DeveloperApiPage />
          </PermissionRoute>
        } />
        <Route path="/developer-api" element={<Navigate to="/settings/developer-api" replace />} />

        {/* Digital Signature & E-Sign Provider Configuration */}
        <Route path="/settings/esign" element={
          <PermissionRoute permissions={["manage_documents", "manage_employee_documents"]}>
            <ESignProviderPage />
          </PermissionRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />

        {/* ERP Modules (Rule 13: Coming Soon with Backdrop Blur Overlay) */}
        <Route path="/products" element={<PermissionRoute module="products" permission="view_products"><ProductsPage /></PermissionRoute>} />
        <Route path="/products/categories" element={<PermissionRoute module="products" permission="view_product_categories"><ProductCategoriesPage /></PermissionRoute>} />
        <Route path="/products/uoms" element={<PermissionRoute module="products" permission="view_uoms"><ProductUnitsPage /></PermissionRoute>} />
        <Route path="/products/attributes" element={<PermissionRoute module="products" permission="view_product_attributes"><ProductAttributesPage /></PermissionRoute>} />
        <Route path="/products/pricelists" element={<PermissionRoute module="products" permission="view_price_lists"><ProductPriceListsPage /></PermissionRoute>} />
        <Route path="/products/labels" element={<PermissionRoute module="products" permission="view_label_templates"><ProductLabelsPage /></PermissionRoute>} />
        <Route path="/products/reports" element={<PermissionRoute module="products" permission="view_product_reports"><ProductReportsPage /></PermissionRoute>} />
        <Route path="/products/settings" element={<PermissionRoute module="products" permission="view_product_settings"><ProductSettingsPage /></PermissionRoute>} />
        <Route path="/contacts" element={<PermissionRoute module="contacts" permission="view_contacts"><ContactsPage /></PermissionRoute>} />
        <Route path="/customers" element={<PermissionRoute module="contacts" permission="view_contacts"><CustomersPage /></PermissionRoute>} />
        <Route path="/contacts/categories" element={<PermissionRoute module="contacts" permission="view_contact_categories"><ContactCategoriesPage /></PermissionRoute>} />
        <Route path="/crm" element={<Navigate to="/crm/opportunities" replace />} />
        <Route path="/crm/leads" element={<PermissionRoute module="crm" permission="view_crm_leads"><CrmLeadsPage /></PermissionRoute>} />
        <Route path="/crm/opportunities" element={<PermissionRoute module="crm" permission="view_crm_opportunities"><CrmOpportunitiesPage /></PermissionRoute>} />
        <Route path="/crm/activities" element={<PermissionRoute module="crm" permission="view_crm_activities"><CrmActivitiesPage /></PermissionRoute>} />
        <Route path="/crm/forecast" element={<PermissionRoute module="crm" permission="view_crm_opportunities"><CrmForecastPage /></PermissionRoute>} />
        <Route path="/crm/setup" element={<PermissionRoute module="crm" permission="view_crm_setup"><CrmSetupPage /></PermissionRoute>} />
        <Route path="/products/*" element={<ComingSoonModulePage moduleKey="products" />} />

        <Route path="/inventory" element={<PermissionRoute module="inventory" permission="view_stock"><InventoryStockPage /></PermissionRoute>} />
        <Route path="/inventory/warehouses" element={<PermissionRoute module="inventory" permission="view_warehouses"><InventoryWarehousesPage /></PermissionRoute>} />
        <Route path="/inventory/locations" element={<PermissionRoute module="inventory" permission="view_inventory_locations"><InventoryLocationsPage /></PermissionRoute>} />
        <Route path="/inventory/transfers" element={<PermissionRoute module="inventory" permission="view_transfers"><InventoryTransfersPage /></PermissionRoute>} />
        <Route path="/inventory/movements" element={<PermissionRoute module="inventory" permission="view_stock"><InventoryMovementsPage /></PermissionRoute>} />
        <Route path="/inventory/*" element={<ComingSoonModulePage moduleKey="inventory" />} />

        <Route path="/purchasing" element={<ComingSoonModulePage moduleKey="purchasing" />} />
        <Route path="/purchasing/*" element={<ComingSoonModulePage moduleKey="purchasing" />} />

        <Route path="/sales" element={<ComingSoonModulePage moduleKey="sales" />} />
        <Route path="/sales/*" element={<ComingSoonModulePage moduleKey="sales" />} />

        <Route path="/pos" element={<ComingSoonModulePage moduleKey="pos" />} />
        <Route path="/pos/*" element={<ComingSoonModulePage moduleKey="pos" />} />

        <Route path="/accounting" element={<ComingSoonModulePage moduleKey="accounting" />} />
        <Route path="/accounting/*" element={<ComingSoonModulePage moduleKey="accounting" />} />

        <Route path="/ai/settings" element={
          <PermissionRoute module="ai" permissions={["view_ai_settings"]}>
            <AiSettingsPage />
          </PermissionRoute>
        } />
        <Route path="/ai" element={<ComingSoonModulePage moduleKey="ai" />} />
        <Route path="/ai/documents" element={<ComingSoonModulePage moduleKey="ai" />} />
        <Route path="/ai/knowledge" element={<ComingSoonModulePage moduleKey="ai" />} />
        <Route path="/ai/actions" element={<ComingSoonModulePage moduleKey="ai" />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}

export default AppRoutes;
