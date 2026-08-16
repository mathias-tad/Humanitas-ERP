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
  Download,
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
  FileText,
  FileSpreadsheet,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { usePMS, TaskStatus, ProjectStatus } from "@/hooks/usePMS";
import { useAuth } from "@/context/AuthContext";
import { useState, useMemo } from "react";
import { toast } from "sonner";

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

// Export to Excel function
const exportToExcel = (data: any[], filename: string) => {
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

// Export to PDF function (simple text-based)
const exportToPDF = (title: string, data: any[], columns: string[]) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .date { color: #6b7280; font-size: 14px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <span class="date">Generated: ${new Date().toLocaleDateString()}</span>
      </div>
      <table>
        <thead>
          <tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${data.map(row => `<tr>${columns.map(c => `<td>${row[c.toLowerCase().replace(/ /g, '_')] ?? row[c] ?? '-'}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <script>window.print();</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

export default function PMSReports() {
  const { useTasks, useProjects, useUsers, useAllUsersKPIs, useTenantKPIs } = usePMS();
  const { tenant } = useAuth();
  const [period, setPeriod] = useState<DatePeriod>('month');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: allTasks = [], isLoading: loadingTasks, refetch: refetchTasks } = useTasks({});
  const { data: projects = [], isLoading: loadingProjects, refetch: refetchProjects } = useProjects();
  const { isLoading: loadingUsers, refetch: refetchUsers } = useUsers();
  const { data: allUsersKPIs = [], isLoading: loadingKPIs, refetch: refetchKPIs } = useAllUsersKPIs();
  const { data: tenantKPIs, isLoading: loadingTenantKPIs, refetch: refetchTenantKPIs } = useTenantKPIs(tenant?.id || '');

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
  const handleExportKPIsExcel = () => {
    const data = allUsersKPIs.map((u, i) => ({
      Rank: i + 1,
      Name: u.full_name,
      Email: u.email,
      Department: u.department || '-',
      'Total Tasks': u.total_tasks,
      'Completed': u.completed_tasks,
      'Completion Rate': `${u.completion_rate}%`,
      'On-Time Rate': `${u.on_time_rate}%`,
      'Final Score': `${u.final_score}%`,
    }));
    exportToExcel(data, `KPI_Rankings_${periodLabels[period].replace(' ', '_')}`);
  };

  const handleExportKPIsPDF = () => {
    const data = allUsersKPIs.map((u, i) => ({
      Rank: i + 1,
      Name: u.full_name,
      Department: u.department || '-',
      'Total Tasks': u.total_tasks,
      Completed: u.completed_tasks,
      'Completion Rate': `${u.completion_rate}%`,
      'On-Time Rate': `${u.on_time_rate}%`,
      'Final Score': `${u.final_score}%`,
    }));
    exportToPDF(`KPI Rankings - ${periodLabels[period]}`, data, ['Rank', 'Name', 'Department', 'Total Tasks', 'Completed', 'Completion Rate', 'On-Time Rate', 'Final Score']);
  };

  const handleExportProjectsExcel = () => {
    const data = projectPerformance.map(p => ({
      Project: p.name,
      Total: p.total,
      Completed: p.completed,
      'On Time': p.onTime,
      Delayed: p.delayed,
      'Completion %': p.total > 0 ? `${Math.round((p.completed / p.total) * 100)}%` : '0%',
    }));
    exportToExcel(data, `Project_Performance_${periodLabels[period].replace(' ', '_')}`);
  };

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

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportKPIsExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> KPI Rankings (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportKPIsPDF}>
                  <FileText className="h-4 w-4 mr-2 text-red-600" /> KPI Rankings (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportProjectsExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Project Performance (Excel)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <Button size="sm" variant="outline" onClick={handleExportKPIsExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-1 text-green-600" /> Excel
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportKPIsPDF}>
                  <FileText className="h-4 w-4 mr-1 text-red-600" /> PDF
                </Button>
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
              <Button size="sm" variant="outline" onClick={handleExportProjectsExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1 text-green-600" /> Export
              </Button>
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
      </div>
    </>
  );
}
