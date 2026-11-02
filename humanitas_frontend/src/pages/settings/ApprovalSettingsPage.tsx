import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitPullRequest,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Edit2,
  DollarSign,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  useApprovalWorkflows,
  useCreateApprovalWorkflow,
  useUpdateApprovalWorkflow,
  useDeleteApprovalWorkflow,
  type ApprovalWorkflow,
  type ApprovalWorkflowStep,
  type ApprovalWorkflowType,
  type ApprovalRoutingMode,
} from '@/hooks/useApprovals';
import { toast } from 'sonner';
import { useERPModules } from '@/context/ModuleContext';

interface WorkflowTypeConfig {
  value: ApprovalWorkflowType;
  label: string;
  desc: string;
  module?: string;
  isCommon?: boolean;
}

const ALL_WORKFLOW_TYPE_OPTIONS: WorkflowTypeConfig[] = [
  // HRMS Module
  { value: 'leave_request', label: 'Leave Requests & Time Off', desc: 'Annual vacation, sick leave, compassionate, and extended sabbaticals', module: 'hrms' },
  { value: 'overtime_claim', label: 'Overtime & Shift Exceptions', desc: 'Extra hours pre-approval and overtime claims', module: 'hrms' },
  { value: 'shift_swap', label: 'Shift Swap & Exchange Requests', desc: 'Mutual shift trade and schedule change signoffs', module: 'hrms' },

  // PMS Module
  { value: 'timesheet', label: 'Timesheet & Project Hour Approvals', desc: 'Sprint task logged hours and client billable timesheet signoffs', module: 'pms' },
  { value: 'project_budget', label: 'Project Budget & Milestone Signoffs', desc: 'Sprint budget allocation and project milestone deliverables', module: 'pms' },

  // Purchasing Module
  { value: 'purchase_order', label: 'Purchase Orders & Requisitions', desc: 'Vendor orders, capital expenditures, and equipment requisitions', module: 'purchasing' },

  // Sales Module
  { value: 'sales_discount', label: 'Sales Quotation & Discounts', desc: 'Contract discount percentages and price-list margin overrides', module: 'sales' },
  { value: 'credit_limit', label: 'Customer Credit Limit Overrides', desc: 'Credit line extensions beyond customer account risk limits', module: 'sales' },

  // Inventory Module
  { value: 'inventory_writeoff', label: 'Inventory Write-offs & Adjustments', desc: 'Damaged stock scrap, shrinkage adjustments, and revaluation writes', module: 'inventory' },

  // Accounting Module
  { value: 'general_journal', label: 'General Journal Adjustment Postings', desc: 'Manual journal ledger entries and depreciation adjustments', module: 'accounting' },
  { value: 'asset_disposal', label: 'Fixed Asset Disposals', desc: 'Equipment decommissioning, write-offs, and salvage asset sales', module: 'accounting' },

  // Universal Common
  { value: 'expense_claim', label: 'Employee Expense Reimbursements', desc: 'Corporate expense claims, mileage, and travel reimbursements', isCommon: true },
  { value: 'document_signature', label: 'Document & E-Signature Signoffs', desc: 'Contracts, policy agreements, and legal certifications', isCommon: true },
];

