import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Users,
  Trophy,
  PieChart,
  Target,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { usePMS, TaskStatus, ProjectStatus } from "@/hooks/usePMS";
import { useAuth } from "@/context/AuthContext";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ReportExportMenu } from "@/components/common/ReportExportMenu";

type DatePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

const periodLabels: Record<DatePeriod, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  all: 'All Time',
};

// Helper to get date range
const getDateRange = (period: DatePeriod): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      // Already set to today
      break;
    case 'week':
      start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      break;
    case 'month':
      start.setDate(1); // Start of month
      break;
    case 'year':
      start.setMonth(0, 1); // Jan 1st
      break;
    case 'all':
      start = new Date(0); // Beginning of time
      break;
  }

  return { start, end };
};





export default function PMSReports() {
  const { useTasks, useProjects, useUsers, useAllUsersKPIs, useTenantKPIs, useTimeTrackingSummary } = usePMS();
  const { tenant } = useAuth();
  const [period, setPeriod] = useState<DatePeriod>('month');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeReportProjectId, setTimeReportProjectId] = useState<string>('');

  const { data: allTasks = [], isLoading: loadingTasks, refetch: refetchTasks } = useTasks({});
  const { data: projects = [], isLoading: loadingProjects, refetch: refetchProjects } = useProjects();
  const { isLoading: loadingUsers, refetch: refetchUsers } = useUsers();
  const { data: allUsersKPIs = [], isLoading: loadingKPIs, refetch: refetchKPIs } = useAllUsersKPIs();
  const { data: tenantKPIs, isLoading: loadingTenantKPIs, refetch: refetchTenantKPIs } = useTenantKPIs(tenant?.id || '');

  const activeTimeProjectId = timeReportProjectId || (projects[0]?.id ?? '');
  const { data: timeSummary, isLoading: loadingTimeSummary } = useTimeTrackingSummary(activeTimeProjectId);

  // Filter tasks by date period
  const tasks = useMemo(() => {
    const { start, end } = getDateRange(period);
    return allTasks.filter(t => {
      const taskDate = new Date(t.created_at);
      return taskDate >= start && taskDate <= end;
    });
  }, [allTasks, period]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchTasks(),
        refetchProjects(),
        refetchUsers(),
        refetchKPIs(),
        refetchTenantKPIs()
      ]);
      toast.success("Reports refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh reports");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loadingTasks || loadingProjects || loadingUsers || loadingKPIs || loadingTenantKPIs) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  // --- Aggregations ---
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE).length;
  const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date || t.status === TaskStatus.DONE) return false;
    return new Date(t.due_date) < new Date();
  }).length;
  const pendingTasks = tasks.filter(t => t.status === TaskStatus.TODO || t.status === TaskStatus.BACKLOG || t.status === TaskStatus.BLOCKED || t.status === TaskStatus.IN_REVIEW).length;

  const overviewStats = [
    { title: "Total Tasks", value: totalTasks.toString(), icon: BarChart3, color: "text-primary", bg: "bg-gradient-to-br from-primary/5 to-primary/10", border: "border-primary/20" },
    { title: "Completed", value: completedTasks.toString(), icon: CheckCircle2, color: "text-green-600", bg: "bg-gradient-to-br from-green-50 to-green-100", border: "border-green-200" },
    { title: "In Progress", value: inProgressTasks.toString(), icon: Clock, color: "text-orange-600", bg: "bg-gradient-to-br from-orange-50 to-orange-100", border: "border-orange-200" },
    { title: "Overdue", value: overdueTasks.toString(), icon: AlertCircle, color: "text-red-600", bg: "bg-gradient-to-br from-red-50 to-red-100", border: "border-red-200" },
  ];

  const topPerformers = allUsersKPIs.slice(0, 5);

  const getMedal = (index: number) => {
    if (index === 0) return <span className="text-2xl">🥇</span>;
    if (index === 1) return <span className="text-2xl">🥈</span>;
    if (index === 2) return <span className="text-2xl">🥉</span>;
    return <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">{index + 1}</span>;
  };

  const projectPerformance = projects.filter(p => p.status !== ProjectStatus.ARCHIVED).map(project => {
    const pTasks = tasks.filter(t => t.project_id === project.id && t.status !== TaskStatus.BLOCKED);
    const total = pTasks.length;
    const completed = pTasks.filter(t => t.status === TaskStatus.DONE).length;
    const delayed = pTasks.filter(t => {
      if (!t.due_date) return false;
      return t.status !== TaskStatus.DONE && new Date(t.due_date) < new Date();
    }).length;
    return { id: project.id, name: project.name, completed, total, onTime: completed, delayed };
  });

  const distCompleted = Math.round((completedTasks / (totalTasks || 1)) * 100);
  const distInProgress = Math.round((inProgressTasks / (totalTasks || 1)) * 100);
  const distPending = Math.round((pendingTasks / (totalTasks || 1)) * 100);
  const distOverdue = Math.round((overdueTasks / (totalTasks || 1)) * 100);

  // Export handlers






  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-500 mt-1">Track performance, KPIs, and project metrics</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh Reports"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>

            {/* Date Period Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {periodLabels[period]}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPeriod('today')}>
                  <Calendar className="h-4 w-4 mr-2" /> Today
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPeriod('week')}>
                  <Calendar className="h-4 w-4 mr-2" /> This Week
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPeriod('month')}>
                  <Calendar className="h-4 w-4 mr-2" /> This Month
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPeriod('year')}>
                  <Calendar className="h-4 w-4 mr-2" /> This Year
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPeriod('all')}>
                  <Calendar className="h-4 w-4 mr-2" /> All Time
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Top Multi-Format Exporter */}
            <ReportExportMenu
              title={`PMS Performance & Project Analytics (${periodLabels[period]})`}
              filenamePrefix={`pms_analytics_${period}`}
              data={allUsersKPIs}
              columns={[
                { key: 'rank', header: 'Rank', accessor: (_r: any, idx?: number) => (idx ?? 0) + 1 },
                { key: 'full_name', header: 'Employee' },
                { key: 'email', header: 'Email' },
                { key: 'department', header: 'Department', accessor: (r: any) => r.department || '-' },
                { key: 'total_tasks', header: 'Total Tasks' },
                { key: 'completed_tasks', header: 'Completed Tasks' },
                { key: 'completion_rate', header: 'Completion Rate (%)', accessor: (r: any) => `${r.completion_rate}%` },
                { key: 'on_time_rate', header: 'On-Time Rate (%)', accessor: (r: any) => `${r.on_time_rate}%` },
                { key: 'final_score', header: 'Final Score (%)', accessor: (r: any) => `${r.final_score}%` },
              ]}
              organizationName="Humanitas PMS Intelligence"
              buttonLabel="Export Analytics"
            />
          </div>
        </div>

        {/* Period Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
            Showing data for: {periodLabels[period]}
          </Badge>
          {period !== 'all' && (
            <span className="text-sm text-gray-500">
              ({tasks.length} tasks in this period)
            </span>
          )}
        </div>

        {/* Tenant KPI Hero Card */}
        {tenantKPIs && (
          <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-primary-foreground/90 text-sm font-medium">Organization Performance Score</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-bold">{tenantKPIs.final_score || 0}%</span>
                  </div>
                  <p className="text-primary-foreground/80 text-xs mt-2">{tenantKPIs.total_tasks || 0} total tasks · {tenantKPIs.completed_tasks || 0} completed</p>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <p className="text-primary-foreground text-lg font-bold">
                        {Math.round((tenantKPIs.completed_tasks / (tenantKPIs.total_tasks || 1)) * 100)}%
                      </p>
                      <p className="text-primary-foreground/80 text-xs">Completion Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-primary-foreground text-lg font-bold">
                        {tenantKPIs.total_overdue > 0
                          ? Math.round(((tenantKPIs.total_tasks - tenantKPIs.total_overdue) / (tenantKPIs.total_tasks || 1)) * 100)
                          : 100}%
                      </p>
                      <p className="text-primary-foreground/80 text-xs">On-Time Rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-primary-foreground text-lg font-bold">{tenantKPIs.total_overdue}</p>
                      <p className="text-primary-foreground/80 text-xs">Overdue</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewStats.map((stat) => (
            <Card key={stat.title} className={`${stat.bg} border ${stat.border} shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-white/60 backdrop-blur-sm`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* KPI Leaderboard */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-yellow-50 to-amber-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Top Performers
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {topPerformers.map((user, index) => (
                  <div key={user.user_id} className={`p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${index === 0 ? 'bg-gradient-to-r from-primary/10 to-transparent' : ''}`}>
                    <div className="flex-shrink-0 w-10 flex justify-center">{getMedal(index)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.position || user.department || 'Team Member'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${index === 0 ? 'bg-primary' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-primary/60'}`} style={{ width: `${user.final_score}%` }} />
                      </div>
                      <span className={`font-bold text-lg ${index === 0 ? 'text-primary' : 'text-gray-700'}`}>{user.final_score}%</span>
                    </div>
                  </div>
                ))}
                {topPerformers.length === 0 && <div className="p-8 text-center text-gray-500">No performance data yet</div>}
              </div>
            </CardContent>
          </Card>

          {/* Task Distribution */}
          <Card className="shadow-lg">
            <CardHeader className="border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Task Distribution ({periodLabels[period]})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="url(#gradient)" strokeWidth="12" strokeDasharray={`${distCompleted * 2.51} 251`} strokeLinecap="round" />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#d4a017" />
                        <stop offset="100%" stopColor="#b8860b" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">{totalTasks}</p>
                      <p className="text-xs text-gray-500">Tasks</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium">Completed ({distCompleted}%)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-sm font-medium">In Progress ({distInProgress}%)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50">
                  <div className="w-3 h-3 bg-orange-500 rounded-full" />
                  <span className="text-sm font-medium">Pending ({distPending}%)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-sm font-medium">Overdue ({distOverdue}%)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full Rankings Table */}
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-600" />
                Complete KPI Rankings
              </CardTitle>
              <div className="flex gap-2">
                <ReportExportMenu
                  title={`Complete KPI Rankings — ${periodLabels[period]}`}
                  filenamePrefix={`kpi_rankings_${period}`}
                  data={allUsersKPIs}
                  columns={[
                    { key: 'rank', header: 'Rank', accessor: (_r: any, idx?: number) => (idx ?? 0) + 1 },
                    { key: 'full_name', header: 'Employee' },
                    { key: 'email', header: 'Email' },
                    { key: 'department', header: 'Department', accessor: (r: any) => r.department || '-' },
                    { key: 'total_tasks', header: 'Total Tasks' },
                    { key: 'completed_tasks', header: 'Completed Tasks' },
                    { key: 'completion_rate', header: 'Completion Rate (%)', accessor: (r: any) => `${r.completion_rate}%` },
                    { key: 'on_time_rate', header: 'On-Time Rate (%)', accessor: (r: any) => `${r.on_time_rate}%` },
                    { key: 'final_score', header: 'Final Score (%)', accessor: (r: any) => `${r.final_score}%` },
                  ]}
                  organizationName="Humanitas PMS Intelligence"
                  buttonLabel="Export Rankings"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-600 text-sm">Rank</th>
                    <th className="text-left p-4 font-semibold text-gray-600 text-sm">Employee</th>
                    <th className="text-left p-4 font-semibold text-gray-600 text-sm">Department</th>
                    <th className="text-center p-4 font-semibold text-gray-600 text-sm">Tasks</th>
                    <th className="text-center p-4 font-semibold text-gray-600 text-sm">Completion</th>
                    <th className="text-center p-4 font-semibold text-gray-600 text-sm">On-Time</th>
                    <th className="text-center p-4 font-semibold text-gray-600 text-sm">Final Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allUsersKPIs.map((user, index) => (
                    <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center justify-center w-8 h-8">
                          {index < 3 ? getMedal(index) : <span className="text-gray-500 font-medium">{index + 1}</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-medium text-sm">
                            {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.full_name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 text-sm">{user.department || '—'}</td>
                      <td className="p-4 text-center">
                        <span className="font-medium">{user.completed_tasks}</span>
                        <span className="text-gray-400">/{user.total_tasks}</span>
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={`${user.completion_rate >= 80 ? 'bg-green-100 text-green-700' : user.completion_rate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {user.completion_rate}%
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={`${user.on_time_rate >= 80 ? 'bg-green-100 text-green-700' : user.on_time_rate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {user.on_time_rate}%
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full" style={{ width: `${user.final_score}%` }} />
                          </div>
                          <span className="font-bold text-gray-900">{user.final_score}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allUsersKPIs.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No performance data available yet.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Performance */}
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Project Performance ({periodLabels[period]})
              </CardTitle>
              <ReportExportMenu
                title={`Project Delivery & Performance — ${periodLabels[period]}`}
                filenamePrefix={`project_performance_${period}`}
                data={projectPerformance}
                columns={[
                  { key: 'name', header: 'Project Name' },
                  { key: 'total', header: 'Total Tasks' },
                  { key: 'completed', header: 'Completed Tasks' },
                  { key: 'onTime', header: 'On-Time Delivery' },
                  { key: 'delayed', header: 'Delayed Tasks' },
                  {
                    key: 'completionPct',
                    header: 'Completion %',
                    accessor: (p: any) => (p.total > 0 ? `${Math.round((p.completed / p.total) * 100)}%` : '0%'),
                  },
                ]}
                organizationName="Humanitas PMS Intelligence"
                buttonLabel="Export Projects"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-96 overflow-y-auto">
              {projectPerformance.map((project) => (
                <div key={project.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{project.name}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600 font-medium">{project.onTime} on time</span>
                      <span className="text-red-600 font-medium">{project.delayed} delayed</span>
                      <span className="text-gray-500">{project.completed}/{project.total} tasks</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-500" style={{ width: `${project.total > 0 ? (project.completed / project.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-bold w-12 text-right">{project.total > 0 ? Math.round((project.completed / project.total) * 100) : 0}%</span>
                  </div>
                </div>
              ))}
              {projectPerformance.length === 0 && <div className="p-4 text-center text-gray-500">No active projects.</div>}
            </div>
          </CardContent>
        </Card>

        {/* Time Tracking & Billable Segregation */}
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  Time Tracking & Billable Segregation
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Segregation of billable client hours vs non-billable internal overhead
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="px-3 py-1.5 border rounded-lg text-xs font-medium bg-background"
                  value={activeTimeProjectId}
                  onChange={(e) => setTimeReportProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {loadingTimeSummary ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Aggregating time logs...
              </div>
            ) : !timeSummary || timeSummary.total_hours === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No time logs recorded for this project yet.
              </div>
            ) : (
              <>
                {/* KPI Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border bg-muted/20">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Total Hours</p>
                    <p className="text-2xl font-bold mt-1">{timeSummary.total_hours} hrs</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-green-50/50 border-green-200">
                    <p className="text-xs font-medium text-green-700 uppercase">Billable Hours</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">{timeSummary.billable_hours} hrs</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-amber-50/50 border-amber-200">
                    <p className="text-xs font-medium text-amber-700 uppercase">Non-Billable</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{timeSummary.non_billable_hours} hrs</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-indigo-50/50 border-indigo-200">
                    <p className="text-xs font-medium text-indigo-700 uppercase">Billable Ratio</p>
                    <p className="text-2xl font-bold text-indigo-700 mt-1">{timeSummary.billable_percentage}%</p>
                  </div>
                </div>

                {/* Team Member Breakdown */}
                {timeSummary.by_member.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Time by Team Member</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 border-b text-muted-foreground">
                          <tr>
                            <th className="text-left p-3">Member</th>
                            <th className="text-center p-3">Total</th>
                            <th className="text-center p-3 text-green-600">Billable</th>
                            <th className="text-center p-3 text-amber-600">Non-Billable</th>
                            <th className="text-right p-3">Billable Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {timeSummary.by_member.map((m) => (
                            <tr key={m.user_id} className="hover:bg-muted/10">
                              <td className="p-3 font-medium">{m.user_name}</td>
                              <td className="p-3 text-center">{m.total_hours} hrs</td>
                              <td className="p-3 text-center text-green-700 font-semibold">{m.billable_hours} hrs</td>
                              <td className="p-3 text-center text-amber-700">{m.non_billable_hours} hrs</td>
                              <td className="p-3 text-right font-bold">${m.billable_amount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
