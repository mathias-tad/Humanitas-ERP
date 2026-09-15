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
import PMSTeam from "./pages/pms/Team";
import PMSTeams from "./pages/pms/Teams";
import PMSTeamDashboard from "./pages/pms/TeamDashboard";
import PMSReports from "./pages/pms/Reports";
import MyAttendance from "./pages/attendance/MyAttendance";
import ReviewQueue from "./pages/pms/ReviewQueue";
import EnterpriseLayout from "./layouts/EnterpriseLayout";
import { AppearanceSettings } from "./pages/settings/AppearanceSettings";
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

// Permission-based Route wrapper
function PermissionRoute({
  children,
  permissions = [],
  fallback = "/dashboard"
}: {
  children: React.ReactNode;
  permissions?: string[];
  fallback?: string;
}) {
  const { hasAnyPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // If no permissions required, allow access
  if (permissions.length === 0) {
    return <>{children}</>;
  }

  // Check if user has any of the required permissions
  if (!hasAnyPermission(permissions)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

import Leaderboard from "./pages/Leaderboard";
import FormBuilder from "./pages/FormBuilder";
import Recruitment from "./pages/Recruitment";
import Apply from "./pages/Apply";

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
        <Route path="/recruitment" element={
          <PermissionRoute permissions={["manage_recruitment", "view_hrm_settings"]}>
            <Recruitment />
          </PermissionRoute>
        } />
        <Route path="/recruitment/jobs/:jobId/leaderboard" element={
          <PermissionRoute permissions={["manage_recruitment", "view_hrm_settings"]}>
            <Leaderboard />
          </PermissionRoute>
        } />
        <Route path="/recruitment/jobs/:jobId/form-builder" element={
          <PermissionRoute permissions={["manage_recruitment", "view_hrm_settings"]}>
            <FormBuilder />
          </PermissionRoute>
        } />
        <Route path="/accounts" element={
          <PermissionRoute permissions={["view_users", "edit_users", "create_users", "delete_users"]}>
            <Accounts />
          </PermissionRoute>
        } />
        <Route path="/accesscontrol" element={
          <PermissionRoute permissions={["view_roles", "edit_roles", "create_roles", "delete_roles"]}>
            <AccessControl />
          </PermissionRoute>
        } />
        <Route path="/attendance/view" element={
          <PermissionRoute permissions={["view_attendance"]}>
            <Attendance />
          </PermissionRoute>
        } />
        <Route path="/attendance/my-attendance" element={
          <PermissionRoute permissions={["view_my_attendance", "view_attendance"]}>
            <MyAttendance />
          </PermissionRoute>
        } />
        <Route path="/attendance/qr-display" element={
          <PermissionRoute permissions={["view_qr_display", "view_attendance"]}>
            <QRDisplay />
          </PermissionRoute>
        } />
        <Route path="/attendance/clock-in" element={
          <PermissionRoute permissions={["clock_in_out", "view_my_attendance"]}>
            <ClockIn />
          </PermissionRoute>
        } />
        <Route path="/attendance/overtime-monitor" element={
          <PermissionRoute permissions={["view_overtime_workers"]}>
            <OvertimeMonitor />
          </PermissionRoute>
        } />
        <Route path="/leave/requests" element={
          <PermissionRoute permissions={["view_leave", "approve_leave"]}>
            <LeaveRequests />
          </PermissionRoute>
        } />
        <Route path="/leave/my-requests" element={
          <PermissionRoute permissions={["view_my_leave", "request_leave"]}>
            <MyLeaveRequests />
          </PermissionRoute>
        } />
        <Route path="/leave/balances" element={
          <PermissionRoute permissions={["manage_leave", "view_leave"]}>
            <LeaveBalances />
          </PermissionRoute>
        } />
        <Route path="/leave/workflow" element={
          <PermissionRoute permissions={["manage_leave", "approve_leave"]}>
            <LeaveWorkflowSettings />
          </PermissionRoute>
        } />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/scheduling" element={
          <PermissionRoute permissions={["manage_roster", "view_roster"]}>
            <SchedulingDashboard />
          </PermissionRoute>
        } />
        <Route path="/devices" element={
          <PermissionRoute permissions={["view_devices", "manage_devices"]}>
            <Devices />
          </PermissionRoute>
        } />
        <Route path="/settings" element={
          <PermissionRoute permissions={["view_general_settings", "edit_general_settings"]}>
            <Settings />
          </PermissionRoute>
        } />
        <Route path="/payroll/dashboard" element={
          <PermissionRoute permissions={["view_payroll_dashboard", "view_payroll"]}>
            <PayrollDashboard />
          </PermissionRoute>
        } />
        <Route path="/payroll/my-payslip" element={
          <PermissionRoute permissions={["view_my_payslip", "view_payroll"]}>
            <MyPayslip />
          </PermissionRoute>
        } />
        <Route path="/payroll/run" element={
          <PermissionRoute permissions={["run_payroll"]}>
            <RunPayroll />
          </PermissionRoute>
        } />
        <Route path="/pms/dashboard" element={
          <PermissionRoute permissions={["view_pms_dashboard", "view_pms"]}>
            <PMSDashboard />
          </PermissionRoute>
        } />
        <Route path="/pms/my-tasks" element={
          <PermissionRoute permissions={["view_my_tasks", "view_pms"]}>
            <PMSMyTasks />
          </PermissionRoute>
        } />
        <Route path="/pms/all-tasks" element={
          <PermissionRoute permissions={["view_all_tasks", "view_pms"]}>
            <PMSAllTasks />
          </PermissionRoute>
        } />
        <Route path="/pms/review-queue" element={
          <PermissionRoute permissions={["review_tasks"]}>
            <ReviewQueue />
          </PermissionRoute>
        } />
        <Route path="/pms/reports" element={
          <PermissionRoute permissions={["view_pms_reports", "view_pms"]}>
            <PMSReports />
          </PermissionRoute>
        } />
        <Route path="/pms/projects" element={
          <PermissionRoute permissions={["view_projects", "view_pms"]}>
            <PMSProjects />
          </PermissionRoute>
        } />
        <Route path="/pms/team" element={
          <PermissionRoute permissions={["view_pms_team", "view_pms"]}>
            <PMSTeam />
          </PermissionRoute>
        } />
        <Route path="/pms/teams" element={
          <PermissionRoute permissions={["view_teams", "view_pms"]}>
            <PMSTeams />
          </PermissionRoute>
        } />
        <Route path="/pms/teams/:id" element={
          <PermissionRoute permissions={["view_team_dashboard", "view_teams", "view_pms"]}>
            <PMSTeamDashboard />
          </PermissionRoute>
        } />
        <Route path="/pms/settings" element={
          <PermissionRoute permissions={["manage_pms_settings"]}>
            <PMSSettings />
          </PermissionRoute>
        } />
        <Route path="/announcements" element={
          <PermissionRoute permissions={["view_announcements"]}>
            <Announcements />
          </PermissionRoute>
        } />
        <Route path="/events" element={
          <PermissionRoute permissions={["view_events"]}>
            <Events />
          </PermissionRoute>
        } />
        <Route path="/system-logs" element={
          <PermissionRoute permissions={["view_logs"]}>
            <SystemLogs />
          </PermissionRoute>
        } />
        <Route path="/per-diem-claims" element={
          <PermissionRoute permissions={["view_my_payslip", "view_payroll"]}>
            <PerDiemClaims />
          </PermissionRoute>
        } />
        <Route path="/admin/per-diem-claims" element={
          <PermissionRoute permissions={["manage_payroll"]}>
            <AdminPerDiemClaims />
          </PermissionRoute>
        } />
        <Route path="/payroll/loans" element={
          <PermissionRoute permissions={["manage_payroll"]}>
            <LoanManagement />
          </PermissionRoute>
        } />
        <Route path="/payroll/loan-workflow" element={
          <PermissionRoute permissions={["manage_payroll"]}>
            <LoanWorkflowSettings />
          </PermissionRoute>
        } />
        <Route path="/my-loans" element={<MyLoans />} />

        {/* Helper Navigation Redirects */}
        <Route path="/attendance" element={<Navigate to="/attendance/view" replace />} />
        <Route path="/leave" element={<Navigate to="/leave/requests" replace />} />
        <Route path="/loans" element={<Navigate to="/payroll/loans" replace />} />
        <Route path="/audit-logs" element={<PermissionRoute permissions={["view_logs"]}><SystemLogs /></PermissionRoute>} />

        {/* HRMS Reports (Coming Soon) */}
        <Route path="/hrms/reports" element={<ComingSoonModulePage moduleKey="hrms" subSectionTitle="HRMS Analytics & Reports" />} />

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
