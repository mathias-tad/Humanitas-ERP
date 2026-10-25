import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: 'rating_scale' | 'nps' | 'multiple_choice' | 'text';
  options?: string[];
  is_required: boolean;
  sort_order: number;
}

export interface Survey {
  id: string;
  company_id?: string;
  branch_id?: string;
  title: string;
  description?: string;
  survey_type: 'pulse' | 'engagement' | 'culture' | 'onboarding' | 'exit' | 'custom';
  status: 'draft' | 'active' | 'closed';
  is_anonymous: boolean;
  min_responses_for_results: number;
  target_audience: string;
  target_department?: string;
  target_branch_id?: string;
  start_date?: string;
  end_date?: string;
  response_count?: number;
  question_count?: number;
  questions?: SurveyQuestion[];
  has_responded?: boolean;
  created_at: string;
}

export interface QuestionResult {
  question_id: string;
  question_text: string;
  question_type: string;
  total_answers?: number;
  average_score?: number;
  enps_score?: number;
  promoters_pct?: number;
  passives_pct?: number;
  detractors_pct?: number;
  distribution?: { selected_option: string; count: number }[];
  open_responses?: string[];
}

export interface SurveyResults {
  survey: Survey;
  total_responses: number;
  threshold_met: boolean;
  overall_enps?: number | null;
  message?: string;
  questions: QuestionResult[];
}

export interface SurveyActionItem {
  id: string;
  survey_id: string;
  survey_title?: string;
  department?: string;
  title: string;
  description?: string;
  assigned_to_user_id?: string;
  first_name?: string;
  last_name?: string;
  assignee_department?: string;
  due_date?: string;
  status: 'open' | 'in_progress' | 'completed';
  resolution_notes?: string;
  created_at: string;
}

export interface SurveyAnalytics {
  total_surveys: number;
  active_surveys: number;
  total_responses: number;
  enps_score: number;
  total_action_items: number;
  completed_action_items: number;
}

const API_BASE = '/api/hrms/surveys';

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${res.status}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export function useSurveys(status?: string) {
  const url = status && status !== 'all' ? `${API_BASE}?status=${status}` : API_BASE;
  return useQuery<Survey[]>({
    queryKey: ['surveys', status],
    queryFn: () => fetcher<Survey[]>(url),
  });
}

export function useSurvey(id: string) {
  return useQuery<Survey>({
    queryKey: ['survey', id],
    queryFn: () => fetcher<Survey>(`${API_BASE}/${id}`),
    enabled: !!id,
  });
}

export function useSurveyResults(id: string) {
  return useQuery<SurveyResults>({
    queryKey: ['survey-results', id],
    queryFn: () => fetcher<SurveyResults>(`${API_BASE}/${id}/results`),
    enabled: !!id,
  });
}

export function useSurveyAnalytics() {
  return useQuery<SurveyAnalytics>({
    queryKey: ['survey-analytics'],
    queryFn: () => fetcher<SurveyAnalytics>(`${API_BASE}/analytics`),
  });
}

export function useSurveyActionItems(surveyId?: string) {
  const url = surveyId ? `${API_BASE}/actions?survey_id=${surveyId}` : `${API_BASE}/actions`;
  return useQuery<SurveyActionItem[]>({
    queryKey: ['survey-actions', surveyId],
    queryFn: () => fetcher<SurveyActionItem[]>(url),
  });
}

export function useCreateSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Partial<Survey>, 'questions'> & { questions?: Partial<SurveyQuestion>[] }) => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create survey');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['survey-analytics'] });
    },
  });
}

export function useSubmitSurveyResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      survey_id: string;
      answers: { question_id: string; rating_value?: number; text_value?: string; selected_option?: string }[];
    }) => {
      const res = await fetch(`${API_BASE}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to submit response');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['survey', variables.survey_id] });
      queryClient.invalidateQueries({ queryKey: ['survey-results', variables.survey_id] });
      queryClient.invalidateQueries({ queryKey: ['survey-analytics'] });
    },
  });
}

export function useCreateSurveyActionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SurveyActionItem>) => {
      const res = await fetch(`${API_BASE}/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create action item');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-actions'] });
      queryClient.invalidateQueries({ queryKey: ['survey-analytics'] });
    },
  });
}

export function useUpdateSurveyActionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<SurveyActionItem>) => {
      const res = await fetch(`${API_BASE}/actions/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update action item');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-actions'] });
      queryClient.invalidateQueries({ queryKey: ['survey-analytics'] });
    },
  });
}
