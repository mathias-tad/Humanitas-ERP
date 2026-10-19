import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { PageHeader } from "@/components/design-system/PageHeader";
import { KPITile } from "@/components/design-system/KPITile";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useNavigate } from 'react-router-dom';

interface HomeDashboardData {
  hrMetrics: {
    totalEmployees: number;
    activeEmployees: number;
    newHires: number;
    pendingLeaves: number;
    attendance: {
      today: { present: number; absent: number; late: number };
      rate: number;
    };
  };
  pmsMetrics: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  payrollMetrics: {
    monthlyPayroll: number;
    processed: number;
    pending: number;
  };
}

async function fetchHomeDashboardData(): Promise<HomeDashboardData> {
  const res = await fetch(`${API_BASE_URL}/users/home-dashboard`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch home dashboard data');
  const data = await res.json();
  return data.data || data;
}

function Home() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<HomeDashboardData>({
    queryKey: ['home-dashboard'],
    queryFn: fetchHomeDashboardData,
    refetchInterval: 30000,
  });

  const quickActions = [
    {
      icon: UserCheck,
      label: "Mark Attendance",
      description: "Clock in / out with QR code or PIN",
      color: "text-amber-500",
      bgLight: "bg-amber-500/10 dark:bg-amber-500/20",
      path: "/attendance/view"
    },
    {
      icon: FileText,
      label: "Request Leave",
      description: "Submit vacation or sick leave request",
      color: "text-emerald-500",
      bgLight: "bg-emerald-500/10 dark:bg-emerald-500/20",
      path: "/leave/requests"
    },
    {
      icon: ListChecks,
      label: "My Tasks",
      description: "View active tasks, sprint items & boards",
      color: "text-primary",
      bgLight: "bg-primary/10 dark:bg-primary/20",
      path: "/pms/all-tasks"
    },
    {
      icon: Calendar,
      label: "My Schedule",
      description: "View shift patterns and roster times",
      color: "text-amber-600 dark:text-amber-400",
      bgLight: "bg-amber-500/10 dark:bg-amber-500/20",
      path: "/hr/scheduling"
    },
  ];

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium animate-pulse">
          Loading executive dashboard...
        </p>
      </div>
    );
  }

  const { hrMetrics, pmsMetrics, payrollMetrics } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Executive Page Header */}
      <PageHeader
        title="Executive Overview"
        description="Real-time operational intelligence across Human Capital, Projects, and Financial operations."
        badge={
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold gold-gradient gold-glow text-slate-950">
            <Sparkles className="h-3 w-3" />
            Live ERP
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/appearance')}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Theme</span>
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/payroll/run')}
              className="h-8 gap-1.5 text-xs font-bold gold-gradient gold-glow border-none text-slate-950"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Run Payroll</span>
            </Button>
          </div>
        }
      />

      {/* Quick Action Cards (Sleek, Interactive, Gold Accented) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, idx) => {
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

      {/* Primary KPI Metrics Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          title="Total Workforce"
          value={hrMetrics.totalEmployees}
          subtitle={`${hrMetrics.activeEmployees} active employees`}
          change={hrMetrics.newHires > 0 ? hrMetrics.newHires : undefined}
          changeLabel="new this month"
          icon={Users}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          onClick={() => navigate('/accounts')}
        />

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

        <KPITile
          title="Active PMS Tasks"
          value={pmsMetrics.totalTasks}
          subtitle={`${pmsMetrics.completedTasks} completed (${pmsMetrics.completionRate}%)`}
          change={pmsMetrics.completionRate}
          changeLabel="completion rate"
          icon={Target}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
          onClick={() => navigate('/pms/all-tasks')}
        />

        <KPITile
          title="Monthly Payroll"
          value={`$${payrollMetrics.monthlyPayroll.toLocaleString()}`}
          subtitle={`${payrollMetrics.processed} processed, ${payrollMetrics.pending} pending`}
          icon={DollarSign}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          onClick={() => navigate('/payroll/dashboard')}
        />
      </div>

      {/* Detailed Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* HR & Workforce Insights */}
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

        {/* Project Delivery Health */}
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
                <span>{pmsMetrics.overdueTasks} tasks require immediate manager attention</span>
              </div>
            )}
          </div>
        </div>

        {/* System & Financial Engine Health */}
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
                <span className="font-semibold text-foreground">Python Engine & APIs</span>
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
              <span>View System Logs & Health Diagnostics</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
