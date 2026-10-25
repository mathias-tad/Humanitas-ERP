import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import {
  RotateCcw,
  Star,
  Users,
  TrendingUp,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  SlidersHorizontal,
  X,
  UserCheck,
  Send,
  Award,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import {
  useReviewCycles,
  useEmployeeReviews,
  useMyReviews,
  useCompetencies,
  usePips,
  useReviewAnalytics,
  useCreateReviewCycle,
  useUpdateReviewCycle,
  useNominatePeers,
  useSubmitFeedback,
  useCalibrateReview,
  useCreatePip,
  useUpdatePip,
  type EmployeeReview,
  type ReviewFeedback,
  type PIP,
} from '@/hooks/usePMSReviews';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const STATUS_BADGES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  calibrating: 'bg-amber-50 text-amber-700 border-amber-200',
  closed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  pending_self: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_peers: 'bg-purple-50 text-purple-700 border-purple-200',
  pending_manager: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ReviewsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('manage_reviews') || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner';
  const canCalibrate = hasPermission('calibrate_reviews') || canManage;

  const [activeTab, setActiveTab] = useState<'cycles' | 'my' | 'calibration' | 'pips' | 'analytics'>('cycles');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showNominateModal, setShowNominateModal] = useState(false);
  const [showCalibrateModal, setShowCalibrateModal] = useState(false);
  const [showPipModal, setShowPipModal] = useState(false);
  const [showPipOutcomeModal, setShowPipOutcomeModal] = useState(false);

  // Selected item state
  const [activeFeedback, setActiveFeedback] = useState<ReviewFeedback | null>(null);
  const [activeReview, setActiveReview] = useState<EmployeeReview | null>(null);
  const [activePip, setActivePip] = useState<PIP | null>(null);

  // Data queries
  const { data: cycles = [], isLoading: cyclesLoading } = useReviewCycles();
  const { data: reviews = [] } = useEmployeeReviews();
  const { data: myData } = useMyReviews();
  const { data: competencies = [] } = useCompetencies();
  const { data: pips = [], isLoading: pipsLoading } = usePips();
  const { data: analytics } = useReviewAnalytics();
  const { data: users = [] } = useUsers();

  // Mutations
  const createCycleMutation = useCreateReviewCycle();
  const updateCycleMutation = useUpdateReviewCycle();
  const nominatePeersMutation = useNominatePeers();
  const submitFeedbackMutation = useSubmitFeedback();
  const calibrateMutation = useCalibrateReview();
  const createPipMutation = useCreatePip();
  const updatePipMutation = useUpdatePip();

  // Cycle form state
  const [cycleForm, setCycleForm] = useState({
    title: '',
    cycle_type: 'quarterly' as const,
    start_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    self_review_due_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    peer_review_due_date: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
    manager_review_due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    description: '',
    min_peers: 2,
    max_peers: 5,
  });

  // Feedback form state
  const [feedbackForm, setFeedbackForm] = useState({
    overall_rating: 4,
    general_feedback: '',
    strengths: '',
    improvements: '',
    competency_scores: {} as Record<string, number>,
  });

  // Nominate peers state
  const [selectedPeers, setSelectedPeers] = useState<string[]>([]);

  // Calibration state
  const [calibrateForm, setCalibrateForm] = useState({
    calibrated_rating: 4,
    manager_summary: '',
    strengths: '',
    areas_for_growth: '',
    status: 'completed' as const,
  });

  // PIP state
  const [pipForm, setPipForm] = useState({
    employee_id: '',
    title: '',
    reason: '',
    action_plan: '',
    success_criteria: '',
    support_resources: '',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
    check_in_frequency: 'bi_weekly',
  });

  const [pipOutcomeForm, setPipOutcomeForm] = useState({
    status: 'completed_successfully' as const,
    outcome_notes: '',
  });

  // Handlers
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCycleMutation.mutateAsync(cycleForm);
      toast.success('Review cycle launched successfully');
      setShowCycleModal(false);
      setCycleForm({
        title: '',
        cycle_type: 'quarterly',
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        self_review_due_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        peer_review_due_date: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
        manager_review_due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        description: '',
        min_peers: 2,
        max_peers: 5,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create review cycle');
    }
  };

  const handleOpenFeedback = (fb: ReviewFeedback) => {
    setActiveFeedback(fb);
    const initialScores: Record<string, number> = {};
    competencies.forEach((c) => {
      initialScores[c.id] = 4;
    });
    setFeedbackForm({
      overall_rating: 4,
      general_feedback: '',
      strengths: '',
      improvements: '',
      competency_scores: initialScores,
    });
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFeedback) return;
    try {
      const scoresArray = Object.entries(feedbackForm.competency_scores).map(([cid, score]) => ({
        competency_id: cid,
        score,
      }));
      await submitFeedbackMutation.mutateAsync({
        feedbackId: activeFeedback.id,
        payload: {
          overall_rating: feedbackForm.overall_rating,
          general_feedback: feedbackForm.general_feedback,
          strengths: feedbackForm.strengths,
          improvements: feedbackForm.improvements,
          competency_scores: scoresArray,
        },
      });
      toast.success('Feedback submitted successfully!');
      setShowFeedbackModal(false);
      setActiveFeedback(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    }
  };

  const handleNominatePeers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReview || selectedPeers.length === 0) return;
    try {
      await nominatePeersMutation.mutateAsync({
        reviewId: activeReview.id,
        peerIds: selectedPeers,
      });
      toast.success('Peers nominated successfully');
      setShowNominateModal(false);
      setSelectedPeers([]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to nominate peers');
    }
  };

  const handleOpenCalibrate = (rev: EmployeeReview) => {
    setActiveReview(rev);
    setCalibrateForm({
      calibrated_rating: rev.calibrated_rating || rev.final_rating || rev.manager_rating || 3.5,
      manager_summary: rev.manager_summary || '',
      strengths: rev.strengths || '',
      areas_for_growth: rev.areas_for_growth || '',
      status: 'completed',
    });
    setShowCalibrateModal(true);
  };

  const handleCalibrate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReview) return;
    try {
      await calibrateMutation.mutateAsync({
        reviewId: activeReview.id,
        payload: calibrateForm,
      });
      toast.success('Performance review calibrated and saved');
      setShowCalibrateModal(false);
      setActiveReview(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to calibrate review');
    }
  };

  const handleCreatePip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPipMutation.mutateAsync(pipForm);
      toast.success('Performance Improvement Plan created successfully');
      setShowPipModal(false);
      setPipForm({
        employee_id: '',
        title: '',
        reason: '',
        action_plan: '',
        success_criteria: '',
        support_resources: '',
        start_date: new Date().toISOString().split('T')[0],
        target_end_date: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
        check_in_frequency: 'bi_weekly',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create PIP');
    }
  };

  const handleUpdatePipOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePip) return;
    try {
      await updatePipMutation.mutateAsync({
        pipId: activePip.id,
        payload: {
          status: pipOutcomeForm.status,
          outcome_notes: pipOutcomeForm.outcome_notes,
          outcome_date: new Date().toISOString().split('T')[0],
        },
      });
      toast.success('PIP outcome recorded');
      setShowPipOutcomeModal(false);
      setActivePip(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record PIP outcome');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="360° Performance Reviews"
        description="Comprehensive employee evaluations, multi-source peer feedback, calibration, and PIP tracking"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('my')}
              className="gap-2 text-xs"
            >
              <UserCheck className="h-4 w-4" />
              My Reviews ({myData?.pending_requests?.length || 0})
            </Button>
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPipModal(true)}
                  className="gap-2 text-xs"
                >
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  Initiate PIP
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowCycleModal(true)}
                  className="gap-2 text-xs"
                >
                  <Plus className="h-4 w-4" />
                  New Review Cycle
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPITile
          title="Active Cycles"
          value={analytics?.total_cycles?.toString() || '0'}
          subtitle="Configured evaluation periods"
          icon={RotateCcw}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <KPITile
          title="Review Completion"
          value={`${analytics?.completion_rate || 0}%`}
          subtitle={`${analytics?.completed_reviews || 0} of ${analytics?.total_reviews || 0} reviews finalized`}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
        />
        <KPITile
          title="Average Org Rating"
          value={`${analytics?.average_rating || 0} / 5.0`}
          subtitle="Normalized calibration score"
          icon={Star}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
        <KPITile
          title="Active PIPs"
          value={analytics?.active_pips?.toString() || '0'}
          subtitle="Active improvement roadmaps"
          icon={TrendingUp}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border text-sm font-medium">
        <button
          onClick={() => setActiveTab('cycles')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'cycles'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          Review Cycles ({cycles.length})
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'my'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          My 360 Feedback
          {(myData?.pending_requests?.length || 0) > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
              {myData?.pending_requests.length}
            </span>
          )}
        </button>
        {canCalibrate && (
          <button
            onClick={() => setActiveTab('calibration')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
              activeTab === 'calibration'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Calibration & Normalization ({reviews.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('pips')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'pips'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Improvement Plans (PIP) ({pips.length})
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
          Review Analytics & Bell Curve
        </button>
      </div>

      {/* ── TAB 1: CYCLES ──────────────────────────────────────────────────────── */}
      {activeTab === 'cycles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cycles.map((c) => {
              const compPercent = c.total_participants > 0
                ? Math.round((c.completed_reviews / c.total_participants) * 100)
                : 0;

              return (
                <div key={c.id} className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div>
                    <div className="flex items-start justify-between">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGES[c.status] || 'bg-slate-100'}`}>
                        {c.status}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                        {c.cycle_type.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-foreground">{c.title}</h3>
                    {c.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    )}

                    <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Period:</span>
                        <span className="font-medium text-foreground">{c.start_date} → {c.due_date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Peers Allowed:</span>
                        <span className="font-medium text-foreground">{c.min_peers} - {c.max_peers} peers</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Participants:</span>
                        <span className="font-medium text-foreground">{c.total_participants} employees</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress:</span>
                        <span className="font-semibold text-foreground">{compPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${compPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="mt-5 border-t border-border pt-3 flex justify-end gap-2">
                      {c.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCycleMutation.mutate({ cycleId: c.id, payload: { status: 'calibrating' } })}
                          className="text-xs"
                        >
                          Start Calibration
                        </Button>
                      )}
                      {c.status === 'calibrating' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCycleMutation.mutate({ cycleId: c.id, payload: { status: 'closed' } })}
                          className="text-xs"
                        >
                          Close Cycle
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {cycles.length === 0 && !cyclesLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card">
              <RotateCcw className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">No Review Cycles Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Create a quarterly or annual 360° review cycle to begin evaluations.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: MY 360 REVIEWS ──────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* Section 1: Pending Feedback Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Pending Feedback Requests for You to Submit
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(myData?.pending_requests || []).map((req) => (
                <div key={req.id} className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 capitalize">
                        {req.reviewer_type} Evaluation
                      </span>
                      <span className="text-[11px] text-muted-foreground">Due: {req.cycle_due_date}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                        {req.subject_first_name?.[0] || 'U'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {req.subject_first_name} {req.subject_last_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {req.subject_job_title || 'Colleague'} • {req.subject_department || 'General'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Cycle: <span className="font-medium text-foreground">{req.cycle_title}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleOpenFeedback(req)}
                    className="mt-4 w-full gap-2 text-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Submit Review & Ratings
                  </Button>
                </div>
              ))}
            </div>

            {(!myData?.pending_requests || myData.pending_requests.length === 0) && (
              <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                You have no pending feedback requests at this time.
              </div>
            )}
          </div>

          {/* Section 2: My Performance Reviews */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
              <Award className="h-4 w-4 text-emerald-500" />
              My Performance Evaluations
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(myData?.evaluations || []).map((ev: any) => (
                <div key={ev.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-foreground">{ev.cycle_title}</h4>
                      <p className="text-xs text-muted-foreground">Manager: {ev.manager_first_name || 'Assigned'} {ev.manager_last_name || 'Lead'}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGES[ev.status] || 'bg-slate-100'}`}>
                      {ev.status?.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Rating Breakdown */}
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center border-y border-border py-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Self</p>
                      <p className="text-sm font-bold text-foreground">{ev.self_rating || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Peers Avg</p>
                      <p className="text-sm font-bold text-foreground">{ev.peer_rating_avg || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Manager</p>
                      <p className="text-sm font-bold text-foreground">{ev.manager_rating || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold text-primary">Final</p>
                      <p className="text-sm font-extrabold text-primary">{ev.final_rating || '—'}</p>
                    </div>
                  </div>

                  {ev.manager_summary && (
                    <div className="mt-3 text-xs bg-slate-50 p-2.5 rounded-lg border">
                      <p className="font-semibold text-foreground mb-0.5">Manager Feedback Summary:</p>
                      <p className="text-muted-foreground italic">"{ev.manager_summary}"</p>
                    </div>
                  )}

                  {/* Action to nominate peers */}
                  {ev.status === 'pending_self' && (
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveReview(ev);
                          setShowNominateModal(true);
                        }}
                        className="text-xs gap-1.5"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Nominate Peer Reviewers
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(!myData?.evaluations || myData.evaluations.length === 0) && (
              <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                No performance review cycles currently active for your profile.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: CALIBRATION & RATINGS ────────────────────────────────────────── */}
      {activeTab === 'calibration' && canCalibrate && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employee or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {reviews.length} employee reviews for calibration
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Review Cycle</th>
                  <th className="p-3 text-center">Self</th>
                  <th className="p-3 text-center">Peers Avg</th>
                  <th className="p-3 text-center">Manager</th>
                  <th className="p-3 text-center font-bold text-primary">Final Rating</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reviews
                  .filter((r) =>
                    `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{r.first_name} {r.last_name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.job_title || r.email}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.department || 'General'}</td>
                      <td className="p-3 font-medium text-foreground">{r.cycle_title}</td>
                      <td className="p-3 text-center font-medium">{r.self_rating || '—'}</td>
                      <td className="p-3 text-center font-medium">{r.peer_rating_avg || '—'}</td>
                      <td className="p-3 text-center font-medium">{r.manager_rating || '—'}</td>
                      <td className="p-3 text-center">
                        <span className="font-extrabold text-primary text-sm">
                          {r.calibrated_rating || r.final_rating || '—'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGES[r.status] || 'bg-slate-100'}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCalibrate(r)}
                          className="h-7 text-xs gap-1"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          Calibrate
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: PERFORMANCE IMPROVEMENT PLANS (PIP) ─────────────────────────── */}
      {activeTab === 'pips' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pips.map((pip) => (
              <div key={pip.id} className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      pip.status === 'completed_successfully' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      pip.status === 'active' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      pip.status === 'terminated' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100'
                    }`}>
                      {pip.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{pip.check_in_frequency}</span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-foreground">{pip.title}</h3>
                  <p className="text-xs text-primary font-medium mt-0.5">
                    Employee: {pip.first_name} {pip.last_name} ({pip.department || 'General'})
                  </p>

                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-muted-foreground">Target Date: </span>
                      <span className="text-foreground">{pip.start_date} → {pip.target_end_date}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">Reason: </span>
                      <p className="text-muted-foreground line-clamp-2 mt-0.5">{pip.reason}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">Success Criteria: </span>
                      <p className="text-muted-foreground line-clamp-2 mt-0.5">{pip.success_criteria}</p>
                    </div>
                  </div>
                </div>

                {canManage && pip.status === 'active' && (
                  <div className="mt-4 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActivePip(pip);
                        setShowPipOutcomeModal(true);
                      }}
                      className="w-full text-xs"
                    >
                      Record Final PIP Outcome
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {pips.length === 0 && !pipsLoading && (
            <div className="rounded-xl border border-dashed p-10 text-center text-xs text-muted-foreground">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              No active or historical Performance Improvement Plans found.
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: ANALYTICS & REPORTS ─────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Bell Curve Distribution Chart */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Organization Rating Distribution (Bell Curve)
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Distribution of finalized 360 review ratings across all active evaluation cycles
            </p>

            <div className="space-y-4">
              {Object.entries(analytics?.rating_distribution || {}).map(([label, count]) => {
                const total = analytics?.total_reviews || 1;
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="text-muted-foreground font-semibold">
                        {count} employees ({percentage}%)
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Department Completion Breakdown */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Department Evaluation Progress
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Percentage of completed 360 reviews per organizational unit
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(analytics?.department_stats || []).map((ds) => (
                <div key={ds.department} className="rounded-lg border p-4 bg-muted/10">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-xs font-semibold text-foreground">{ds.department}</h4>
                    <span className="text-xs font-bold text-primary">{ds.completion_rate}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    {ds.completed} of {ds.total} reviews complete
                  </p>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${ds.completion_rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE REVIEW CYCLE ────────────────────────────────────────── */}
      {showCycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">Create 360° Review Cycle</h3>
              <button onClick={() => setShowCycleModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCycle} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground">Cycle Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q1 2026 Annual 360° Review"
                  value={cycleForm.title}
                  onChange={(e) => setCycleForm({ ...cycleForm, title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Cycle Type</label>
                  <select
                    value={cycleForm.cycle_type}
                    onChange={(e: any) => setCycleForm({ ...cycleForm, cycle_type: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  >
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="annual">Annual</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-foreground">Cycle Due Date</label>
                  <input
                    type="date"
                    required
                    value={cycleForm.due_date}
                    onChange={(e) => setCycleForm({ ...cycleForm, due_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Self Review Deadline</label>
                  <input
                    type="date"
                    value={cycleForm.self_review_due_date}
                    onChange={(e) => setCycleForm({ ...cycleForm, self_review_due_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground">Peer Feedback Deadline</label>
                  <input
                    type="date"
                    value={cycleForm.peer_review_due_date}
                    onChange={(e) => setCycleForm({ ...cycleForm, peer_review_due_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground">Description & Objectives</label>
                <textarea
                  rows={2}
                  value={cycleForm.description}
                  onChange={(e) => setCycleForm({ ...cycleForm, description: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  placeholder="Review instructions for employees and managers..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCycleModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createCycleMutation.isPending}>
                  {createCycleMutation.isPending ? 'Launching...' : 'Launch Cycle'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SUBMIT FEEDBACK ────────────────────────────────────────────── */}
      {showFeedbackModal && activeFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold">
                  Submit {activeFeedback.reviewer_type.toUpperCase()} Review
                </h3>
                <p className="text-xs text-muted-foreground">
                  For: {activeFeedback.subject_first_name} {activeFeedback.subject_last_name} ({activeFeedback.subject_department || 'General'})
                </p>
              </div>
              <button onClick={() => setShowFeedbackModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground">Overall Performance Rating (1.0 to 5.0)</label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={feedbackForm.overall_rating}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, overall_rating: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="font-bold text-sm text-primary w-12 text-center bg-primary/10 rounded py-1">
                    {feedbackForm.overall_rating} ★
                  </span>
                </div>
              </div>

              {/* Competencies Scoring */}
              <div className="border rounded-lg p-3 bg-muted/10 space-y-3">
                <h4 className="font-semibold text-foreground">Core Competencies Evaluation</h4>
                {competencies.map((comp) => (
                  <div key={comp.id} className="border-t border-border pt-2 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{comp.name}</p>
                      <p className="text-[10px] text-muted-foreground">{comp.description}</p>
                    </div>
                    <select
                      value={feedbackForm.competency_scores[comp.id] || 4}
                      onChange={(e) =>
                        setFeedbackForm({
                          ...feedbackForm,
                          competency_scores: {
                            ...feedbackForm.competency_scores,
                            [comp.id]: parseInt(e.target.value, 10),
                          },
                        })
                      }
                      className="rounded border border-input p-1 text-xs"
                    >
                      <option value="1">1 - Needs Dev</option>
                      <option value="2">2 - Developing</option>
                      <option value="3">3 - Proficient</option>
                      <option value="4">4 - Advanced</option>
                      <option value="5">5 - Role Model</option>
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="font-medium text-foreground">Key Strengths & Impact</label>
                <textarea
                  rows={2}
                  required
                  value={feedbackForm.strengths}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
                  placeholder="Highlight key contributions, problem-solving, or leadership..."
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Areas for Growth & Improvements</label>
                <textarea
                  rows={2}
                  value={feedbackForm.improvements}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, improvements: e.target.value })}
                  placeholder="Suggestions for skills expansion, communication, or ownership..."
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">General Summary Feedback</label>
                <textarea
                  rows={2}
                  value={feedbackForm.general_feedback}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, general_feedback: e.target.value })}
                  placeholder="Additional context or qualitative feedback..."
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowFeedbackModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitFeedbackMutation.isPending}>
                  {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Evaluation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: NOMINATE PEERS ─────────────────────────────────────────────── */}
      {showNominateModal && activeReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">Nominate Peer Reviewers</h3>
              <button onClick={() => setShowNominateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleNominatePeers} className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                Select 2 to 5 peers who collaborate with you to provide confidential feedback.
              </p>

              <div className="max-h-60 overflow-y-auto space-y-1.5 border rounded-lg p-2">
                {users.map((u: any) => {
                  const isSelected = selectedPeers.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPeers([...selectedPeers, u.id]);
                          } else {
                            setSelectedPeers(selectedPeers.filter((id) => id !== u.id));
                          }
                        }}
                      />
                      <div>
                        <p className="text-xs text-foreground font-semibold">{u.full_name || u.email}</p>
                        <p className="text-[10px] text-muted-foreground">{u.position || u.job_title} • {u.department}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Selected: {selectedPeers.length} peers</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNominateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={nominatePeersMutation.isPending || selectedPeers.length === 0}>
                    {nominatePeersMutation.isPending ? 'Saving...' : 'Nominate Selected'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CALIBRATE REVIEW ───────────────────────────────────────────── */}
      {showCalibrateModal && activeReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold">Calibrate Employee Review</h3>
                <p className="text-xs text-muted-foreground">
                  Employee: {activeReview.first_name} {activeReview.last_name} ({activeReview.department || 'General'})
                </p>
              </div>
              <button onClick={() => setShowCalibrateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCalibrate} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 p-3 bg-muted/20 rounded-lg text-center">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Self Rating</span>
                  <p className="font-bold text-sm text-foreground">{activeReview.self_rating || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Peers Avg</span>
                  <p className="font-bold text-sm text-foreground">{activeReview.peer_rating_avg || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Manager Rating</span>
                  <p className="font-bold text-sm text-foreground">{activeReview.manager_rating || '—'}</p>
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground">Calibrated Final Rating (1.0 to 5.0)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  required
                  value={calibrateForm.calibrated_rating}
                  onChange={(e) => setCalibrateForm({ ...calibrateForm, calibrated_rating: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Manager Final Summary</label>
                <textarea
                  rows={2}
                  value={calibrateForm.manager_summary}
                  onChange={(e) => setCalibrateForm({ ...calibrateForm, manager_summary: e.target.value })}
                  placeholder="Executive summary of overall performance..."
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Key Strengths</label>
                <textarea
                  rows={2}
                  value={calibrateForm.strengths}
                  onChange={(e) => setCalibrateForm({ ...calibrateForm, strengths: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Areas for Growth</label>
                <textarea
                  rows={2}
                  value={calibrateForm.areas_for_growth}
                  onChange={(e) => setCalibrateForm({ ...calibrateForm, areas_for_growth: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCalibrateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={calibrateMutation.isPending}>
                  {calibrateMutation.isPending ? 'Saving...' : 'Finalize Calibration'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE PIP ─────────────────────────────────────────────────── */}
      {showPipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">Create Performance Improvement Plan (PIP)</h3>
              <button onClick={() => setShowPipModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePip} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground">Select Employee</label>
                <select
                  required
                  value={pipForm.employee_id}
                  onChange={(e) => setPipForm({ ...pipForm, employee_id: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                >
                  <option value="">Select an employee...</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} ({u.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground">Plan Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 60-Day Technical Quality & Deadlines PIP"
                  value={pipForm.title}
                  onChange={(e) => setPipForm({ ...pipForm, title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Start Date</label>
                  <input
                    type="date"
                    required
                    value={pipForm.start_date}
                    onChange={(e) => setPipForm({ ...pipForm, start_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground">Target End Date</label>
                  <input
                    type="date"
                    required
                    value={pipForm.target_end_date}
                    onChange={(e) => setPipForm({ ...pipForm, target_end_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground">Performance Reason</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Document specific instances or metrics not meeting expectations..."
                  value={pipForm.reason}
                  onChange={(e) => setPipForm({ ...pipForm, reason: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Concrete Action Plan</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Specific tasks, pairing schedules, and weekly expectations..."
                  value={pipForm.action_plan}
                  onChange={(e) => setPipForm({ ...pipForm, action_plan: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground">Success Criteria</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Measurable outcomes for successful completion..."
                  value={pipForm.success_criteria}
                  onChange={(e) => setPipForm({ ...pipForm, success_criteria: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPipModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createPipMutation.isPending}>
                  {createPipMutation.isPending ? 'Creating...' : 'Initiate PIP'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PIP OUTCOME ─────────────────────────────────────────────────── */}
      {showPipOutcomeModal && activePip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-semibold">Record PIP Outcome</h3>
              <button onClick={() => setShowPipOutcomeModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePipOutcome} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground">Final Outcome Decision</label>
                <select
                  value={pipOutcomeForm.status}
                  onChange={(e: any) => setPipOutcomeForm({ ...pipOutcomeForm, status: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs font-semibold"
                >
                  <option value="completed_successfully">Completed Successfully (Met Criteria)</option>
                  <option value="extended">Extend PIP (Further evaluation needed)</option>
                  <option value="terminated">Terminated (Criteria not met)</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground">Outcome Notes & Justification</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Document final evaluation, metrics, and manager sign-off..."
                  value={pipOutcomeForm.outcome_notes}
                  onChange={(e) => setPipOutcomeForm({ ...pipOutcomeForm, outcome_notes: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPipOutcomeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={updatePipMutation.isPending}>
                  {updatePipMutation.isPending ? 'Recording...' : 'Record Outcome'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
