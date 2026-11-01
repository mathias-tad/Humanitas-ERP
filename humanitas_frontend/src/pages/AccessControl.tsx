import { useState, useEffect } from "react";
import { RoleList, type Role } from "@/components/roleAndPermisions/RoleList";
import { CreateEditRoleModal } from "@/components/roleAndPermisions/CreateEditRoleModal";
import {
  PermissionMatrix,
  type Permission,
} from "@/components/roleAndPermisions/PermissionMatrix";
import { DeleteRoleModal } from "@/components/roleAndPermisions/DeleteRoleModal";
import { ShieldCheck, Loader2, RefreshCw, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRolesWithMutations } from "@/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const permissions: Permission[] = [
  // Dashboard
  { id: "view_dashboard", name: "view", label: "View Dashboard", module: "Dashboard" },

  // Users
  { id: "view_users", name: "view", label: "View Users", module: "Users" },
  { id: "edit_users", name: "edit", label: "Edit Users", module: "Users" },
  { id: "create_users", name: "create", label: "Create Users", module: "Users" },
  { id: "delete_users", name: "delete", label: "Delete Users", module: "Users" },
  { id: "view_user_attachments", name: "view_attachments", label: "View User Attachments", module: "Users" },
  { id: "manage_user_attachments", name: "manage_attachments", label: "Manage User Attachments", module: "Users" },
  { id: "view_departments", name: "view_departments", label: "View Departments", module: "Users" },
  { id: "manage_departments", name: "manage_departments", label: "Manage Departments", module: "Users" },
  { id: "view_all_departments", name: "view_all_departments", label: "View All Departments (Org-Wide Scope)", module: "Users" },

  // Organization (Multi-Company & Multi-Branch)
  { id: "view_companies", name: "view_companies", label: "View Companies", module: "Organization" },
  { id: "manage_companies", name: "manage_companies", label: "Manage Companies (Create/Edit/Delete)", module: "Organization" },
  { id: "view_all_companies", name: "view_all_companies", label: "View All Companies (Enterprise Org-Wide Scope)", module: "Organization" },
  { id: "view_branches", name: "view_branches", label: "View Branches", module: "Organization" },
  { id: "manage_branches", name: "manage_branches", label: "Manage Branches (Create/Edit/Delete)", module: "Organization" },
  { id: "view_all_branches", name: "view_all_branches", label: "View All Branches (Company-Wide Scope)", module: "Organization" },

  // Roles & Access Control
  { id: "view_roles", name: "view", label: "View Roles", module: "Access Control" },
  { id: "edit_roles", name: "edit", label: "Edit Roles", module: "Access Control" },
  { id: "create_roles", name: "create", label: "Create Roles", module: "Access Control" },
  { id: "delete_roles", name: "delete", label: "Delete Roles", module: "Access Control" },

  // Devices
  { id: "view_devices", name: "view", label: "View Devices", module: "Devices" },
  { id: "manage_devices", name: "manage", label: "Manage Devices", module: "Devices" },
  { id: "authorize_devices", name: "authorize", label: "Authorize / Revoke Devices", module: "Devices" },
  { id: "sync_devices", name: "sync", label: "Sync Device Templates & Users", module: "Devices" },
  { id: "view_device_logs", name: "logs", label: "View Device Logs", module: "Devices" },

  // Attendance
  { id: "view_attendance", name: "view", label: "View All Attendance", module: "Attendance" },
  { id: "edit_attendance", name: "edit", label: "Edit Attendance", module: "Attendance" },
  { id: "correct_attendance", name: "correct", label: "Correct Attendance", module: "Attendance" },
  { id: "view_my_attendance", name: "view_my", label: "View My Attendance", module: "Attendance" },
  { id: "clock_in_out", name: "clock", label: "Clock In/Out", module: "Attendance" },
  { id: "view_qr_display", name: "qr_display", label: "View QR Display", module: "Attendance" },
  { id: "manage_attendance_devices", name: "manage_devices", label: "Manage Attendance Devices", module: "Attendance" },
  { id: "manage_attendance_networks", name: "manage_networks", label: "Manage Allowed Networks", module: "Attendance" },
  { id: "view_overtime_workers", name: "view_ot_monitor", label: "View OT Monitor", module: "Attendance" },
  { id: "force_clockout", name: "force_clockout", label: "Force Clock Out", module: "Attendance" },
  { id: "manage_shift_assignments", name: "manage_assignments", label: "Manage Shift Assignments", module: "Attendance" },

  // Roster / Scheduling
  { id: "view_roster", name: "view_roster", label: "View Roster", module: "Roster" },
  { id: "manage_roster", name: "manage_roster", label: "Manage Roster (Create/Edit)", module: "Roster" },
  { id: "view_shifts", name: "view_shifts", label: "View Shifts & Patterns", module: "Roster" },
  { id: "manage_shifts", name: "manage_shifts", label: "Manage Shifts & Patterns", module: "Roster" },
  { id: "view_wfm_opportunities", name: "view_wfm_opportunities", label: "View VET/VTO Opportunities", module: "Roster" },
  { id: "claim_wfm_opportunities", name: "claim_wfm_opportunities", label: "Claim VET/VTO Opportunities", module: "Roster" },
  { id: "broadcast_wfm_opportunities", name: "broadcast_wfm_opportunities", label: "Broadcast VET/VTO Opportunities", module: "Roster" },
  { id: "manage_wfm_claims", name: "manage_wfm_claims", label: "Approve/Reject VET/VTO Claims", module: "Roster" },
  { id: "manage_wfm_settings", name: "manage_wfm_settings", label: "Manage WFM & Fatigue Policies", module: "Roster" },

  // Leave
  { id: "view_leave", name: "view", label: "View All Leave Requests", module: "Leave" },
  { id: "approve_leave", name: "approve", label: "Approve Leave Requests", module: "Leave" },
  { id: "view_my_leave", name: "view_my", label: "View My Leave Requests", module: "Leave" },
  { id: "request_leave", name: "request", label: "Request Leave", module: "Leave" },

  // Payroll
  { id: "view_payroll", name: "view", label: "View All Payroll", module: "Payroll" },
  { id: "view_payroll_dashboard", name: "view_dashboard", label: "View Payroll Dashboard", module: "Payroll" },
  { id: "run_payroll", name: "run", label: "Run Payroll", module: "Payroll" },
  { id: "view_my_payslip", name: "view_my", label: "View My Payslip", module: "Payroll" },
  { id: "view_payroll_history", name: "view_history", label: "View Payroll History", module: "Payroll" },
  { id: "view_tax_reports", name: "view_tax", label: "View Tax Reports", module: "Payroll" },
  { id: "absence_penalty_approve", name: "approve_absence_penalty", label: "Approve Absence Penalties", module: "Payroll" },

  // Loan Management
  { id: "manage_loans", name: "manage_loans", label: "Manage Loans (Approve/Reject)", module: "Loan Management" },
  { id: "manage_loan_workflows", name: "manage_workflows", label: "Manage Loan Workflows", module: "Loan Management" },

  // PMS - Project Management
  { id: "view_pms", name: "view", label: "View PMS (Full Access)", module: "PMS" },
  { id: "view_pms_dashboard", name: "view_dashboard", label: "View PMS Dashboard", module: "PMS" },
  { id: "view_my_tasks", name: "view_my", label: "View My Tasks", module: "PMS" },
  { id: "view_all_tasks", name: "view_all", label: "View All Tasks", module: "PMS" },
  { id: "create_tasks", name: "create", label: "Create Tasks", module: "PMS" },
  { id: "edit_tasks", name: "edit", label: "Edit Tasks", module: "PMS" },
  { id: "edit_own_tasks", name: "edit_own", label: "Edit Own Tasks", module: "PMS" },
  { id: "delete_tasks", name: "delete", label: "Delete Tasks", module: "PMS" },
  { id: "view_projects", name: "view_projects", label: "View Projects", module: "PMS" },
  { id: "create_projects", name: "create_projects", label: "Create Projects", module: "PMS" },
  { id: "edit_projects", name: "edit_projects", label: "Edit Projects", module: "PMS" },
  { id: "delete_projects", name: "delete_projects", label: "Delete Projects", module: "PMS" },
  { id: "view_pms_reports", name: "view_reports", label: "View Reports", module: "PMS" },

  // PMS - Teams
  { id: "view_teams", name: "view_teams", label: "View Teams", module: "PMS" },
  { id: "create_teams", name: "create_teams", label: "Create Teams", module: "PMS" },
  { id: "edit_teams", name: "edit_teams", label: "Edit Teams", module: "PMS" },
  { id: "delete_teams", name: "delete_teams", label: "Delete Teams", module: "PMS" },
  { id: "manage_team_members", name: "manage_members", label: "Manage Team Members", module: "PMS" },
  { id: "view_team_dashboard", name: "view_team_dash", label: "View Team Dashboard", module: "PMS" },

  // PMS - Sprints & Tasks Advanced
  { id: "view_sprints", name: "view_sprints", label: "View Sprints", module: "PMS" },
  { id: "manage_sprints", name: "manage_sprints", label: "Manage Sprints", module: "PMS" },
  { id: "assign_tasks", name: "assign_tasks", label: "Assign Tasks", module: "PMS" },
  { id: "approve_tasks", name: "approve_tasks", label: "Approve Tasks", module: "PMS" },
  { id: "log_time", name: "log_time", label: "Log Time", module: "PMS" },
  { id: "view_time_logs", name: "view_time_logs", label: "View Time Logs", module: "PMS" },
  { id: "reassign_tasks", name: "reassign_tasks", label: "Re-assign claimed task", module: "PMS" },

  // PMS - KPIs & Settings
  { id: "view_team_kpis", name: "view_team_kpis", label: "View Team KPIs", module: "PMS" },
  { id: "view_own_kpis", name: "view_own_kpis", label: "View Own KPIs", module: "PMS" },
  { id: "manage_pms_settings", name: "manage_settings", label: "Manage PMS Settings", module: "PMS" },
  { id: "export_pms_data", name: "export_data", label: "Export PMS Data", module: "PMS" },

  // KPI & Performance
  { id: "view_kpi", name: "view", label: "View KPI", module: "KPI" },
  { id: "create_kpi", name: "create", label: "Create KPI", module: "KPI" },
  { id: "edit_kpi", name: "edit", label: "Edit KPI", module: "KPI" },
  { id: "delete_kpi", name: "delete", label: "Delete KPI", module: "KPI" },
  { id: "view_performance_reviews", name: "view_reviews", label: "View Performance Reviews", module: "KPI" },
  { id: "create_performance_reviews", name: "create_reviews", label: "Create Performance Reviews", module: "KPI" },
  { id: "approve_performance_reviews", name: "approve_reviews", label: "Approve Performance Reviews", module: "KPI" },

  // Settings - General
  { id: "view_general_settings", name: "view", label: "View General Settings", module: "Settings" },
  { id: "edit_general_settings", name: "edit", label: "Edit General Settings", module: "Settings" },

  // Settings - Company
  { id: "view_company_settings", name: "view_company", label: "View Company Settings", module: "Settings" },
  { id: "edit_company_settings", name: "edit_company", label: "Edit Company Settings", module: "Settings" },

  // Settings - Payroll
  { id: "view_payroll_settings", name: "view_payroll", label: "View Payroll Settings", module: "Settings" },
  { id: "edit_payroll_settings", name: "edit_payroll", label: "Edit Payroll Settings", module: "Settings" },

  // Settings - Accounts & Privacy
  { id: "view_accounts_privacy_settings", name: "view_accounts", label: "View Accounts & Privacy", module: "Settings" },
  { id: "edit_accounts_privacy_settings", name: "edit_accounts", label: "Edit Accounts & Privacy", module: "Settings" },

  // Settings - HRM
  { id: "view_hrm_settings", name: "view_hrm", label: "View HRM Settings", module: "Settings" },
  { id: "edit_hrm_settings", name: "edit_hrm", label: "Edit HRM Settings", module: "Settings" },

  // Settings - Tasks
  { id: "view_tasks_settings", name: "view_tasks", label: "View Tasks Settings", module: "Settings" },
  { id: "edit_tasks_settings", name: "edit_tasks", label: "Edit Tasks Settings", module: "Settings" },

  // Settings - KPI
  { id: "view_kpi_settings", name: "view_kpi", label: "View KPI Settings", module: "Settings" },
  { id: "edit_kpi_settings", name: "edit_kpi", label: "Edit KPI Settings", module: "Settings" },

  // Settings - Notifications
  { id: "view_notifications_settings", name: "view_notif", label: "View Notifications Settings", module: "Settings" },
  { id: "edit_notifications_settings", name: "edit_notif", label: "Edit Notifications Settings", module: "Settings" },

  // Settings - Email
  { id: "view_email_settings", name: "view_email", label: "View Email Settings", module: "Settings" },
  { id: "edit_email_settings", name: "edit_email", label: "Edit Email Settings", module: "Settings" },

  // System Logs
  { id: "view_logs", name: "view_logs", label: "View System Logs", module: "System Logs" },
  { id: "manage_logs", name: "manage_logs", label: "Manage Logs (Retry)", module: "System Logs" },

  // Overtime
  { id: "overtime_view", name: "view", label: "View Overtime Tab", module: "Overtime" },
  { id: "overtime_management", name: "manage", label: "Manage Overtime (Edit/Calculate)", module: "Overtime" },

  // Messaging
  { id: "use_messaging", name: "use", label: "Use Messaging", module: "Messaging" },
  { id: "create_groups", name: "create_groups", label: "Create Group Chats", module: "Messaging" },
  { id: "manage_own_groups", name: "manage_groups", label: "Manage Own Groups", module: "Messaging" },
  { id: "delete_any_message", name: "delete_any", label: "Delete Any Message (Admin)", module: "Messaging" },
  { id: "bypass_privacy_mode", name: "bypass_privacy", label: "Bypass Privacy Mode", module: "Messaging" },
  { id: "export_chat_history", name: "export", label: "Export Chat History", module: "Messaging" },

  // Recruitment
  { id: "manage_recruitment", name: "manage_recruitment", label: "Manage Recruitment (Jobs & Candidates)", module: "Recruitment" },

  // AI Intelligence Capability Gating
  { id: "use_ai", name: "use_ai", label: "Use AI Assistant (Base Access)", module: "AI Intelligence" },
  { id: "ai_help", name: "ai_help", label: "AI Help & Knowledge Base Queries", module: "AI Intelligence" },
  { id: "ai_documents", name: "ai_documents", label: "AI Document Generation", module: "AI Intelligence" },
  { id: "ai_actions", name: "ai_actions", label: "AI System Actions (Execute on Behalf)", module: "AI Intelligence" },
  { id: "ai_full", name: "ai_full", label: "Full AI Suite (All Capabilities)", module: "AI Intelligence" },

  // Notification Preferences
  { id: "view_notification_preferences", name: "view_preferences", label: "View Notification Preferences", module: "Notifications" },
  { id: "manage_notification_preferences", name: "manage_preferences", label: "Manage Notification Preferences (Admin)", module: "Notifications" },

  // Dynamic Approvals
  { id: "view_approval_rules", name: "view_approval_rules", label: "View Approval Workflows & Rules", module: "Dynamic Approvals" },
  { id: "manage_approval_rules", name: "manage_approval_rules", label: "Manage Approval Rules & Workflows", module: "Dynamic Approvals" },
  { id: "approve_requests", name: "approve_requests", label: "Approve or Reject Approval Requests", module: "Dynamic Approvals" },
  { id: "view_approval_requests", name: "view_approval_requests", label: "View Approval Requests & History", module: "Dynamic Approvals" },
];

