import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Target,
  ListChecks,
  Briefcase,
  DollarSign,
  FileText,
  Loader2,
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
      color: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
      path: "/attendance/view"
    },
    {
      icon: FileText,
      label: "Request Leave",
      color: "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400",
      path: "/leave/requests"
    },
    {
      icon: ListChecks,
      label: "View Tasks",
      color: "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
      path: "/pms/all-tasks"
    },
    {
      icon: Calendar,
      label: "My Schedule",
      color: "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
      path: "/scheduling"
    },
  ];

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { hrMetrics, pmsMetrics, payrollMetrics } = data;

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back! Here's what's happening today.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Card
              key={index}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(action.path)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${action.color}`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    {action.label}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* HR Overview */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                HR Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Employees</p>
                  <p className="text-2xl font-bold text-foreground">
                    {hrMetrics.totalEmployees}
                  </p>
                </div>
                {hrMetrics.newHires > 0 && (
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {hrMetrics.newHires} New
                    </Badge>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-lg font-bold text-foreground">
                    {hrMetrics.activeEmployees}
                  </p>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">Pending Leaves</p>
                  <p className="text-lg font-bold text-foreground">
                    {hrMetrics.pendingLeaves}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Attendance Rate</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {hrMetrics.attendance.rate}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${hrMetrics.attendance.rate}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PMS Overview */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                PMS Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Tasks</p>
                  <p className="text-2xl font-bold text-foreground">
                    {pmsMetrics.totalTasks}
                  </p>
                </div>
                {pmsMetrics.totalTasks > 0 && (
                  <div className="text-right">
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                      {pmsMetrics.completionRate}% Complete
                    </Badge>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-lg font-bold text-foreground">
                    {pmsMetrics.completedTasks}
                  </p>
                </div>
                <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-lg">
                  <p className="text-xs text-muted-foreground">In Progress</p>
                  <p className="text-lg font-bold text-foreground">
                    {pmsMetrics.inProgressTasks}
                  </p>
                </div>
              </div>
              {pmsMetrics.overdueTasks > 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {pmsMetrics.overdueTasks} Overdue Tasks
                    </p>
                    <p className="text-xs text-muted-foreground">Requires attention</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payroll Overview */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Payroll Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Monthly Payroll</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${payrollMetrics.monthlyPayroll.toLocaleString()}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">Processed</p>
                  <p className="text-lg font-bold text-foreground">
                    {payrollMetrics.processed}
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-lg font-bold text-foreground">
                    {payrollMetrics.pending}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/payroll/run')}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Run Payroll
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Attendance */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Today's Attendance</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-foreground">
                    Present
                  </span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {hrMetrics.attendance.today.present}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-foreground">
                    Absent
                  </span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {hrMetrics.attendance.today.absent}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-foreground">
                    Late
                  </span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {hrMetrics.attendance.today.late}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* System Status - replacing Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">System Status</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">All Systems Operational</p>
                      <p className="text-xs text-muted-foreground mt-1">HR, Payroll, and PMS modules running smoothly</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Active Users</p>
                    <p className="text-lg font-bold text-foreground">{hrMetrics.activeEmployees}</p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                    <ListChecks className="h-5 w-5 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Active Tasks</p>
                    <p className="text-lg font-bold text-foreground">{pmsMetrics.inProgressTasks}</p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Payroll Ready</p>
                    <p className="text-lg font-bold text-foreground">{payrollMetrics.processed}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default Home;
