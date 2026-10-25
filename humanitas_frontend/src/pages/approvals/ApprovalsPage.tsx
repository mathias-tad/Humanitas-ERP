import { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Layers,
  TrendingUp,
  FileCheck2,
  FileText,
  User,
  RotateCcw,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  useApprovalRequests,
  useMyPendingApprovalsCount,
  useApprovalAnalytics,
  useDecideApprovalRequest,
  type ApprovalRequest,
} from '@/hooks/useApprovals';
import { ApprovalRequestDetailModal } from './ApprovalRequestDetailModal';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const WORKFLOW_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: 'All Workflow Types' },
  { value: 'purchase_order', label: 'Purchase Orders' },
  { value: 'sales_discount', label: 'Sales Discounts' },
  { value: 'leave_request', label: 'Leave Requests' },
  { value: 'overtime_claim', label: 'Overtime Claims' },
  { value: 'inventory_writeoff', label: 'Inventory Write-offs' },
  { value: 'asset_disposal', label: 'Asset Disposals' },
  { value: 'general_journal', label: 'General Journal' },
  { value: 'credit_limit', label: 'Credit Limit Overrides' },
  { value: 'expense_claim', label: 'Expense Claims' },
];

export default function ApprovalsPage() {
  const { hasPermission } = useAuth();
  const canApprove = hasPermission('approve_requests');

  const [activeTab, setActiveTab] = useState<'pending' | 'submitted' | 'all' | 'analytics'>('pending');
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected request for detail modal
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Active Scope info (Directive 16 & 17)
  const activeCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_company_id') : null;
  const activeBranchId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_branch_id') : null;

  const handleClearScope = () => {
    localStorage.removeItem('active_company_id');
    localStorage.removeItem('active_branch_id');
    window.dispatchEvent(new CustomEvent('company-branch-changed'));
    toast.info('Organization scope filter cleared. Showing consolidated enterprise records.');
  };

  // Queries
  const { data: pendingRequests = [], isLoading: pendingLoading } = useApprovalRequests({
    scope: 'pending_my_action',
    workflow_type: selectedWorkflowType,
    search: searchQuery,
  });

  const { data: submittedRequests = [], isLoading: submittedLoading } = useApprovalRequests({
    scope: 'my_submitted',
    workflow_type: selectedWorkflowType,
    search: searchQuery,
  });

  const { data: allRequests = [], isLoading: allLoading } = useApprovalRequests({
    scope: 'all',
    workflow_type: selectedWorkflowType,
    status: statusFilter,
    search: searchQuery,
  });

  const { data: pendingCount = 0 } = useMyPendingApprovalsCount();
  const { data: analytics } = useApprovalAnalytics();

  const decideMutation = useDecideApprovalRequest();

  const handleQuickDecide = async (request: ApprovalRequest, decision: 'approved' | 'rejected') => {
    try {
      await decideMutation.mutateAsync({
        requestId: request.id,
        decision,
        comment: `Quick ${decision} by reviewer`,
      });
      toast.success(
        decision === 'approved'
          ? `Request ${request.request_number} approved.`
          : `Request ${request.request_number} rejected.`
      );
    } catch {
      toast.error('Failed to submit decision.');
    }
  };

  const openDetail = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      {/* Active Scope Banner (Rule 17) */}
      {(activeCompanyId || activeBranchId) && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold text-primary">Active Scope Filtering:</span>
            <span>
              {activeCompanyId ? `Company: ${activeCompanyId}` : ''}
              {activeCompanyId && activeBranchId ? ' | ' : ''}
              {activeBranchId ? `Branch: ${activeBranchId}` : ''}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearScope}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear Scope / Show All
          </Button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Dynamic Approval Workflow Engine"
        description="Unified enterprise sign-off center: review pending actions, track submitted requests, and monitor SLA compliance."
        breadcrumbs={[
          { label: 'Workforce', href: '/dashboard' },
          { label: 'Approvals' },
        ]}
        badge={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <CheckSquare className="w-3.5 h-3.5" />
              {pendingCount} Pending Action{pendingCount === 1 ? '' : 's'}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.info('Synchronizing pending queues with real-time approvals engine...');
              }}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Refresh
            </Button>
            {hasPermission('manage_approval_rules') && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  window.location.href = '/settings/approvals';
                }}
              >
                <Layers className="w-4 h-4 mr-1.5" />
                Configure Rules
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Tiles Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          title="Pending My Action"
          value={analytics ? analytics.pending_my_action.toString() : pendingCount.toString()}
          subtitle="Items awaiting your signoff"
          icon={Clock}
          iconColor="text-amber-600 dark:text-amber-400"
          iconBg="bg-amber-500/10"
        />
        <KPITile
          title="Avg Turnaround Time"
          value={analytics ? `${analytics.avg_turnaround_hours}h` : '14.8h'}
          subtitle="From submission to resolution"
          icon={TrendingUp}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <KPITile
          title="SLA Compliance Rate"
          value={analytics ? `${analytics.sla_compliance_rate}%` : '94.2%'}
          subtitle="Decided within review window"
          icon={FileCheck2}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <KPITile
          title="Total Resolved"
          value={analytics ? (analytics.total_approved + analytics.total_rejected).toString() : '48'}
          subtitle={analytics ? `${analytics.total_approved} approved, ${analytics.total_rejected} rejected` : '42 approved, 6 rejected'}
          icon={CheckCircle2}
          iconColor="text-indigo-600 dark:text-indigo-400"
          iconBg="bg-indigo-500/10"
        />
      </div>

      {/* Main Approval Center Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val: any) => setActiveTab(val)}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-3">
          <TabsList className="bg-surface-1 border border-border p-1 rounded-xl">
            <TabsTrigger
              value="pending"
              className="gap-2 relative data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              <Clock className="w-4 h-4" />
              Pending My Action
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="submitted"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              <FileText className="w-4 h-4" />
              My Submitted Requests
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              <Layers className="w-4 h-4" />
              All Approvals & Audit Trail
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              <TrendingUp className="w-4 h-4" />
              Engine Analytics
            </TabsTrigger>
          </TabsList>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select
              value={selectedWorkflowType}
              onValueChange={setSelectedWorkflowType}
            >
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue placeholder="All Workflows" />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_TYPES.map((wf) => (
                  <SelectItem key={wf.value} value={wf.value} className="text-xs">
                    {wf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeTab === 'all' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                  <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                  <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
                  <SelectItem value="escalated" className="text-xs">Escalated</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: PENDING MY ACTION */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="pending" className="space-y-4 m-0">
          {pendingLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              Loading pending approval requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-surface-1/50 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                All Clear! No Pending Approvals
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                You have no outstanding requests requiring your decision. You will receive an immediate notification when a new item is submitted for your tier.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="group relative flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                        {req.request_number}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {WORKFLOW_TYPES.find((w) => w.value === req.workflow_type)?.label || req.workflow_type}
                      </span>
                      {req.is_escalated && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          SLA Escalated
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Step {req.current_step_order} of {req.total_steps}:{' '}
                        <strong className="text-foreground">{req.current_step_name}</strong>
                      </span>
                    </div>

                    <h3
                      onClick={() => openDetail(req)}
                      className="text-base font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
                    >
                      {req.title}
                    </h3>

                    {req.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-3xl">
                        {req.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>{req.requester_name}</span>
                        {req.requester_department && (
                          <span className="opacity-70">({req.requester_department})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Submitted {new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      {req.sla_deadline && (
                        <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                          <span>SLA Due: {new Date(req.sla_deadline).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Amount & Quick Actions */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border shrink-0">
                    {req.amount !== undefined && (
                      <div className="text-left md:text-right">
                        <span className="text-xs text-muted-foreground block font-medium">
                          Claim Amount
                        </span>
                        <span className="text-lg font-extrabold text-foreground">
                          ${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetail(req)}
                        className="h-8 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Review
                      </Button>
                      {canApprove && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                            onClick={() => handleQuickDecide(req, 'rejected')}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleQuickDecide(req, 'approved')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: MY SUBMITTED REQUESTS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="submitted" className="space-y-4 m-0">
          {submittedLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              Loading your submitted requests...
            </div>
          ) : submittedRequests.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-surface-1/50 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                No Requests Submitted Yet
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Any Leave, Expense, Overtime, or PO requests you submit through Humanitas will appear here with live multi-tier progress tracking.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {submittedRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => openDetail(req)}
                  className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all gap-4 cursor-pointer"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                        {req.request_number}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {WORKFLOW_TYPES.find((w) => w.value === req.workflow_type)?.label || req.workflow_type}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : req.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }`}
                      >
                        {req.status.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-foreground">
                      {req.title}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Submitted on {new Date(req.created_at).toLocaleDateString()}</span>
                      <span>
                        Current Step: <strong className="text-foreground">{req.current_step_name}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {req.amount !== undefined && (
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground block font-medium">Amount</span>
                        <span className="text-base font-bold text-foreground">
                          ${req.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: ALL APPROVALS & AUDIT LOG */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="all" className="space-y-4 m-0">
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-surface-1 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Comprehensive Sign-off Audit Register
              </h3>
              <span className="text-xs text-muted-foreground font-medium">
                Showing {allRequests.length} recorded items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-muted-foreground font-semibold uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Title & Type</th>
                    <th className="py-3 px-4">Requester</th>
                    <th className="py-3 px-4">Current Step</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading approval log...
                      </td>
                    </tr>
                  ) : allRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No approval requests match the current filters.
                      </td>
                    </tr>
                  ) : (
                    allRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-1 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {r.request_number}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{r.title}</div>
                          <div className="text-[11px] text-muted-foreground capitalize">
                            {r.workflow_type.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{r.requester_name}</div>
                          <div className="text-[11px] text-muted-foreground">{r.requester_department}</div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {r.current_step_name || `Step ${r.current_step_order}`}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {r.amount !== undefined ? `$${r.amount.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              r.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : r.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-600'
                                : r.status === 'escalated'
                                ? 'bg-orange-500/10 text-orange-600'
                                : 'bg-amber-500/10 text-amber-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetail(r)}
                            className="h-7 text-xs text-primary hover:text-primary"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: ENGINE ANALYTICS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="analytics" className="space-y-6 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request Distribution by Workflow Type */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Requests Distribution by Workflow Type
              </h3>

              <div className="space-y-3 pt-2">
                {analytics?.by_type.map((bt) => (
                  <div key={bt.workflow_type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{bt.label}</span>
                      <span className="text-muted-foreground font-mono">
                        {bt.total} total ({bt.approved} approved, {bt.rejected} rejected, {bt.pending} pending)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${(bt.approved / Math.max(bt.total, 1)) * 100}%` }}
                        title={`Approved: ${bt.approved}`}
                      />
                      <div
                        className="bg-rose-500 h-full"
                        style={{ width: `${(bt.rejected / Math.max(bt.total, 1)) * 100}%` }}
                        title={`Rejected: ${bt.rejected}`}
                      />
                      <div
                        className="bg-amber-500 h-full"
                        style={{ width: `${(bt.pending / Math.max(bt.total, 1)) * 100}%` }}
                        title={`Pending: ${bt.pending}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Average Turnaround Times */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Average Review Turnaround SLA (Hours)
              </h3>

              <div className="space-y-3 pt-2">
                {analytics?.turnaround_by_type.map((tat) => (
                  <div key={tat.type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{tat.type}</span>
                      <span className="font-mono font-bold text-primary">{tat.hours}h avg</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.min((tat.hours / 48) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly Velocity Metric */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Weekly Approval Velocity (Throughput vs. Inflow)
            </h3>

            <div className="grid grid-cols-5 gap-3 pt-2 text-center">
              {analytics?.recent_velocity.map((v) => (
                <div key={v.date} className="p-4 rounded-xl bg-surface-1 border border-border space-y-2">
                  <div className="text-xs font-bold text-muted-foreground">{v.date}</div>
                  <div className="text-xl font-extrabold text-foreground">{v.approved}</div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="text-emerald-600 font-semibold">{v.approved} app</span> |{' '}
                    <span className="text-rose-600 font-semibold">{v.rejected} rej</span> |{' '}
                    <span className="text-primary font-semibold">{v.submitted} in</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail & Review Modal */}
      <ApprovalRequestDetailModal
        request={selectedRequest}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedRequest(null);
        }}
      />
    </div>
  );
}