function AccessControl() {
  const { hasPermission, user } = useAuth();

  // Permission checks with explicit Owner bypass
  const isOwner = user?.role?.toLowerCase() === 'owner' || (user as any)?.role_name?.toLowerCase() === 'owner';
  const canCreate = hasPermission("create_roles") || isOwner;
  const canEdit = hasPermission("edit_roles") || isOwner;
  const canDelete = hasPermission("delete_roles") || isOwner;

  // TanStack Query hooks
  const {
    rolesQuery,
    createRoleMutation,
    updateRoleMutation,
    deleteRoleMutation,
    updatePermissionsMutation,
  } = useRolesWithMutations();

  const roles = rolesQuery.data || [];
  const isLoading = rolesQuery.isLoading;

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreateEditModalOpen, setIsCreateEditModalOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDeleteId, setRoleToDeleteId] = useState<string | null>(null);

  // Local state for permission editing (allows batch changes before saving)
  const [localPermissions, setLocalPermissions] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  // Sync local permissions when role selection changes
  useEffect(() => {
    if (selectedRole) {
      setLocalPermissions(selectedRole.permissions || []);
      setHasUnsavedChanges(false);
    }
  }, [selectedRole?.id, selectedRole?.permissions]);

  const handleCreateRole = () => {
    setRoleToEdit(null);
    setIsCreateEditModalOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setRoleToEdit(role);
    setIsCreateEditModalOpen(true);
  };

  const handleDeleteRole = (roleId: string) => {
    setRoleToDeleteId(roleId);
    setIsDeleteModalOpen(true);
  };

  const handleSaveRole = (
    id: string | null,
    name: string,
    description: string
  ) => {
    if (id) {
      updateRoleMutation.mutate({ id, data: { name, description } }, {
        onSuccess: () => setIsCreateEditModalOpen(false),
      });
    } else {
      createRoleMutation.mutate({ name, description }, {
        onSuccess: () => setIsCreateEditModalOpen(false),
      });
    }
  };

  const handleConfirmDeleteRole = () => {
    if (roleToDeleteId) {
      deleteRoleMutation.mutate(roleToDeleteId, {
        onSuccess: () => {
          if (selectedRoleId === roleToDeleteId) {
            setSelectedRoleId(null);
          }
          setRoleToDeleteId(null);
          setIsDeleteModalOpen(false);
        },
      });
    }
  };

  // Toggle permission locally (no API call yet)
  const handleTogglePermission = (permissionId: string) => {
    if (!selectedRole || !canEdit) return;

    setLocalPermissions(prev => {
      const newPermissions = prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId];
      return newPermissions;
    });
    setHasUnsavedChanges(true);
  };

  // Toggle entire module locally
  const handleToggleModule = (moduleName: string, allSelected: boolean) => {
    if (!selectedRole || !canEdit) return;

    const modulePermissionIds = permissions
      .filter((perm) => perm.module === moduleName)
      .map((perm) => perm.id);

    setLocalPermissions(prev => {
      let newPermissions = [...prev];
      if (allSelected) {
        newPermissions = newPermissions.filter((id) => !modulePermissionIds.includes(id));
      } else {
        const permsToAdd = modulePermissionIds.filter((id) => !newPermissions.includes(id));
        newPermissions = [...newPermissions, ...permsToAdd];
      }
      return newPermissions;
    });
    setHasUnsavedChanges(true);
  };

  // Save changes to server
  const handleSavePermissions = () => {
    if (!selectedRole || !hasUnsavedChanges) return;

    updatePermissionsMutation.mutate(
      { id: selectedRole.id, permissions: localPermissions },
      {
        onSuccess: () => {
          setHasUnsavedChanges(false);
          toast.success("Permissions saved successfully!");
        },
        onError: () => {
          toast.error("Failed to save permissions");
        },
      }
    );
  };

  // Discard local changes
  const handleDiscardChanges = () => {
    if (selectedRole) {
      setLocalPermissions(selectedRole.permissions || []);
      setHasUnsavedChanges(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Access Control
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage roles and permissions for system access.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => rolesQuery.refetch()}
            disabled={rolesQuery.isRefetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${rolesQuery.isRefetching ? 'animate-spin' : ''}`} />
            {rolesQuery.isRefetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 md:w-80 flex-shrink-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <RoleList
                roles={roles}
                selectedRoleId={selectedRoleId}
                onCreateRole={handleCreateRole}
                onSelectRole={(roleId) => {
                  // Warn if unsaved changes
                  if (hasUnsavedChanges) {
                    if (!confirm("You have unsaved changes. Discard and switch role?")) {
                      return;
                    }
                  }
                  setSelectedRoleId(roleId);
                }}
                onEditRole={handleEditRole}
                onDeleteRole={handleDeleteRole}
                canCreate={canCreate}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            )}
          </aside>

          <main className="flex-1 flex flex-col min-w-0 bg-muted/10">
            {selectedRole ? (
              <div className="flex flex-col h-full">
                <div className="px-6 py-4 border-b bg-primary/5 border-primary/20 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-2 w-2 rounded-full ${hasUnsavedChanges ? 'bg-amber-500' : 'bg-primary'} animate-pulse`} />
                      <span className="text-xs font-medium text-primary uppercase tracking-wide">
                        {hasUnsavedChanges ? 'Unsaved Changes' : 'Editing Role'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground">
                      {selectedRole.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedRole.description}
                    </p>
                  </div>

                  {/* Save / Discard Buttons */}
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {hasUnsavedChanges && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDiscardChanges}
                          disabled={updatePermissionsMutation.isPending}
                        >
                          Discard
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSavePermissions}
                        disabled={!hasUnsavedChanges || updatePermissionsMutation.isPending}
                      >
                        {updatePermissionsMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <PermissionMatrix
                  permissions={permissions}
                  selectedPermissionIds={localPermissions}
                  onTogglePermission={handleTogglePermission}
                  onToggleModule={handleToggleModule}
                  disabled={!canEdit || updatePermissionsMutation.isPending}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a role to view permissions.
              </div>
            )}
          </main>
        </div>
      </div>
      <CreateEditRoleModal
        isOpen={isCreateEditModalOpen}
        onClose={() => setIsCreateEditModalOpen(false)}
        onSave={handleSaveRole}
        role={roleToEdit}
      />
      <DeleteRoleModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteRole}
        roleName={roles.find((role) => role.id === roleToDeleteId)?.name || ""}
      />
    </>
  );
}
export default AccessControl;
