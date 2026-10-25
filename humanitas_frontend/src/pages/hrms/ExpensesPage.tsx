import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import {
  Receipt,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Sliders,
  X,
  BarChart3,
  Trash2,
  Send,
  Eye,
} from 'lucide-react';
import {
  useExpenseCategories,
  useExpenseReports,
  useMyExpenseReports,
  useExpenseReport,
  useExpenseAnalytics,
  useCreateExpenseReport,
  useAddExpenseItem,
  useDeleteExpenseItem,
  useSubmitExpenseReport,
  useApproveExpenseReport,
  useRejectExpenseReport,
  useMarkExpenseReimbursed,
  useCreateExpenseCategory,
  type ExpenseReport,
} from '@/hooks/useExpenses';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const STATUS_BADGES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  under_review: 'bg-purple-50 text-purple-700 border-purple-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  reimbursed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ExpensesPage() {
  const { user, hasPermission } = useAuth();
  const canApprove = hasPermission('approve_expenses') || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner';
  const canManagePolicies = hasPermission('manage_expense_policies') || canApprove;
  const canReimburse = hasPermission('reimburse_expenses') || canApprove;

  const [activeTab, setActiveTab] = useState<'my' | 'approvals' | 'policies' | 'analytics'>('my');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showReportModal, setShowReportModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Selected item state
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [activeReport, setActiveReport] = useState<ExpenseReport | null>(null);

  // Data queries
  const { data: myReports = [], isLoading: myLoading } = useMyExpenseReports();
  const { data: allReports = [] } = useExpenseReports();
  const { data: categories = [] } = useExpenseCategories();
  const { data: analytics } = useExpenseAnalytics();
  const { data: singleReport } = useExpenseReport(selectedReportId);

  // Mutations
  const createReportMutation = useCreateExpenseReport();
  const addItemMutation = useAddExpenseItem();
  const deleteItemMutation = useDeleteExpenseItem();
  const submitReportMutation = useSubmitExpenseReport();
  const approveReportMutation = useApproveExpenseReport();
  const rejectReportMutation = useRejectExpenseReport();
  const reimburseMutation = useMarkExpenseReimbursed();
  const createCategoryMutation = useCreateExpenseCategory();

  // Report form state
  const [reportForm, setReportForm] = useState({
    title: '',
    purpose: '',
    currency: 'USD',
  });

  // Item form state
  const [itemForm, setItemForm] = useState({
    category_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    merchant_name: '',
    description: '',
    amount: 50,
    receipt_url: '',
  });

  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: '',
    spending_limit: 250,
    daily_per_diem_cap: 75,
    requires_receipt: true,
  });

  // Approval state
  const [approvalForm, setApprovalForm] = useState({
    approved_amount: 0,
    include_in_payroll: true,
  });

  // Rejection state
  const [rejectionReason, setRejectionReason] = useState('');

  // Handlers
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createReportMutation.mutateAsync(reportForm);
      toast.success('Expense report created. Now add your line items.');
      setShowReportModal(false);
      setReportForm({ title: '', purpose: '', currency: 'USD' });
      setSelectedReportId(res.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create report');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportId) return;
    try {
      await addItemMutation.mutateAsync({
        reportId: selectedReportId,
        payload: itemForm,
      });
      toast.success('Expense item added');
      setShowItemModal(false);
      setItemForm({
        category_id: categories[0]?.id || '',
        expense_date: new Date().toISOString().split('T')[0],
        merchant_name: '',
        description: '',
        amount: 50,
        receipt_url: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to add item');
    }
  };

  const handleDeleteItem = async (reportId: string, itemId: string) => {
    try {
      await deleteItemMutation.mutateAsync({ reportId, itemId });
      toast.success('Item deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete item');
    }
  };

  const handleSubmitReport = async (reportId: string) => {
    try {
      await submitReportMutation.mutateAsync(reportId);
      toast.success('Expense report submitted for manager approval');
      setShowDetailModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    }
  };

  const handleOpenApprove = (report: ExpenseReport) => {
    setActiveReport(report);
    setApprovalForm({
      approved_amount: report.total_amount,
      include_in_payroll: true,
    });
    setShowApproveModal(true);
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReport) return;
    try {
      await approveReportMutation.mutateAsync({
        reportId: activeReport.id,
        payload: approvalForm,
      });
      toast.success('Expense report approved');
      setShowApproveModal(false);
      setActiveReport(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve report');
    }
  };

  const handleOpenReject = (report: ExpenseReport) => {
    setActiveReport(report);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReport) return;
    try {
      await rejectReportMutation.mutateAsync({
        reportId: activeReport.id,
        reason: rejectionReason,
      });
      toast.success('Expense report rejected');
      setShowRejectModal(false);
      setActiveReport(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject report');
    }
  };

  const handleMarkReimbursed = async (reportId: string) => {
    try {
      await reimburseMutation.mutateAsync(reportId);
      toast.success('Report marked as fully reimbursed/paid');
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark reimbursed');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCategoryMutation.mutateAsync(categoryForm);
      toast.success('Expense policy category created');
      setShowCategoryModal(false);
      setCategoryForm({
        name: '',
        code: '',
        description: '',
        spending_limit: 250,
        daily_per_diem_cap: 75,
        requires_receipt: true,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Expense Management"
        description="Employee expense claims, policy spending limits, multi-level approvals, and payroll reimbursement"
        actions={
          <div className="flex gap-2">
            {canManagePolicies && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCategoryModal(true)}
                className="gap-2 text-xs"
              >
                <Sliders className="h-4 w-4" />
                New Policy Category
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setShowReportModal(true)}
              className="gap-2 text-xs"
            >
              <Plus className="h-4 w-4" />
              New Expense Claim
            </Button>
          </div>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPITile
          title="Total Claimed"
          value={`$${(analytics?.total_claimed || 0).toLocaleString()}`}
          subtitle={`${analytics?.total_reports || 0} total reports submitted`}
          icon={Receipt}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <KPITile
          title="Total Approved"
          value={`$${(analytics?.total_approved || 0).toLocaleString()}`}
          subtitle={`${analytics?.approved_reports || 0} claims approved`}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
        />
        <KPITile
          title="Pending Review"
          value={analytics?.pending_reports?.toString() || '0'}
          subtitle="Waiting for manager or finance sign-off"
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
        <KPITile
          title="Policy Violations"
          value={analytics?.policy_violations?.toString() || '0'}
          subtitle="Claims flagged exceeding category caps"
          icon={AlertTriangle}
          iconColor="text-rose-600"
          iconBg="bg-rose-100"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border text-sm font-medium">
        <button
          onClick={() => setActiveTab('my')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'my'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Receipt className="h-4 w-4" />
          My Claims ({myReports.length})
        </button>
        {canApprove && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
              activeTab === 'approvals'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-4 w-4" />
            Approvals Queue ({allReports.filter((r) => r.status === 'submitted').length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'policies'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Policies & Categories ({categories.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'analytics'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Spend Analytics
        </button>
      </div>

      {/* ── TAB 1: MY EXPENSES ─────────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myReports.map((report) => (
              <div
                key={report.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-primary">{report.report_number}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        STATUS_BADGES[report.status] || 'bg-slate-100'
                      }`}
                    >
                      {report.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-foreground">{report.title}</h3>
                  {report.purpose && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{report.purpose}</p>
                  )}

                  <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">Claimed Total:</span>
                    <span className="text-lg font-extrabold text-foreground">
                      ${report.total_amount?.toFixed(2)} {report.currency}
                    </span>
                  </div>

                  {report.status === 'approved' && (
                    <div className="mt-1 flex items-baseline justify-between text-xs text-emerald-600 font-semibold">
                      <span>Approved Amount:</span>
                      <span>${report.approved_amount?.toFixed(2)} {report.currency}</span>
                    </div>
                  )}

                  {report.violation_count ? report.violation_count > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 font-medium bg-rose-50 p-1.5 rounded border border-rose-200">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{report.violation_count} policy violation(s) flagged</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 border-t border-border pt-3 flex justify-between items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setShowDetailModal(true);
                    }}
                    className="text-xs gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Items ({report.item_count || 0})
                  </Button>

                  {report.status === 'draft' && (
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReportId(report.id);
                          setShowItemModal(true);
                        }}
                        className="text-xs gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Item
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSubmitReport(report.id)}
                        className="text-xs gap-1"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Submit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {myReports.length === 0 && !myLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card">
              <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">No Expense Claims Yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Create a claim to submit your business travel, meals, or office expense receipts for reimbursement.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: APPROVALS QUEUE ────────────────────────────────────────────── */}
      {activeTab === 'approvals' && canApprove && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employee or report number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {allReports.length} organization expense reports
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Report #</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Title & Purpose</th>
                  <th className="p-3 text-right">Total Claimed</th>
                  <th className="p-3 text-right">Approved Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allReports
                  .filter((r) =>
                    r.report_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-bold text-primary">{r.report_number}</td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{r.first_name} {r.last_name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.department || 'General'}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{r.title}</div>
                        {r.purpose && <div className="text-[11px] text-muted-foreground line-clamp-1">{r.purpose}</div>}
                      </td>
                      <td className="p-3 text-right font-extrabold text-foreground">
                        ${r.total_amount?.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600">
                        {r.status === 'approved' || r.status === 'reimbursed' ? `$${r.approved_amount?.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGES[r.status] || 'bg-slate-100'}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedReportId(r.id);
                              setShowDetailModal(true);
                            }}
                            className="h-7 text-xs"
                          >
                            Inspect
                          </Button>
                          {r.status === 'submitted' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleOpenApprove(r)}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenReject(r)}
                                className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {r.status === 'approved' && canReimburse && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkReimbursed(r.id)}
                              className="h-7 text-xs text-emerald-600 hover:bg-emerald-50"
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: POLICIES & CATEGORIES ───────────────────────────────────────── */}
      {activeTab === 'policies' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {cat.code}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cat.requires_receipt ? 'Receipt Required' : 'Receipt Optional'}
                  </span>
                </div>

                <h3 className="mt-3 text-base font-semibold text-foreground">{cat.name}</h3>
                {cat.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{cat.description}</p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Spending Cap:</span>
                    <p className="font-bold text-foreground">
                      {cat.spending_limit ? `$${cat.spending_limit.toFixed(2)}` : 'No Cap'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Per Diem Cap:</span>
                    <p className="font-bold text-foreground">
                      {cat.daily_per_diem_cap ? `$${cat.daily_per_diem_cap.toFixed(2)} / day` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: SPEND ANALYTICS ────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Category Spend Breakdown */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Expenditure by Category
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Total approved and claimed expenses across categories
              </p>

              <div className="space-y-4">
                {(analytics?.category_spend || []).map((cs) => {
                  const total = analytics?.total_claimed || 1;
                  const percentage = total > 0 ? Math.round((cs.spend / total) * 100) : 0;

                  return (
                    <div key={cs.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground">{cs.name}</span>
                        <span className="font-bold text-foreground">
                          ${cs.spend.toFixed(2)} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department Spend Breakdown */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Expenditure by Department
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Cost center claim totals and report volumes
              </p>

              <div className="space-y-4">
                {(analytics?.department_spend || []).map((ds) => (
                  <div key={ds.department} className="flex items-center justify-between border-b pb-2 text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{ds.department}</p>
                      <p className="text-[11px] text-muted-foreground">{ds.count} reports submitted</p>
                    </div>
                    <span className="font-bold text-foreground text-sm">
                      ${ds.spend.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE EXPENSE REPORT ──────────────────────────────────────── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">New Expense Claim</h3>
              <button onClick={() => setShowReportModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateReport} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground">Claim Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client Onsite Visit — Chicago Q4"
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Business Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Explain business justification for expenses..."
                  value={reportForm.purpose}
                  onChange={(e) => setReportForm({ ...reportForm, purpose: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Currency</label>
                <select
                  value={reportForm.currency}
                  onChange={(e) => setReportForm({ ...reportForm, currency: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowReportModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createReportMutation.isPending}>
                  {createReportMutation.isPending ? 'Creating...' : 'Create Draft Claim'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD EXPENSE ITEM ───────────────────────────────────────────── */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">Add Expense Item</h3>
              <button onClick={() => setShowItemModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground">Category</label>
                <select
                  required
                  value={itemForm.category_id}
                  onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.spending_limit ? `(Limit: $${c.spending_limit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={itemForm.expense_date}
                    onChange={(e) => setItemForm({ ...itemForm, expense_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={itemForm.amount}
                    onChange={(e) => setItemForm({ ...itemForm, amount: parseFloat(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground">Merchant / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. Hilton Chicago, Uber, Delta Airlines"
                  value={itemForm.merchant_name}
                  onChange={(e) => setItemForm({ ...itemForm, merchant_name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="What was purchased and for what business reason..."
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Receipt Photo / Document URL</label>
                <input
                  type="url"
                  placeholder="https://storage... or receipt link"
                  value={itemForm.receipt_url}
                  onChange={(e) => setItemForm({ ...itemForm, receipt_url: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowItemModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={addItemMutation.isPending}>
                  {addItemMutation.isPending ? 'Adding...' : 'Add Line Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW REPORT DETAILS ─────────────────────────────────────────── */}
      {showDetailModal && singleReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{singleReport.report_number}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGES[singleReport.status] || 'bg-slate-100'}`}>
                    {singleReport.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-base font-semibold mt-1">{singleReport.title}</h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/20 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Employee:</span>
                  <p className="font-semibold text-foreground">{singleReport.first_name} {singleReport.last_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Department:</span>
                  <p className="font-semibold text-foreground">{singleReport.department || 'General'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Claimed:</span>
                  <p className="font-extrabold text-foreground text-sm">${singleReport.total_amount?.toFixed(2)}</p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-semibold text-foreground mb-2">Itemized Receipts ({singleReport.items?.length || 0})</h4>
                <div className="divide-y divide-border border rounded-lg overflow-hidden">
                  {(singleReport.items || []).map((item) => (
                    <div key={item.id} className="p-3 bg-card hover:bg-muted/10 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{item.description}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {item.category_name}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {item.expense_date} {item.merchant_name ? `• ${item.merchant_name}` : ''}
                          </p>
                          {item.policy_violation && (
                            <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {item.violation_note}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground text-sm">
                            ${item.amount.toFixed(2)}
                          </span>
                          {singleReport.status === 'draft' && (
                            <button
                              onClick={() => handleDeleteItem(singleReport.id, item.id)}
                              className="text-muted-foreground hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                {singleReport.status === 'draft' ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowItemModal(true);
                    }}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Another Item
                  </Button>
                ) : <div />}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDetailModal(false)}>
                    Close
                  </Button>
                  {singleReport.status === 'draft' && (
                    <Button size="sm" onClick={() => handleSubmitReport(singleReport.id)}>
                      Submit for Approval
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: APPROVE REPORT ─────────────────────────────────────────────── */}
      {showApproveModal && activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">Approve Expense Claim</h3>
              <button onClick={() => setShowApproveModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleApprove} className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                Approving claim <span className="font-bold text-foreground">{activeReport.report_number}</span> by {activeReport.first_name} {activeReport.last_name}.
              </p>

              <div>
                <label className="font-medium text-foreground">Approved Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={approvalForm.approved_amount}
                  onChange={(e) => setApprovalForm({ ...approvalForm, approved_amount: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="includePayroll"
                  checked={approvalForm.include_in_payroll}
                  onChange={(e) => setApprovalForm({ ...approvalForm, include_in_payroll: e.target.checked })}
                />
                <label htmlFor="includePayroll" className="font-medium text-foreground cursor-pointer">
                  Flag approved reimbursement for inclusion in next payroll run
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowApproveModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  Confirm Approval
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: REJECT REPORT ──────────────────────────────────────────────── */}
      {showRejectModal && activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">Reject Expense Claim</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleReject} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground">Rejection Reason</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specify why this claim cannot be approved (e.g. missing VAT receipts, personal expense)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="destructive">
                  Reject Claim
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE POLICY CATEGORY ─────────────────────────────────────── */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">New Policy Category</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client Entertainment"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ENTERTAINMENT"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Spending Cap ($)</label>
                  <input
                    type="number"
                    value={categoryForm.spending_limit}
                    onChange={(e) => setCategoryForm({ ...categoryForm, spending_limit: parseFloat(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground">Daily Per Diem Cap ($)</label>
                  <input
                    type="number"
                    value={categoryForm.daily_per_diem_cap}
                    onChange={(e) => setCategoryForm({ ...categoryForm, daily_per_diem_cap: parseFloat(e.target.value) })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reqReceipt"
                  checked={categoryForm.requires_receipt}
                  onChange={(e) => setCategoryForm({ ...categoryForm, requires_receipt: e.target.checked })}
                />
                <label htmlFor="reqReceipt" className="font-medium text-foreground cursor-pointer">
                  Mandatory itemized receipt upload
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCategoryModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createCategoryMutation.isPending}>
                  {createCategoryMutation.isPending ? 'Saving...' : 'Save Category'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
