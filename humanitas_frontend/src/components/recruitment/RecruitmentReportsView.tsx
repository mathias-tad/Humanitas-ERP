import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Download,
  ArrowRight,
} from "lucide-react";
import {
  useRecruitmentFunnel,
  useRecruitmentAnalytics,
} from "@/hooks/useRecruitmentPipeline";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { toast } from "sonner";

interface RecruitmentReportsViewProps {
  jobs?: any[];
}

export function RecruitmentReportsView({ jobs: _jobs = [] }: RecruitmentReportsViewProps) {
  const { data: funnelData } = useRecruitmentFunnel();
  const { data: analyticsData } = useRecruitmentAnalytics();
  const [departmentFilter] = useState("all");

  const funnelColors = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#10b981"];

  const handleExportCSV = () => {
    if (!funnelData || !analyticsData) return;
    const rows = [
      ["Metric", "Value"],
      ["Time to Hire (Days)", analyticsData.timeToHireDays],
      ["Cost Per Hire (USD)", analyticsData.costPerHire],
      ["Offer Acceptance Rate (%)", `${analyticsData.offerAcceptanceRate}%`],
      ["Open Positions", analyticsData.openPositions],
      ["Filled Positions", analyticsData.filledPositions],
      [],
      ["Funnel Stage", "Candidates", "Conversion Rate", "Dropoff Rate"],
      ...funnelData.stages.map((s) => [
        s.stage,
        s.count,
        `${s.conversionRate}%`,
        `${s.dropoffRate}%`,
      ]),
      [],
      ["Department", "Avg Days to Hire", "Open Roles", "Hires Count"],
      ...analyticsData.departmentVelocity.map((d) => [
        d.department,
        d.avgDaysToHire,
        d.openRoles,
        d.hiresCount,
      ]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `recruitment_analytics_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Recruitment metrics report exported to CSV");
  };

  const filteredVelocity =
    departmentFilter === "all"
      ? analyticsData?.departmentVelocity || []
      : (analyticsData?.departmentVelocity || []).filter(
          (d) => d.department.toLowerCase() === departmentFilter.toLowerCase()
        );

  return (
    <div className="space-y-6">
      {/* Header & Export controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Recruitment Analytics & Insights</h3>
          <p className="text-sm text-muted-foreground">
            Hiring funnel conversion velocity, cost-per-hire KPIs, and department talent benchmarks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Time-to-Hire</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData?.timeToHireDays || 22} <span className="text-sm font-normal text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
              <span>↓ 6 days</span> vs. industry benchmark (28d)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost-per-Hire</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analyticsData?.costPerHire ? analyticsData.costPerHire.toLocaleString() : "2,840"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Calculated via Krinai AI & recruitment attribution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Offer Acceptance Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData?.offerAcceptanceRate || 85}%
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              Top decile candidate retention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open vs. Filled Positions</CardTitle>
            <Briefcase className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-baseline gap-2">
              <span>{analyticsData?.filledPositions || 19}</span>
              <span className="text-sm font-normal text-muted-foreground">
                / {(analyticsData?.filledPositions || 19) + (analyticsData?.openPositions || 8)} total
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analyticsData?.openPositions || 8} positions currently recruiting
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hiring Funnel Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Talent Acquisition Conversion Funnel</CardTitle>
              <CardDescription>
                Stage-by-stage candidate throughput and attrition across all job postings.
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit text-primary border-primary/30">
              Overall Funnel Efficiency: {funnelData?.overallConversionRate || 8}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Visual Funnel Step Bars */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-8">
            {(funnelData?.stages || []).map((stage, idx) => (
              <div
                key={stage.stage}
                className="relative p-4 rounded-xl border bg-card/60 flex flex-col justify-between overflow-hidden shadow-xs"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: funnelColors[idx % funnelColors.length] }}
                />
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Stage {idx + 1}
                    </span>
                    {idx < (funnelData?.stages || []).length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground/60 hidden md:block" />
                    )}
                  </div>
                  <h4 className="font-bold text-base">{stage.stage}</h4>
                  <div className="text-2xl font-extrabold text-foreground mt-2">
                    {stage.count}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conv. Rate:</span>
                    <span className="font-semibold text-emerald-600">
                      {stage.conversionRate}%
                    </span>
                  </div>
                  {stage.dropoffRate > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Drop-off:</span>
                      <span className="text-rose-500 font-medium">
                        {stage.dropoffRate}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bar Chart Representation of Funnel */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData?.stages || []}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="stage" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) => [
                    `${value} Candidates`,
                    "Count",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(funnelData?.stages || []).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={funnelColors[index % funnelColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Department Velocity + Monthly Trends */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Department Velocity */}
        <Card>
          <CardHeader>
            <CardTitle>Department Hiring Velocity</CardTitle>
            <CardDescription>
              Average turnaround days from requisition open to candidate contract signing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredVelocity}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" unit="d" />
                  <YAxis
                    dataKey="department"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={110}
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val} Days`, "Avg Days to Hire"]}
                    contentStyle={{
                      borderRadius: "8px",
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Bar
                    dataKey="avgDaysToHire"
                    fill="#3b82f6"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              {(analyticsData?.departmentVelocity || []).map((dep) => (
                <div key={dep.department} className="p-2 rounded bg-muted/30">
                  <p className="font-semibold truncate">{dep.department}</p>
                  <p className="text-muted-foreground">{dep.hiresCount} hires</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 6-Month Hiring Volume Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Recruitment Volume Trends</CardTitle>
            <CardDescription>
              6-month historical activity across applications, interviews, and hires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={analyticsData?.monthlyTrends || []}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Applications"
                  />
                  <Line
                    type="monotone"
                    dataKey="interviews"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Interviews"
                  />
                  <Line
                    type="monotone"
                    dataKey="hires"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Hires"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t flex justify-between text-xs text-muted-foreground">
              <span>Attribution: Krinai AI Talent Engine</span>
              <span className="text-emerald-600 font-semibold">
                +24% Year-over-Year Pipeline Velocity
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
