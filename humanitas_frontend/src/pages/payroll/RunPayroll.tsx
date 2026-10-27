import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Play,
  Download,
  Calendar,
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Landmark,
  FileCode,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { API_BASE_URL } from "@/config/api.config";
import { usePayroll, type PayrollSummary } from "@/hooks/usePayroll";
import { getAuthHeaders } from "@/context/AuthContext";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Payroll() {
  const { settingsQuery, historyQuery, runPayrollMutation } = usePayroll();

  const settings = settingsQuery.data || null;
  const payrollRuns = historyQuery.data || [];
  const isLoading = settingsQuery.isLoading || historyQuery.isLoading;

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isExporting, setIsExporting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentPayroll, setCurrentPayroll] = useState<PayrollSummary[] | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsData, setDetailsData] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Extract unique allowance and deduction types for dynamic columns
  const visibleAllowances = useMemo(() => {
    const types = new Set<string>();
    detailsData?.forEach(item => {
      const breakdown = typeof item.allowances_breakdown === 'string'
        ? JSON.parse(item.allowances_breakdown)
        : item.allowances_breakdown || [];
      breakdown.forEach((a: any) => types.add(a.name));
    });
    return Array.from(types);
  }, [detailsData]);

  const visibleDeductions = useMemo(() => {
    const types = new Set<string>();
    detailsData?.forEach(item => {
      // Use penalty_breakdown (backend fixed to use this)
      const breakdown = typeof item.penalty_breakdown === 'string'
        ? JSON.parse(item.penalty_breakdown)
        : item.penalty_breakdown || [];
      breakdown.forEach((p: any) => types.add(p.type || 'Penalty'));
    });
    return Array.from(types);
  }, [detailsData]);

  // Job Tracking
  const { activeJobQuery } = usePayroll();
  const queryClient = useQueryClient();
  const jobQuery = activeJobQuery(selectedMonth + 1, selectedYear);
  const rawJobInfo = jobQuery.data;

  const [ignoreRunId, setIgnoreRunId] = useState<string | null>(null);

  // Filter out the "ignored" (old) run ID so we don't think it's the new job
  const jobInfo = (rawJobInfo && rawJobInfo.id === ignoreRunId) ? null : rawJobInfo;
  const status = jobInfo?.status;

  const isActive = status === 'processing' || status === 'pending';
  const isCompleted = status === 'completed';

  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);

  // Watch for job pickup (transition from queuing to processing)
  useEffect(() => {
    if (isActive && isQueuing) {
      setIsQueuing(false); // Job picked up by backend!
    }
  }, [isActive, isQueuing]);

  // Safety timeout for queuing state
  useEffect(() => {
    if (isQueuing) {
      const timer = setTimeout(() => setIsQueuing(false), 10000); // 10s safety timeout
      return () => clearTimeout(timer);
    }
  }, [isQueuing]);

  // Watch for job completion
  useEffect(() => {
    // Check for transition to completed
    // Either from queuing (fast job) or from processing (normal job)
    const wasActiveOrQueuing = prevStatus === 'processing' || prevStatus === 'pending' || isQueuing;

    if (status === 'error') {
      // Backend reported an error
      toast.error(`Status Check Failed: ${jobInfo?.message || 'Unknown error'}`);
      setIsQueuing(false);
    } else if (isCompleted && wasActiveOrQueuing) {
      // Reset queuing flag just in case
      setIsQueuing(false);
      handleJobCompletion(jobInfo);
    }

    // Update prev status
    setPrevStatus(status);
  }, [status, isQueuing]);

  const handleJobCompletion = async (info: any) => {
    // Display message from backend (includes skipped user info)
    const message = info?.message || 'Payroll completed!';
    toast.success(message);

    // Fetch full details
    try {
      const detailsResponse = await fetch(`${API_BASE_URL}/payroll/details?month=${selectedMonth + 1}&year=${selectedYear}`, {
        credentials: 'include',
      });
      if (detailsResponse.ok) {
        const data = await detailsResponse.json();
        setCurrentPayroll(data);
      }
    } catch (e) {
      console.error("Error fetching details:", e);
    }

    // Do not auto-open dialog
    // setShowResultDialog(true);
    historyQuery.refetch();
  };

  const handleRunPayroll = async () => {
    // Track the current (old) run ID so we ignore it during the new run initiation
    // Try to get ID from current payroll details or history
    // Try to get ID from current payroll details or history
    const currentRunId = (currentPayroll?.[0] as any)?.payroll_run_id || historyQuery.data?.find(r => r.month === selectedMonth + 1 && r.year === selectedYear)?.id;
    if (currentRunId) {
      setIgnoreRunId(currentRunId);
    }

    // Clear any stale status data to prevent "completion" logic from firing immediately based on old data
    queryClient.removeQueries({ queryKey: ['active-payroll-job', selectedMonth + 1, selectedYear] });

    setShowConfirmDialog(false);

    runPayrollMutation.mutate(
      { month: selectedMonth + 1, year: selectedYear },
      {
        onSuccess: () => {
          setIsQueuing(true);
          // Force immediate refetch triggers new fetch
          queryClient.invalidateQueries({ queryKey: ['active-payroll-job'] });
          // Also invalidate history
          historyQuery.refetch();
        }
      }
    );
  };

  const handleExport = async (month: number, year: number) => {
    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/payroll/export?month=${month}&year=${year}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll_${year}_${month.toString().padStart(2, '0')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Payroll exported successfully');
      } else {
        toast.error('Failed to export payroll');
      }
    } catch (error) {
      console.error("Error exporting payroll:", error);
      toast.error('Failed to export payroll');
    } finally {
      setIsExporting(false);
    }
  };

  const [isExportingBank, setIsExportingBank] = useState(false);

  const handleExportBankTransfer = async (
    month: number,
    year: number,
    format: 'nacha' | 'aba' | 'cbe' | 'awash' | 'dashen' | 'generic',
    formatLabel: string,
  ) => {
    setIsExportingBank(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/payroll/export/bank-transfer?month=${month}&year=${year}&format=${format}`,
        {
          credentials: 'include',
          headers: getAuthHeaders(),
        },
      );

      if (response.ok) {
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `bank_transfer_${year}_${month}.${format === 'nacha' ? 'ach' : format === 'aba' ? 'aba' : 'csv'}`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^";]+)"?/);
          if (match && match[1]) filename = match[1];
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(`${formatLabel} file exported successfully`);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'Failed to export bank transfer file');
      }
    } catch (error) {
      console.error('Error exporting bank transfer:', error);
      toast.error('Failed to export bank transfer file');
    } finally {
      setIsExportingBank(false);
    }
  };



  const handleViewDetails = async (month: number, year: number) => {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`${API_BASE_URL}/payroll/details?month=${month}&year=${year}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDetailsData(data);
        setShowDetailsDialog(true);
      } else {
        toast.error('Failed to load payroll details');
      }
    } catch (error) {
      console.error("Error loading payroll details:", error);
      toast.error('Failed to load payroll details');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-primary/20 text-primary">Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Management</h1>
          <p className="text-gray-500 mt-1">
            Run and manage monthly payroll calculations
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { settingsQuery.refetch(); historyQuery.refetch(); }}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Auto Run Day</p>
                <p className="text-2xl font-bold">
                  {settings?.auto_payroll_enabled ? `Day ${settings.payroll_run_day}` : 'Disabled'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <Clock className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Late Penalty/Min</p>
                <p className="text-2xl font-bold">
                  {settings?.currency} {formatCurrency(settings?.late_penalty_per_minute || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Runs</p>
                <p className="text-2xl font-bold">{payrollRuns.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Currency</p>
                <p className="text-2xl font-bold">{settings?.currency || 'ETB'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Run Payroll Card */}
      <Card>
        <CardHeader>
          <CardTitle>Run Payroll</CardTitle>
          <CardDescription>
            Select a month and year to calculate payroll for all employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Month</label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={runPayrollMutation.isPending || isActive || isQueuing}
              className="bg-primary hover:bg-primary/90"
            >
              {isQueuing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Queuing...
                </>
              ) : isActive ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : runPayrollMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Payroll
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => handleExport(selectedMonth + 1, selectedYear)}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Export Excel
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isExportingBank}
                  className="gap-2"
                >
                  {isExportingBank ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Landmark className="h-4 w-4 text-emerald-600" />
                  )}
                  <span>Bank Transfer Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-semibold">
                  Direct Bank Transfer Formats
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    handleExportBankTransfer(
                      selectedMonth + 1,
                      selectedYear,
                      "nacha",
                      "NACHA Direct Deposit (ACH)"
                    )
                  }
                  className="gap-2 cursor-pointer text-xs"
                >
                  <FileCode className="h-3.5 w-3.5 text-blue-600" />
                  <div>
                    <p className="font-medium">NACHA ACH (.ach)</p>
                    <p className="text-[10px] text-muted-foreground">Standard US Direct Deposit</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    handleExportBankTransfer(
                      selectedMonth + 1,
                      selectedYear,
                      "aba",
                      "ABA Direct Entry"
                    )
                  }
                  className="gap-2 cursor-pointer text-xs"
                >
                  <FileCode className="h-3.5 w-3.5 text-purple-600" />
                  <div>
                    <p className="font-medium">ABA Direct Entry (.aba)</p>
                    <p className="text-[10px] text-muted-foreground">Australian / CEMTEX Standard</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    handleExportBankTransfer(
                      selectedMonth + 1,
                      selectedYear,
                      "cbe",
                      "Commercial Bank of Ethiopia (CBE)"
                    )
                  }
                  className="gap-2 cursor-pointer text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />
                  <div>
                    <p className="font-medium">CBE Salary Transfer (.csv)</p>
                    <p className="text-[10px] text-muted-foreground">Commercial Bank of Ethiopia</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    handleExportBankTransfer(
                      selectedMonth + 1,
                      selectedYear,
                      "awash",
                      "Awash Bank Direct Credit"
                    )
                  }
                  className="gap-2 cursor-pointer text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
                  <div>
                    <p className="font-medium">Awash Bank (.csv)</p>
                    <p className="text-[10px] text-muted-foreground">Direct Salary Credit Batch</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    handleExportBankTransfer(
                      selectedMonth + 1,
                      selectedYear,
                      "dashen",
                      "Dashen Bank Transfer"
                    )
                  }
                  className="gap-2 cursor-pointer text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-500" />
                  <div>
                    <p className="font-medium">Dashen Bank (.csv)</p>
                    <p className="text-[10px] text-muted-foreground">Corporate Salary Upload</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    handleExportBankTransfer(
                      selectedMonth + 1,
                      selectedYear,
                      "generic",
                      "Generic Bank Transfer Batch"
                    )
                  }
                  className="gap-2 cursor-pointer text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <div>
                    <p className="font-medium">Generic Corporate Batch (.csv)</p>
                    <p className="text-[10px] text-muted-foreground">Universal ISO 20022 compatible</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>


          </div>
        </CardContent>
      </Card>

      {/* Payroll History */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
          <CardDescription>
            Previous payroll runs and their status
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Gross Total</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Run Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No payroll runs yet. Run your first payroll above.
                  </TableCell>
                </TableRow>
              ) : (
                payrollRuns.map((run: any) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {months[run.month - 1]} {run.year}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        {run.total_employees}
                      </div>
                    </TableCell>
                    <TableCell>{settings?.currency} {formatCurrency(run.total_gross)}</TableCell>
                    <TableCell className="text-red-600">
                      -{settings?.currency} {formatCurrency(run.total_deductions)}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {settings?.currency} {formatCurrency(run.total_net)}
                    </TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(run.run_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(run.month, run.year)}
                          disabled={isLoadingDetails}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(run.month, run.year)}
                          disabled={isExporting}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Payroll Run
            </DialogTitle>
            <DialogDescription>
              You are about to run payroll for <strong>{months[selectedMonth]} {selectedYear}</strong>.
              This will calculate salaries for all active employees based on their attendance records.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">This action will:</p>
            <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
              <li>Calculate working days and hours for each employee</li>
              <li>Apply late penalties ({settings?.currency} {settings?.late_penalty_per_minute}/minute)</li>
              <li>Generate payroll summary for the period</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRunPayroll} className="bg-primary hover:bg-primary/90">
              Run Payroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Payroll Completed
            </DialogTitle>
            <DialogDescription>
              Payroll for {months[selectedMonth]} {selectedYear} has been calculated successfully.
            </DialogDescription>
          </DialogHeader>
          {currentPayroll && currentPayroll.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Allowances</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Pension 7%</TableHead>
                    <TableHead className="text-right">Loan</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPayroll.map((emp: any) => (
                    <TableRow key={emp.employee_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{emp.employee_name}</p>
                          <p className="text-xs text-gray-500">{emp.department}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <span title={`Attendance: ${emp.attendance_days || 0}, Leave: ${emp.leave_days || 0}`}>
                          {emp.days_worked}/{emp.working_days_in_month || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(emp.basic_salary)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(emp.total_allowances)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(emp.gross_salary)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600">
                        -{formatCurrency(emp.income_tax)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600">
                        -{formatCurrency(emp.pension_employee)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600">
                        -{formatCurrency(emp.loan_deduction || 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600">
                        -{formatCurrency(emp.late_deduction)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        {formatCurrency(emp.net_salary)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleExport(selectedMonth + 1, selectedYear)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
            <Button onClick={() => setShowResultDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Payroll View Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Payroll Details - {months[selectedMonth]} {selectedYear}</DialogTitle>
            <DialogDescription>
              Complete payroll breakdown for all employees
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {detailsData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-white z-10">Employee</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-center">Days</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right">Basic</TableHead>

                    {/* Dynamic Allowance Headers */}
                    {visibleAllowances.map(type => (
                      <TableHead key={type} className="sticky top-0 bg-white z-10 text-right">{type}</TableHead>
                    ))}

                    <TableHead className="sticky top-0 bg-white z-10 text-right bg-gray-50">Gross</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right">Taxable</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right">Tax</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right">Pension 7%</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right">Pension 11%</TableHead>

                    {/* Dynamic Deduction Headers (Penalties) */}
                    {visibleDeductions.map(type => (
                      <TableHead key={type} className="sticky top-0 bg-white z-10 text-right text-red-600">{type}</TableHead>
                    ))}

                    {/* Separate Columns for Standard Deductions if not dynamic */}
                    <TableHead className="sticky top-0 bg-white z-10 text-right text-red-600">Loans</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right text-red-600">Late</TableHead>

                    <TableHead className="sticky top-0 bg-white z-10 text-right bg-red-50 font-medium">Total Ded.</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right bg-green-50 font-bold">Net Pay</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-xs">TIN</TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-xs">Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsData.map((emp: any) => {
                    // Parse Breakdowns once
                    const allowances = typeof emp.allowances_breakdown === 'string'
                      ? JSON.parse(emp.allowances_breakdown)
                      : emp.allowances_breakdown || [];
                    const allowanceMap = new Map();
                    allowances.forEach((a: any) => allowanceMap.set(a.name, a.amount));

                    const penalties = typeof emp.penalty_breakdown === 'string'
                      ? JSON.parse(emp.penalty_breakdown)
                      : emp.penalty_breakdown || [];
                    const penaltyMap = new Map();
                    penalties.forEach((p: any) => penaltyMap.set(p.type || 'Penalty', p.amount));

                    return (
                      <TableRow key={emp.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-sm">
                          <div>{emp.employee_name}</div>
                          <div className="text-xs text-gray-500">{emp.position}</div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{emp.days_worked}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(emp.basic_salary)}</TableCell>

                        {/* Dynamic Allowance Cells */}
                        {visibleAllowances.map(type => (
                          <TableCell key={type} className="text-right text-sm text-gray-600">
                            {formatCurrency(allowanceMap.get(type) || 0)}
                          </TableCell>
                        ))}

                        <TableCell className="text-right text-sm font-medium bg-gray-50">{formatCurrency(emp.gross_salary)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(emp.taxable_income)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">-{formatCurrency(emp.income_tax)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">-{formatCurrency(emp.pension_employee)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">-{formatCurrency(emp.pension_employer)}</TableCell>

                        {/* Dynamic Deduction Cells */}
                        {visibleDeductions.map(type => (
                          <TableCell key={type} className="text-right text-sm text-red-600">
                            -{formatCurrency(penaltyMap.get(type) || 0)}
                          </TableCell>
                        ))}

                        <TableCell className="text-right text-sm text-red-600">-{formatCurrency(emp.loan_deduction || 0)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">-{formatCurrency(emp.late_deduction || 0)}</TableCell>

                        <TableCell className="text-right text-sm font-medium bg-red-50 text-red-700">-{formatCurrency(emp.total_deductions)}</TableCell>
                        <TableCell className="text-right text-sm font-bold bg-green-50 text-green-700">{formatCurrency(emp.net_salary)}</TableCell>
                        <TableCell className="text-xs text-gray-500 font-mono">{emp.tin}</TableCell>
                        <TableCell className="text-xs text-gray-500 font-mono">{emp.account_number}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No payroll data for this period
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleExport(selectedMonth + 1, selectedYear)}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
            <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
