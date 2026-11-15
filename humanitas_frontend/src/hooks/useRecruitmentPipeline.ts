import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';

export interface Interview {
  id: string;
  job_id: string;
  job_title: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  interviewer_id?: string;
  interviewer_name: string;
  interview_type: 'screening' | 'technical' | 'cultural' | 'managerial' | 'final';
  scheduled_at: string;
  duration_minutes: number;
  meeting_link?: string;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  rating?: number; // 1-5
  feedback?: string;
  notes?: string;
  created_at: string;
}

export interface CreateInterviewInput {
  job_id: string;
  job_title?: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  interviewer_name: string;
  interview_type: 'screening' | 'technical' | 'cultural' | 'managerial' | 'final';
  scheduled_at: string;
  duration_minutes: number;
  meeting_link?: string;
  location?: string;
  notes?: string;
}

export interface UpdateInterviewInput {
  id: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  rating?: number;
  feedback?: string;
  notes?: string;
  scheduled_at?: string;
  duration_minutes?: number;
}

export interface JobOffer {
  id: string;
  job_id: string;
  job_title: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  department: string;
  position: string;
  base_salary: number;
  currency: string;
  employment_type: 'full_time' | 'part_time' | 'contract';
  start_date: string;
  expiration_date: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  terms_notes?: string;
  created_at: string;
  sent_at?: string;
  responded_at?: string;
}

export interface CreateOfferInput {
  job_id: string;
  job_title: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  department: string;
  position: string;
  base_salary: number;
  currency?: string;
  employment_type: 'full_time' | 'part_time' | 'contract';
  start_date: string;
  expiration_date: string;
  terms_notes?: string;
}

export interface UpdateOfferStatusInput {
  id: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  notes?: string;
}

export interface ConvertCandidateInput {
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  job_id: string;
  job_title: string;
  department?: string;
  role?: string;
  start_date?: string;
  salary?: number;
  currency?: string;
  company_id?: string;
  branch_id?: string;
}

export interface ConvertCandidateResult {
  success: boolean;
  user_id: string;
  onboarding_instance_id?: string;
  employee_id?: string;
  message: string;
}

export interface FunnelStage {
  stage: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
}

export interface RecruitmentFunnelData {
  totalApplications: number;
  stages: FunnelStage[];
  overallConversionRate: number;
}

export interface DepartmentVelocity {
  department: string;
  avgDaysToHire: number;
  openRoles: number;
  hiresCount: number;
}

export interface MonthlyTrend {
  month: string;
  applications: number;
  interviews: number;
  offers: number;
  hires: number;
}

export interface RecruitmentAnalyticsData {
  timeToHireDays: number;
  costPerHire: number;
  openPositions: number;
  filledPositions: number;
  offerAcceptanceRate: number;
  departmentVelocity: DepartmentVelocity[];
  monthlyTrends: MonthlyTrend[];
}

// ─────────────────────────────────────────────────────────────────────────────
// API access — the backend (/recruitment/*) is the single source of truth.
// There is deliberately NO localStorage/seed fallback: failures surface as errors
// so the UI never shows invented candidates, offers or KPIs.
// ─────────────────────────────────────────────────────────────────────────────

async function recruitmentRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/recruitment${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err?.message) ? err.message.join(', ') : err?.message;
    throw new Error(msg || `Recruitment request failed (HTTP ${res.status})`);
  }
  const json = await res.json().catch(() => null);
  return (json && json.data !== undefined ? json.data : json) as T;
}

/** Removes undefined/null/'' values so the backend's strict DTO validation accepts the body. */
function compact<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out as Partial<T>;
}

function toDateOnly(v?: string | null): string {
  return v ? String(v).slice(0, 10) : '';
}

// ── Backend row → UI model mappers ───────────────────────────────────────────

function toInterview(r: any): Interview {
  return {
    id: String(r.id),
    job_id: String(r.job_id ?? ''),
    job_title: r.job_title ?? '',
    candidate_id: String(r.candidate_id ?? ''),
    candidate_name: r.candidate_name ?? '',
    candidate_email: r.candidate_email ?? '',
    interviewer_id: r.interviewer_id ?? undefined,
    interviewer_name: r.interviewer_name ?? '',
    interview_type: (r.interview_type ?? 'technical') as Interview['interview_type'],
    scheduled_at: r.scheduled_at,
    duration_minutes: Number(r.duration_minutes ?? 45),
    meeting_link: r.meeting_link ?? undefined,
    status: (r.status ?? 'scheduled') as Interview['status'],
    rating: r.rating != null ? Number(r.rating) : undefined,
    feedback: r.feedback ?? undefined,
    created_at: r.created_at,
  };
}

