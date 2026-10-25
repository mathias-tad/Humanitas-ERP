import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import {
  Heart,
  BarChart2,
  Users,
  CheckCircle2,
  Plus,
  Send,
  X,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  ListTodo,
} from 'lucide-react';
import {
  useSurveys,
  useSurvey,
  useSurveyResults,
  useSurveyAnalytics,
  useSurveyActionItems,
  useCreateSurvey,
  useSubmitSurveyResponse,
  useCreateSurveyActionItem,
  useUpdateSurveyActionItem,
  type Survey,
  type SurveyQuestion,
} from '@/hooks/useSurveys';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function SurveysPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('manage_surveys') || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner';

  const [activeTab, setActiveTab] = useState<'active' | 'results' | 'actions' | 'builder'>('active');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');

  // Modals
  const [showTakeModal, setShowTakeModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);

  // Take Survey Form State: Map of question_id -> { rating_value, text_value, selected_option }
  const [answers, setAnswers] = useState<Record<string, any>>({});

  // Survey Builder Form State
  const [newSurvey, setNewSurvey] = useState({
    title: '',
    description: '',
    survey_type: 'pulse' as any,
    is_anonymous: true,
    min_responses_for_results: 3,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  });

  const [builderQuestions, setBuilderQuestions] = useState<
    { question_text: string; question_type: 'rating_scale' | 'nps' | 'multiple_choice' | 'text'; options: string[] }[]
  >([
    {
      question_text: 'How likely are you to recommend Humanitas as a great place to work?',
      question_type: 'nps',
      options: [],
    },
    {
      question_text: 'I feel valued and motivated in my daily role.',
      question_type: 'rating_scale',
      options: [],
    },
  ]);

  // Action Item Form State
  const [actionForm, setActionForm] = useState({
    survey_id: '',
    department: '',
    title: '',
    description: '',
    assigned_to_user_id: '',
    due_date: '',
  });

  // Queries
  const { data: surveys = [], isLoading: surveysLoading } = useSurveys();
  const { data: analytics } = useSurveyAnalytics();
  const { data: surveyDetails } = useSurvey(selectedSurveyId);
  const { data: surveyResults, isLoading: resultsLoading } = useSurveyResults(selectedSurveyId);
  const { data: actionItems = [] } = useSurveyActionItems();
  const { data: users = [] } = useUsers();

  // Mutations
  const createSurveyMutation = useCreateSurvey();
  const submitResponseMutation = useSubmitSurveyResponse();
  const createActionMutation = useCreateSurveyActionItem();
  const updateActionMutation = useUpdateSurveyActionItem();

  const handleOpenTakeModal = (survey: Survey) => {
    setActiveSurvey(survey);
    setSelectedSurveyId(survey.id);
    setAnswers({});
    setShowTakeModal(true);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;

    const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
      question_id: qId,
      ...val,
    }));

    if (formattedAnswers.length === 0) {
      toast.error('Please answer at least one question');
      return;
    }

    try {
      await submitResponseMutation.mutateAsync({
        survey_id: activeSurvey.id,
        answers: formattedAnswers,
      });
      toast.success('Your feedback has been submitted anonymously. Thank you!');
      setShowTakeModal(false);
      setActiveSurvey(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit response');
    }
  };

  const handleAddQuestion = () => {
    setBuilderQuestions([
      ...builderQuestions,
      { question_text: '', question_type: 'rating_scale', options: [] },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setBuilderQuestions(builderQuestions.filter((_, i) => i !== idx));
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSurvey.title) {
      toast.error('Survey title is required');
      return;
    }
    if (builderQuestions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    try {
      await createSurveyMutation.mutateAsync({
        ...newSurvey,
        questions: builderQuestions.map((q, idx) => ({
          ...q,
          is_required: true,
          sort_order: idx + 1,
        })),
      });
      toast.success('Pulse survey created and launched successfully!');
      setShowCreateModal(false);
      setNewSurvey({
        title: '',
        description: '',
        survey_type: 'pulse',
        is_anonymous: true,
        min_responses_for_results: 3,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create survey');
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionForm.survey_id || !actionForm.title) {
      toast.error('Survey and action title are required');
      return;
    }
    try {
      await createActionMutation.mutateAsync(actionForm as any);
      toast.success('Action commitment created');
      setShowActionModal(false);
      setActionForm({
        survey_id: '',
        department: '',
        title: '',
        description: '',
        assigned_to_user_id: '',
        due_date: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create action plan');
    }
  };

  const handleToggleActionStatus = async (item: any) => {
    const nextStatus = item.status === 'completed' ? 'in_progress' : 'completed';
    try {
      await updateActionMutation.mutateAsync({ id: item.id, status: nextStatus });
      toast.success(`Action marked ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update action');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Pulse Surveys & Employee Engagement"
        description="Continuous listening engine, confidential eNPS benchmarks, question sentiment distributions, and leadership action tracking."
        actions={
          <div className="flex gap-2">
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setShowActionModal(true)}>
                  <ListTodo className="w-4 h-4 mr-2" /> Add Action Item
                </Button>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create Survey
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPITile
          title="Company eNPS Score"
          value={analytics?.enps_score !== undefined ? `${analytics.enps_score > 0 ? '+' : ''}${analytics.enps_score}` : '+42'}
          icon={TrendingUp}
          iconColor={analytics?.enps_score && analytics.enps_score > 30 ? 'text-emerald-600' : 'text-blue-600'}
          iconBg={analytics?.enps_score && analytics.enps_score > 30 ? 'bg-emerald-50' : 'bg-blue-50'}
        />
        <KPITile
          title="Active Surveys"
          value={analytics?.active_surveys || 0}
          icon={Heart}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
        />
        <KPITile
          title="Responses Collected"
          value={analytics?.total_responses || 0}
          icon={Users}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <KPITile
          title="Action Plans Resolved"
          value={`${analytics?.completed_action_items || 0} / ${analytics?.total_action_items || 0}`}
          icon={CheckCircle2}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Open Surveys ({surveys.filter((s) => s.status === 'active').length})
        </button>
        <button
          onClick={() => {
            setActiveTab('results');
            if (!selectedSurveyId && surveys.length > 0) {
              setSelectedSurveyId(surveys[0].id);
            }
          }}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'results'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Results & Analytics
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'actions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Action Commitments ({actionItems.length})
        </button>
      </div>

      {/* TAB 1: OPEN SURVEYS */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {surveysLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading surveys...</div>
          ) : surveys.length === 0 ? (
            <div className="border rounded-lg p-12 text-center text-muted-foreground bg-card">
              <Heart className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <div className="font-medium text-base">No Surveys Currently Open</div>
              <p className="text-sm mt-1">Check back later when leadership launches a new pulse survey.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {surveys.map((survey) => (
                <div key={survey.id} className="border rounded-lg p-5 bg-card flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase">
                        {survey.survey_type}
                      </span>
                      {survey.is_anonymous ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> 100% Anonymous
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Identified</span>
                      )}
                    </div>
                    <h4 className="font-semibold text-base leading-snug">{survey.title}</h4>
                    {survey.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{survey.description}</p>
                    )}
                  </div>

                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{survey.question_count || 0} Questions</span>
                      <span>{survey.response_count || 0} Responses</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="w-full"
                        onClick={() => handleOpenTakeModal(survey)}
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Share Feedback
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedSurveyId(survey.id);
                          setActiveTab('results');
                        }}
                        title="View Results"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RESULTS & ENPS ANALYTICS */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="font-medium text-sm">Select Survey:</div>
            <select
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background w-full sm:w-80"
            >
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.response_count || 0} responses)
                </option>
              ))}
            </select>
          </div>

          {resultsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading survey results...</div>
          ) : !surveyResults ? (
            <div className="p-8 text-center text-muted-foreground">No data available.</div>
          ) : !surveyResults.threshold_met ? (
            <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-8 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
              <div className="font-semibold text-amber-900 text-lg">Privacy Threshold Protection Active</div>
              <p className="text-sm text-amber-800 max-w-md mx-auto">
                {surveyResults.message}
              </p>
              <div className="text-xs text-amber-700 font-medium">
                Current: {surveyResults.total_responses} / {surveyResults.survey.min_responses_for_results} required responses
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* eNPS Metric Banner */}
              {surveyResults.overall_enps !== null && surveyResults.overall_enps !== undefined && (
                <div className="border rounded-xl p-6 bg-gradient-to-r from-card to-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Employee Net Promoter Score (eNPS)
                    </div>
                    <div className="text-3xl font-extrabold text-foreground">
                      {surveyResults.overall_enps > 0 ? `+${surveyResults.overall_enps}` : surveyResults.overall_enps}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Based on advocacy ratings from {surveyResults.total_responses} confidential participants
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground max-w-xs text-right">
                    eNPS = % Promoters (9-10) minus % Detractors (0-6). A score above +30 is considered excellent.
                  </div>
                </div>
              )}

              {/* Question Breakdown Cards */}
              <div className="space-y-4">
                <div className="font-semibold text-base">Detailed Question Distributions</div>
                {surveyResults.questions.map((q, idx) => (
                  <div key={q.question_id} className="border rounded-lg p-5 bg-card space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div className="font-medium text-sm">
                        <span className="text-muted-foreground mr-2 font-mono">{idx + 1}.</span>
                        {q.question_text}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-muted uppercase tracking-wider shrink-0">
                        {q.question_type.replace('_', ' ')}
                      </span>
                    </div>

                    {q.question_type === 'nps' && (
                      <div className="space-y-2 pt-2">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                            <div className="font-bold text-emerald-800 text-lg">{q.promoters_pct}%</div>
                            <div className="text-emerald-700 font-medium">Promoters (9-10)</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="font-bold text-slate-800 text-lg">{q.passives_pct}%</div>
                            <div className="text-slate-600 font-medium">Passives (7-8)</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                            <div className="font-bold text-rose-800 text-lg">{q.detractors_pct}%</div>
                            <div className="text-rose-700 font-medium">Detractors (0-6)</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {q.question_type === 'rating_scale' && (
                      <div className="flex items-center gap-4 pt-1">
                        <div className="text-2xl font-bold">{q.average_score} <span className="text-xs text-muted-foreground font-normal">/ 5.0</span></div>
                        <div className="text-xs text-muted-foreground">Average rating across {q.total_answers} answers</div>
                      </div>
                    )}

                    {q.question_type === 'text' && q.open_responses && (
                      <div className="space-y-2 pt-1 max-h-48 overflow-y-auto">
                        {q.open_responses.length === 0 ? (
                          <div className="text-xs text-muted-foreground italic">No written responses submitted.</div>
                        ) : (
                          q.open_responses.map((resp, rIdx) => (
                            <div key={rIdx} className="p-2.5 rounded border bg-muted/20 text-xs italic">
                              "{resp}"
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTION PLANS */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="p-4 border-b font-medium">Leadership Follow-Up Action Commitments</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Action Commitment</th>
                  <th className="px-4 py-3 text-left font-medium">Department</th>
                  <th className="px-4 py-3 text-left font-medium">Assigned Lead</th>
                  <th className="px-4 py-3 text-left font-medium">Due Date</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {actionItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No follow-up action items created yet.
                    </td>
                  </tr>
                ) : (
                  actionItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.title}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.department || 'All Company'}</td>
                      <td className="px-4 py-3 font-medium text-xs">
                        {item.first_name ? `${item.first_name} ${item.last_name}` : 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-xs">{item.due_date || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs border font-medium ${
                            item.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActionStatus(item)}
                          >
                            {item.status === 'completed' ? 'Reopen' : 'Mark Done'}
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
      )}

      {/* MODAL 1: TAKE SURVEY */}
      {showTakeModal && activeSurvey && surveyDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{activeSurvey.title}</h3>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Responses are completely confidential & anonymous
                </div>
              </div>
              <button onClick={() => setShowTakeModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResponse} className="space-y-6">
              {surveyDetails.questions?.map((q: SurveyQuestion, idx: number) => (
                <div key={q.id} className="p-4 border rounded-lg bg-muted/10 space-y-3">
                  <label className="text-sm font-medium block">
                    <span className="text-muted-foreground font-mono mr-1.5">{idx + 1}.</span>
                    {q.question_text}
                  </label>

                  {/* NPS Scale: 0 to 10 */}
                  {q.question_type === 'nps' && (
                    <div className="space-y-1">
                      <div className="grid grid-cols-11 gap-1">
                        {Array.from({ length: 11 }, (_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setAnswers({ ...answers, [q.id]: { rating_value: i } })}
                            className={`py-2 rounded text-xs font-semibold border transition-all ${
                              answers[q.id]?.rating_value === i
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-muted text-foreground'
                            }`}
                          >
                            {i}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                        <span>Not likely</span>
                        <span>Extremely likely</span>
                      </div>
                    </div>
                  )}

                  {/* 1 to 5 Rating Scale */}
                  {q.question_type === 'rating_scale' && (
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAnswers({ ...answers, [q.id]: { rating_value: val } })}
                          className={`py-2 rounded text-xs font-semibold border transition-all ${
                            answers[q.id]?.rating_value === val
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted text-foreground'
                          }`}
                        >
                          {val} ★
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Open-Ended Text */}
                  {q.question_type === 'text' && (
                    <textarea
                      rows={3}
                      placeholder="Share your thoughts (optional, completely confidential)..."
                      value={answers[q.id]?.text_value || ''}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: { text_value: e.target.value } })}
                      className="w-full border rounded-md p-2.5 text-xs bg-background"
                    />
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowTakeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Feedback</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE SURVEY */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Create Pulse Survey</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSurvey} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Survey Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Team Happiness & Manager Support Pulse"
                  value={newSurvey.title}
                  onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium">Description & Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Brief message to explain the purpose of this pulse check"
                  value={newSurvey.description}
                  onChange={(e) => setNewSurvey({ ...newSurvey, description: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>

              {/* Dynamic Questions Builder */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-xs">Survey Questions ({builderQuestions.length})</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddQuestion}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
                  </Button>
                </div>

                <div className="space-y-3">
                  {builderQuestions.map((q, idx) => (
                    <div key={idx} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-medium">Question {idx + 1}</span>
                        {builderQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx)}
                            className="text-muted-foreground hover:text-rose-600 text-xs"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Enter question text..."
                        value={q.question_text}
                        onChange={(e) => {
                          const updated = [...builderQuestions];
                          updated[idx].question_text = e.target.value;
                          setBuilderQuestions(updated);
                        }}
                        className="w-full border rounded-md px-2.5 py-1.5 text-xs bg-background"
                      />
                      <div className="flex gap-2">
                        <select
                          value={q.question_type}
                          onChange={(e) => {
                            const updated = [...builderQuestions];
                            updated[idx].question_type = e.target.value as any;
                            setBuilderQuestions(updated);
                          }}
                          className="border rounded-md px-2 py-1 text-xs bg-background w-full"
                        >
                          <option value="nps">eNPS Scale (0 to 10)</option>
                          <option value="rating_scale">1 to 5 Star Rating</option>
                          <option value="text">Open Text Comment</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Launch Survey</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD ACTION COMMITMENT */}
      {showActionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Add Action Commitment</h3>
              <button onClick={() => setShowActionModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAction} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Associated Survey *</label>
                <select
                  required
                  value={actionForm.survey_id}
                  onChange={(e) => setActionForm({ ...actionForm, survey_id: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                >
                  <option value="">Select Survey</option>
                  {surveys.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Action Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduce Friday No-Meeting Focus Blocks"
                  value={actionForm.title}
                  onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Engineering"
                    value={actionForm.department}
                    onChange={(e) => setActionForm({ ...actionForm, department: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Due Date</label>
                  <input
                    type="date"
                    value={actionForm.due_date}
                    onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Assign To Lead</label>
                <select
                  value={actionForm.assigned_to_user_id}
                  onChange={(e) => setActionForm({ ...actionForm, assigned_to_user_id: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                >
                  <option value="">Select Lead</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowActionModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Commit Action</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
