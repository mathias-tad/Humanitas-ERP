import { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserCheck,
  TrendingDown,
  Clock,
  Calendar,
  DollarSign,
  Download,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CreditCard,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useHrmsReports } from '@/hooks/useHrmsReports';
import { toast } from 'sonner';
import { ReportExportMenu, type ReportExportColumn } from '@/components/common/ReportExportMenu';

export default function HRReportsDashboard() {
  const {
    useSummary,
    useHeadcount,
    useTurnover,
    useAttendance,
    usePayroll,
    downloadBankTransferFile,
  } = useHrmsReports();

  const { data: summary, isLoading: loadingSummary } = useSummary();
  const { data: headcount, isLoading: loadingHeadcount } = useHeadcount();
  const { data: turnover, isLoading: loadingTurnover } = useTurnover();
  const { data: attendance } = useAttendance();
  const { data: payroll, isLoading: loadingPayroll } = usePayroll();

  const [activeTab, setActiveTab] = useState<'demographics' | 'turnover' | 'attendance' | 'payroll'>('demographics');
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankMonth, setBankMonth] = useState(new Date().getMonth() + 1);
  const [bankYear, setBankYear] = useState(new Date().getFullYear());
  const [bankFormat, setBankFormat] = useState<'csv' | 'nacha' | 'aba'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const handleBankExport = async () => {
    setIsExporting(true);
    try {
      await downloadBankTransferFile(bankMonth, bankYear, bankFormat);
      toast.success(`Bank transfer file (${bankFormat.toUpperCase()}) downloaded successfully`);
      setBankModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate bank file');
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val?: number) => {
    if (!val) return 'ETB 0.00';
    return `ETB ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getActiveReportColumns = (): ReportExportColumn[] => {
    switch (activeTab) {
      case 'demographics':
        return [
          { key: 'name', header: 'Department Name' },
          { key: 'count', header: 'Headcount' },
          {
            key: 'pct',
            header: 'Share of Workforce',
            accessor: (row: any) => `${Math.round((row.count / (summary?.activeEmployees || 1)) * 100)}%`,
          },
        ];
      case 'turnover':
        return [
          { key: 'month', header: 'Reporting Period' },
          { key: 'hired', header: 'New Hires' },
          { key: 'exited', header: 'Departures / Exits' },
          { key: 'netGrowth', header: 'Net Headcount Expansion' },
        ];
      case 'attendance':
        return [
          { key: 'department', header: 'Department' },
          { key: 'punctualityRate', header: 'Punctuality Rate (%)', accessor: (r: any) => `${r.punctualityRate}%` },
          { key: 'overtimeHours', header: 'Overtime Hours' },
        ];
      case 'payroll':
        return [
          { key: 'department', header: 'Department' },
          { key: 'employeeCount', header: 'Staff Count' },
          { key: 'grossSalary', header: 'Gross Compensation', accessor: (r: any) => formatCurrency(r.grossSalary) },
          { key: 'totalDeductions', header: 'Total Deductions', accessor: (r: any) => formatCurrency(r.totalDeductions) },
          { key: 'netSalary', header: 'Net Disbursed', accessor: (r: any) => formatCurrency(r.netSalary) },
          { key: 'employerPension', header: 'Employer Pension (11%)', accessor: (r: any) => formatCurrency(r.employerPension) },
        ];
      default:
        return [];
    }
  };

  const getActiveReportData = (): any[] => {
    switch (activeTab) {
      case 'demographics':
        return headcount?.byDepartment || [];
      case 'turnover':
        return turnover?.monthlyTrend || [];
      case 'attendance':
        return attendance?.departmentStats || [];
      case 'payroll':
        return payroll?.departmentSpend || [];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fade-in">
      {/* Page Header */}
      <PageHeader
        title="People Analytics & Workforce Intelligence"
        description="Real-time executive headcount demographics, turnover rates, absenteeism patterns, and commercial bank payroll disbursement."
        actions={
          <div className="flex items-center gap-2.5">
            <ReportExportMenu
              title={`HR Workforce Intelligence — ${activeTab.toUpperCase()}`}
              filenamePrefix={`hrms_analytics_${activeTab}`}
              data={getActiveReportData()}
              columns={getActiveReportColumns()}
              organizationName="Humanitas HRMS Intelligence"
              buttonLabel={`Export ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report`}
            />
            <Button
              size="sm"
              onClick={() => setBankModalOpen(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <CreditCard className="h-4 w-4" />
              <span>Generate Bank Transfer File</span>
            </Button>
          </div>
        }
      />

      {/* 6 Executive KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPITile
          title="Total Headcount"
          value={loadingSummary ? '...' : (summary?.totalHeadcount ?? 0).toString()}
          icon={Users}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
          subtitle={`${summary?.newHiresThisMonth ?? 0} new this month`}
        />
        <KPITile
          title="Active Workforce"
          value={loadingSummary ? '...' : (summary?.activeEmployees ?? 0).toString()}
          icon={UserCheck}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
          subtitle="Staff with active status"
        />
        <KPITile
          title="Turnover Rate"
          value={loadingSummary ? '...' : `${summary?.turnoverRatePercentage ?? 0}%`}
          icon={TrendingDown}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
          subtitle="Annualized attrition"
        />
        <KPITile
          title="Average Tenure"
          value={loadingSummary ? '...' : `${summary?.averageTenureYears ?? 0} yrs`}
          icon={Clock}
          iconColor="text-purple-500"
          iconBg="bg-purple-500/10"
          subtitle="Service longevity"
        />
        <KPITile
          title="Absenteeism Rate"
          value={loadingSummary ? '...' : `${summary?.absenteeismRatePercentage ?? 0}%`}
          icon={Activity}
          iconColor="text-rose-500"
          iconBg="bg-rose-500/10"
          subtitle="Past 30 days"
        />
        <KPITile
          title="Workforce Spend"
          value={loadingSummary ? '...' : formatCurrency(summary?.monthlyWorkforceSpend)}
          icon={DollarSign}
          iconColor="text-indigo-500"
          iconBg="bg-indigo-500/10"
          subtitle="Gross monthly cost"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab('demographics')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'demographics'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Headcount & Demographics</span>
        </button>

        <button
          onClick={() => setActiveTab('turnover')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'turnover'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          <span>Turnover & Retention</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'attendance'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Attendance & Punctuality</span>
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'payroll'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Workforce Spend & Bank Disbursement</span>
        </button>
      </div>

      {/* TAB 1: Demographics */}
      {activeTab === 'demographics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Breakdown */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Headcount by Department</h3>
                  <p className="text-xs text-muted-foreground">Active personnel distribution across departments</p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {headcount?.byDepartment.length || 0} Departments
                </Badge>
              </div>

              {loadingHeadcount ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {headcount?.byDepartment.map((dept) => {
                    const total = summary?.activeEmployees || 1;
                    const pct = Math.round((dept.count / total) * 100);
                    return (
                      <div key={dept.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{dept.name}</span>
                          <span className="text-muted-foreground font-mono">
                            {dept.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {(!headcount || headcount.byDepartment.length === 0) && (
                    <p className="text-xs text-muted-foreground italic">No department data recorded yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Gender & Diversity */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Gender & Diversity Representation</h3>
                  <p className="text-xs text-muted-foreground">Workforce demographic composition</p>
                </div>
                <Badge variant="outline" className="text-xs">Demographics</Badge>
              </div>

              {loadingHeadcount ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {headcount?.byGender.map((g) => {
                    const total = summary?.activeEmployees || 1;
                    const pct = Math.round((g.count / total) * 100);
                    return (
                      <div key={g.name} className="p-4 rounded-lg bg-surface-1 border border-border/50 text-center">
                        <div className="text-2xl font-bold text-foreground">{g.count}</div>
                        <div className="text-xs font-semibold text-muted-foreground mt-0.5">{g.name}</div>
                        <div className="text-[11px] font-mono text-primary font-bold mt-2">{pct}% of workforce</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tenure Distribution */}
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">Tenure Distribution</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {headcount?.byTenure.map((t) => (
                    <div key={t.name} className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-center">
                      <div className="text-sm font-bold text-foreground">{t.count}</div>
                      <div className="text-[10px] text-muted-foreground font-semibold">{t.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Turnover */}
      {activeTab === 'turnover' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 6-Month Hiring vs Exits */}
            <div className="lg:col-span-2 p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">6-Month Hiring Velocity vs. Exits</h3>
                  <p className="text-xs text-muted-foreground">Monthly net headcount expansion trend</p>
                </div>
                <Badge variant="outline" className="text-xs">Trends</Badge>
              </div>

              {loadingTurnover ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/50">
                      <tr>
                        <th className="py-2.5 px-3">Period</th>
                        <th className="py-2.5 px-3">New Hires</th>
                        <th className="py-2.5 px-3">Departures</th>
                        <th className="py-2.5 px-3">Net Expansion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {turnover?.monthlyTrend.map((row) => (
                        <tr key={row.month} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-semibold text-foreground">{row.month}</td>
                          <td className="py-2.5 px-3 text-emerald-600 font-bold">+{row.hired}</td>
                          <td className="py-2.5 px-3 text-rose-600 font-bold">-{row.exited}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 font-mono font-bold ${
                                row.netGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {row.netGrowth >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                              {row.netGrowth > 0 ? `+${row.netGrowth}` : row.netGrowth}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Retention Milestones */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Milestone Retention</h3>
                <p className="text-xs text-muted-foreground">New hire survival benchmarks</p>
              </div>

              <div className="space-y-3 pt-2">
                {turnover?.milestoneRetention.map((m) => (
                  <div key={m.milestone} className="p-3 rounded-lg bg-surface-1 border border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-semibold text-foreground">{m.milestone} Milestone</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600">{m.rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Attendance */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekday Heatmap */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Weekday Punctuality & Absence Profile</h3>
                <p className="text-xs text-muted-foreground">Patterns by day of week across all teams</p>
              </div>

              <div className="space-y-3 pt-2">
                {attendance?.weekdayHeatmap.map((w) => (
                  <div key={w.day} className="p-3 rounded-lg bg-surface-1 border border-border/50 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground w-24">{w.day}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-600 font-bold font-mono">Present: {w.presentRate}%</span>
                      <span className="text-amber-600 font-mono">Late: {w.lateRate}%</span>
                      <span className="text-rose-600 font-mono">Absent: {w.absentRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Punctuality */}
            <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Department Punctuality Leaderboard</h3>
                  <p className="text-xs text-muted-foreground">Compliance and overtime stats in last 30 days</p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {attendance?.totalOvertimeHours ?? 0} OT Hours Total
                </Badge>
              </div>

              <div className="space-y-3 pt-2">
                {attendance?.departmentStats.map((dept) => (
                  <div key={dept.department} className="p-3 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{dept.department}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground font-mono">{dept.overtimeHours} OT hrs</span>
                      <Badge
                        variant={dept.punctualityRate >= 95 ? 'default' : 'secondary'}
                        className="font-mono text-xs"
                      >
                        {dept.punctualityRate}% On-Time
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Payroll & Disbursement */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Workforce Compensation & Spend by Department</h3>
                <p className="text-xs text-muted-foreground">Department gross, net, deductions, and employer pension</p>
              </div>
              <div className="flex items-center gap-2">
                <ReportExportMenu
                  title="Workforce Compensation & Spend by Department"
                  filenamePrefix="payroll_department_spend"
                  data={payroll?.departmentSpend || []}
                  columns={[
                    { key: 'department', header: 'Department' },
                    { key: 'employeeCount', header: 'Staff Count' },
                    { key: 'grossSalary', header: 'Gross Compensation', accessor: (r: any) => formatCurrency(r.grossSalary) },
                    { key: 'totalDeductions', header: 'Total Deductions', accessor: (r: any) => formatCurrency(r.totalDeductions) },
                    { key: 'netSalary', header: 'Net Disbursed', accessor: (r: any) => formatCurrency(r.netSalary) },
                    { key: 'employerPension', header: 'Employer Pension (11%)', accessor: (r: any) => formatCurrency(r.employerPension) },
                  ]}
                  organizationName="Humanitas Payroll"
                  buttonLabel="Export Payroll Report"
                />
                <Button size="sm" onClick={() => setBankModalOpen(true)} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Export Bank Transfer</span>
                </Button>
              </div>
            </div>

            {loadingPayroll ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/50">
                    <tr>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Headcount</th>
                      <th className="py-2.5 px-3">Gross Compensation</th>
                      <th className="py-2.5 px-3">Total Deductions</th>
                      <th className="py-2.5 px-3">Net Disbursed</th>
                      <th className="py-2.5 px-3">Employer Pension (11%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {payroll?.departmentSpend.map((row) => (
                      <tr key={row.department} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-semibold text-foreground">{row.department}</td>
                        <td className="py-2.5 px-3 font-mono">{row.employeeCount}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-foreground">{formatCurrency(row.grossSalary)}</td>
                        <td className="py-2.5 px-3 font-mono text-rose-600">{formatCurrency(row.totalDeductions)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">{formatCurrency(row.netSalary)}</td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">{formatCurrency(row.employerPension)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Direct Bank Transfer Modal */}
      {bankModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Direct Bank Transfer Export</h3>
                  <p className="text-xs text-muted-foreground">Generate standard batch salary payment file</p>
                </div>
              </div>
              <button
                onClick={() => setBankModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Payroll Month</label>
                  <select
                    value={bankMonth}
                    onChange={(e) => setBankMonth(parseInt(e.target.value, 10))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ].map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m} ({idx + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Payroll Year</label>
                  <input
                    type="number"
                    value={bankYear}
                    onChange={(e) => setBankYear(parseInt(e.target.value, 10))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Transfer File Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBankFormat('csv')}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      bankFormat === 'csv'
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Standard Bank CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankFormat('nacha')}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      bankFormat === 'nacha'
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    NACHA ACH (.txt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankFormat('aba')}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      bankFormat === 'aba'
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    ABA Format (.txt)
                  </button>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg border border-border/50 space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Validation Guarantee</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The generated file validates employee bank account numbers, formats standard headers and control checksums, and is ready for direct upload to your corporate banking portal.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={() => setBankModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleBankExport} disabled={isExporting} className="gap-2">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span>Download Payment File</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
