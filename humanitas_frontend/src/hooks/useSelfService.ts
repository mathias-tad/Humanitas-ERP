import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';

export interface LeaveBalance {
  leave_type: string;
  allocated_days: number;
  used_days: number;
  remaining_days: number;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  streak: number;
}

export interface PayslipItem {
  id: string;
  month: number;
  year: number;
  gross_pay: string | number;
  net_pay: string | number;
  total_deductions: string | number;
  status: string;
}

export interface SelfServiceDashboard {
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    position?: string;
    department?: string;
    hire_date?: string;
  };
  leave_balances: LeaveBalance[];
  pending_requests: {
    leave: number;
    profile_changes: number;
  };
  attendance_summary: AttendanceSummary;
  latest_payslip?: PayslipItem | null;
}

export interface AttendanceHeatmapEntry {
  date: string;
  status: string;
  actual_in?: string;
  actual_out?: string;
}

export interface PayslipsResponse {
  payslips: PayslipItem[];
  ytd_summary: {
    year: number;
    ytd_gross: number;
    ytd_net: number;
    ytd_deductions: number;
  };
}

export interface SensitiveChangeRequest {
  id: string;
  user_id: string;
  field_name: string;
  current_value?: string;
  proposed_value: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  department?: string;
}

export interface EmployeeProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
  national_id?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  hire_date?: string;
  position?: string;
  department?: string;
  tin?: string;
  account_number?: string;
  bank_name?: string;
}

export interface SelfServiceProfileResponse {
  profile: EmployeeProfile;
  pending_change_requests: SensitiveChangeRequest[];
}

export interface SelfServiceAnalytics {
  punctuality_score: number;
  pay_trend: Array<{
    month: number;
    year: number;
    net_pay: string | number;
    gross_pay: string | number;
  }>;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }
  const data = await res.json();
  return data.data !== undefined ? data.data : data;
}

export function useSelfService() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || '';

  const useDashboard = () =>
    useQuery<SelfServiceDashboard>({
      queryKey: ['self-service', 'dashboard', userId],
      queryFn: () => fetcher<SelfServiceDashboard>(`${API_BASE_URL}/self-service/dashboard`),
      enabled: !!userId,
    });

  const useAttendanceHeatmap = (days = 90) =>
    useQuery<AttendanceHeatmapEntry[]>({
      queryKey: ['self-service', 'attendance-heatmap', userId, days],
      queryFn: () =>
        fetcher<AttendanceHeatmapEntry[]>(
          `${API_BASE_URL}/self-service/attendance-heatmap?days=${days}`,
        ),
      enabled: !!userId,
    });

  const usePayslips = () =>
    useQuery<PayslipsResponse>({
      queryKey: ['self-service', 'payslips', userId],
      queryFn: () => fetcher<PayslipsResponse>(`${API_BASE_URL}/self-service/payslips`),
      enabled: !!userId,
    });

  const useProfile = () =>
    useQuery<SelfServiceProfileResponse>({
      queryKey: ['self-service', 'profile', userId],
      queryFn: () =>
        fetcher<SelfServiceProfileResponse>(`${API_BASE_URL}/self-service/profile`),
      enabled: !!userId,
    });

  const useChangeRequests = (status = 'pending') =>
    useQuery<SensitiveChangeRequest[]>({
      queryKey: ['self-service', 'change-requests', status],
      queryFn: () =>
        fetcher<SensitiveChangeRequest[]>(
          `${API_BASE_URL}/self-service/change-requests?status=${status}`,
        ),
    });

  const useAnalytics = () =>
    useQuery<SelfServiceAnalytics>({
      queryKey: ['self-service', 'analytics', userId],
      queryFn: () =>
        fetcher<SelfServiceAnalytics>(`${API_BASE_URL}/self-service/analytics`),
      enabled: !!userId,
    });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: Partial<EmployeeProfile>) => {
      const res = await fetch(`${API_BASE_URL}/self-service/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update profile');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-service', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['self-service', 'dashboard'] });
    },
  });

  const requestSensitiveChangeMutation = useMutation({
    mutationFn: async (payload: {
      field_name: 'account_number' | 'bank_name' | 'tin' | 'national_id';
      proposed_value: string;
      reason?: string;
    }) => {
      const res = await fetch(`${API_BASE_URL}/self-service/change-request`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to submit change request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-service', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['self-service', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['self-service', 'change-requests'] });
    },
  });

  const reviewChangeRequestMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      reviewer_notes,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      reviewer_notes?: string;
    }) => {
      const res = await fetch(
        `${API_BASE_URL}/self-service/change-requests/${id}/review`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ status, reviewer_notes }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to review request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-service', 'change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['self-service', 'profile'] });
    },
  });

  return {
    useDashboard,
    useAttendanceHeatmap,
    usePayslips,
    useProfile,
    useChangeRequests,
    useAnalytics,
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    requestSensitiveChange: requestSensitiveChangeMutation.mutateAsync,
    isRequestingSensitiveChange: requestSensitiveChangeMutation.isPending,
    reviewChangeRequest: reviewChangeRequestMutation.mutateAsync,
    isReviewingChangeRequest: reviewChangeRequestMutation.isPending,
  };
}
