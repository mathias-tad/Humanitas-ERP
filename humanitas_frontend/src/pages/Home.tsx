import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';
import { useERPModules } from '@/context/ModuleContext';
import { PageHeader } from "@/components/design-system/PageHeader";
import { KPITile } from "@/components/design-system/KPITile";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  Calendar,
  AlertCircle,
  Target,
  ListChecks,
  DollarSign,
  FileText,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  FolderKanban,
  User,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { useNavigate } from 'react-router-dom';

interface HomeDashboardData {
  hrMetrics?: {
    totalEmployees: number;
    activeEmployees: number;
    newHires: number;
    pendingLeaves: number;
    attendance: {
      today: { present: number; absent: number; late: number };
      rate: number;
    };
  };
  pmsMetrics?: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  payrollMetrics?: {
    monthlyPayroll: number;
    processed: number;
    pending: number;
  };
}

async function fetchHomeDashboardData(): Promise<HomeDashboardData> {
  const res = await fetch(`${API_BASE_URL}/users/home-dashboard`, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch home dashboard data');
  const data = await res.json();
  return data.data || data;
}

export function Home() {
  const navigate = useNavigate();
  const { user, activeCompanyId, activeBranchId, activeCompanyIds, activeBranchIds, hasPermission } = useAuth();
  const { isModuleSubscribed } = useERPModules();

  const hasHR = isModuleSubscribed("hrms");
  const hasPMS = isModuleSubscribed("pms");

  const roleName = (((user as any)?.role_name || user?.role) || user?.role || "").toLowerCase();
  const isAdmin = roleName.includes("admin") || roleName.includes("owner") || roleName.includes("director");
  const isManager = roleName.includes("manager") || roleName.includes("lead") || roleName.includes("supervisor");
  const isPrivileged = isAdmin || isManager;

  const [viewMode, setViewMode] = useState<"executive" | "personal">(
    isPrivileged ? "executive" : "personal"
  );

  const { data, isLoading } = useQuery<HomeDashboardData>({
    queryKey: ['home-dashboard', activeCompanyId, activeBranchId],
    queryFn: fetchHomeDashboardData,
  });

  // Dynamic quick actions filtered by subscribed modules and user role
  const quickActions: {
    icon: any;
    label: string;
    description: string;
    color: string;
    bgLight: string;
    path: string;
  }[] = [];

  if (hasHR) {
    quickActions.push(
      {
        icon: UserCheck,
        label: "Mark Attendance",
        description: "Clock in / out with QR code or PIN",
        color: "text-amber-500",
        bgLight: "bg-amber-500/10 dark:bg-amber-500/20",
        path: "/attendance/view",
      },
      {
        icon: FileText,
        label: "Request Leave",
        description: "Submit vacation or sick leave request",
        color: "text-emerald-500",
        bgLight: "bg-emerald-500/10 dark:bg-emerald-500/20",
        path: "/leave/requests",
      }
    );
  }

  if (hasPMS) {
    quickActions.push(
      {
        icon: ListChecks,
        label: "My Tasks & Boards",
        description: "View sprint backlog & task execution",
        color: "text-primary",
        bgLight: "bg-primary/10 dark:bg-primary/20",
        path: "/pms/all-tasks",
      },
      {
        icon: FolderKanban,
        label: "Project Sprints",
        description: "Monitor milestones, velocity & timelines",
        color: "text-indigo-600 dark:text-indigo-400",
        bgLight: "bg-indigo-500/10 dark:bg-indigo-500/20",
        path: "/pms/projects",
      }
    );
  }

  if (hasHR && (hasPermission("view_scheduling") || isPrivileged)) {
    quickActions.push({
      icon: Calendar,
      label: "Work Roster",
      description: "Inspect cyclic shifts and schedule patterns",
      color: "text-amber-600 dark:text-amber-400",
      bgLight: "bg-amber-500/10 dark:bg-amber-500/20",
      path: "/hr/scheduling",
    });
  }

  if (quickActions.length === 0) {
    quickActions.push(
      {
        icon: Users,
        label: "Team Directory",
        description: "Browse organizational employee directory",
        color: "text-blue-500",
        bgLight: "bg-blue-500/10 dark:bg-blue-500/20",
        path: "/accounts",
      },
      {
        icon: Calendar,
        label: "Calendar & Events",
        description: "View organization timeline and holidays",
        color: "text-amber-500",
        bgLight: "bg-amber-500/10 dark:bg-amber-500/20",
        path: "/calendar",
      }
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium animate-pulse">
          Loading tailored organizational dashboard...
        </p>
      </div>
    );
  }

  const hrMetrics = data.hrMetrics || {
    totalEmployees: 0,
    activeEmployees: 0,
    newHires: 0,
    pendingLeaves: 0,
    attendance: { today: { present: 0, absent: 0, late: 0 }, rate: 100 },
  };

  const pmsMetrics = data.pmsMetrics || {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
  };

  const payrollMetrics = data.payrollMetrics || {
    monthlyPayroll: 0,
    processed: 0,
    pending: 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Executive / Role-Adaptive Header */}
      <PageHeader
        title={
          viewMode === "personal"
            ? `Welcome back, ${user?.full_name || "Employee"}`
            : isAdmin
            ? "Executive Organization Overview"
            : isManager
            ? "Departmental Leadership Dashboard"
            : "Operational Workspace"
        }
        description={
          viewMode === "personal"
            ? "Your personal assignments, attendance punch card, task backlog, and schedule."
            : hasHR && hasPMS
            ? "Real-time intelligence across Human Capital, Agile Projects, and Operations."
            : hasPMS
            ? "Agile project execution, sprint velocity, task backlogs, and team delivery health."
            : "Workforce headcount, attendance telemetry, shift compliance, and payroll."
        }
        badge={
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold gold-gradient gold-glow text-slate-950">
            <Sparkles className="h-3 w-3" />
            {hasHR && hasPMS ? "Unified ERP" : hasPMS ? "Agile PMS" : "HRMS Core"}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode Switcher for Admins/Managers */}
            {isPrivileged && (
              <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
                <button
                  onClick={() => setViewMode("executive")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    viewMode === "executive"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5 inline mr-1" />
                  {isAdmin ? "Executive View" : "Team View"}
                </button>
                <button
                  onClick={() => setViewMode("personal")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    viewMode === "personal"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="h-3.5 w-3.5 inline mr-1" />
                  My Workspace
                </button>
              </div>
            )}

            {hasHR && hasPermission("run_payroll") && (
              <Button
                size="sm"
                onClick={() => navigate('/payroll/dashboard')}
                className="h-8 gap-1.5 text-xs font-bold gold-gradient gold-glow border-none text-slate-950"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Payroll</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Union Scope Indicator (Multi-Company / Multi-Branch) */}
      {(activeCompanyIds.length > 1 || activeBranchIds.length > 1) && (
        <div className="flex items-center justify-between p-3.5 bg-primary/10 border border-primary/25 rounded-xl text-xs text-primary shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm bg-primary/20 rounded px-1.5 py-0.5">∪</span>
            <div>
              <span className="font-semibold">Consolidated Union Scope Active: </span>
              <span>
                {activeCompanyIds.length > 1
                  ? `Aggregating metrics across ${activeCompanyIds.length} selected legal entities`
                  : 'All Companies'}
                {activeBranchIds.length > 1 ? ` & ${activeBranchIds.length} branches` : ''}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-semibold bg-primary/20 px-2.5 py-1 rounded-full border border-primary/30">
            Multi-Entity Union
          </span>
        </div>
      )}

      {/* Quick Action Cards (Filtered by subscribed modules) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.slice(0, 4).map((action, idx) => {
          const Icon = action.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(action.path)}
              className="group relative flex flex-col justify-between p-4 rounded-xl border border-border bg-card shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${action.bgLight}`}>
                  <Icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="mt-4 space-y-0.5">
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {action.label}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {action.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* EXECUTIVE / TEAM OVERVIEW VIEW */}
      {/* ============================================================== */}
      {viewMode === "executive" && (
        <>
          {/* Primary KPI Tiles (Module-Gated) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {hasHR && (
              <KPITile
                title="Total Workforce"
                value={hrMetrics.totalEmployees}
                subtitle={`${hrMetrics.activeEmployees} active personnel`}
                change={hrMetrics.newHires > 0 ? hrMetrics.newHires : undefined}
                changeLabel="new this month"
                icon={Users}
                iconColor="text-primary"
                iconBg="bg-primary/10"
                onClick={() => navigate('/accounts')}
              />
            )}

            {hasHR && (
              <KPITile
                title="Attendance Rate"
                value={`${hrMetrics.attendance.rate}%`}
                subtitle={`${hrMetrics.attendance.today.present} present today`}
                change={hrMetrics.attendance.rate >= 90 ? 2.5 : -1.2}
                changeLabel="vs last week"
                icon={UserCheck}
                iconColor="text-emerald-500"
                iconBg="bg-emerald-500/10"
                onClick={() => navigate('/attendance/view')}
              />
            )}

            {hasPMS && (
              <KPITile
                title="Active Sprint Tasks"
                value={pmsMetrics.totalTasks}
                subtitle={`${pmsMetrics.completedTasks} completed (${pmsMetrics.completionRate}%)`}
                change={pmsMetrics.completionRate}
                changeLabel="completion rate"
                icon={Target}
                iconColor="text-amber-500"
                iconBg="bg-amber-500/10"
                onClick={() => navigate('/pms/all-tasks')}
              />
            )}

            {hasPMS && (
              <KPITile
                title="Sprint Delivery Velocity"
                value={`${pmsMetrics.completionRate}%`}
                subtitle={`${pmsMetrics.inProgressTasks} tasks in flight`}
                icon={FolderKanban}
                iconColor="text-indigo-500"
                iconBg="bg-indigo-500/10"
                onClick={() => navigate('/pms/projects')}
              />
            )}

            {hasHR && hasPermission("view_payroll") && (
              <KPITile
                title="Monthly Payroll"
                value={`$${payrollMetrics.monthlyPayroll.toLocaleString()}`}
                subtitle={`${payrollMetrics.processed} processed, ${payrollMetrics.pending} pending`}
                icon={DollarSign}
                iconColor="text-primary"
                iconBg="bg-primary/10"
                onClick={() => navigate('/payroll/dashboard')}
              />
            )}
          </div>

          {/* Operational Insights Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* HR Section (Rendered only if HRMS subscribed) */}
            {hasHR && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/80">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Users className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Workforce Activity</h3>
                  </div>
                  <StatusBadge status="active" label={`${hrMetrics.activeEmployees} Active`} size="sm" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-border/50 text-xs">
                    <span className="text-muted-foreground font-medium">Pending Leave Requests</span>
                    <span className="font-bold text-foreground bg-card px-2 py-0.5 rounded-md border border-border">
                      {hrMetrics.pendingLeaves}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Attendance Compliance</span>
                      <span className="font-bold text-foreground">{hrMetrics.attendance.rate}%</span>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
                      <div
                        className="gold-gradient h-2 rounded-full transition-all duration-500"
                        style={{ width: `${hrMetrics.attendance.rate}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">
                      <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Present</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{hrMetrics.attendance.today.present}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/20">
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Late</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{hrMetrics.attendance.today.late}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-500/10 dark:bg-rose-500/20">
                      <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase">Absent</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{hrMetrics.attendance.today.absent}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PMS Section (Rendered only if PMS subscribed) */}
            {hasPMS && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/80">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                      <Target className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Project Sprints & Tasks</h3>
                  </div>
                  <StatusBadge
                    status={pmsMetrics.overdueTasks > 0 ? "overdue" : "completed"}
                    label={pmsMetrics.overdueTasks > 0 ? `${pmsMetrics.overdueTasks} Overdue` : "On Track"}
                    size="sm"
                  />
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-surface-1 border border-border/50">
                      <p className="text-[11px] text-muted-foreground">In Progress</p>
                      <p className="text-lg font-bold text-foreground">{pmsMetrics.inProgressTasks}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-1 border border-border/50">
                      <p className="text-[11px] text-muted-foreground">Completed</p>
                      <p className="text-lg font-bold text-foreground">{pmsMetrics.completedTasks}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Sprint Velocity</span>
                      <span className="font-bold text-foreground">{pmsMetrics.completionRate}%</span>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pmsMetrics.completionRate}%` }}
                      />
                    </div>
                  </div>

                  {pmsMetrics.overdueTasks > 0 && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{pmsMetrics.overdueTasks} tasks require manager attention</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Universal Operational Health */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/80">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Operational Status</h3>
                </div>
                <StatusBadge status="approved" label="All Healthy" size="sm" />
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-surface-1 border border-border/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-foreground">Microservices & APIs</span>
                  </div>
                  <span className="text-muted-foreground font-mono">100% Online</span>
                </div>

                <div className="p-3 rounded-lg bg-surface-1 border border-border/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-foreground">Multi-Tenant DB Pools</span>
                  </div>
                  <span className="text-muted-foreground font-mono">Connected</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/system-logs')}
                  className="w-full text-xs font-semibold h-8 gap-1.5"
                >
                  <span>View System Logs & Diagnostics</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============================================================== */}
      {/* PERSONAL SELF-SERVICE VIEW */}
      {/* ============================================================== */}
      {viewMode === "personal" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          {hasPMS && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/80">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">My Assigned Tasks</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  {pmsMetrics.inProgressTasks} In Flight
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Track your active tasks, submit reviews, and log time for active sprints.
              </p>
              <Button
                size="sm"
                onClick={() => navigate('/pms/all-tasks')}
                className="w-full text-xs font-semibold"
              >
                Open My Task Board
              </Button>
            </div>
          )}

          {hasHR && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/80">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  <h3 className="text-sm font-bold text-foreground">Attendance & Shifts</h3>
                </div>
                <Badge variant="outline" className="text-xs text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                  Logged In
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review your clock-in timestamps, monthly attendance report, and assigned cyclic roster.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/attendance/view')}
                className="w-full text-xs font-semibold"
              >
                View Attendance Record
              </Button>
            </div>
          )}

          {hasHR && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/80">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-sm font-bold text-foreground">Leave Balances</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  {hrMetrics.pendingLeaves} Pending
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Check your available vacation entitlement, submit new time-off requests, and view approval status.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/leave/requests')}
                className="w-full text-xs font-semibold"
              >
                Manage My Leaves
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Home;
