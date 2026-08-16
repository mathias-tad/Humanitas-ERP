import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Eye, Loader2, DollarSign, Calendar, Clock, AlertCircle } from "lucide-react";
import { usePayroll } from "@/hooks/usePayroll";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' }).format(amount);
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function PayslipDetailDialog({ payslipId, open, onOpenChange }: { payslipId: string | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { useMyPayslipDetail, taxRulesQuery } = usePayroll();
  const { data: detail, isLoading } = useMyPayslipDetail(payslipId || "", open);
  const { data: taxRules } = taxRulesQuery;

  const getTaxInfo = (taxableIncome: number) => {
    if (!taxRules || !taxableIncome) return null;
    return taxRules.find((r: any) =>
      taxableIncome >= Number(r.min_salary) &&
      (r.max_salary === null || taxableIncome <= Number(r.max_salary))
    );
  };

  if (!payslipId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip Details</DialogTitle>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{detail.employee_name}</h2>
                <p className="text-gray-500">{detail.position} - {detail.department}</p>
                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1"><FileText className="h-4 w-4" /> TIN: {detail.tin}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {months[detail.month - 1]} {detail.year}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Net Pay</p>
                <p className="text-3xl font-bold text-green-600 font-mono">{formatCurrency(detail.net_salary)}</p>
                <Badge className="bg-green-100 text-green-800 mt-1">Paid</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Earnings Section */}
              <Card className="border shadow-sm">
                <CardHeader className="bg-green-50/50 pb-3 border-b border-green-100">
                  <CardTitle className="text-green-800 text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" /> Earnings
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-[1fr,auto] gap-4 items-center">
                    <span className="font-medium text-gray-700">Basic Salary</span>
                    <span className="font-mono font-medium">{formatCurrency(detail.basic_salary)}</span>
                  </div>

                  {/* Allowances Breakdown */}
                  <div className="space-y-2 border-t pt-2 mt-2">
                    {(() => {
                      const allowances = typeof detail.allowances_breakdown === 'string'
                        ? JSON.parse(detail.allowances_breakdown)
                        : detail.allowances_breakdown || [];

                      return allowances.length > 0 ? (
                        allowances.map((allowance: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-[1fr,auto] gap-4 text-sm">
                            <span className="text-gray-600">{allowance.name}</span>
                            <span className="text-gray-900 font-mono">{formatCurrency(allowance.amount)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 italic py-1">No additional allowances</p>
                      );
                    })()}
                  </div>

                  <div className="border-t pt-3 mt-2 grid grid-cols-[1fr,auto] gap-4 font-bold text-lg bg-green-50/30 p-2 rounded-md -mx-2">
                    <span className="text-gray-900">Gross Salary</span>
                    <span className="text-green-700 font-mono">{formatCurrency(detail.gross_salary)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Deductions Section */}
              <Card className="border shadow-sm">
                <CardHeader className="bg-red-50/50 pb-3 border-b border-red-100">
                  <CardTitle className="text-red-800 text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" /> Deductions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-[1fr,auto] gap-4 items-center text-sm">
                    <span className="text-gray-500">Taxable Income</span>
                    <span className="font-mono text-gray-400">{formatCurrency(detail.taxable_income)}</span>
                  </div>

                  <div className="space-y-2 border-t pt-2 mt-2">
                    {/* Income Tax Row with Rate/Deductible */}
                    {(() => {
                      const taxRule = getTaxInfo(Number(detail.taxable_income));
                      return (
                        <div className="grid grid-cols-[1fr,auto] gap-4 text-sm text-red-600">
                          <span className="flex flex-col">
                            <span>Income Tax</span>
                            {taxRule && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded w-fit mt-0.5">
                                Rate: {taxRule.tax_rate}% | Ded: {formatCurrency(taxRule.deductible)}
                              </span>
                            )}
                          </span>
                          <span className="font-mono">-{formatCurrency(detail.income_tax)}</span>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-[1fr,auto] gap-4 text-sm text-red-600">
                      <span>Pension (7%)</span>
                      <span className="font-mono">-{formatCurrency(detail.pension_employee)}</span>
                    </div>

                    {Number(detail.late_deduction) > 0 && (
                      <div className="grid grid-cols-[1fr,auto] gap-4 text-sm text-red-600">
                        <span>Late Penalty ({Math.round(detail.late_minutes)}m)</span>
                        <span className="font-mono">-{formatCurrency(detail.late_deduction)}</span>
                      </div>
                    )}

                    {Number(detail.absent_deduction) > 0 && (
                      <div className="grid grid-cols-[1fr,auto] gap-4 text-sm text-red-600">
                        <span>Absence ({detail.days_absent} days)</span>
                        <span className="font-mono">-{formatCurrency(detail.absent_deduction)}</span>
                      </div>
                    )}

                    {/* Other Penalties */}
                    {(() => {
                      const penalties = typeof detail.other_deductions === 'string'
                        ? JSON.parse(detail.other_deductions)
                        : [];

                      return Array.isArray(penalties) && penalties.map((p: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-[1fr,auto] gap-4 text-sm text-red-600">
                          <span>{p.reason || p.type || 'Penalty'}</span>
                          <span className="font-mono">-{formatCurrency(p.amount)}</span>
                        </div>
                      ));
                    })()}

                    {Number(detail.loan_deduction) > 0 && (
                      <div className="grid grid-cols-[1fr,auto] gap-4 text-sm text-red-600">
                        <span>Loan Repayment</span>
                        <span className="font-mono">-{formatCurrency(detail.loan_deduction)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3 mt-2 grid grid-cols-[1fr,auto] gap-4 font-bold text-lg bg-red-50/30 p-2 rounded-md -mx-2">
                    <span className="text-gray-900">Total Deductions</span>
                    <span className="text-red-700 font-mono">-{formatCurrency(detail.total_deductions)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Info / Attendance Context */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Working Days</p>
                <p className="font-bold text-gray-900 text-lg">{detail.days_worked}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Absent Days</p>
                <p className="font-bold text-red-600 text-lg">{detail.days_absent}</p>
              </div>
              {/* Removed Pension (11%) as per user request */}
              <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Run Date</p>
                <p className="font-bold text-gray-700 text-lg">{new Date(detail.run_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MyPayslip() {
  const { myPayslipsQuery } = usePayroll();
  const { data: payslips, isLoading } = myPayslipsQuery;
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);

  const latestPayslip = payslips && payslips.length > 0 ? payslips[0] : null;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
            <p className="text-gray-500 mt-1">
              View your payroll history and earnings details
            </p>
          </div>
        </div>

        {/* Latest Payslip Card - Premium Design with Theme Color */}
        {latestPayslip && (
          <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 shadow-md">
            {/* Ambient Background Gradient with Theme Colors */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5 opacity-50" />

            <div className="relative p-6 sm:p-8">
              <div className="grid gap-6 md:grid-cols-2 md:items-center">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                      LATEST PAYSLIP
                    </span>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-mono">
                      {months[latestPayslip.month - 1]} {latestPayslip.year}
                    </h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Processed on {new Date(latestPayslip.run_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 md:items-end">
                  <div className="space-y-1 text-left md:text-right">
                    <p className="text-sm font-medium text-muted-foreground">Net Take Home Pay</p>
                    <p className="text-4xl font-bold tracking-tight text-primary font-mono">
                      {formatCurrency(latestPayslip.net_salary)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setSelectedPayslipId(latestPayslip.id)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Breakdown
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative bottom border */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20" />
          </div>
        )}

        {/* History Table */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Payslip History</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Run Date</TableHead>
                    <TableHead>Gross Pay</TableHead>
                    <TableHead>Total Deductions</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!payslips || payslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No payslips found
                      </TableCell>
                    </TableRow>
                  ) : (
                    payslips.map((payslip: any) => (
                      <TableRow key={payslip.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            {months[payslip.month - 1]} {payslip.year}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {new Date(payslip.run_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{formatCurrency(payslip.gross_salary)}</TableCell>
                        <TableCell className="text-red-500">-{formatCurrency(payslip.total_deductions)}</TableCell>
                        <TableCell className="font-medium text-green-600">
                          {formatCurrency(payslip.net_salary)}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800 border-none shadow-none">
                            {payslip.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPayslipId(payslip.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <PayslipDetailDialog
        payslipId={selectedPayslipId}
        open={!!selectedPayslipId}
        onOpenChange={(open) => !open && setSelectedPayslipId(null)}
      />
    </>
  );
}
