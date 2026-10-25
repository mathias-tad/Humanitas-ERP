import "./App.css";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import SetupAccount from "./pages/SetupAccount";
import Home from "./pages/Home";
import Accounts from "./pages/Accounts";
import AccessControl from "./pages/AccessControl";
import Attendance from "./pages/attendance/Attendance";
import QRDisplay from "./pages/attendance/QRDisplay";
import ClockIn from "./pages/attendance/ClockIn";
import Calendar from "./pages/Calendar";
import Devices from "./pages/Devices";
import { Settings } from "./pages/Settings";
import PayrollDashboard from "./pages/payroll/Dashboard";
import PMSAllTasks from "./pages/pms/AllTasks";
import PMSDashboard from "./pages/pms/Dashboard";
import PMSMyTasks from "./pages/pms/MyTasks";
import PMSProjects from "./pages/pms/Projects";
import AgileBacklogPage from "./pages/pms/AgileBacklogPage";
import ProjectGanttPage from "./pages/pms/ProjectGanttPage";
import ProjectCalendarPage from "./pages/pms/ProjectCalendarPage";
import PMSTeam from "./pages/pms/Team";
import PMSTeams from "./pages/pms/Teams";
import PMSTeamDashboard from "./pages/pms/TeamDashboard";
import PMSReports from "./pages/pms/Reports";
import MyAttendance from "./pages/attendance/MyAttendance";
import ReviewQueue from "./pages/pms/ReviewQueue";
import EnterpriseLayout from "./layouts/EnterpriseLayout";
import { AppearanceSettings } from "./components/settings/AppearanceSettings";
import LeaveRequests from "./pages/leave/LeaveRequests";
import MyLeaveRequests from "./pages/leave/MyRequests";
import LeaveBalances from "./pages/leave/LeaveBalances";
import MyPayslip from "./pages/payroll/MyPayslip";
import RunPayroll from "./pages/payroll/RunPayroll";
import SchedulingDashboard from "./pages/scheduling/SchedulingDashboard";
import Announcements from "./pages/Announcements";
import Events from "./pages/Events";
import { OvertimeMonitor } from "./pages/attendance/OvertimeMonitor";
import PMSSettings from "./pages/pms/PMSSettings";
import { SystemLogs } from "./pages/SystemLogs";
import { PerDiemClaims } from "./pages/PerDiemClaims";
import { AdminPerDiemClaims } from "./pages/admin/AdminPerDiemClaims";
import LoanManagement from "./pages/admin/LoanManagement";
import LoanWorkflowSettings from "./pages/admin/LoanWorkflowSettings";
import LeaveWorkflowSettings from "./pages/admin/LeaveWorkflowSettings";
import MyLoans from "./pages/MyLoans";
import LandingPage from "./pages/LandingPage";
import FeaturesPage from "./pages/FeaturesPage";
import ComingSoonModulePage from "./components/common/ComingSoonModulePage";
import OrganizationSettings from "./pages/settings/OrganizationSettings";
import HRReportsDashboard from "./pages/hrms/HRReportsDashboard";
import HRDocumentsPage from "./pages/hrms/HRDocumentsPage";
import OnboardingPage from "./pages/hrms/OnboardingPage";
import GrievancesPage from "./pages/hrms/GrievancesPage";
import SelfServicePage from "./pages/self-service/SelfServicePage";
import BenefitsPage from "./pages/hrms/BenefitsPage";
import TrainingPage from "./pages/hrms/TrainingPage";
import ReviewsPage from "./pages/pms/ReviewsPage";
import ExpensesPage from "./pages/hrms/ExpensesPage";
import AssetsPage from "./pages/hrms/AssetsPage";
import SurveysPage from "./pages/hrms/SurveysPage";
import ImportExportPage from "./pages/settings/ImportExportPage";
import NotificationPreferencesPage from "./pages/settings/NotificationPreferencesPage";
import ApprovalsPage from "./pages/approvals/ApprovalsPage";
import ApprovalSettingsPage from "./pages/settings/ApprovalSettingsPage";


function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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

import Leaderboard from "./pages/Leaderboard";
import FormBuilder from "./pages/FormBuilder";
import Recruitment from "./pages/Recruitment";
import Apply from "./pages/Apply";
import OrgChart from "./pages/hrms/OrgChart";

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/setup-account" element={<SetupAccount />} />

      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
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
          <PermissionRoute module="hrms" permissions={["view_users", "edit_users", "create_users", "delete_users"]}>
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
          <PermissionRoute module="hrms" permissions={["view_roles", "edit_roles", "create_roles", "delete_roles"]}>
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
            <MyAttendance />
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
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/hr/scheduling" element={
          <PermissionRoute module="hrms" permissions={["manage_roster", "view_roster", "view_shifts", "manage_shifts", "manage_schedules"]}>
            <SchedulingDashboard />
          </PermissionRoute>
        } />
        <Route path="/scheduling" element={<Navigate to="/hr/scheduling" replace />} />
        <Route path="/devices" element={
          <PermissionRoute module="attendance" permissions={["view_devices", "manage_devices"]}>
            <Devices />
          </PermissionRoute>
        } />
        <Route path="/settings" element={
          <PermissionRoute module="hrms" permissions={["view_general_settings", "edit_general_settings"]}>
            <Settings />
          </PermissionRoute>
        } />
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

        {/* Notification Preferences */}
        <Route path="/settings/notifications" element={
          <PermissionRoute module="notifications" permissions={["view_notification_preferences"]}>
            <NotificationPreferencesPage />
          </PermissionRoute>
        } />
        <Route path="/notifications/preferences" element={<Navigate to="/settings/notifications" replace />} />

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

        {/* ERP Modules (Rule 13: Coming Soon with Backdrop Blur Overlay) */}
        <Route path="/products" element={<ComingSoonModulePage moduleKey="products" />} />
        <Route path="/products/*" element={<ComingSoonModulePage moduleKey="products" />} />

        <Route path="/inventory" element={<ComingSoonModulePage moduleKey="inventory" />} />
        <Route path="/inventory/*" element={<ComingSoonModulePage moduleKey="inventory" />} />

        <Route path="/purchasing" element={<ComingSoonModulePage moduleKey="purchasing" />} />
        <Route path="/purchasing/*" element={<ComingSoonModulePage moduleKey="purchasing" />} />

        <Route path="/sales" element={<ComingSoonModulePage moduleKey="sales" />} />
        <Route path="/sales/*" element={<ComingSoonModulePage moduleKey="sales" />} />

        <Route path="/pos" element={<ComingSoonModulePage moduleKey="pos" />} />
        <Route path="/pos/*" element={<ComingSoonModulePage moduleKey="pos" />} />

        <Route path="/accounting" element={<ComingSoonModulePage moduleKey="accounting" />} />
        <Route path="/accounting/*" element={<ComingSoonModulePage moduleKey="accounting" />} />

        <Route path="/ai" element={<ComingSoonModulePage moduleKey="ai" />} />
        <Route path="/ai/*" element={<ComingSoonModulePage moduleKey="ai" />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default AppRoutes;
