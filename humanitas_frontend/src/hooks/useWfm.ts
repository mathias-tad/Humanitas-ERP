import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import { getAuthHeaders } from "@/context/AuthContext";

export interface WfmSettings {
  id: string;
  company_id?: string;
  branch_id?: string;
  vet_enabled: boolean;
  vto_enabled: boolean;
  vet_claim_strategy: 'fcfs' | 'seniority' | 'fairness';
  vto_claim_strategy: 'fcfs' | 'seniority' | 'fairness';
  vet_auto_approval: boolean;
  vto_auto_approval: boolean;
  max_weekly_ot_hours: number;
  min_rest_hours_between_shifts: number;
  vto_allow_pto_funding: boolean;
  vet_cancellation_cutoff_hours: number;
  vto_cancellation_cutoff_hours: number;
  notify_via_push: boolean;
  notify_via_email: boolean;
  notify_via_in_app: boolean;
  default_vto_compensation?: 'unpaid' | 'paid';
  payroll_ot_rates?: {
    normal: number | null;
    night: number | null;
    dayoff: number | null;
    holiday: number | null;
  };
}

export interface WfmOpportunity {
  id: string;
  company_id?: string;
  branch_id?: string;
  department_id?: string;
  type: 'VET' | 'VTO';
  title: string;
  date: string;
  shift_id?: string;
  shift_name?: string;
  shift_color?: string;
  start_time?: string;
  end_time?: string;
  hours: number;
  slots_available: number;
  slots_claimed: number;
  slots_remaining: number;
  ot_rate_multiplier: number;
  ot_category: 'normal' | 'night' | 'dayoff' | 'holiday';
  vto_compensation_type?: 'unpaid' | 'paid';
  urgency: 'normal' | 'high' | 'critical';
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  reason?: string;
  notes?: string;
  expires_at?: string;
  has_claimed?: boolean;
  my_claim_id?: string;
  my_claim_status?: string;
  my_use_pto?: boolean;
}

export interface WfmClaim {
  id: string;
  opportunity_id: string;
  user_id: string;
  claim_type: 'VET' | 'VTO';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  claimed_at: string;
  use_pto_balance: boolean;
  is_paid?: boolean;
  vto_compensation_type?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  opportunity_title?: string;
  opportunity_type?: string;
  opportunity_date?: string;
  start_time?: string;
  end_time?: string;
  hours?: number;
  ot_rate_multiplier?: number;
  ot_category?: string;
  full_name?: string;
  email?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  month_ot_hours?: number;
}

export interface WfmStats {
  open_vet_slots: number;
  open_vto_slots: number;
  total_vet_claimed: number;
  total_vto_claimed: number;
  pending_reviews: number;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...getAuthHeaders(),
    },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || 'Network response was not ok');
  }
  return res.json();
}

export function useWfmSettings() {
  const companyId = localStorage.getItem('active_company_id') || '';
  const branchId = localStorage.getItem('active_branch_id') || '';

  return useQuery<WfmSettings>({
    queryKey: ['wfm-settings', companyId, branchId],
    queryFn: () => fetcher<WfmSettings>(`${API_BASE_URL}/wfm/settings`),
  });
}

export function useUpdateWfmSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: Partial<WfmSettings>) => {
      const res = await fetch(`${API_BASE_URL}/wfm/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update WFM settings');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wfm-settings'] });
    },
  });
}

export function useWfmOpportunities(filters: {
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
}) {
  const companyId = localStorage.getItem('active_company_id') || '';
  const branchId = localStorage.getItem('active_branch_id') || '';

  const params = new URLSearchParams();
  if (filters.type && filters.type !== 'all') params.append('type', filters.type);
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.departmentId) params.append('departmentId', filters.departmentId);

  return useQuery<WfmOpportunity[]>({
    queryKey: ['wfm-opportunities', companyId, branchId, filters],
    queryFn: () => fetcher<WfmOpportunity[]>(`${API_BASE_URL}/wfm/opportunities?${params.toString()}`),
  });
}

export function useMyWfmClaims() {
  const companyId = localStorage.getItem('active_company_id') || '';
  const branchId = localStorage.getItem('active_branch_id') || '';

  return useQuery<WfmClaim[]>({
    queryKey: ['wfm-my-claims', companyId, branchId],
    queryFn: () => fetcher<WfmClaim[]>(`${API_BASE_URL}/wfm/my-claims`),
  });
}

export function useWfmClaimsQueue(filters: { status?: string; departmentId?: string }) {
  const companyId = localStorage.getItem('active_company_id') || '';
  const branchId = localStorage.getItem('active_branch_id') || '';

  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.departmentId) params.append('departmentId', filters.departmentId);

  return useQuery<WfmClaim[]>({
    queryKey: ['wfm-claims-queue', companyId, branchId, filters],
    queryFn: () => fetcher<WfmClaim[]>(`${API_BASE_URL}/wfm/claims?${params.toString()}`),
  });
}

export function useWfmStats() {
  const companyId = localStorage.getItem('active_company_id') || '';
  const branchId = localStorage.getItem('active_branch_id') || '';

  return useQuery<WfmStats>({
    queryKey: ['wfm-stats', companyId, branchId],
    queryFn: () => fetcher<WfmStats>(`${API_BASE_URL}/wfm/stats`),
  });
}

export function useBroadcastOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: any) => {
      const res = await fetch(`${API_BASE_URL}/wfm/opportunities`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to broadcast opportunity');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wfm-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['wfm-stats'] });
    },
  });
}

export function useClaimOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, use_pto_balance, hours }: { id: string; use_pto_balance?: boolean; hours?: number }) => {
      const res = await fetch(`${API_BASE_URL}/wfm/opportunities/${id}/claim`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ use_pto_balance, hours }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to claim opportunity');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wfm-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['wfm-my-claims'] });
      queryClient.invalidateQueries({ queryKey: ['wfm-stats'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
    },
  });
}

export function useCancelClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (claimId: string) => {
      const res = await fetch(`${API_BASE_URL}/wfm/claims/${claimId}/cancel`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to cancel claim');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wfm-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['wfm-my-claims'] });
      queryClient.invalidateQueries({ queryKey: ['wfm-stats'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useReviewClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ claimId, status, review_notes }: { claimId: string; status: 'approved' | 'rejected'; review_notes?: string }) => {
      const res = await fetch(`${API_BASE_URL}/wfm/claims/${claimId}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status, review_notes }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to review claim');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wfm-claims-queue'] });
      queryClient.invalidateQueries({ queryKey: ['wfm-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['wfm-stats'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['overtime'] });
    },
  });
}