function toOffer(r: any): JobOffer {
  return {
    id: String(r.id),
    job_id: String(r.job_id ?? ''),
    job_title: r.job_title ?? r.position_title ?? '',
    candidate_id: String(r.candidate_id ?? ''),
    candidate_name: r.candidate_name ?? '',
    candidate_email: r.candidate_email ?? '',
    department: r.department ?? '',
    position: r.position_title ?? '',
    base_salary: Number(r.offered_salary ?? 0),
    currency: r.currency ?? 'USD',
    employment_type: (r.employment_type ?? 'full_time') as JobOffer['employment_type'],
    start_date: toDateOnly(r.start_date),
    expiration_date: toDateOnly(r.expiry_date),
    status: (r.status ?? 'draft') as JobOffer['status'],
    terms_notes: r.letter_content ?? undefined,
    created_at: r.created_at,
    responded_at: r.signed_at ?? undefined,
  };
}

/**
 * useInterviews hook
 * Fetches scheduled interviews, optionally filtered by jobId
 */
export function useInterviews(jobId?: string) {
  const { activeCompanyId, activeBranchId } = useAuth();

  return useQuery<Interview[]>({
    queryKey: ['recruitment-interviews', activeCompanyId, activeBranchId, jobId],
    queryFn: async () => {
      const queryParam = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
      const rows = await recruitmentRequest<any[]>(`/interviews${queryParam}`, { method: 'GET' });
      return (rows || []).map(toInterview);
    },
  });
}

/**
 * useCreateInterview hook
 * Schedules a new candidate interview
 */
export function useCreateInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInterviewInput) => {
      const body = compact({
        job_id: data.job_id,
        candidate_id: data.candidate_id,
        candidate_name: data.candidate_name,
        candidate_email: data.candidate_email,
        interviewer_name: data.interviewer_name,
        interview_type: data.interview_type,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes || 45,
        // The backend stores one meeting field: use the link, or the physical location
        meeting_link: data.meeting_link || data.location,
      });
      const row = await recruitmentRequest<any>('/interviews', { method: 'POST', body: JSON.stringify(body) });
      return toInterview(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-funnel'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-analytics'] });
    },
  });
}

/**
 * useUpdateInterview hook
 * Updates status, rating, feedback, or scheduled time for an interview
 */
