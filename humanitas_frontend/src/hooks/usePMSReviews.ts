import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';

export interface ReviewCycle {
  id: string;
  company_id?: string;
  branch_id?: string;
  title: string;
  cycle_type: 'quarterly' | 'semi_annual' | 'annual' | 'custom';
  status: 'draft' | 'active' | 'calibrating' | 'closed';
  start_date: string;
  due_date: string;
  self_review_due_date?: string;
  peer_review_due_date?: string;
  manager_review_due_date?: string;
  description?: string;
  is_peer_review_enabled: boolean;
  min_peers: number;
  max_peers: number;
  is_upward_review_enabled: boolean;
  total_participants: number;
  completed_reviews: number;
  created_at: string;
}

export interface Competency {
  id: string;
  name: string;
  category: string;
  description: string;
  rating_scale: string;
  is_core: boolean;
}

export interface EmployeeReview {
  id: string;
  cycle_id: string;
  employee_id: string;
  manager_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  job_title?: string;
  manager_first_name?: string;
  manager_last_name?: string;
  cycle_title: string;
  cycle_status: string;
  status: 'pending_self' | 'pending_peers' | 'pending_manager' | 'calibrating' | 'completed';
  self_rating?: number;
  manager_rating?: number;
  peer_rating_avg?: number;
  calibrated_rating?: number;
  final_rating?: number;
  manager_summary?: string;
  strengths?: string;
  areas_for_growth?: string;
  created_at: string;
  feedbacks?: ReviewFeedback[];
  competency_scores?: ReviewCompetencyScore[];
}

export interface ReviewFeedback {
  id: string;
  review_id: string;
  cycle_id: string;
  reviewer_id: string;
  reviewer_type: 'self' | 'manager' | 'peer' | 'upward';
  status: 'pending' | 'submitted';
  overall_rating?: number;
  general_feedback?: string;
  strengths?: string;
  improvements?: string;
  submitted_at?: string;
  reviewer_first_name?: string;
  reviewer_last_name?: string;
  cycle_title?: string;
  cycle_due_date?: string;
  subject_first_name?: string;
  subject_last_name?: string;
  subject_job_title?: string;
  subject_department?: string;
}

export interface ReviewCompetencyScore {
  id: string;
  feedback_id: string;
  competency_id: string;
  score: number;
  comments?: string;
  competency_name: string;
  competency_category: string;
}

export interface PIP {
  id: string;
  employee_id: string;
  manager_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  job_title?: string;
  manager_first_name?: string;
  manager_last_name?: string;
  title: string;
  reason: string;
  action_plan: string;
  success_criteria: string;
  support_resources?: string;
  start_date: string;
  target_end_date: string;
  check_in_frequency: string;
  status: 'draft' | 'active' | 'completed_successfully' | 'extended' | 'terminated';
  outcome_notes?: string;
  outcome_date?: string;
  created_at: string;
}

export interface ReviewAnalytics {
  total_cycles: number;
  total_reviews: number;
  completed_reviews: number;
  completion_rate: number;
  average_rating: number;
  active_pips: number;
  rating_distribution: { [label: string]: number };
  department_stats: { department: string; total: number; completed: number; completion_rate: number }[];
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch data');
  const data = await res.json();
  return data.data || data;
}

export function useReviewCycles(companyId?: string, branchId?: string) {
  const params = new URLSearchParams();
  if (companyId) params.append('companyId', companyId);
  if (branchId) params.append('branchId', branchId);
  const q = params.toString() ? `?${params.toString()}` : '';

  return useQuery<ReviewCycle[]>({
    queryKey: ['pms-review-cycles', companyId, branchId],
    queryFn: () => fetcher<ReviewCycle[]>(`${API_BASE_URL}/pms/reviews/cycles${q}`),
  });
}

export function useReviewCycle(cycleId: string) {
  return useQuery<ReviewCycle>({
    queryKey: ['pms-review-cycle', cycleId],
    queryFn: () => fetcher<ReviewCycle>(`${API_BASE_URL}/pms/reviews/cycles/${cycleId}`),
    enabled: !!cycleId,
  });
}

export function useCreateReviewCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE_URL}/pms/reviews/cycles`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create review cycle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pms-review-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['pms-employee-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pms-review-analytics'] });
    },
  });
}

export function useUpdateReviewCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cycleId, payload }: { cycleId: string; payload: any }) => {
      const res = await fetch(`${API_BASE_URL}/pms/reviews/cycles/${cycleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update review cycle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pms-review-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['pms-review-cycle'] });
    },
  });
}

