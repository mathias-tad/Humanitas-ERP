import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import {
  HeartPulse,
  ShieldCheck,
  DollarSign,
  Users,
  Plus,
  Search,
  Calendar,
  Building2,
  Trash2,
  X,
  PieChart,
  Activity,
  Layers,
  Sparkles,
  Receipt,
} from 'lucide-react';
import {
  useBenefitPlans,
  useBenefitEnrollments,
  useBenefitEnrollment,
  useBenefitStats,
  useOpenEnrollmentPeriods,
  useCreateBenefitPlan,
  useEnrollEmployee,
  useAddDependent,
  useRemoveDependent,
  useCreateOpenEnrollmentPeriod,
  type BenefitPlan,
} from '@/hooks/useBenefits';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const PLAN_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  medical: { label: 'Medical Health', icon: HeartPulse, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  dental: { label: 'Dental Care', icon: Activity, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  vision: { label: 'Optical / Vision', icon: Activity, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  life_insurance: { label: 'Life & Disability', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  pension: { label: 'Retirement Pension', icon: DollarSign, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  housing_allowance: { label: 'Housing Allowance', icon: Building2, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  transport_allowance: { label: 'Transport Subsidy', icon: Receipt, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  education_assistance: { label: 'Education Support', icon: Sparkles, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  wellness: { label: 'Wellness & Gym', icon: HeartPulse, color: 'text-pink-600 bg-pink-50 border-pink-200' },
};

const TIER_COLORS: Record<string, string> = {
  basic: 'bg-slate-100 text-slate-800',
  standard: 'bg-blue-100 text-blue-800',
  premium: 'bg-purple-100 text-purple-800',
  executive: 'bg-amber-100 text-amber-800',
};

export default function BenefitsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_benefits');
  const canEnroll = hasPermission('manage_enrollments') || canManage;

  const [activeTab, setActiveTab] = useState<'plans' | 'enrollments' | 'open_enrollment' | 'reports'>('plans');
  const [selectedPlanType, setSelectedPlanType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showDependentModal, setShowDependentModal] = useState(false);
  const [showOpenPeriodModal, setShowOpenPeriodModal] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);

  // Forms
  const [planForm, setPlanForm] = useState({
    name: '',
    code: '',
    plan_type: 'medical',
    tier: 'standard',
    provider_name: '',
    description: '',
    total_cost: 200,
    employer_contribution: 150,
    employee_contribution: 50,
    is_family_covered: true,
    max_dependents: 4,
    min_tenure_months: 0,
  });

  const [enrollForm, setEnrollForm] = useState({
    plan_id: '',
    user_id: '',
    coverage_tier: 'individual',
    enrollment_type: 'open_enrollment',
    effective_start_date: new Date().toISOString().split('T')[0],
    qualifying_life_event: '',
    notes: '',
  });

  const [depForm, setDepForm] = useState({
    full_name: '',
    relationship: 'spouse' as 'spouse' | 'child' | 'parent' | 'other',
    date_of_birth: '',
    national_id: '',
    gender: 'male',
  });

  const [openPeriodForm, setOpenPeriodForm] = useState({
    title: `Annual Open Enrollment ${new Date().getFullYear()}`,
    plan_year: new Date().getFullYear(),
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  });

  // Queries
  const { data: plans = [], isLoading: isLoadingPlans } = useBenefitPlans(selectedPlanType);
  const { data: enrollments = [], isLoading: isLoadingEnrollments } = useBenefitEnrollments();
  const { data: stats } = useBenefitStats();
  const { data: openPeriods = [] } = useOpenEnrollmentPeriods();
  const { data: activeEnrollment } = useBenefitEnrollment(selectedEnrollmentId);
  const { data: users = [] } = useUsers();

  // Mutations
  const createPlanMutation = useCreateBenefitPlan();
  const enrollMutation = useEnrollEmployee();
  const addDepMutation = useAddDependent();
  const removeDepMutation = useRemoveDependent();
  const createPeriodMutation = useCreateOpenEnrollmentPeriod();

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name || !planForm.code) {
      toast.error('Plan name and unique code are required');
      return;
    }
    try {
      await createPlanMutation.mutateAsync({
        name: planForm.name,
        code: planForm.code,
        plan_type: planForm.plan_type,
        tier: planForm.tier,
        provider_name: planForm.provider_name || undefined,
        description: planForm.description || undefined,
        total_cost: Number(planForm.total_cost),
        employer_contribution: Number(planForm.employer_contribution),
        employee_contribution: Number(planForm.employee_contribution),
        is_family_covered: planForm.is_family_covered,
        max_dependents: Number(planForm.max_dependents),
        min_tenure_months: Number(planForm.min_tenure_months),
      });
      toast.success('Benefit plan created successfully');
      setShowCreatePlanModal(false);
      setPlanForm({
        name: '',
        code: '',
        plan_type: 'medical',
        tier: 'standard',
        provider_name: '',
        description: '',
        total_cost: 200,
        employer_contribution: 150,
        employee_contribution: 50,
        is_family_covered: true,
        max_dependents: 4,
        min_tenure_months: 0,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create plan');
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollForm.plan_id || !enrollForm.user_id) {
      toast.error('Please select both a plan and an employee');
      return;
    }
    try {
      await enrollMutation.mutateAsync({
        plan_id: enrollForm.plan_id,
        user_id: enrollForm.user_id,
        coverage_tier: enrollForm.coverage_tier,
        enrollment_type: enrollForm.enrollment_type,
        effective_start_date: enrollForm.effective_start_date,
        qualifying_life_event: enrollForm.qualifying_life_event || undefined,
        notes: enrollForm.notes || undefined,
      });
      toast.success('Employee enrolled successfully');
      setShowEnrollModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to enroll employee');
    }
  };

  const handleAddDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentId || !depForm.full_name) {
      toast.error('Dependent full name is required');
      return;
    }
    try {
      await addDepMutation.mutateAsync({
        enrollmentId: selectedEnrollmentId,
        dependent: {
          full_name: depForm.full_name,
          relationship: depForm.relationship,
          date_of_birth: depForm.date_of_birth || undefined,
          national_id: depForm.national_id || undefined,
          gender: depForm.gender || undefined,
        },
      });
      toast.success('Dependent added to coverage');
      setDepForm({
        full_name: '',
        relationship: 'spouse',
        date_of_birth: '',
        national_id: '',
        gender: 'male',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to add dependent');
    }
  };

  const handleRemoveDependent = async (depId: string) => {
    try {
      await removeDepMutation.mutateAsync(depId);
      toast.success('Dependent removed from coverage');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove dependent');
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPeriodMutation.mutateAsync({
        title: openPeriodForm.title,
        plan_year: Number(openPeriodForm.plan_year),
        start_date: openPeriodForm.start_date,
        end_date: openPeriodForm.end_date,
      });
      toast.success('Open enrollment campaign scheduled');
      setShowOpenPeriodModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule period');
    }
  };

  const filteredEnrollments = enrollments.filter((enr) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (enr.employee_name && enr.employee_name.toLowerCase().includes(q)) ||
      (enr.plan_name && enr.plan_name.toLowerCase().includes(q)) ||
      (enr.employee_department && enr.employee_department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Benefits & Insurance Management"
        description="Employee health insurance, retirement pensions, allowances, dependent coverage, qualifying life events, and automated payroll deductions."
        actions={
          <div className="flex items-center gap-3">
            {canEnroll && (
              <Button
                variant="outline"
                onClick={() => setShowEnrollModal(true)}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                Enroll Employee
              </Button>
            )}
            {canManage && (
              <Button
                onClick={() => setShowCreatePlanModal(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Benefit Plan
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KPITile
          title="Enrolled Staff"
          value={stats?.total_enrolled_employees ?? 0}
          subtitle="Active enrollments"
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <KPITile
          title="Employer Cost"
          value={`$${(stats?.total_monthly_employer_cost ?? 0).toLocaleString()}`}
          subtitle="Monthly expense"
          icon={Building2}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <KPITile
          title="Staff Deductions"
          value={`$${(stats?.total_monthly_employee_deductions ?? 0).toLocaleString()}`}
          subtitle="Monthly payroll sum"
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
        />
        <KPITile
          title="Dependents"
          value={stats?.total_covered_dependents ?? 0}
          subtitle="Family covered"
          icon={HeartPulse}
          iconColor="text-rose-600"
          iconBg="bg-rose-100"
        />
        <KPITile
          title="Active Plans"
          value={stats?.total_active_plans ?? 0}
          subtitle="Catalog offerings"
          icon={Layers}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100"
        />
        <KPITile
          title="Enrollment Rate"
          value={`${stats?.enrollment_rate ?? 0}%`}
          subtitle="Eligible staff"
          icon={ShieldCheck}
          iconColor="text-teal-600"
          iconBg="bg-teal-100"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('plans')}
          className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'plans'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Benefits Catalog & Plans
        </button>
        <button
          onClick={() => setActiveTab('enrollments')}
          className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'enrollments'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active Enrollments & Dependents
        </button>
        <button
          onClick={() => setActiveTab('open_enrollment')}
          className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'open_enrollment'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Open Enrollment & Life Events
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Payroll Deductions & Cost Reports
        </button>
      </div>

      {/* Tab 1: Plans Catalog */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Filter Type:</span>
              <select
                value={selectedPlanType}
                onChange={(e) => setSelectedPlanType(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none"
              >
                <option value="all">All Plan Types</option>
                {Object.entries(PLAN_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-muted-foreground">
              {plans.length} plan{plans.length === 1 ? '' : 's'} available
            </span>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingPlans ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                Loading benefit plans...
              </div>
            ) : plans.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                No benefit plans found.
              </div>
            ) : (
              plans.map((p: BenefitPlan) => {
                const conf = PLAN_TYPE_LABELS[p.plan_type] || {
                  label: p.plan_type,
                  icon: HeartPulse,
                  color: 'text-slate-600 bg-slate-50 border-slate-200',
                };
                const IconComponent = conf.icon;
                const total = Number(p.total_cost) || 1;
                const erPct = Math.round(((Number(p.employer_contribution) || 0) / total) * 100);
                const eePct = Math.max(0, 100 - erPct);

                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className={`p-2.5 rounded-xl border ${conf.color}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                            TIER_COLORS[p.tier] || 'bg-slate-100'
                          }`}
                        >
                          {p.tier}
                        </span>
                      </div>

                      <div className="mt-4">
                        <h3 className="font-bold text-lg text-foreground">{p.name}</h3>
                        <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                        {p.provider_name && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Provider: <span className="font-medium text-foreground">{p.provider_name}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {p.description || 'Comprehensive company-sponsored employee benefit plan.'}
                        </p>
                      </div>

                      {/* Cost Split Breakdown */}
                      <div className="mt-5 rounded-xl border border-border bg-muted/20 p-3">
                        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                          <span>Total Monthly Cost</span>
                          <span className="font-bold text-sm text-foreground">${p.total_cost}</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden flex">
                          <div
                            className="bg-primary h-full"
                            style={{ width: `${erPct}%` }}
                            title={`Employer: ${erPct}%`}
                          />
                          <div
                            className="bg-amber-500 h-full"
                            style={{ width: `${eePct}%` }}
                            title={`Employee: ${eePct}%`}
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
                            Employer: ${p.employer_contribution} ({erPct}%)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                            Staff: ${p.employee_contribution} ({eePct}%)
                          </span>
                        </div>
                      </div>

                      {/* Eligibility & Family Perks */}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {p.is_family_covered && (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-200">
                            Family Covered (Max {p.max_dependents})
                          </span>
                        )}
                        {p.min_tenure_months > 0 && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                            Min {p.min_tenure_months}mo tenure
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {p.active_enrollments_count ?? 0} enrolled
                      </span>
                      {canEnroll && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setEnrollForm((prev) => ({ ...prev, plan_id: p.id }));
                            setShowEnrollModal(true);
                          }}
                        >
                          Enroll Staff
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Active Enrollments */}
      {activeTab === 'enrollments' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employee, department, plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Plan Name</th>
                    <th className="px-4 py-3">Tier / Coverage</th>
                    <th className="px-4 py-3">Effective Period</th>
                    <th className="px-4 py-3">Staff Deduction</th>
                    <th className="px-4 py-3">Employer Cost</th>
                    <th className="px-4 py-3">Dependents</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingEnrollments ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading enrollments...
                      </td>
                    </tr>
                  ) : filteredEnrollments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No active enrollments found.
                      </td>
                    </tr>
                  ) : (
                    filteredEnrollments.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{e.employee_name || 'Staff Member'}</div>
                          <div className="text-xs text-muted-foreground">{e.employee_department || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{e.plan_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{e.plan_code}</div>
                        </td>
                        <td className="px-4 py-3 capitalize text-xs">
                          <span className="font-medium">{e.coverage_tier.replace('_', ' ')}</span>
                          <div className="text-muted-foreground">{e.enrollment_type.replace('_', ' ')}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div>From: {e.effective_start_date}</div>
                          {e.effective_end_date && (
                            <div className="text-muted-foreground">To: {e.effective_end_date}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-xs text-amber-600">
                          ${e.employee_deduction_amount}/mo
                        </td>
                        <td className="px-4 py-3 font-semibold text-xs text-primary">
                          ${e.employer_cost_amount}/mo
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {e.covered_dependents_count ? (
                            <span className="rounded bg-purple-50 px-2 py-0.5 font-medium text-purple-700 border border-purple-200">
                              {e.covered_dependents_count} Covered
                            </span>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEnrollmentId(e.id);
                              setShowDependentModal(true);
                            }}
                          >
                            Dependents
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Open Enrollment & Life Events */}
      {activeTab === 'open_enrollment' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:border-blue-900/40 dark:from-blue-950/20 dark:to-indigo-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 mb-2">
                Annual Campaign Engine
              </span>
              <h3 className="text-lg font-bold text-foreground">Open Enrollment Periods</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Define organizational open enrollment windows where all staff can elect, upgrade, or waive benefit options without qualifying life events.
              </p>
            </div>
            {canManage && (
              <Button onClick={() => setShowOpenPeriodModal(true)} className="gap-2 shrink-0">
                <Calendar className="h-4 w-4" />
                Schedule Open Period
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {openPeriods.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-base text-foreground">{p.title}</h4>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 capitalize">
                    {p.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Plan Year:</span> {p.plan_year}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Starts:</span> {p.start_date}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Closes:</span> {p.end_date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Payroll Deductions & Reports */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Plan Type Distribution */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold text-foreground text-base mb-4 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Enrollment Volume by Benefit Category
            </h3>
            <div className="space-y-3">
              {stats?.by_plan_type?.length ? (
                stats.by_plan_type.map((item) => (
                  <div key={item.plan_type} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {item.plan_type.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        ${Number(item.total_employer_cost).toLocaleString()} er cost
                      </span>
                      <span className="text-sm font-semibold text-foreground w-8 text-right">
                        {item.enrollment_count}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No distribution records found.</p>
              )}
            </div>
          </div>

          {/* Payroll Sync Status */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Automated Payroll Deductions Sync
            </h3>
            <div className="rounded-lg bg-muted/40 p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span>Active Benefit Deductions Count</span>
                <span className="font-bold text-foreground">{enrollments.length} line items</span>
              </div>
              <div className="flex justify-between">
                <span>Total Monthly Pre-Tax Deduction</span>
                <span className="font-bold text-amber-600">
                  ${(stats?.total_monthly_employee_deductions ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Employer Benefits Expense</span>
                <span className="font-bold text-primary">
                  ${(stats?.total_monthly_employer_cost ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These deduction amounts are auto-synced into the payroll module calculation engine during pay runs.
            </p>
          </div>
        </div>
      )}

      {/* Create Benefit Plan Modal */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-lg font-bold">Create Benefit Plan</h3>
              <button onClick={() => setShowCreatePlanModal(false)} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Plan Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Health Plus Dental"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Plan Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. HLT-PL-01"
                    value={planForm.code}
                    onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Plan Type</label>
                  <select
                    value={planForm.plan_type}
                    onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                  >
                    {Object.entries(PLAN_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tier</label>
                  <select
                    value={planForm.tier}
                    onChange={(e) => setPlanForm({ ...planForm, tier: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                  >
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Provider / Carrier Name</label>
                <input
                  type="text"
                  placeholder="e.g. BlueCross, National Insurance"
                  value={planForm.provider_name}
                  onChange={(e) => setPlanForm({ ...planForm, provider_name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Total Cost ($/mo) *</label>
                  <input
                    type="number"
                    value={planForm.total_cost}
                    onChange={(e) => setPlanForm({ ...planForm, total_cost: Number(e.target.value) })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Employer Cost *</label>
                  <input
                    type="number"
                    value={planForm.employer_contribution}
                    onChange={(e) => setPlanForm({ ...planForm, employer_contribution: Number(e.target.value) })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Staff Deduction *</label>
                  <input
                    type="number"
                    value={planForm.employee_contribution}
                    onChange={(e) => setPlanForm({ ...planForm, employee_contribution: Number(e.target.value) })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planForm.is_family_covered}
                    onChange={(e) => setPlanForm({ ...planForm, is_family_covered: e.target.checked })}
                    className="rounded border-input text-primary"
                  />
                  Family & Dependent Coverage Eligible
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowCreatePlanModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={createPlanMutation.isPending}>
                  Create Plan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Employee Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg">Enroll Employee in Benefits</h3>

            <form onSubmit={handleEnroll} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Employee *</label>
                <select
                  value={enrollForm.user_id}
                  onChange={(e) => setEnrollForm({ ...enrollForm, user_id: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                  required
                >
                  <option value="">Select Employee...</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({u.department || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Benefit Plan *</label>
                <select
                  value={enrollForm.plan_id}
                  onChange={(e) => setEnrollForm({ ...enrollForm, plan_id: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                  required
                >
                  <option value="">Select Plan...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.total_cost}/mo)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Coverage Tier</label>
                  <select
                    value={enrollForm.coverage_tier}
                    onChange={(e) => setEnrollForm({ ...enrollForm, coverage_tier: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                  >
                    <option value="individual">Individual Only</option>
                    <option value="individual_plus_spouse">Individual + Spouse</option>
                    <option value="individual_plus_children">Individual + Children</option>
                    <option value="family">Family (All Dependents)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Enrollment Type</label>
                  <select
                    value={enrollForm.enrollment_type}
                    onChange={(e) => setEnrollForm({ ...enrollForm, enrollment_type: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                  >
                    <option value="open_enrollment">Open Enrollment</option>
                    <option value="new_hire">New Hire</option>
                    <option value="qualifying_life_event">Qualifying Life Event</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Effective Start Date *</label>
                <input
                  type="date"
                  value={enrollForm.effective_start_date}
                  onChange={(e) => setEnrollForm({ ...enrollForm, effective_start_date: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowEnrollModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={enrollMutation.isPending}>
                  Confirm Enrollment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dependents Modal */}
      {showDependentModal && selectedEnrollmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="font-bold text-base">Covered Family Dependents</h3>
                <p className="text-xs text-muted-foreground">
                  {activeEnrollment?.employee_name} • {activeEnrollment?.plan_name}
                </p>
              </div>
              <button onClick={() => setShowDependentModal(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Existing Dependents List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeEnrollment?.dependents?.length ? (
                activeEnrollment.dependents.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs bg-muted/20"
                  >
                    <div>
                      <span className="font-bold text-foreground">{dep.full_name}</span>
                      <span className="ml-2 capitalize text-muted-foreground">({dep.relationship})</span>
                      {dep.date_of_birth && <div className="text-[11px] text-muted-foreground">DOB: {dep.date_of_birth}</div>}
                    </div>
                    <button
                      onClick={() => handleRemoveDependent(dep.id)}
                      className="text-rose-600 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">No dependents covered yet.</p>
              )}
            </div>

            {/* Add Dependent Form */}
            <form onSubmit={handleAddDependent} className="pt-2 border-t border-border space-y-3">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Add Dependent</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Full Legal Name *"
                  value={depForm.full_name}
                  onChange={(e) => setDepForm({ ...depForm, full_name: e.target.value })}
                  className="rounded-lg border border-input bg-background p-2 text-xs"
                  required
                />
                <select
                  value={depForm.relationship}
                  onChange={(e) => setDepForm({ ...depForm, relationship: e.target.value as any })}
                  className="rounded-lg border border-input bg-background p-2 text-xs"
                >
                  <option value="spouse">Spouse</option>
                  <option value="child">Child / Dependent</option>
                  <option value="parent">Parent</option>
                  <option value="other">Other Dependent</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  placeholder="Date of Birth"
                  value={depForm.date_of_birth}
                  onChange={(e) => setDepForm({ ...depForm, date_of_birth: e.target.value })}
                  className="rounded-lg border border-input bg-background p-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="National ID / Tax #"
                  value={depForm.national_id}
                  onChange={(e) => setDepForm({ ...depForm, national_id: e.target.value })}
                  className="rounded-lg border border-input bg-background p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" type="submit" disabled={addDepMutation.isPending}>
                  Add to Coverage
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Enrollment Schedule Modal */}
      {showOpenPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg">Schedule Open Enrollment Window</h3>
            <form onSubmit={handleCreatePeriod} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={openPeriodForm.title}
                  onChange={(e) => setOpenPeriodForm({ ...openPeriodForm, title: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={openPeriodForm.start_date}
                    onChange={(e) => setOpenPeriodForm({ ...openPeriodForm, start_date: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    value={openPeriodForm.end_date}
                    onChange={(e) => setOpenPeriodForm({ ...openPeriodForm, end_date: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowOpenPeriodModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={createPeriodMutation.isPending}>
                  Activate Period
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
