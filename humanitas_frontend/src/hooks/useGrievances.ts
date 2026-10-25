import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api.config';

export interface GrievanceAttachment {
  id: string;
  grievance_id: string;
  uploaded_by?: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

export interface GrievanceTimeline {
  id: string;
  grievance_id: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  notes?: string;
  is_confidential: boolean;
  created_at: string;
}

export interface Grievance {
  id: string;
  ticket_number: string;
  user_id?: string;
  is_anonymous: boolean;
  category: 'harassment' | 'discrimination' | 'safety' | 'policy_violation' | 'workplace_conflict' | 'compensation_dispute' | 'other';
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'filed' | 'acknowledged' | 'investigating' | 'resolution_proposed' | 'closed';
  incident_date?: string;
  incident_location?: string;
  accused_parties?: string;
  witnesses?: string;
  assigned_investigator_id?: string;
  investigator_name?: string;
  investigation_notes?: string;
  resolution_summary?: string;
  resolution_action_items?: string;
  resolution_date?: string;
  acknowledged_at?: string;
  sla_acknowledgment_deadline?: string;
  sla_resolution_deadline?: string;
  is_sla_breached?: boolean;
  retaliation_monitoring_flag?: boolean;
  satisfaction_score?: number;
  satisfaction_feedback?: string;
  submitter_name?: string;
  submitter_email?: string;
  submitter_department?: string;
  attachments_count?: number;
  company_id?: string;
  branch_id?: string;
  created_at: string;
  updated_at: string;
  timeline?: GrievanceTimeline[];
  attachments?: GrievanceAttachment[];
}

export interface GrievanceStats {
  total_cases: number;
  open_cases: number;
  closed_cases: number;
  sla_breached_cases: number;
  retaliation_monitoring_count: number;
  avg_resolution_days: number;
  sla_compliance_rate: number;
  by_category: { category: string; count: string }[];
  by_status: { status: string; count: string }[];
}

export interface FileGrievanceInput {
  category: string;
  subject: string;
  description: string;
  priority?: string;
  is_anonymous?: boolean;
  incident_date?: string;
  incident_location?: string;
  accused_parties?: string;
  witnesses?: string;
  attachments?: {
    file_name: string;
    file_url: string;
    file_size?: number;
    file_type?: string;
  }[];
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

export function useGrievances(filters?: { status?: string; category?: string }) {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.category) queryParams.set('category', filters.category);
  const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return useQuery<Grievance[]>({
    queryKey: ['grievances', filters],
    queryFn: () => fetcher<Grievance[]>(`${API_BASE_URL}/hrms/grievances${qs}`),
  });
}

export function useGrievance(id: string | null) {
  return useQuery<Grievance>({
    queryKey: ['grievance', id],
    queryFn: () => fetcher<Grievance>(`${API_BASE_URL}/hrms/grievances/${id}`),
    enabled: !!id,
  });
}

export function useGrievanceStats() {
  return useQuery<GrievanceStats>({
    queryKey: ['grievances', 'stats'],
    queryFn: () => fetcher<GrievanceStats>(`${API_BASE_URL}/hrms/grievances/reports/stats`),
  });
}

export function useFileGrievance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FileGrievanceInput) =>
      fetcher<Grievance>(`${API_BASE_URL}/hrms/grievances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
    },
  });
}

export function useUpdateGrievanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      fetcher<Grievance>(`${API_BASE_URL}/hrms/grievances/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
      qc.invalidateQueries({ queryKey: ['grievance', vars.id] });
    },
  });
}

export function useAssignInvestigator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, investigator_id, notes }: { id: string; investigator_id: string; notes?: string }) =>
      fetcher<Grievance>(`${API_BASE_URL}/hrms/grievances/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investigator_id, notes }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
      qc.invalidateQueries({ queryKey: ['grievance', vars.id] });
    },
  });
}

export function useProposeResolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      resolution_summary,
      action_items,
      retaliation_monitoring_flag,
    }: {
      id: string;
      resolution_summary: string;
      action_items?: string;
      retaliation_monitoring_flag?: boolean;
    }) =>
      fetcher<Grievance>(`${API_BASE_URL}/hrms/grievances/${id}/resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution_summary,
          action_items,
          retaliation_monitoring_flag,
        }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
      qc.invalidateQueries({ queryKey: ['grievance', vars.id] });
    },
  });
}

export function useSubmitGrievanceFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      satisfaction_score,
      satisfaction_feedback,
    }: {
      id: string;
      satisfaction_score: number;
      satisfaction_feedback?: string;
    }) =>
      fetcher<Grievance>(`${API_BASE_URL}/hrms/grievances/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satisfaction_score, satisfaction_feedback }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['grievances'] });
      qc.invalidateQueries({ queryKey: ['grievance', vars.id] });
    },
  });
}

export function useAddGrievanceNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      notes,
      is_confidential,
    }: {
      id: string;
      notes: string;
      is_confidential?: boolean;
    }) =>
      fetcher<GrievanceTimeline>(`${API_BASE_URL}/hrms/grievances/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, is_confidential }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['grievance', vars.id] });
    },
  });
}