export default function ApprovalSettingsPage() {
  const { isModuleSubscribed } = useERPModules();

  const availableWorkflowTypes = useMemo(() => {
    return ALL_WORKFLOW_TYPE_OPTIONS.filter((opt) => {
      if (opt.isCommon) return true;
      if (!opt.module) return true;
      return isModuleSubscribed(opt.module);
    });
  }, [isModuleSubscribed]);

  const { data: rawWorkflows = [], isLoading } = useApprovalWorkflows();
  const workflows: ApprovalWorkflow[] = Array.isArray(rawWorkflows) ? rawWorkflows : (rawWorkflows as any)?.workflows || [];
  const createMutation = useCreateApprovalWorkflow();
  const updateMutation = useUpdateApprovalWorkflow();
  const deleteMutation = useDeleteApprovalWorkflow();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workflowType, setWorkflowType] = useState<ApprovalWorkflowType>(
    availableWorkflowTypes[0]?.value || 'expense_claim'
  );
  const [routingMode, setRoutingMode] = useState<ApprovalRoutingMode>('sequential');
  const [hasThresholds, setHasThresholds] = useState(true);
  const [minAmount, setMinAmount] = useState<string>('1000');
  const [maxAmount, setMaxAmount] = useState<string>('50000');
  const [steps, setSteps] = useState<ApprovalWorkflowStep[]>([
    {
      id: 'step-1',
      step_order: 1,
      name: 'Department Team Lead Approval',
      approver_type: 'role',
      role_name: 'Team Lead',
      sla_hours: 24,
      auto_escalate: true,
      escalate_to_role_name: 'Operations Manager',
    },
    {
      id: 'step-2',
      step_order: 2,
      name: 'Department Director Signoff',
      approver_type: 'role',
      role_name: 'Director',
      sla_hours: 48,
      auto_escalate: false,
    },
  ]);

  const resetForm = () => {
    setEditingWorkflowId(null);
    setName('');
    setDescription('');
    setWorkflowType('purchase_order');
    setRoutingMode('sequential');
    setHasThresholds(true);
    setMinAmount('1000');
    setMaxAmount('50000');
    setSteps([
      {
        id: `step-${Date.now()}-1`,
        step_order: 1,
        name: 'Initial Tier Review',
        approver_type: 'role',
        role_name: 'Team Lead',
        sla_hours: 24,
        auto_escalate: true,
        escalate_to_role_name: 'Department Head',
      },
      {
        id: `step-${Date.now()}-2`,
        step_order: 2,
        name: 'Executive Signoff',
        approver_type: 'role',
        role_name: 'Director',
        sla_hours: 48,
        auto_escalate: false,
      },
    ]);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (wf: ApprovalWorkflow) => {
    setEditingWorkflowId(wf.id);
    setName(wf.name);
    setDescription(wf.description || '');
    setWorkflowType(wf.workflow_type);
    setRoutingMode(wf.routing_mode);
    setHasThresholds(wf.min_amount !== undefined || wf.max_amount !== undefined);
    setMinAmount(wf.min_amount !== undefined ? wf.min_amount.toString() : '');
    setMaxAmount(wf.max_amount !== undefined ? wf.max_amount.toString() : '');
    setSteps(wf.steps && wf.steps.length > 0 ? [...wf.steps] : []);
    setIsModalOpen(true);
  };

  // Step builder helpers
  const handleAddStep = () => {
    const nextOrder = steps.length + 1;
    const newStep: ApprovalWorkflowStep = {
      id: `step-${Date.now()}`,
      step_order: nextOrder,
      name: `Tier ${nextOrder} Signoff`,
      approver_type: 'role',
      role_name: 'Manager',
      sla_hours: 24,
      auto_escalate: false,
    };
    setSteps([...steps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      toast.warning('A workflow must contain at least 1 approval step.');
      return;
    }
    const updated = steps.filter((_, idx) => idx !== index).map((s, idx) => ({
      ...s,
      step_order: idx + 1,
    }));
    setSteps(updated);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIdx];
    newSteps[targetIdx] = temp;

    // Recalculate order numbers
    const reordered = newSteps.map((s, idx) => ({ ...s, step_order: idx + 1 }));
    setSteps(reordered);
  };

  const handleUpdateStep = (index: number, updates: Partial<ApprovalWorkflowStep>) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], ...updates };
    setSteps(updated);
  };

  const handleSaveWorkflow = async () => {
    if (!name.trim()) {
      toast.error('Please enter a workflow name.');
      return;
    }
    if (steps.length === 0) {
      toast.error('Please add at least one approval step.');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      workflow_type: workflowType,
      routing_mode: routingMode,
      min_amount: hasThresholds && minAmount ? parseFloat(minAmount) : undefined,
      max_amount: hasThresholds && maxAmount ? parseFloat(maxAmount) : undefined,
      is_active: true,
      steps,
    };

    try {
      if (editingWorkflowId) {
        await updateMutation.mutateAsync({
          id: editingWorkflowId,
          updates: payload,
        });
        toast.success(`Workflow "${name}" updated successfully.`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(`Workflow "${name}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch {
      toast.error('Failed to save workflow.');
    }
  };

  const handleDeleteWorkflow = async (id: string, wfName: string) => {
    if (confirm(`Are you sure you want to delete workflow rule "${wfName}"?`)) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(`Workflow rule deleted.`);
      } catch {
        toast.error('Failed to delete workflow rule.');
      }
    }
  };

  const handleToggleActive = async (wf: ApprovalWorkflow, currentState: boolean) => {
    try {
      await updateMutation.mutateAsync({
        id: wf.id,
        updates: { is_active: !currentState },
      });
      toast.success(
        !currentState
          ? `Workflow "${wf.name}" activated.`
          : `Workflow "${wf.name}" deactivated.`
      );
    } catch {
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Dynamic Approval Workflow Rules & Hierarchy Builder"
        description="Configure multi-tier approval chains, conditional monetary thresholds, routing modes, and auto-escalation SLAs."
        breadcrumbs={[
          { label: 'Workforce', href: '/dashboard' },
          { label: 'Approvals', href: '/approvals' },
          { label: 'Workflow Rules' },
        ]}
        actions={
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Approval Rule
          </Button>
        }
      />

      {/* Rules Information Card */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-foreground leading-relaxed space-y-1">
          <span className="font-bold text-primary block">
            How Dynamic Approval Rules Work:
          </span>
          <p className="text-muted-foreground">
            Operational documents (Purchase Orders, Discounts, Leave, Overtime, Stock Adjustments, Asset Disposals) are automatically evaluated against these rules upon submission. If monetary thresholds match, the engine routes the request through the defined sequence or parallel reviewers.
          </p>
        </div>
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
            Loading workflow rules...
          </div>
        ) : workflows.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-surface-1/50 space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <GitPullRequest className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              No Approval Rules Configured
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Create your first multi-tier approval workflow rule to enforce governance and sign-off compliance.
            </p>
            <Button onClick={handleOpenCreate} className="mt-2">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Rule
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {workflows.map((wf: ApprovalWorkflow) => {
              const typeOption = ALL_WORKFLOW_TYPE_OPTIONS.find((t) => t.value === wf.workflow_type);

              return (
                <div
                  key={wf.id}
                  className={`p-6 rounded-2xl border transition-all ${
                    wf.is_active
                      ? 'border-border bg-card shadow-sm'
                      : 'border-border/60 bg-muted/20 opacity-75'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Left: Info & Stepper Preview */}
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          {typeOption?.label || wf.workflow_type}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground capitalize">
                          {wf.routing_mode} Routing
                        </span>
                        {(wf.min_amount !== undefined || wf.max_amount !== undefined) && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {wf.min_amount !== undefined && wf.max_amount !== undefined
                              ? `$${wf.min_amount.toLocaleString()} — $${wf.max_amount.toLocaleString()}`
                              : wf.min_amount !== undefined
                              ? `> $${wf.min_amount.toLocaleString()}`
                              : `< $${wf.max_amount?.toLocaleString()}`}
                          </span>
                        )}
                        {!wf.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 font-semibold">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-foreground">
                          {wf.name}
                        </h3>
                        {wf.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {wf.description}
                          </p>
                        )}
                      </div>

                      {/* Visual Steps Chain */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Approval Chain ({wf.steps?.length || 0} Stages)
                        </span>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {wf.steps?.map((st: ApprovalWorkflowStep, i: number) => (
                            <React.Fragment key={st.id || i}>
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-surface-1 text-xs">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                                  {st.step_order}
                                </span>
                                <div>
                                  <div className="font-semibold text-foreground">
                                    {st.name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {st.role_name || st.user_name || st.approver_type} ({st.sla_hours}h SLA)
                                  </div>
                                </div>
                              </div>
                              {i < wf.steps.length - 1 && (
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions & Switch */}
                    <div className="flex items-center gap-3 shrink-0 pt-2 lg:pt-0">
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs text-muted-foreground">
                          {wf.is_active ? 'Active' : 'Disabled'}
                        </span>
                        <Switch
                          checked={wf.is_active}
                          onCheckedChange={() => handleToggleActive(wf, wf.is_active)}
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(wf)}
                        className="h-8 text-xs gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Rule
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteWorkflow(wf.id, wf.name)}
                        className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* CREATE / EDIT WORKFLOW RULE MODAL */}
      {/* ============================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border bg-card">
          <DialogHeader className="p-6 border-b border-border bg-surface-1">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <GitPullRequest className="w-5 h-5 text-primary" />
              {editingWorkflowId ? 'Edit Approval Workflow Rule' : 'Create New Approval Rule'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Define the hierarchical review tiers, threshold conditions, and SLA escalations for this workflow.
            </p>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. General Rule Configuration
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Workflow Rule Name *
                  </label>
                  <Input
                    placeholder="e.g. Standard Purchase Orders (> $1,000)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Workflow Type *
                  </label>
                  <Select
                    value={workflowType}
                    onValueChange={(val: any) => setWorkflowType(val)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWorkflowTypes.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Description & Governance Policy (Optional)
                </label>
                <Textarea
                  placeholder="Outline purpose, scope, and specific financial bylaws enforced by this workflow..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs resize-none"
                  rows={2}
                />
              </div>

              {/* Routing Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground block">
                  Routing Execution Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setRoutingMode('sequential')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      routingMode === 'sequential'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:bg-surface-1'
                    }`}
                  >
                    <div className="font-bold text-xs">Sequential (Stepped)</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Approvers must sign off in strict tier order (Tier 1 → Tier 2 → Tier 3).
                    </div>
                  </div>

                  <div
                    onClick={() => setRoutingMode('parallel')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      routingMode === 'parallel'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:bg-surface-1'
                    }`}
                  >
                    <div className="font-bold text-xs">Parallel (Consensus)</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      All reviewers are alerted at once and must approve before final signoff.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Threshold Rules */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    2. Threshold Trigger Rules (Amount-Based Routing)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Optionally restrict this rule to specific financial transaction amounts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Enable</span>
                  <Switch
                    checked={hasThresholds}
                    onCheckedChange={setHasThresholds}
                  />
                </div>
              </div>

              {hasThresholds && (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-surface-1 border border-border">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Minimum Threshold ($)
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g. 1000"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Requests below this amount will not trigger this rule.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Maximum Threshold ($)
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g. 50000"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Requests exceeding this amount will route to higher executive tiers.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Tier Step Builder */}
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    3. Dynamic Approval Tier Steps ({steps.length} Stages)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Define the sequential or parallel sign-off stages, SLA turnaround, and auto-escalations.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddStep}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Tier Step
                </Button>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div
                    key={step.id || idx}
                    className="p-4 rounded-xl border border-border bg-surface-1 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          Stage {idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={idx === 0}
                          onClick={() => handleMoveStep(idx, 'up')}
                          className="h-7 w-7 p-0"
                          title="Move step up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={idx === steps.length - 1}
                          onClick={() => handleMoveStep(idx, 'down')}
                          className="h-7 w-7 p-0"
                          title="Move step down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStep(idx)}
                          className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700"
                          title="Delete step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Step Label *
                        </label>
                        <Input
                          value={step.name}
                          onChange={(e) => handleUpdateStep(idx, { name: e.target.value })}
                          placeholder="e.g. Director Signoff"
                          className="text-xs h-8"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">
                          Approver Assignment Type
                        </label>
                        <Select
                          value={step.approver_type}
                          onValueChange={(val: any) => handleUpdateStep(idx, { approver_type: val })}
                        >
                          <SelectTrigger className="text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="role" className="text-xs">Role-based (Any with Role)</SelectItem>
                            <SelectItem value="line_manager" className="text-xs">Requester Line Manager</SelectItem>
                            <SelectItem value="department_head" className="text-xs">Head of Department (HOD)</SelectItem>
                            <SelectItem value="specific_user" className="text-xs">Specific User</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {step.approver_type === 'role' && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Required Role Name
                          </label>
                          <Input
                            value={step.role_name || ''}
                            onChange={(e) => handleUpdateStep(idx, { role_name: e.target.value })}
                            placeholder="e.g. Team Lead, Director, CFO"
                            className="text-xs h-8"
                          />
                        </div>
                      )}

                      {step.approver_type === 'specific_user' && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            Assigned User Name
                          </label>
                          <Input
                            value={step.user_name || ''}
                            onChange={(e) => handleUpdateStep(idx, { user_name: e.target.value })}
                            placeholder="e.g. John Doe"
                            className="text-xs h-8"
                          />
                        </div>
                      )}
                    </div>

                    {/* SLA and Auto-escalate */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/50 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">Review SLA:</span>
                        <Input
                          type="number"
                          value={step.sla_hours}
                          onChange={(e) => handleUpdateStep(idx, { sla_hours: parseInt(e.target.value) || 24 })}
                          className="w-16 h-7 text-xs"
                        />
                        <span className="text-[11px] text-muted-foreground">Hours</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">Auto-escalate on breach:</span>
                          <Switch
                            checked={step.auto_escalate || false}
                            onCheckedChange={(val) => handleUpdateStep(idx, { auto_escalate: val })}
                          />
                        </div>

                        {step.auto_escalate && (
                          <Input
                            placeholder="Escalate to role/user..."
                            value={step.escalate_to_role_name || ''}
                            onChange={(e) => handleUpdateStep(idx, { escalate_to_role_name: e.target.value })}
                            className="h-7 w-44 text-xs"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border bg-surface-1 flex items-center justify-end gap-2.5">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWorkflow}>
              {editingWorkflowId ? 'Update Rule' : 'Save Workflow Rule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
