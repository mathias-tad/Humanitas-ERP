import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api.config';

export interface BenefitPlan {
  id: string;
  name: string;
  code: string;
  plan_type: 'medical' | 'dental' | 'vision' | 'life_insurance' | 'pension' | 'housing_allowance' | 'transport_allowance' | 'education_assistance' | 'wellness';
  tier: 'basic' | 'standard' | 'premium' | 'executive';
  provider_name?: string;
  policy_number?: string;
  description?: string;
  total_cost: number;
  employer_contribution: number;
  employee_contribution: number;
  employer_percentage?: number;
  employee_percentage?: number;
  contribution_frequency: string;
  is_family_covered: boolean;
  max_dependents: number;
  min_tenure_months: number;
  eligible_employment_types?: string[];
  eligible_departments?: string[];
  is_active: boolean;
  active_enrollments_count?: number;
  created_at: string;
  updated_at: string;
}

export interface BenefitDependent {
  id: string;
  enrollment_id: string;
  full_name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'other';
  date_of_birth?: string;
  national_id?: string;
  gender?: string;
  is_covered: boolean;
  created_at: string;
}

export interface BenefitEnrollment {
  id: string;
  plan_id: string;
  user_id: string;
  plan_name: string;
  plan_code: string;
  plan_type: string;
  plan_tier: string;
  provider_name?: string;
  is_family_covered?: boolean;
  max_dependents?: number;
  coverage_tier: 'individual' | 'individual_plus_spouse' | 'individual_plus_children' | 'family';
  status: 'enrolled' | 'pending' | 'waived' | 'terminated';
  enrollment_type: 'open_enrollment' | 'new_hire' | 'qualifying_life_event' | 'administrative';
  qualifying_life_event?: string;
  life_event_date?: string;
  effective_start_date: string;
  effective_end_date?: string;
  employee_deduction_amount: number;
  employer_cost_amount: number;
  notes?: string;
  employee_name?: string;
  employee_email?: string;
  employee_department?: string;
  covered_dependents_count?: number;
  created_at: string;
  updated_at: string;
  dependents?: BenefitDependent[];
}

export interface OpenEnrollmentPeriod {
  id: string;
  title: string;
  plan_year: number;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'closed';
  created_at: string;
}

export interface BenefitStats {
  total_enrolled_employees: number;
  total_active_plans: number;
  total_monthly_employer_cost: number;
  total_monthly_employee_deductions: number;
  total_covered_dependents: number;
  enrollment_rate: number;
  by_plan_type: { plan_type: string; enrollment_count: string; total_employer_cost: string }[];
}

export interface CreatePlanInput {
  name: string;
  code: string;
  plan_type: string;
  tier?: string;
  provider_name?: string;
  policy_number?: string;
  description?: string;
  total_cost: number;
  employer_contribution: number;
  employee_contribution: number;
  contribution_frequency?: string;
  is_family_covered?: boolean;
  max_dependents?: number;
  min_tenure_months?: number;
}

export interface EnrollEmployeeInput {
  plan_id: string;
  user_id: string;
  coverage_tier?: string;
  enrollment_type?: string;
  qualifying_life_event?: string;
  life_event_date?: string;
  effective_start_date: string;
  effective_end_date?: string;
  custom_employee_deduction?: number;
  custom_employer_cost?: number;
  notes?: string;
}

export interface AddDependentInput {
  full_name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'other';
  date_of_birth?: string;
  national_id?: string;
  gender?: string;
}

async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = {
    ...getAuthHeaders(),
    ...(init?.headers || {}),
  };
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `Request failed with status ${res.status}`);
  }
  const data = await res.json();
  return data.data !== undefined ? data.data : data;
}

export function useBenefitPlans(planType?: string) {
  const qs = planType && planType !== 'all' ? `?type=${encodeURIComponent(planType)}` : '';
  return useQuery<BenefitPlan[]>({
    queryKey: ['benefits', 'plans', planType],
    queryFn: () => fetcher<BenefitPlan[]>(`${API_BASE_URL}/hrms/benefits/plans${qs}`),
  });
}