export function useEmployeeReviews(cycleId?: string, companyId?: string, branchId?: string) {
  const params = new URLSearchParams();
  if (cycleId) params.append('cycleId', cycleId);
  if (companyId) params.append('companyId', companyId);
  if (branchId) params.append('branchId', branchId);
  const q = params.toString() ? `?${params.toString()}` : '';

  return useQuery<EmployeeReview[]>({
    queryKey: ['pms-employee-reviews', cycleId, companyId, branchId],
    queryFn: () => fetcher<EmployeeReview[]>(`${API_BASE_URL}/pms/reviews/employees${q}`),
  });
}

export function useMyReviews() {
  return useQuery<{
    evaluations: any[];
    pending_requests: ReviewFeedback[];
    completed_requests: ReviewFeedback[];
  }>({
    queryKey: ['pms-my-reviews'],
    queryFn: () => fetcher(`${API_BASE_URL}/pms/reviews/my`),
  });
}

export function useReview(reviewId: string) {
  return useQuery<EmployeeReview>({
    queryKey: ['pms-review', reviewId],
    queryFn: () => fetcher<EmployeeReview>(`${API_BASE_URL}/pms/reviews/employees/${reviewId}`),
    enabled: !!reviewId,
  });
}

export function useNominatePeers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, peerIds }: { reviewId: string; peerIds: string[] }) => {
      const res = await fetch(`${API_BASE_URL}/pms/reviews/employees/${reviewId}/nominate-peers`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ peer_ids: peerIds }),
      });
      if (!res.ok) throw new Error('Failed to nominate peers');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pms-review', variables.reviewId] });
      queryClient.invalidateQueries({ queryKey: ['pms-my-reviews'] });
    },
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, payload }: { feedbackId: string; payload: any }) => {
      const res = await fetch(`${API_BASE_URL}/pms/reviews/feedbacks/${feedbackId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pms-my-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pms-employee-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pms-review'] });
      queryClient.invalidateQueries({ queryKey: ['pms-review-analytics'] });
    },
  });
}

export function useCalibrateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, payload }: { reviewId: string; payload: any }) => {
      const res = await fetch(`${API_BASE_URL}/pms/reviews/employees/${reviewId}/calibrate`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to calibrate review');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pms-review', variables.reviewId] });
      queryClient.invalidateQueries({ queryKey: ['pms-employee-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['pms-review-analytics'] });
    },
  });
}

export function useCompetencies() {
  return useQuery<Competency[]>({
    queryKey: ['pms-competencies'],
    queryFn: () => fetcher<Competency[]>(`${API_BASE_URL}/pms/reviews/competencies`),
  });
}

export function usePips(employeeId?: string, companyId?: string, branchId?: string) {
  const params = new URLSearchParams();
  if (employeeId) params.append('employeeId', employeeId);
  if (companyId) params.append('companyId', companyId);
  if (branchId) params.append('branchId', branchId);
  const q = params.toString() ? `?${params.toString()}` : '';

  return useQuery<PIP[]>({
    queryKey: ['pms-pips', employeeId, companyId, branchId],
    queryFn: () => fetcher<PIP[]>(`${API_BASE_URL}/pms/reviews/pips${q}`),
  });
}

export function useCreatePip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE_URL}/pms/reviews/pips`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create PIP');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pms-pips'] });
      queryClient.invalidateQueries({ queryKey: ['pms-review-analytics'] });
    },
  });
}

export function useUpdatePip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipId, payload }: { pipId: string; payload: any }) => {
      const res = await fetch(`${API_BASE_URL}/pms/reviews/pips/${pipId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update PIP');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pms-pips'] });
      queryClient.invalidateQueries({ queryKey: ['pms-review-analytics'] });
    },
  });
}

export function useReviewAnalytics(cycleId?: string, companyId?: string, branchId?: string) {
  const params = new URLSearchParams();
  if (cycleId) params.append('cycleId', cycleId);
  if (companyId) params.append('companyId', companyId);
  if (branchId) params.append('branchId', branchId);
  const q = params.toString() ? `?${params.toString()}` : '';

  return useQuery<ReviewAnalytics>({
    queryKey: ['pms-review-analytics', cycleId, companyId, branchId],
    queryFn: () => fetcher<ReviewAnalytics>(`${API_BASE_URL}/pms/reviews/analytics${q}`),
  });
}
