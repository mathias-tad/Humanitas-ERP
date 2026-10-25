import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  AlertCircle,
  Clock,
  CheckCircle2,
  EyeOff,
  UserCheck,
  FileText,
  Search,
  ShieldCheck,
  Plus,
  Send,
  AlertTriangle,
  Star,
  User,
  TrendingUp,
  X,
  FileCheck,
} from 'lucide-react';
import {
  useGrievances,
  useGrievance,
  useGrievanceStats,
  useFileGrievance,
  useUpdateGrievanceStatus,
  useAssignInvestigator,
  useProposeResolution,
  useSubmitGrievanceFeedback,
  useAddGrievanceNote,
} from '@/hooks/useGrievances';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'discrimination', label: 'Discrimination' },
  { value: 'safety', label: 'Workplace Safety' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'workplace_conflict', label: 'Workplace Conflict' },
  { value: 'compensation_dispute', label: 'Compensation Dispute' },
  { value: 'other', label: 'Other Concern' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-800' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-100 text-rose-800' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  filed: { label: 'Filed', color: 'bg-amber-100 text-amber-800', step: 1 },
  acknowledged: { label: 'Acknowledged', color: 'bg-sky-100 text-sky-800', step: 2 },
  investigating: { label: 'Investigating', color: 'bg-indigo-100 text-indigo-800', step: 3 },
  resolution_proposed: { label: 'Resolution Proposed', color: 'bg-purple-100 text-purple-800', step: 4 },
  closed: { label: 'Closed / Resolved', color: 'bg-emerald-100 text-emerald-800', step: 5 },
};

