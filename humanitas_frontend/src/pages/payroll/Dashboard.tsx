import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/design-system/PageHeader";
import { KPITile } from "@/components/design-system/KPITile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Users,
  Clock,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { usePayroll } from "@/hooks/usePayroll";
import { Link, useNavigate } from "react-router-dom";

const formatCurrency = (amount: number, currency: string = "ETB") => {
  return new Intl.NumberFormat('en-ET', { style: 'currency', currency }).format(amount);
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const { historyQuery, settingsQuery } = usePayroll();
  const { data: history, isLoading: isHistoryLoading } = historyQuery;
  const { data: settings } = settingsQuery;

  const currency = settings?.currency || "ETB";

  // Derived Stats
  const latestRun = history && history.length > 0 ? history[0] : null;
  const previousRun = history && history.length > 1 ? history[1] : null;

  // Calculate changes
  const costChange = latestRun && previousRun
    ? ((latestRun.total_gross - previousRun.total_gross) / previousRun.total_gross) * 100
    : 0;

  const empChange = latestRun && previousRun
    ? latestRun.total_employees - previousRun.total_employees
    : 0;

  // Next Pay Date
  const today = new Date();
  const runDay = settings?.payroll_run_day || 25;
  let nextPayDate = new Date(today.getFullYear(), today.getMonth(), runDay);
  if (today.getDate() > runDay) {
    nextPayDate = new Date(today.getFullYear(), today.getMonth() + 1, runDay);
  }
  const daysLeft = Math.ceil((nextPayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));


  const stats = [
    {
      title: "Latest Payroll Cost",
      value: latestRun ? formatCurrency(latestRun.total_gross, currency) : "N/A",
      change: latestRun ? `${costChange > 0 ? '+' : ''}${costChange.toFixed(1)}%` : "No history",
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      title: "Employees Paid",
      value: latestRun ? latestRun.total_employees : 0,
      change: latestRun ? `${empChange > 0 ? '+' : ''}${empChange} vs last month` : "No history",
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Active Status",
      value: latestRun?.status === 'completed' ? 'All Clear' : 'Processing',
      change: "Last run status",
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
    {
      title: "Next Pay Date",
      value: nextPayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      change: `${daysLeft} days left`,
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
  ];

  if (isHistoryLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Executive Page Header */}
      <PageHeader
        title="Compensation & Payroll"
        description="Comprehensive salary runs, automated tax deductions, pension withholdings, and payslip distribution."
        breadcrumbs={[
          { label: "HRMS", href: "/dashboard" },
          { label: "Payroll" },
        ]}
        actions={
          <Button
            onClick={() => navigate('/payroll/run')}
            className="gap-2 h-9 px-3.5 text-xs font-bold gold-gradient gold-glow border-none text-slate-950 transition-transform hover:scale-105"
          >
            <DollarSign className="h-4 w-4 stroke-[2.5]" />
            Run Payroll
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <KPITile
            key={idx}
            title={stat.title}
            value={stat.value}
            subtitle={stat.change}
            icon={stat.icon}
            iconColor={stat.color}
            iconBg={stat.bg}
          />
        ))}
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Payrolls */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Payroll Runs</CardTitle>
              <Link to="/payroll/run">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-primary hover:text-primary/80"
                >
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Date Processed</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!history || history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">No payroll runs yet.</TableCell>
                    </TableRow>
                  ) : (
                    history.slice(0, 5).map((payroll) => (
                      <TableRow key={payroll.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          {months[payroll.month - 1]} {payroll.year}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {new Date(payroll.run_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{payroll.total_employees}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payroll.total_gross, currency)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`
                            ${payroll.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                              payroll.status === 'processing' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-2 text-muted-foreground border border-border'}
                          `}>
                            {payroll.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Quick Actions / Upcoming */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">System Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Clock className="h-5 w-5 text-emerald-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">Payroll Engine Ready</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    System is online and ready for processing.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Users className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">
                    Configuration
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Currency: {currency}<br />
                    Run Date: Day {settings?.payroll_run_day}
                  </p>
                  <Link to="/settings/hr">
                    <Button
                      size="sm"
                      variant="link"
                      className="px-0 h-auto mt-2 text-primary hover:underline"
                    >
                      Manage Settings &rarr;
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