export function useUpdateInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateInterviewInput) => {
      const feedback =
        data.feedback !== undefined || data.notes !== undefined
          ? [data.feedback, data.notes].filter(Boolean).join('\n\n')
          : undefined;
      const body = compact({
        status: data.status,
        rating: data.rating,
        feedback,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
      });
      const row = await recruitmentRequest<any>(`/interviews/${encodeURIComponent(data.id)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return toInterview(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-interviews'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-analytics'] });
    },
  });
}

/**
 * useOffers hook
 * Fetches generated offer letters, optionally filtered by jobId
 */
export function useOffers(jobId?: string) {
  const { activeCompanyId, activeBranchId } = useAuth();

  return useQuery<JobOffer[]>({
    queryKey: ['recruitment-offers', activeCompanyId, activeBranchId, jobId],
    queryFn: async () => {
      const queryParam = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
      const rows = await recruitmentRequest<any[]>(`/offers${queryParam}`, { method: 'GET' });
      return (rows || []).map(toOffer);
    },
  });
}

/**
 * useCreateOffer hook
 * Generates a new offer letter for a candidate
 */
export function useCreateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOfferInput) => {
      const employment = data.employment_type ? `Employment type: ${data.employment_type.replace('_', ' ')}` : '';
      const body = compact({
        job_id: data.job_id,
        candidate_id: data.candidate_id,
        candidate_name: data.candidate_name,
        candidate_email: data.candidate_email,
        position_title: data.position || data.job_title,
        department: data.department,
        offered_salary: Number(data.base_salary),
        currency: data.currency,
        start_date: data.start_date,
        expiry_date: data.expiration_date,
        letter_content: [data.terms_notes, employment].filter(Boolean).join('\n\n'),
        status: 'draft',
      });
      const row = await recruitmentRequest<any>('/offers', { method: 'POST', body: JSON.stringify(body) });
      return toOffer(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-offers'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-funnel'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-analytics'] });
    },
  });
}

/**
 * useUpdateOfferStatus hook
 * Transitions an offer between draft → sent → accepted/rejected
 */
export function useUpdateOfferStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateOfferStatusInput) => {
      const body = compact({
        status: data.status,
        signed_at: data.status === 'accepted' ? new Date().toISOString() : undefined,
      });
      const row = await recruitmentRequest<any>(`/offers/${encodeURIComponent(data.id)}/status`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return toOffer(row);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-offers'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-funnel'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-analytics'] });
    },
  });
}

/**
 * useConvertToEmployee hook
 * 1-Click candidate-to-employee conversion: provisions the user profile, marks the
 * candidate hired and starts an onboarding checklist (all server-side).
 */
export function useConvertToEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ConvertCandidateInput): Promise<ConvertCandidateResult> => {
      const parts = (data.candidate_name || '').trim().split(/\s+/);
      const first_name = parts.shift() || data.candidate_name || '';
      const last_name = parts.join(' ') || '-';
      const body = compact({
        job_id: data.job_id,
        first_name,
        last_name,
        email: data.candidate_email,
        department: data.department,
        position_title: data.role || data.job_title,
        start_date: data.start_date,
        salary: data.salary != null ? Number(data.salary) : undefined,
        company_id: data.company_id,
        branch_id: data.branch_id,
      });
      const res = await recruitmentRequest<any>(
        `/candidates/${encodeURIComponent(data.candidate_id)}/convert-to-employee`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      return {
        success: !!res?.success,
        user_id: String(res?.employee?.id ?? ''),
        onboarding_instance_id: res?.onboarding?.id ? String(res.onboarding.id) : undefined,
        employee_id: res?.employee?.employee_id ?? (res?.employee?.id ? String(res.employee.id) : undefined),
        message: res?.message ?? 'Candidate converted to employee',
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitment-offers'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-funnel'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-instances'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

interface BackendFunnel {
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  hired: number;
  rejected?: number;
  conversion_rates?: {
    applicant_to_interview_rate?: number;
    interview_to_offer_rate?: number;
    offer_to_hired_rate?: number;
    overall_conversion_rate?: number;
  };
}

/**
 * useRecruitmentFunnel hook
 * Hiring funnel Applied -> Screening -> Interview -> Offer -> Hired (server-computed counts)
 */
export function useRecruitmentFunnel() {
  const { activeCompanyId, activeBranchId } = useAuth();

  return useQuery<RecruitmentFunnelData>({
    queryKey: ['recruitment-funnel', activeCompanyId, activeBranchId],
    queryFn: async () => {
      const f = await recruitmentRequest<BackendFunnel>('/reports/funnel', { method: 'GET' });
      const counts: [string, number][] = [
        ['Applied', Number(f?.applied ?? 0)],
        ['Screening', Number(f?.screening ?? 0)],
        ['Interview', Number(f?.interview ?? 0)],
        ['Offer', Number(f?.offer ?? 0)],
        ['Hired', Number(f?.hired ?? 0)],
      ];
      const stages: FunnelStage[] = counts.map(([stage, count], i) => {
        if (i === 0) return { stage, count, conversionRate: count > 0 ? 100 : 0, dropoffRate: 0 };
        const prev = counts[i - 1][1];
        return {
          stage,
          count,
          conversionRate: pct(count, prev),
          dropoffRate: prev > 0 ? Math.max(0, 100 - pct(count, prev)) : 0,
        };
      });
      return {
        totalApplications: counts[0][1],
        stages,
        overallConversionRate:
          f?.conversion_rates?.overall_conversion_rate != null
            ? Math.round(Number(f.conversion_rates.overall_conversion_rate))
            : pct(counts[4][1], counts[0][1]),
      };
    },
  });
}

interface BackendAnalytics {
  time_to_hire_days: number;
  open_positions_count: number;
  filled_positions_count: number;
  cost_per_hire_avg: number;
  department_breakdown: { department: string; open: number; filled: number; total_candidates?: number }[];
}

/**
 * useRecruitmentAnalytics hook
 * Time-to-hire, cost-per-hire, open vs filled positions and per-department figures (server-computed)
 */
export function useRecruitmentAnalytics() {
  const { activeCompanyId, activeBranchId } = useAuth();

  return useQuery<RecruitmentAnalyticsData>({
    queryKey: ['recruitment-analytics', activeCompanyId, activeBranchId],
    queryFn: async () => {
      const [a, f] = await Promise.all([
        recruitmentRequest<BackendAnalytics>('/reports/analytics', { method: 'GET' }),
        recruitmentRequest<BackendFunnel>('/reports/funnel', { method: 'GET' }),
      ]);
      const timeToHire = Number(a?.time_to_hire_days ?? 0);
      return {
        timeToHireDays: timeToHire,
        costPerHire: Number(a?.cost_per_hire_avg ?? 0),
        openPositions: Number(a?.open_positions_count ?? 0),
        filledPositions: Number(a?.filled_positions_count ?? 0),
        offerAcceptanceRate: Math.round(Number(f?.conversion_rates?.offer_to_hired_rate ?? 0)),
        departmentVelocity: (a?.department_breakdown || []).map((d) => ({
          department: d.department,
          // Per-department time-to-hire is not tracked yet; the tenant-wide average is shown
          avgDaysToHire: timeToHire,
          openRoles: Number(d.open ?? 0),
          hiresCount: Number(d.filled ?? 0),
        })),
        // Monthly trend series is not provided by the API yet — empty rather than invented
        monthlyTrends: [],
      };
    },
  });
}

/**
 * Unified hook convenience export
 */
export function useRecruitmentPipeline(jobId?: string) {
  const interviewsQuery = useInterviews(jobId);
  const createInterviewMutation = useCreateInterview();
  const updateInterviewMutation = useUpdateInterview();
  const offersQuery = useOffers(jobId);
  const createOfferMutation = useCreateOffer();
  const updateOfferStatusMutation = useUpdateOfferStatus();
  const convertToEmployeeMutation = useConvertToEmployee();
  const funnelQuery = useRecruitmentFunnel();
  const analyticsQuery = useRecruitmentAnalytics();

  return {
    interviewsQuery,
    createInterviewMutation,
    updateInterviewMutation,
    offersQuery,
    createOfferMutation,
    updateOfferStatusMutation,
    convertToEmployeeMutation,
    funnelQuery,
    analyticsQuery,
  };
}
