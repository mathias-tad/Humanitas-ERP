import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UserCheck,
  UserX,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  Plus,
  Search,
  Eye,
  Check,
  Loader2,
  Award,
  Layers,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import {
  useOnboarding,
  type OnboardingInstance,
  type OffboardingInstance,
  type OnboardingTemplate,
  type OnboardingTask,
  type OffboardingTask,
} from '@/hooks/useOnboarding';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_onboarding');

  const {
    useOnboardingStats,
    useOnboardings,
    useOnboardingInstance,
    useOffboardings,
    useOffboardingInstance,
    useTemplates,
    useTemplate,
    startOnboarding,
    isStartingOnboarding,
    updateOnboardingTask,
    recordProbationOutcome,
    isRecordingProbationOutcome,
    startOffboarding,
    isStartingOffboarding,
    updateOffboardingTask,
    submitExitInterview,
    isSubmittingExitInterview,
    createTemplate,
    isCreatingTemplate,
    createTemplateItem,
    isCreatingTemplateItem: isCreatingItem,
  } = useOnboarding();

  const { data: usersData } = useUsers();
  const users = Array.isArray(usersData) ? usersData : [];

  const [activeTab, setActiveTab] = useState<'onboarding' | 'offboarding' | 'templates'>('onboarding');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected Detail Modals
  const [selectedOnboardingId, setSelectedOnboardingId] = useState<string | null>(null);
  const [selectedOffboardingId, setSelectedOffboardingId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Action Modals
  const [startOnboardingOpen, setStartOnboardingOpen] = useState(false);
  const [startOffboardingOpen, setStartOffboardingOpen] = useState(false);
  const [exitInterviewModalOpen, setExitInterviewModalOpen] = useState(false);
  const [exitInterviewOffboardingId, setExitInterviewOffboardingId] = useState<string | null>(null);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);

  // Form states - Start Onboarding
  const [onbUserId, setOnbUserId] = useState('');
  const [onbTemplateId, setOnbTemplateId] = useState('');
  const [onbStartDate, setOnbStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [onbProbationDays, setOnbProbationDays] = useState('90');

  // Form states - Start Offboarding
  const [offbUserId, setOffbUserId] = useState('');
  const [offbTemplateId, setOffbTemplateId] = useState('');
  const [offbLastDay, setOffbLastDay] = useState(new Date().toISOString().split('T')[0]);
  const [offbReason, setOffbReason] = useState('Resignation');

  // Form states - Exit Interview
  const [exitScore, setExitScore] = useState(4);
  const [exitReason, setExitReason] = useState('');
  const [exitFeedback, setExitFeedback] = useState('');
  const [exitAnonymous, setExitAnonymous] = useState(false);

  // Form states - Probation
  const [probationOutcome, setProbationOutcome] = useState<'confirmed' | 'extended' | 'terminated'>('confirmed');
  const [probationNotes, setProbationNotes] = useState('');
  const [probationExtendedUntil, setProbationExtendedUntil] = useState('');

  // Form states - Create Template
  const [tplName, setTplName] = useState('');
  const [tplDescription, setTplDescription] = useState('');
  const [tplType, setTplType] = useState<'onboarding' | 'offboarding'>('onboarding');
  const [tplDept, setTplDept] = useState('');

  // Form states - Add Item
  const [itemTitle, setItemTitle] = useState('');
  const [itemCategory, setItemCategory] = useState<'it' | 'hr' | 'manager' | 'facilities' | 'finance' | 'general'>('general');
  const [itemDueDays, setItemDueDays] = useState('1');
  const [itemAssigneeRole, setItemAssigneeRole] = useState('');
  const [itemRequired, setItemRequired] = useState(true);

  // Queries
  const { data: stats } = useOnboardingStats();
  const { data: onboardingsData, isLoading: loadingOnboardings } = useOnboardings({
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });
  const { data: offboardingsData, isLoading: loadingOffboardings } = useOffboardings();
  const { data: templatesData, isLoading: loadingTemplates } = useTemplates();

  const { data: singleOnboarding } = useOnboardingInstance(selectedOnboardingId);
  const { data: singleOffboarding } = useOffboardingInstance(selectedOffboardingId);
  const { data: singleTemplate } = useTemplate(selectedTemplateId);

  const onboardings: OnboardingInstance[] = Array.isArray(onboardingsData) ? onboardingsData : [];
  const offboardings: OffboardingInstance[] = Array.isArray(offboardingsData) ? offboardingsData : [];
  const templates: OnboardingTemplate[] = Array.isArray(templatesData) ? templatesData : [];

  // Filtered onboardings
  const filteredOnboardings = useMemo(() => {
    return onboardings.filter((o) => {
      const name = `${o.first_name || ''} ${o.last_name || ''} ${o.email || ''}`.toLowerCase();
      const matchSearch = searchTerm ? name.includes(searchTerm.toLowerCase()) : true;
      return matchSearch;
    });
  }, [onboardings, searchTerm]);

  // Filtered offboardings
  const filteredOffboardings = useMemo(() => {
    return offboardings.filter((o) => {
      const name = `${o.first_name || ''} ${o.last_name || ''} ${o.email || ''}`.toLowerCase();
      const matchSearch = searchTerm ? name.includes(searchTerm.toLowerCase()) : true;
      return matchSearch;
    });
  }, [offboardings, searchTerm]);

  // Handlers
  const handleStartOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onbUserId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      await startOnboarding({
        user_id: onbUserId,
        template_id: onbTemplateId || undefined,
        start_date: onbStartDate || undefined,
        probation_days: parseInt(onbProbationDays, 10) || 90,
      });
      toast.success('Onboarding workflow initiated successfully');
      setStartOnboardingOpen(false);
      setOnbUserId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start onboarding');
    }
  };

  const handleStartOffboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offbUserId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      await startOffboarding({
        user_id: offbUserId,
        template_id: offbTemplateId || undefined,
        last_working_day: offbLastDay || undefined,
        reason: offbReason || undefined,
      });
      toast.success('Offboarding workflow initiated');
      setStartOffboardingOpen(false);
      setOffbUserId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start offboarding');
    }
  };

  const handleToggleOnboardingTask = async (task: OnboardingTask) => {
    if (!canManage) return;
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateOnboardingTask({
        taskId: task.id,
        status: nextStatus,
      });
      toast.success(`Task marked as ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update task');
    }
  };

  const handleToggleOffboardingTask = async (task: OffboardingTask) => {
    if (!canManage) return;
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateOffboardingTask({
        taskId: task.id,
        status: nextStatus,
      });
      toast.success(`Task marked as ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update task');
    }
  };

  const handleProbationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOnboardingId) return;
    try {
      await recordProbationOutcome({
        onboarding_id: selectedOnboardingId,
        outcome: probationOutcome,
        notes: probationNotes || undefined,
        extended_until: probationOutcome === 'extended' ? probationExtendedUntil || undefined : undefined,
      });
      toast.success(`Probation outcome recorded: ${probationOutcome}`);
      setProbationNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record probation outcome');
    }
  };

  const handleExitInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitInterviewOffboardingId) return;
    try {
      await submitExitInterview({
        offboarding_id: exitInterviewOffboardingId,
        satisfaction_score: exitScore,
        reason_for_leaving: exitReason,
        feedback: exitFeedback,
        is_anonymous: exitAnonymous,
      });
      toast.success('Exit interview feedback submitted');
      setExitInterviewModalOpen(false);
      setExitReason('');
      setExitFeedback('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit exit interview');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName) return;
    try {
      await createTemplate({
        name: tplName,
        description: tplDescription || undefined,
        type: tplType,
        department: tplDept || undefined,
      });
      toast.success('Template created successfully');
      setCreateTemplateOpen(false);
      setTplName('');
      setTplDescription('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create template');
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId || !itemTitle) return;
    try {
      await createTemplateItem({
        templateId: selectedTemplateId,
        title: itemTitle,
        category: itemCategory,
        due_days_from_start: parseInt(itemDueDays, 10) || 1,
        assignee_role: itemAssigneeRole || undefined,
        is_required: itemRequired,
      });
      toast.success('Checklist item added to template');
      setCreateItemOpen(false);
      setItemTitle('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add checklist item');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">In Progress</Badge>;
      case 'overdue':
        return <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30">Overdue</Badge>;
      case 'initiated':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Initiated</Badge>;
      default:
        return <Badge variant="outline">{status.replace('_', ' ')}</Badge>;
    }
  };

  const getProbationBadge = (outcome?: string) => {
    switch (outcome) {
      case 'confirmed':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Confirmed</Badge>;
      case 'extended':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Extended</Badge>;
      case 'terminated':
        return <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30">Terminated</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Onboarding & Offboarding"
        description="Structured employee lifecycle management, compliance checklists, probation tracking, and exit surveys"
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button
                  onClick={() => setStartOffboardingOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <UserX className="h-4 w-4 text-rose-500" />
                  <span>Initiate Offboarding</span>
                </Button>
                <Button
                  onClick={() => setStartOnboardingOpen(true)}
                  size="sm"
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Start Onboarding</span>
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPITile
          title="Total Onboarding"
          value={stats?.total_onboarding ?? 0}
          subtitle="All new hires"
          icon={Users}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
        />
        <KPITile
          title="In Progress"
          value={stats?.in_progress_onboarding ?? 0}
          subtitle="Active checklists"
          icon={Clock}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
        />
        <KPITile
          title="Completed"
          value={stats?.completed_onboarding ?? 0}
          subtitle="Graduated hires"
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
        <KPITile
          title="Overdue Tasks"
          value={stats?.overdue_tasks ?? 0}
          subtitle="Needs attention"
          icon={AlertTriangle}
          iconColor="text-rose-500"
          iconBg="bg-rose-500/10"
        />
        <KPITile
          title="Probation Reviews"
          value={stats?.upcoming_probation_reviews ?? 0}
          subtitle="Due within 30 days"
          icon={CalendarDays}
          iconColor="text-purple-500"
          iconBg="bg-purple-500/10"
        />
        <KPITile
          title="Avg. Time"
          value={`${stats?.avg_completion_days ?? 0}d`}
          subtitle="Days to complete"
          icon={TrendingUp}
          iconColor="text-teal-500"
          iconBg="bg-teal-500/10"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('onboarding')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'onboarding'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Onboarding ({onboardings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('offboarding')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'offboarding'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserX className="h-4 w-4" />
            <span>Offboarding ({offboardings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'templates'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Checklist Templates ({templates.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ONBOARDING */}
      {activeTab === 'onboarding' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employee name, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-xs focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="not_started">Not Started</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Start Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Checklist Progress</th>
                    <th className="px-4 py-3">Probation End</th>
                    <th className="px-4 py-3">Probation Outcome</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingOnboardings ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <span>Loading onboarding records...</span>
                      </td>
                    </tr>
                  ) : filteredOnboardings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No onboarding workflows found.
                      </td>
                    </tr>
                  ) : (
                    filteredOnboardings.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">
                            {o.first_name} {o.last_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {o.position || 'Staff'} • {o.department || 'General'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {o.template_name || 'Standard'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {o.start_date || '—'}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(o.status)}</td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-medium text-foreground">
                              {o.completed_tasks} / {o.total_tasks}
                            </span>
                            <span className="text-muted-foreground">{o.completion_percentage}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${o.completion_percentage}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {o.probation_end_date || '—'}
                        </td>
                        <td className="px-4 py-3">{getProbationBadge(o.probation_outcome)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOnboardingId(o.id)}
                            className="h-7 text-xs gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View Details</span>
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

      {/* TAB 2: OFFBOARDING */}
      {activeTab === 'offboarding' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search departing employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-xs focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Last Working Day</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Checklist Progress</th>
                    <th className="px-4 py-3">Exit Interview</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingOffboardings ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <span>Loading offboarding records...</span>
                      </td>
                    </tr>
                  ) : filteredOffboardings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No offboarding workflows found.
                      </td>
                    </tr>
                  ) : (
                    filteredOffboardings.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">
                            {o.first_name} {o.last_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {o.position || 'Staff'} • {o.department || 'General'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{o.last_working_day || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{o.reason || 'Resignation'}</td>
                        <td className="px-4 py-3">{getStatusBadge(o.status)}</td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-medium text-foreground">
                              {o.completed_tasks} / {o.total_tasks}
                            </span>
                            <span className="text-muted-foreground">{o.completion_percentage}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-500 rounded-full transition-all"
                              style={{ width: `${o.completion_percentage}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(o.exit_interview_count ?? 0) > 0 ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOffboardingId(o.id)}
                            className="h-7 text-xs gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </Button>
                          {!(o.exit_interview_count && o.exit_interview_count > 0) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setExitInterviewOffboardingId(o.id);
                                setExitInterviewModalOpen(true);
                              }}
                              className="h-7 text-xs gap-1 text-primary hover:text-primary"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Exit Survey</span>
                            </Button>
                          )}
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

      {/* TAB 3: TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Checklist Templates</h3>
              <p className="text-xs text-muted-foreground">
                Standardized IT, HR, and managerial task blueprints for employee entry and exit
              </p>
            </div>
            {canManage && (
              <Button
                onClick={() => setCreateTemplateOpen(true)}
                size="sm"
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                <span>Create Template</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingTemplates ? (
              <div className="col-span-full p-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <span>Loading templates...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="col-span-full p-8 text-center text-muted-foreground">
                No templates configured.
              </div>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-5 rounded-xl border border-border bg-card shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">{tpl.name}</span>
                      <Badge
                        variant="outline"
                        className={
                          tpl.type === 'onboarding'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                            : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                        }
                      >
                        {tpl.type}
                      </Badge>
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                      <span>{tpl.item_count ?? 0} Tasks</span>
                      {tpl.department && <span>• {tpl.department}</span>}
                      {tpl.is_default && <span className="text-primary font-semibold">• Default</span>}
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-border flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Manage Items</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: START ONBOARDING ── */}
      {startOnboardingOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">Start New Hire Onboarding</h3>
              <button
                onClick={() => setStartOnboardingOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartOnboarding} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Select New Employee *</label>
                <select
                  value={onbUserId}
                  onChange={(e) => setOnbUserId(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose employee --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({u.position || 'Staff'} • {u.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Checklist Template</label>
                <select
                  value={onbTemplateId}
                  onChange={(e) => setOnbTemplateId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">Standard Onboarding (Default)</option>
                  {templates
                    .filter((t) => t.type === 'onboarding')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Start Date *</label>
                  <input
                    type="date"
                    value={onbStartDate}
                    onChange={(e) => setOnbStartDate(e.target.value)}
                    required
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Probation Period (Days)</label>
                  <input
                    type="number"
                    value={onbProbationDays}
                    onChange={(e) => setOnbProbationDays(e.target.value)}
                    min={0}
                    max={365}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStartOnboardingOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isStartingOnboarding}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isStartingOnboarding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  <span>Launch Workflow</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: START OFFBOARDING ── */}
      {startOffboardingOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">Initiate Employee Offboarding</h3>
              <button
                onClick={() => setStartOffboardingOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartOffboarding} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Departing Employee *</label>
                <select
                  value={offbUserId}
                  onChange={(e) => setOffbUserId(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose employee --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({u.position || 'Staff'} • {u.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Offboarding Template</label>
                <select
                  value={offbTemplateId}
                  onChange={(e) => setOffbTemplateId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">Standard Offboarding (Default)</option>
                  {templates
                    .filter((t) => t.type === 'offboarding')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Last Working Day *</label>
                <input
                  type="date"
                  value={offbLastDay}
                  onChange={(e) => setOffbLastDay(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Reason for Departure</label>
                <input
                  type="text"
                  placeholder="e.g. Relocation, Career change, Mutual agreement"
                  value={offbReason}
                  onChange={(e) => setOffbReason(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStartOffboardingOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isStartingOffboarding}
                  className="gap-2 bg-rose-600 text-white hover:bg-rose-700"
                >
                  {isStartingOffboarding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserX className="h-4 w-4" />
                  )}
                  <span>Initiate Offboarding</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ONBOARDING DETAIL & TASK CHECKLIST ── */}
      {selectedOnboardingId && singleOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {singleOnboarding.first_name} {singleOnboarding.last_name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {singleOnboarding.position || 'Staff'} • {singleOnboarding.department || 'General'} • Started{' '}
                  {singleOnboarding.start_date || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedOnboardingId(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Checklist Progress */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Overall Onboarding Progress</span>
                <span className="font-bold text-primary">
                  {singleOnboarding.completed_tasks} of {singleOnboarding.total_tasks} completed (
                  {singleOnboarding.completion_percentage}%)
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${singleOnboarding.completion_percentage}%` }}
                />
              </div>
            </div>

            {/* Task Checklist Grouped */}
            <div className="overflow-auto flex-1 space-y-3 pr-1 text-xs">
              <div className="font-bold text-xs uppercase text-muted-foreground tracking-wider">
                Assigned Workflow Tasks
              </div>
              {singleOnboarding.tasks?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No tasks assigned.</div>
              ) : (
                singleOnboarding.tasks?.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-border bg-surface-1 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleToggleOnboardingTask(task)}
                          className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                            task.status === 'completed'
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-input hover:border-primary bg-background'
                          }`}
                        >
                          {task.status === 'completed' && <Check className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <div>
                        <div
                          className={`font-semibold ${
                            task.status === 'completed'
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground'
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                            {task.category}
                          </Badge>
                          {task.due_date && <span>Due: {task.due_date}</span>}
                          {task.assignee_role && <span>• Assignee: {task.assignee_role}</span>}
                        </div>
                      </div>
                    </div>
                    <div>{getStatusBadge(task.status)}</div>
                  </div>
                ))
              )}

              {/* Probation Evaluation Section */}
              <div className="mt-4 p-4 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-purple-600" />
                    <span className="font-bold text-xs text-foreground">Probation Review</span>
                  </div>
                  {getProbationBadge(singleOnboarding.probation_outcome)}
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Target Probation End Date:{' '}
                  <span className="font-semibold text-foreground">
                    {singleOnboarding.probation_end_date || 'N/A'}
                  </span>
                  {singleOnboarding.probation_outcome_notes && (
                    <p className="mt-1 text-foreground italic">
                      "{singleOnboarding.probation_outcome_notes}"
                    </p>
                  )}
                </div>

                {canManage && !singleOnboarding.probation_outcome && (
                  <form onSubmit={handleProbationSubmit} className="space-y-2 pt-2 border-t border-purple-500/20">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setProbationOutcome('confirmed')}
                        className={`p-2 rounded text-center text-xs font-bold border transition-colors ${
                          probationOutcome === 'confirmed'
                            ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        Confirm Hire
                      </button>
                      <button
                        type="button"
                        onClick={() => setProbationOutcome('extended')}
                        className={`p-2 rounded text-center text-xs font-bold border transition-colors ${
                          probationOutcome === 'extended'
                            ? 'bg-amber-500/20 text-amber-600 border-amber-500'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        Extend
                      </button>
                      <button
                        type="button"
                        onClick={() => setProbationOutcome('terminated')}
                        className={`p-2 rounded text-center text-xs font-bold border transition-colors ${
                          probationOutcome === 'terminated'
                            ? 'bg-rose-500/20 text-rose-600 border-rose-500'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        Terminate
                      </button>
                    </div>

                    {probationOutcome === 'extended' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-foreground">Extend Until *</label>
                        <input
                          type="date"
                          value={probationExtendedUntil}
                          onChange={(e) => setProbationExtendedUntil(e.target.value)}
                          required
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground">Review Remarks / Justification</label>
                      <textarea
                        rows={2}
                        placeholder="Evaluation notes on performance, attendance, culture fit..."
                        value={probationNotes}
                        onChange={(e) => setProbationNotes(e.target.value)}
                        className="w-full rounded-md border border-input bg-background p-2 text-xs"
                      />
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={isRecordingProbationOutcome}
                      className="w-full text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isRecordingProbationOutcome ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Finalize Probation Review'}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={() => setSelectedOnboardingId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: OFFBOARDING DETAIL & TASKS ── */}
      {selectedOffboardingId && singleOffboarding && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {singleOffboarding.first_name} {singleOffboarding.last_name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Last Working Day: {singleOffboarding.last_working_day || 'N/A'} • Reason: {singleOffboarding.reason}
                </p>
              </div>
              <button
                onClick={() => setSelectedOffboardingId(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Checklist Progress */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Offboarding Handover & Clearance</span>
                <span className="font-bold text-rose-500">
                  {singleOffboarding.completed_tasks} of {singleOffboarding.total_tasks} completed (
                  {singleOffboarding.completion_percentage}%)
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${singleOffboarding.completion_percentage}%` }}
                />
              </div>
            </div>

            {/* Tasks */}
            <div className="overflow-auto flex-1 space-y-3 pr-1 text-xs">
              <div className="font-bold text-xs uppercase text-muted-foreground tracking-wider">
                Clearance Tasks
              </div>
              {singleOffboarding.tasks?.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border border-border bg-surface-1 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleToggleOffboardingTask(task)}
                        className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                          task.status === 'completed'
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-input hover:border-primary bg-background'
                        }`}
                      >
                        {task.status === 'completed' && <Check className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <div>
                      <div
                        className={`font-semibold ${
                          task.status === 'completed'
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {task.title}
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                          {task.category}
                        </Badge>
                        {task.due_date && <span>Due: {task.due_date}</span>}
                      </div>
                    </div>
                  </div>
                  <div>{getStatusBadge(task.status)}</div>
                </div>
              ))}

              {/* Exit Interview View */}
              {singleOffboarding.exit_interview && (
                <div className="mt-4 p-4 rounded-lg border border-blue-500/30 bg-blue-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      Exit Interview Feedback
                    </span>
                    <Badge variant="outline" className="text-blue-600">
                      Score: {singleOffboarding.exit_interview.satisfaction_score} / 5
                    </Badge>
                  </div>
                  {singleOffboarding.exit_interview.reason_for_leaving && (
                    <div className="text-xs">
                      <span className="font-semibold text-foreground">Reason: </span>
                      <span className="text-muted-foreground">
                        {singleOffboarding.exit_interview.reason_for_leaving}
                      </span>
                    </div>
                  )}
                  {singleOffboarding.exit_interview.feedback && (
                    <div className="text-xs">
                      <span className="font-semibold text-foreground">Feedback: </span>
                      <p className="text-muted-foreground italic mt-0.5">
                        "{singleOffboarding.exit_interview.feedback}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={() => setSelectedOffboardingId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EXIT INTERVIEW SURVEY ── */}
      {exitInterviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">Submit Exit Survey</h3>
              <button
                onClick={() => setExitInterviewModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExitInterviewSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Overall Satisfaction (1 = Poor, 5 = Excellent)</label>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setExitScore(score)}
                      className={`h-9 w-9 rounded-md border font-bold text-sm transition-colors ${
                        exitScore === score
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Primary Reason for Leaving</label>
                <input
                  type="text"
                  placeholder="e.g. Compensation, Commute, Career development"
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Constructive Feedback / Suggestions</label>
                <textarea
                  rows={3}
                  placeholder="What could we have done better? How was your team culture?"
                  value={exitFeedback}
                  onChange={(e) => setExitFeedback(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="anonymousCheck"
                  checked={exitAnonymous}
                  onChange={(e) => setExitAnonymous(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <label htmlFor="anonymousCheck" className="text-xs text-muted-foreground cursor-pointer">
                  Submit feedback anonymously
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExitInterviewModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingExitInterview}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmittingExitInterview ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Feedback'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MANAGE TEMPLATE & ITEMS ── */}
      {selectedTemplateId && singleTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">{singleTemplate.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Type: {singleTemplate.type} • {singleTemplate.items?.length ?? 0} template checklist items
                </p>
              </div>
              <button
                onClick={() => setSelectedTemplateId(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-muted-foreground tracking-wider">
                Checklist Item Blueprints
              </span>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateItemOpen(true)}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Checklist Item</span>
                </Button>
              )}
            </div>

            <div className="overflow-auto flex-1 space-y-2.5 pr-1 text-xs">
              {singleTemplate.items?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No items in this template yet.</div>
              ) : (
                singleTemplate.items?.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-border bg-surface-1 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{item.title}</div>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                          {item.category}
                        </Badge>
                        <span>Due Day: {item.due_days_from_start}</span>
                        {item.assignee_role && <span>• Assignee: {item.assignee_role}</span>}
                        {item.is_required && <span className="text-rose-500 font-semibold">• Required</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={() => setSelectedTemplateId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE TEMPLATE ── */}
      {createTemplateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">Create Checklist Template</h3>
              <button
                onClick={() => setCreateTemplateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Template Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering Onboarding, Sales Handover"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Workflow Type *</label>
                <select
                  value={tplType}
                  onChange={(e) => setTplType(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="onboarding">Onboarding</option>
                  <option value="offboarding">Offboarding</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Department (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering, Sales, Human Resources"
                  value={tplDept}
                  onChange={(e) => setTplDept(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of this template workflow..."
                  value={tplDescription}
                  onChange={(e) => setTplDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateTemplateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingTemplate}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isCreatingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Template'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD CHECKLIST ITEM ── */}
      {createItemOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">Add Checklist Item</h3>
              <button
                onClick={() => setCreateItemOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Issue Security Token, 1-on-1 Sync"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Category</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="it">IT & Systems</option>
                    <option value="hr">HR & Compliance</option>
                    <option value="manager">Manager / Team</option>
                    <option value="facilities">Facilities</option>
                    <option value="finance">Finance</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Due Day Offset</label>
                  <input
                    type="number"
                    value={itemDueDays}
                    onChange={(e) => setItemDueDays(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Assignee Role (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. IT Admin, HR Coordinator, Line Manager"
                  value={itemAssigneeRole}
                  onChange={(e) => setItemAssigneeRole(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reqCheck"
                  checked={itemRequired}
                  onChange={(e) => setItemRequired(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <label htmlFor="reqCheck" className="text-xs text-muted-foreground cursor-pointer">
                  Mandatory task for checklist completion
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateItemOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingItem}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isCreatingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Task'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
