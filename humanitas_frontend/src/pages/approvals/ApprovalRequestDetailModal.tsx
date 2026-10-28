import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Building,
  Calendar,
  Layers,
  ShieldCheck,
  FileText,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import {
  type ApprovalRequest,
  useDecideApprovalRequest,
} from '@/hooks/useApprovals';
import { toast } from 'sonner';

interface ApprovalRequestDetailModalProps {
  request: ApprovalRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending Approval',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  approved: {
    label: 'Fully Approved',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  escalated: {
    label: 'SLA Escalated',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

const WORKFLOW_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  sales_discount: 'Sales Discount',
  leave_request: 'Leave Request',
  overtime_claim: 'Overtime Claim',
  inventory_writeoff: 'Inventory Write-off',
  asset_disposal: 'Asset Disposal',
  general_journal: 'General Journal',
  credit_limit: 'Credit Limit Override',
  expense_claim: 'Expense Claim',
};

export const ApprovalRequestDetailModal: React.FC<ApprovalRequestDetailModalProps> = ({
  request,
  isOpen,
  onClose,
}) => {
  const [decisionComment, setDecisionComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const decideMutation = useDecideApprovalRequest();

  if (!request) return null;

  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const workflowLabel = WORKFLOW_LABELS[request.workflow_type] || request.workflow_type;

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setIsSubmitting(true);
    try {
      await decideMutation.mutateAsync({
        requestId: request.id,
        decision,
        comment: decisionComment.trim() || undefined,
      });
      toast.success(
        decision === 'approved'
          ? `Request ${request.request_number} approved successfully.`
          : `Request ${request.request_number} rejected.`
      );
      setDecisionComment('');
      onClose();
    } catch {
      toast.error('Failed to submit approval decision. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border bg-card">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border bg-surface-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  {request.request_number}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {workflowLabel}
                </span>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.badgeClass}`}
                >
                  {statusConfig.icon}
                  {statusConfig.label}
                </div>
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {request.title}
              </DialogTitle>
            </div>
            {request.amount !== undefined && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Request Amount
                </div>
                <div className="text-2xl font-extrabold text-primary">
                  ${request.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    {request.currency || 'USD'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Summary Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-1 border border-border/80">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Requester</div>
                <div className="text-sm font-semibold text-foreground truncate">
                  {request.requester_name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {request.requester_email || 'Staff Member'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Building className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Department</div>
                <div className="text-sm font-semibold text-foreground truncate">
                  {request.requester_department || 'General'}
                </div>
                <div className="text-xs text-muted-foreground">Internal Org</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Date Submitted</div>
                <div className="text-sm font-semibold text-foreground">
                  {new Date(request.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">SLA Deadline</div>
                <div className="text-sm font-semibold text-foreground">
                  {request.sla_deadline
                    ? new Date(request.sla_deadline).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Standard (48h)'}
                </div>
                {request.is_escalated && (
                  <span className="text-[11px] font-bold text-rose-500">
                    Escalated
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {request.description && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Request Details & Justification
              </h4>
              <div className="p-3.5 rounded-lg border border-border bg-surface-1/50 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {request.description}
              </div>
            </div>
          )}

          {/* Stepper Progress Indicator */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Approval Workflow Progress ({request.current_step_order} of {request.total_steps} Steps)
              </h4>
              <span className="text-xs text-muted-foreground capitalize">
                Routing: {request.routing_mode}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface-1">
              <div className="relative">
                <div className="space-y-4">
                  {request.steps?.map((step, idx) => {
                    const isApproved = step.status === 'approved';
                    const isCurrent = step.status === 'pending' && step.step_order === request.current_step_order;
                    const isRejected = step.status === 'rejected';

                    return (
                      <div key={step.id || idx} className="flex items-start gap-3.5 relative">
                        {/* Circle Indicator */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 transition-colors ${
                            isApproved
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : isRejected
                              ? 'bg-rose-500 text-white shadow-sm'
                              : isCurrent
                              ? 'bg-amber-500 text-white ring-4 ring-amber-500/20 animate-pulse'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {isApproved ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isRejected ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            step.step_order
                          )}
                        </div>

                        {/* Step Details */}
                        <div className="flex-1 pb-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {step.step_name}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                isApproved
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : isRejected
                                  ? 'bg-rose-500/10 text-rose-600'
                                  : isCurrent
                                  ? 'bg-amber-500/10 text-amber-600 font-semibold'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isApproved
                                ? 'Approved'
                                : isRejected
                                ? 'Rejected'
                                : isCurrent
                                ? 'Action Required'
                                : 'Pending'}
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground mt-0.5">
                            Assigned to:{' '}
                            <span className="font-medium text-foreground">
                              {step.role_name || step.assigned_to_user_name || 'Approver'}
                            </span>
                          </div>

                          {step.decided_at && (
                            <div className="mt-2 text-xs p-2.5 rounded-md bg-muted/60 border border-border/60 text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {step.decided_by_name || 'Reviewer'}:
                              </span>{' '}
                              "{step.decision_note || 'Approved'}"
                              <span className="block text-[11px] text-muted-foreground/80 mt-1">
                                {new Date(step.decided_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Timeline Audit History */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Complete Action Audit Trail
            </h4>

            <div className="space-y-2 border rounded-xl p-4 bg-surface-1 border-border">
              {(() => {
                const historyList = Array.isArray(request.history)
                  ? request.history
                  : (Array.isArray((request as any).actions) ? (request as any).actions : []);
                return historyList && historyList.length > 0 ? (
                  historyList.map((h: any, i: number) => (
                    <div
                      key={h.id || i}
                      className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
                    >
                      <div className="p-1.5 rounded-full bg-muted text-muted-foreground shrink-0 mt-0.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-foreground">
                            {h.actor_name || h.approver_name || 'System'}{' '}
                            {(h.actor_role || h.approver_role) && (
                              <span className="text-muted-foreground font-normal">
                                ({h.actor_role || h.approver_role})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground shrink-0">
                            {new Date(h.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-xs font-medium text-primary capitalize mt-0.5">
                          Action: {h.action}
                        </div>
                        {(h.comment || h.comments) && (
                          <div className="text-xs text-muted-foreground italic mt-1 bg-surface-2 p-2 rounded border border-border/40">
                            "{h.comment || h.comments}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    No historical actions logged yet.
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Quick Reviewer Decision Box (When user is eligible to act) */}
          {request.can_user_act && (request.status === 'pending' || request.status === 'escalated') && (
            <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h4 className="text-sm font-bold text-foreground">
                  Your Decision Required
                </h4>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Reviewer Notes / Feedback (Optional for approval, recommended for rejection)
                </label>
                <Textarea
                  placeholder="Enter comments, conditions, or reason for decision..."
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  className="bg-card text-sm resize-none"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <Button
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                  disabled={isSubmitting}
                  onClick={() => handleDecision('rejected')}
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Reject Request
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isSubmitting}
                  onClick={() => handleDecision('approved')}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Approve Request
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-1 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
