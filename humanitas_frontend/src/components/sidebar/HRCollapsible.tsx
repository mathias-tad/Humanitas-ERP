import { NavLink } from "react-router-dom";
import {
  ChevronRight,
  DollarSign,
  Receipt,
  Play,
  FileBarChart,
  UserCheck,
  Clock,
  Eye,
  CalendarCheck,
  FileText,
  ClipboardList,
  Wallet,
  Banknote,
  Settings,
  Sparkles,
  CalendarClock,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AttendanceCollapsible } from "./AttendanceCollapsible";
import { LeaveCollapsible } from "./LeaveCollapsible";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useModules } from "@/context/ModuleContext";

interface HRCollapsibleProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isAttendanceOpen: boolean;
  onAttendanceOpenChange: (open: boolean) => void;
  isLeaveOpen: boolean;
  onLeaveOpenChange: (open: boolean) => void;
}

export function HRCollapsible({
  isOpen,
  onOpenChange,
  isAttendanceOpen,
  onAttendanceOpenChange,
  isLeaveOpen,
  onLeaveOpenChange,
}: HRCollapsibleProps) {
  const { state, isMobile, openMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !(isMobile && openMobile);
  const { hasAnyPermission } = useAuth();

  const [popoverAttendanceOpen, setPopoverAttendanceOpen] = useState(false);
  const [popoverLeaveOpen, setPopoverLeaveOpen] = useState(false);

  const allPayrollItems = [
    { to: "/payroll/dashboard", icon: DollarSign, label: "Payroll Dashboard", permissions: ["view_payroll_dashboard", "view_payroll"] },
    { to: "/payroll/run", icon: Play, label: "Run Payroll", permissions: ["run_payroll"] },
    { to: "/payroll/my-payslip", icon: Receipt, label: "My Payslip", permissions: ["view_my_payslip", "view_payroll"] },
    { to: "/my-loans", icon: Banknote, label: "My Loans", permissions: [] }, // Accessible to all
    { to: "/per-diem-claims", icon: Wallet, label: "Per Diem Claims", permissions: ["view_my_payslip", "view_payroll"] },
    { to: "/admin/per-diem-claims", icon: ClipboardList, label: "Review Claims", permissions: ["manage_payroll"] },
    { to: "/payroll/loans", icon: Banknote, label: "Loan Management", permissions: ["manage_loans"] },
    { to: "/payroll/loan-workflow", icon: Settings, label: "Loan Workflow", permissions: ["manage_loan_workflows"] },
  ];

  const allAttendanceItems = [
    { to: "/attendance/view", icon: Eye, label: "Attendance", permissions: ["view_attendance", "edit_attendance", "correct_attendance"] },
    { to: "/attendance/my-attendance", icon: UserCheck, label: "My Attendance", permissions: ["view_my_attendance", "view_attendance"] },
    { to: "/attendance/overtime-monitor", icon: Clock, label: "Real-Time OT Monitor", permissions: ["view_overtime_workers"] },
  ];

  const allLeaveItems = [
    { to: "/leave/requests", icon: FileText, label: "Leave requests", permissions: ["view_leave", "approve_leave"] },
    { to: "/leave/my-requests", icon: ClipboardList, label: "My Requests", permissions: ["view_my_leave", "request_leave"] },
    { to: "/leave/balances", icon: FileBarChart, label: "Leave Balances", permissions: ["manage_leave", "view_leave"] },
    { to: "/leave/workflow", icon: Settings, label: "Workflow Settings", permissions: ["manage_leave", "approve_leave"] },
  ];

  const allSchedulingItems = [
    { to: "/hr/scheduling", icon: CalendarClock, label: "Scheduling & Roster", permissions: ["manage_schedules", "view_roster", "manage_roster", "view_shifts", "manage_shifts"] },
  ];

  const allRecruitmentItems = [
    { to: "/recruitment", icon: Sparkles, label: "AI Screening", permissions: ["manage_recruitment", "view_hrm_settings", "view_dashboard"] },
  ];

  const { isModuleSubscribed } = useModules();

  const isPayrollSubscribed = isModuleSubscribed("payroll");
  const isAttendanceSubscribed = isModuleSubscribed("attendance");
  const isLeaveSubscribed = isModuleSubscribed("leave");
  const isRecruitmentSubscribed = isModuleSubscribed("recruitment");
  const isSchedulingSubscribed = isModuleSubscribed("hrms") || isModuleSubscribed("hr") || isModuleSubscribed("attendance") || isModuleSubscribed("scheduling");

  // Filter items based on permissions AND module subscription
  const payrollItems = isPayrollSubscribed
    ? allPayrollItems.filter(item => item.permissions.length === 0 || hasAnyPermission(item.permissions))
    : [];
  const attendanceItems = isAttendanceSubscribed
    ? allAttendanceItems.filter(item => hasAnyPermission(item.permissions))
    : [];
  const leaveItems = isLeaveSubscribed
    ? allLeaveItems.filter(item => hasAnyPermission(item.permissions))
    : [];
  const schedulingItems = isSchedulingSubscribed
    ? allSchedulingItems.filter(item => item.permissions.length === 0 || hasAnyPermission(item.permissions))
    : [];
  const recruitmentItems = isRecruitmentSubscribed
    ? allRecruitmentItems.filter(item => hasAnyPermission(item.permissions))
    : [];

  // Check if any HR section is accessible
  const hasAnyHRAccess = payrollItems.length > 0 || attendanceItems.length > 0 || leaveItems.length > 0 || schedulingItems.length > 0 || recruitmentItems.length > 0;

  if (!hasAnyHRAccess) {
    return null;
  }

  // Render popover menu when collapsed
  if (isCollapsed) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="HR"
              className="justify-center flex items-center rounded-md transition-all duration-200 font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <UserCheck
                size={20}
                className="shrink-0"
                style={{
                  color: "currentColor",
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          className="w-56 p-2"
          sideOffset={8}
        >
          <div className="flex flex-col gap-1">
            <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
              HR
            </div>

            {/* Attendance Section */}
            {attendanceItems.length > 0 && (
              <div className="border-b pb-1 mb-1">
                <button
                  onClick={() => setPopoverAttendanceOpen(!popoverAttendanceOpen)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground w-full"
                >
                  <Clock className="h-4 w-4" />
                  <span className="flex-1 text-left">Attendance</span>
                  <ChevronRight className={`h-3 w-3 transition-transform ${popoverAttendanceOpen ? 'rotate-90' : ''}`} />
                </button>
                {popoverAttendanceOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {attendanceItems.map((item) => (
                      <NavLink key={item.to} to={item.to}>
                        {({ isActive }) => (
                          <div
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`}
                          >
                            <item.icon className="h-3 w-3" />
                            <span>{item.label}</span>
                          </div>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Leave Section */}
            {leaveItems.length > 0 && (
              <div className="border-b pb-1 mb-1">
                <button
                  onClick={() => setPopoverLeaveOpen(!popoverLeaveOpen)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground w-full"
                >
                  <CalendarCheck className="h-4 w-4" />
                  <span className="flex-1 text-left">Leave</span>
                  <ChevronRight className={`h-3 w-3 transition-transform ${popoverLeaveOpen ? 'rotate-90' : ''}`} />
                </button>
                {popoverLeaveOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {leaveItems.map((item) => (
                      <NavLink key={item.to} to={item.to}>
                        {({ isActive }) => (
                          <div
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`}
                          >
                            <item.icon className="h-3 w-3" />
                            <span>{item.label}</span>
                          </div>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Scheduling & Roster Section */}
            {schedulingItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {({ isActive }) => (
                  <div
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                )}
              </NavLink>
            ))}

            {/* Payroll Items */}
            {payrollItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {({ isActive }) => (
                  <div
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                )}
              </NavLink>
            ))}

            {/* Recruitment / AI Screening */}
            {recruitmentItems.length > 0 && (
              <div className="border-t pt-1 mt-1">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Recruitment</div>
                {recruitmentItems.map((item) => (
                  <NavLink key={item.to} to={item.to}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Render normal collapsible when expanded
  return (
    <Collapsible
      asChild
      className="group/collapsible-hr"
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip="HR"
            className="!pl-2 flex items-center gap-3 rounded-md transition-all duration-200 font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <div
              className="flex items-center gap-3 w-full text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
              style={{ fontFamily: "Roboto" }}
            >
              <UserCheck
                style={{
                  width: "17px",
                  height: "17px",
                  fontWeight: "bold",
                  color: "currentColor",
                }}
              />
              <span>HR</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible-hr:rotate-90" />
            </div>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {isAttendanceSubscribed && (
              <AttendanceCollapsible
                isOpen={isAttendanceOpen}
                onOpenChange={onAttendanceOpenChange}
              />
            )}
            {isLeaveSubscribed && (
              <LeaveCollapsible
                isOpen={isLeaveOpen}
                onOpenChange={onLeaveOpenChange}
              />
            )}

            {/* Scheduling & Roster Items */}
            {schedulingItems.map((item) => (
              <SidebarMenuSubItem key={item.to}>
                <SidebarMenuSubButton asChild className="!px-0">
                  <NavLink to={item.to}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}

            {/* Payroll Items */}
            {payrollItems.map((item) => (
              <SidebarMenuSubItem key={item.to}>
                <SidebarMenuSubButton asChild className="!px-0">
                  <NavLink to={item.to}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}

            {/* Recruitment / AI Screening Items */}
            {recruitmentItems.map((item) => (
              <SidebarMenuSubItem key={item.to}>
                <SidebarMenuSubButton asChild className="!px-0">
                  <NavLink to={item.to}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <item.icon className="h-4 w-4 text-yellow-500" />
                        <span>{item.label}</span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