export default function GrievancesPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('manage_grievances');
  const canInvestigate = hasPermission('investigate_grievances') || canManage;

  const [activeTab, setActiveTab] = useState<'cases' | 'file' | 'reports'>('cases');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrievanceId, setSelectedGrievanceId] = useState<string | null>(null);

  // Modals inside details
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isNoteConfidential, setIsNoteConfidential] = useState(false);

  // Assignment & Resolution inputs
  const [selectedInvestigator, setSelectedInvestigator] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [retaliationMonitoring, setRetaliationMonitoring] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  // Filing form state
  const [fileForm, setFileForm] = useState({
    category: 'workplace_conflict',
    subject: '',
    description: '',
    priority: 'medium',
    is_anonymous: false,
    incident_date: '',
    incident_location: '',
    accused_parties: '',
    witnesses: '',
  });

  // Queries
  const { data: grievances = [], isLoading: isLoadingGrievances } = useGrievances(
    statusFilter !== 'all' || categoryFilter !== 'all'
      ? {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
        }
      : undefined
  );
  const { data: stats } = useGrievanceStats();
  const { data: activeGrievance, isLoading: isLoadingActive } = useGrievance(selectedGrievanceId);
  const { data: users = [] } = useUsers();

  // Mutations
  const fileMutation = useFileGrievance();
  const updateStatusMutation = useUpdateGrievanceStatus();
  const assignMutation = useAssignInvestigator();
  const resolutionMutation = useProposeResolution();
  const feedbackMutation = useSubmitGrievanceFeedback();
  const noteMutation = useAddGrievanceNote();

  // Filtered grievances
  const filteredGrievances = grievances.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.ticket_number.toLowerCase().includes(q) ||
      g.subject.toLowerCase().includes(q) ||
      (g.submitter_name && g.submitter_name.toLowerCase().includes(q)) ||
      (g.accused_parties && g.accused_parties.toLowerCase().includes(q))
    );
  });

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileForm.subject || !fileForm.description) {
      toast.error('Please provide a subject and detailed description');
      return;
    }
    try {
      const created = await fileMutation.mutateAsync({
        category: fileForm.category,
        subject: fileForm.subject,
        description: fileForm.description,
        priority: fileForm.priority,
        is_anonymous: fileForm.is_anonymous,
        incident_date: fileForm.incident_date || undefined,
        incident_location: fileForm.incident_location || undefined,
        accused_parties: fileForm.accused_parties || undefined,
        witnesses: fileForm.witnesses || undefined,
      });
      toast.success(`Grievance filed successfully: ${created.ticket_number}`);
      setFileForm({
        category: 'workplace_conflict',
        subject: '',
        description: '',
        priority: 'medium',
        is_anonymous: false,
        incident_date: '',
        incident_location: '',
        accused_parties: '',
        witnesses: '',
      });
      setActiveTab('cases');
    } catch (err: any) {
      toast.error(err.message || 'Failed to file grievance');
    }
  };

  const handleAssign = async () => {
    if (!selectedGrievanceId || !selectedInvestigator) return;
    try {
      await assignMutation.mutateAsync({
        id: selectedGrievanceId,
        investigator_id: selectedInvestigator,
      });
      toast.success('Investigator assigned successfully');
      setShowAssignModal(false);
      setSelectedInvestigator('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign investigator');
    }
  };

  const handleResolutionSubmit = async () => {
    if (!selectedGrievanceId || !resolutionSummary) {
      toast.error('Please enter resolution summary');
      return;
    }
    try {
      await resolutionMutation.mutateAsync({
        id: selectedGrievanceId,
        resolution_summary: resolutionSummary,
        action_items: actionItems || undefined,
        retaliation_monitoring_flag: retaliationMonitoring,
      });
      toast.success('Resolution proposal submitted');
      setShowResolutionModal(false);
      setResolutionSummary('');
      setActionItems('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit resolution');
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!selectedGrievanceId) return;
    try {
      await feedbackMutation.mutateAsync({
        id: selectedGrievanceId,
        satisfaction_score: feedbackRating,
        satisfaction_feedback: feedbackText || undefined,
      });
      toast.success('Thank you for providing resolution feedback');
      setShowFeedbackModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    }
  };

  const handleAddNote = async () => {
    if (!selectedGrievanceId || !newNote.trim()) return;
    try {
      await noteMutation.mutateAsync({
        id: selectedGrievanceId,
        notes: newNote,
        is_confidential: isNoteConfidential,
      });
      toast.success('Investigation note recorded');
      setNewNote('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add note');
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedGrievanceId) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: selectedGrievanceId,
        status,
      });
      toast.success(`Case status updated to ${status}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Employee Grievances & Whistleblower System"
        description="Confidential grievance intake, multi-stage case management, investigator assignment, SLA timers, retaliation protection, and resolution tracking."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant={activeTab === 'file' ? 'outline' : 'default'}
              onClick={() => setActiveTab('file')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              File Grievance / Report
            </Button>
          </div>
        }
      />

      {/* KPI Tiles Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KPITile
          title="Total Cases"
          value={stats?.total_cases ?? 0}
          subtitle="All-time reported"
          icon={FileText}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <KPITile
          title="Active Cases"
          value={stats?.open_cases ?? 0}
          subtitle="Under review or investigation"
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
        <KPITile
          title="Closed Cases"
          value={stats?.closed_cases ?? 0}
          subtitle="Resolved or completed"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
        />
        <KPITile
          title="SLA Breached"
          value={stats?.sla_breached_cases ?? 0}
          subtitle="Past target timeline"
          icon={AlertTriangle}
          iconColor="text-rose-600"
          iconBg="bg-rose-100"
        />
        <KPITile
          title="Retaliation Watch"
          value={stats?.retaliation_monitoring_count ?? 0}
          subtitle="Monitored sensitive cases"
          icon={ShieldAlert}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <KPITile
          title="SLA Compliance"
          value={`${stats?.sla_compliance_rate ?? 100}%`}
          subtitle="Resolved within timeline"
          icon={ShieldCheck}
          iconColor="text-teal-600"
          iconBg="bg-teal-100"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('cases')}
          className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'cases'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Investigation Board & Cases
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'file'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Confidential Intake Form
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Analytics & SLA Reports
        </button>
      </div>

      {/* Tab 1: Investigation Board */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ticket #, subject, parties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="filed">Filed</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="investigating">Investigating</option>
                <option value="resolution_proposed">Resolution Proposed</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grievances Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Ticket #</th>
                    <th className="px-4 py-3">Subject & Category</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Complainant</th>
                    <th className="px-4 py-3">Investigator</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">SLA Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingGrievances ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading grievances...
                      </td>
                    </tr>
                  ) : filteredGrievances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No grievances found.
                      </td>
                    </tr>
                  ) : (
                    filteredGrievances.map((g) => {
                      const st = STATUS_CONFIG[g.status] || {
                        label: g.status,
                        color: 'bg-slate-100 text-slate-800',
                      };
                      const pr = PRIORITIES.find((p) => p.value === g.priority) || PRIORITIES[1];

                      return (
                        <tr key={g.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono font-medium text-xs">
                            {g.ticket_number}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{g.subject}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {g.category.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pr.color}`}>
                              {pr.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {g.is_anonymous ? (
                              <div className="flex items-center gap-1.5 text-amber-600 font-medium text-xs">
                                <EyeOff className="h-3.5 w-3.5" />
                                {canManage ? g.submitter_name : 'Anonymous'}
                              </div>
                            ) : (
                              <div className="text-xs">
                                <div className="font-medium text-foreground">{g.submitter_name || 'Employee'}</div>
                                <div className="text-muted-foreground">{g.submitter_department || ''}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {g.investigator_name ? (
                              <div className="flex items-center gap-1.5 text-foreground">
                                <UserCheck className="h-3.5 w-3.5 text-primary" />
                                {g.investigator_name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.color}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {g.is_sla_breached ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                                <AlertCircle className="h-3 w-3" />
                                Breached
                              </span>
                            ) : g.status === 'closed' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" />
                                Resolved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 text-sky-500" />
                                On Target
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedGrievanceId(g.id)}
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Confidential Filing Form */}
      {activeTab === 'file' && (
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4 rounded-lg bg-blue-50/50 p-4 border border-blue-200/50 dark:bg-blue-950/20 dark:border-blue-800/30">
            <ShieldAlert className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300">
                Safe & Confidential Whistleblower & Grievance Intake
              </h4>
              <p className="text-blue-800/90 dark:text-blue-400 mt-1">
                Humanitas maintains a strict zero-retaliation policy. All filings are safeguarded with audit logs, and you may choose to submit anonymously to protect your identity.
              </p>
            </div>
          </div>

          <form onSubmit={handleFileSubmit} className="space-y-5">
            {/* Anonymous Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
              <div>
                <label className="font-medium text-foreground text-sm flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-primary" />
                  Submit Anonymously
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your name and identity will be masked and hidden from non-authorized personnel.
                </p>
              </div>
              <input
                type="checkbox"
                checked={fileForm.is_anonymous}
                onChange={(e) => setFileForm({ ...fileForm, is_anonymous: e.target.checked })}
                className="h-5 w-5 rounded border-input text-primary focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Category *</label>
                <select
                  value={fileForm.category}
                  onChange={(e) => setFileForm({ ...fileForm, category: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Priority Level</label>
                <select
                  value={fileForm.priority}
                  onChange={(e) => setFileForm({ ...fileForm, priority: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Subject / Headline *</label>
              <input
                type="text"
                placeholder="e.g. Inappropriate workplace conduct or safety hazard"
                value={fileForm.subject}
                onChange={(e) => setFileForm({ ...fileForm, subject: e.target.value })}
                className="w-full rounded-lg border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Incident Date (Optional)</label>
                <input
                  type="date"
                  value={fileForm.incident_date}
                  onChange={(e) => setFileForm({ ...fileForm, incident_date: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Incident Location (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 3rd Floor Conference Room or Branch Site"
                  value={fileForm.incident_location}
                  onChange={(e) => setFileForm({ ...fileForm, incident_location: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Person(s) Involved / Accused</label>
                <input
                  type="text"
                  placeholder="Name(s) or title(s)"
                  value={fileForm.accused_parties}
                  onChange={(e) => setFileForm({ ...fileForm, accused_parties: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Witnesses (Optional)</label>
                <input
                  type="text"
                  placeholder="Colleague names who observed the event"
                  value={fileForm.witnesses}
                  onChange={(e) => setFileForm({ ...fileForm, witnesses: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Detailed Narrative *</label>
              <textarea
                rows={5}
                placeholder="Describe what occurred with specific facts, dates, context, and any previous attempts at resolution..."
                value={fileForm.description}
                onChange={(e) => setFileForm({ ...fileForm, description: e.target.value })}
                className="w-full rounded-lg border border-input bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setActiveTab('cases')}>
                Cancel
              </Button>
              <Button type="submit" disabled={fileMutation.isPending} className="gap-2">
                <Send className="h-4 w-4" />
                {fileMutation.isPending ? 'Submitting...' : 'Submit Grievance'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Reports & SLA Analytics */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Category Breakdown */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold text-foreground text-base mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Grievance Volume by Category
            </h3>
            <div className="space-y-3">
              {stats?.by_category?.length ? (
                stats.by_category.map((item) => (
                  <div key={item.category} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {item.category.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.min(100, (parseInt(item.count) / (stats.total_cases || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground w-6 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No category data available yet.</p>
              )}
            </div>
          </div>

          {/* SLA Performance & Resolution Metrics */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-semibold text-foreground text-base mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              SLA Compliance & Resolution Timelines
            </h3>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Average Time to Resolution</span>
                  <span className="text-lg font-bold text-foreground">
                    {stats?.avg_resolution_days ?? 0} days
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Target SLA: 14 business days from filing date.
                </p>
              </div>

              <div className="rounded-lg bg-muted/40 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">SLA Compliance Rate</span>
                  <span className="text-lg font-bold text-emerald-600">
                    {stats?.sla_compliance_rate ?? 100}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cases resolved within target resolution SLA timeline.
                </p>
              </div>

              <div className="rounded-lg bg-muted/40 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Retaliation Watchlist Cases</span>
                  <span className="text-lg font-bold text-purple-600">
                    {stats?.retaliation_monitoring_count ?? 0}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Active monitoring post-resolution to protect employees against workplace retaliation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Case Details Drawer / Modal */}
      {selectedGrievanceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-8">
            {isLoadingActive || !activeGrievance ? (
              <div className="p-8 text-center text-muted-foreground">Loading case details...</div>
            ) : (
              <div>
                {/* Header */}
                <div className="flex items-start justify-between border-b border-border p-6 bg-muted/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">
                        {activeGrievance.ticket_number}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_CONFIG[activeGrievance.status]?.color || 'bg-slate-100'
                        }`}
                      >
                        {STATUS_CONFIG[activeGrievance.status]?.label || activeGrievance.status}
                      </span>
                      {activeGrievance.retaliation_monitoring_flag && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                          Retaliation Watch
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-foreground mt-1">
                      {activeGrievance.subject}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedGrievanceId(null)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                  {/* Stepper */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
                      Lifecycle Progress
                    </h4>
                    <div className="flex items-center justify-between text-xs">
                      {['filed', 'acknowledged', 'investigating', 'resolution_proposed', 'closed'].map(
                        (stepKey, idx) => {
                          const conf = STATUS_CONFIG[stepKey];
                          const currentStep = STATUS_CONFIG[activeGrievance.status]?.step || 1;
                          const isDone = currentStep >= conf.step;
                          const isCurrent = currentStep === conf.step;

                          return (
                            <div key={stepKey} className="flex flex-col items-center flex-1 text-center">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                  isDone
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                              >
                                {idx + 1}
                              </div>
                              <span className="mt-1.5 font-medium">{conf.label}</span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Incident Info Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        Complainant
                      </div>
                      <div className="font-medium text-sm mt-1">
                        {activeGrievance.is_anonymous ? (
                          <span className="text-amber-600 flex items-center gap-1 font-semibold">
                            <EyeOff className="h-3.5 w-3.5" />
                            {canManage ? activeGrievance.submitter_name : 'Anonymous Submitter'}
                          </span>
                        ) : (
                          activeGrievance.submitter_name || 'Staff'
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" />
                        Investigator
                      </div>
                      <div className="font-medium text-sm mt-1">
                        {activeGrievance.investigator_name || (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        SLA Deadline
                      </div>
                      <div className="font-medium text-sm mt-1">
                        {activeGrievance.is_sla_breached ? (
                          <span className="text-rose-600 font-bold">Target Exceeded (Breached)</span>
                        ) : (
                          <span>14 Days Resolution Target</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Narrative */}
                  <div className="rounded-xl border border-border p-4 bg-card">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                      Report Narrative
                    </h4>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {activeGrievance.description}
                    </p>

                    {(activeGrievance.accused_parties || activeGrievance.witnesses) && (
                      <div className="mt-4 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        {activeGrievance.accused_parties && (
                          <div>
                            <span className="text-muted-foreground font-medium">Accused Party:</span>{' '}
                            <span className="font-semibold">{activeGrievance.accused_parties}</span>
                          </div>
                        )}
                        {activeGrievance.witnesses && (
                          <div>
                            <span className="text-muted-foreground font-medium">Witnesses:</span>{' '}
                            <span className="font-semibold">{activeGrievance.witnesses}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Resolution if proposed/closed */}
                  {activeGrievance.resolution_summary && (
                    <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 dark:border-purple-900/40 dark:bg-purple-950/20">
                      <h4 className="text-xs font-semibold uppercase text-purple-900 dark:text-purple-300 mb-2">
                        Resolution & Corrective Actions
                      </h4>
                      <p className="text-sm font-medium text-purple-950 dark:text-purple-200">
                        {activeGrievance.resolution_summary}
                      </p>
                      {activeGrievance.resolution_action_items && (
                        <div className="mt-2 text-xs text-purple-900/80 dark:text-purple-300">
                          <span className="font-semibold">Action Plan:</span> {activeGrievance.resolution_action_items}
                        </div>
                      )}

                      {/* Satisfaction Score */}
                      {activeGrievance.satisfaction_score && (
                        <div className="mt-3 pt-3 border-t border-purple-200/60 dark:border-purple-800/40 flex items-center gap-2">
                          <span className="text-xs font-medium text-purple-900 dark:text-purple-300">
                            Complainant Feedback:
                          </span>
                          <div className="flex items-center text-amber-500">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-4 w-4 ${
                                  s <= (activeGrievance.satisfaction_score || 0)
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-muted-foreground'
                                }`}
                              />
                            ))}
                          </div>
                          {activeGrievance.satisfaction_feedback && (
                            <span className="text-xs italic text-muted-foreground">
                              "{activeGrievance.satisfaction_feedback}"
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confidential Timeline History */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                      Case History & Investigation Timeline
                    </h4>
                    <div className="space-y-2 border-l-2 border-border pl-4">
                      {activeGrievance.timeline?.map((evt) => (
                        <div key={evt.id} className="relative pb-3 text-xs">
                          <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                              {evt.action.replace('_', ' ')}
                            </span>
                            <span>{new Date(evt.created_at).toLocaleString()}</span>
                          </div>
                          {evt.notes && <p className="mt-1 text-foreground">{evt.notes}</p>}
                          {evt.actor_name && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              By: {evt.actor_name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Note Input for Investigators */}
                  {canInvestigate && (
                    <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                        Add Investigation Note
                      </h4>
                      <textarea
                        rows={2}
                        placeholder="Log interview outcome, witness statement summary, or progress note..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-2.5 text-xs focus:outline-none"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isNoteConfidential}
                            onChange={(e) => setIsNoteConfidential(e.target.checked)}
                            className="rounded border-input text-primary"
                          />
                          Restricted Confidential (HR/Investigator Only)
                        </label>
                        <Button
                          size="sm"
                          onClick={handleAddNote}
                          disabled={noteMutation.isPending || !newNote.trim()}
                        >
                          Save Note
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-6 bg-muted/20">
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssignModal(true)}
                      >
                        <UserCheck className="mr-1.5 h-4 w-4" />
                        Assign Investigator
                      </Button>
                    )}

                    {canInvestigate && activeGrievance.status !== 'closed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowResolutionModal(true)}
                      >
                        <FileCheck className="mr-1.5 h-4 w-4" />
                        Propose Resolution
                      </Button>
                    )}

                    {/* Complainant Feedback Trigger */}
                    {activeGrievance.user_id === user?.id &&
                      (activeGrievance.status === 'resolution_proposed' || activeGrievance.status === 'closed') &&
                      !activeGrievance.satisfaction_score && (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => setShowFeedbackModal(true)}
                        >
                          <Star className="mr-1.5 h-4 w-4" />
                          Rate Resolution
                        </Button>
                      )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage && activeGrievance.status === 'filed' && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange('acknowledged')}
                      >
                        Acknowledge Receipt
                      </Button>
                    )}

                    {canManage && activeGrievance.status !== 'closed' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStatusChange('closed')}
                      >
                        Close Case
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedGrievanceId(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Investigator Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-lg text-foreground">Assign Lead Investigator</h3>
            <p className="text-xs text-muted-foreground">
              Select an authorized HR specialist or designated manager to lead case fact-finding.
            </p>
            <select
              value={selectedInvestigator}
              onChange={(e) => setSelectedInvestigator(e.target.value)}
              className="w-full rounded-lg border border-input bg-background p-2.5 text-sm"
            >
              <option value="">Select Investigator...</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email} ({u.role_name || 'Staff'})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAssign} disabled={!selectedInvestigator || assignMutation.isPending}>
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Propose Resolution Modal */}
      {showResolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-lg text-foreground">Propose Case Resolution</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Resolution Summary *</label>
                <textarea
                  rows={3}
                  placeholder="Summarize finding, mediation terms, or corrective action..."
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Action Items & Responsible Parties</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Schedule sensitivity training, adjust team seating, formal reprimand..."
                  value={actionItems}
                  onChange={(e) => setActionItems(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-xs focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={retaliationMonitoring}
                  onChange={(e) => setRetaliationMonitoring(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                Flag for Active Retaliation Monitoring (90-day check-ins)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowResolutionModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleResolutionSubmit} disabled={resolutionMutation.isPending}>
                Submit Resolution
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Resolution / Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-lg text-foreground">Rate Resolution Outcome</h3>
            <p className="text-xs text-muted-foreground">
              Please rate how fairly and effectively your concern was addressed.
            </p>

            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  className="p-1 text-amber-500 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-7 w-7 ${
                      star <= feedbackRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Additional Feedback</label>
              <textarea
                rows={3}
                placeholder="Share any comments regarding the outcome or process..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="w-full rounded-lg border border-input bg-background p-2.5 text-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowFeedbackModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleFeedbackSubmit} disabled={feedbackMutation.isPending}>
                Submit Rating
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