export function useBenefitPlan(id: string | null) {
  return useQuery<BenefitPlan>({
    queryKey: ['benefits', 'plan', id],
    queryFn: () => fetcher<BenefitPlan>(`${API_BASE_URL}/hrms/benefits/plans/${id}`),
    enabled: !!id,
  });
}

export function useBenefitEnrollments(filters?: { user_id?: string; plan_id?: string; status?: string }) {
  const queryParams = new URLSearchParams();
  if (filters?.user_id) queryParams.set('user_id', filters.user_id);
  if (filters?.plan_id) queryParams.set('plan_id', filters.plan_id);
  if (filters?.status && filters.status !== 'all') queryParams.set('status', filters.status);
  const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return useQuery<BenefitEnrollment[]>({
    queryKey: ['benefits', 'enrollments', filters],
    queryFn: () => fetcher<BenefitEnrollment[]>(`${API_BASE_URL}/hrms/benefits/enrollments${qs}`),
  });
}

export function useBenefitEnrollment(id: string | null) {
  return useQuery<BenefitEnrollment>({
    queryKey: ['benefits', 'enrollment', id],
    queryFn: () => fetcher<BenefitEnrollment>(`${API_BASE_URL}/hrms/benefits/enrollments/${id}`),
    enabled: !!id,
  });
}

export function useOpenEnrollmentPeriods() {
  return useQuery<OpenEnrollmentPeriod[]>({
    queryKey: ['benefits', 'open-periods'],
    queryFn: () => fetcher<OpenEnrollmentPeriod[]>(`${API_BASE_URL}/hrms/benefits/open-periods`),
  });
}

export function useBenefitStats() {
  return useQuery<BenefitStats>({
    queryKey: ['benefits', 'stats'],
    queryFn: () => fetcher<BenefitStats>(`${API_BASE_URL}/hrms/benefits/reports/stats`),
  });
}

export function useCreateBenefitPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanInput) =>
      fetcher<BenefitPlan>(`${API_BASE_URL}/hrms/benefits/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benefits', 'plans'] });
      qc.invalidateQueries({ queryKey: ['benefits', 'stats'] });
    },
  });
}

export function useUpdateBenefitPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePlanInput> & { is_active?: boolean } }) =>
      fetcher<BenefitPlan>(`${API_BASE_URL}/hrms/benefits/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['benefits', 'plans'] });
      qc.invalidateQueries({ queryKey: ['benefits', 'plan', vars.id] });
    },
  });
}

export function useEnrollEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnrollEmployeeInput) =>
      fetcher<BenefitEnrollment>(`${API_BASE_URL}/hrms/benefits/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benefits', 'enrollments'] });
      qc.invalidateQueries({ queryKey: ['benefits', 'stats'] });
      qc.invalidateQueries({ queryKey: ['benefits', 'plans'] });
    },
  });
}

export function useAddDependent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ enrollmentId, dependent }: { enrollmentId: string; dependent: AddDependentInput }) =>
      fetcher<BenefitDependent>(`${API_BASE_URL}/hrms/benefits/enrollments/${enrollmentId}/dependents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dependent),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['benefits', 'enrollment', vars.enrollmentId] });
      qc.invalidateQueries({ queryKey: ['benefits', 'enrollments'] });
      qc.invalidateQueries({ queryKey: ['benefits', 'stats'] });
    },
  });
}

export function useRemoveDependent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dependentId: string) =>
      fetcher<{ success: boolean }>(`${API_BASE_URL}/hrms/benefits/dependents/${dependentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benefits', 'enrollments'] });
      qc.invalidateQueries({ queryKey: ['benefits', 'stats'] });
    },
  });
}

export function useCreateOpenEnrollmentPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; plan_year: number; start_date: string; end_date: string }) =>
      fetcher<OpenEnrollmentPeriod>(`${API_BASE_URL}/hrms/benefits/open-periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benefits', 'open-periods'] });
    },
  });
}
