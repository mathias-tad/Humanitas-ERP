import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { useAuth, getAuthHeaders } from '@/context/AuthContext';

export interface OnboardingTemplateItem {
  id: string;
  template_id: string;
  title: string;
  description?: string;
  category: 'it' | 'hr' | 'manager' | 'facilities' | 'finance' | 'general';
  assignee_role?: string;
  due_days_from_start: number;
  is_required: boolean;
  sort_order: number;
  created_at?: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'onboarding' | 'offboarding';
  department?: string;
  employment_type?: string;
  is_default: boolean;
  item_count?: number;
  items?: OnboardingTemplateItem[];
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  id: string;
  onboarding_id: string;
  template_item_id?: string;
  title: string;
  description?: string;
  category: 'it' | 'hr' | 'manager' | 'facilities' | 'finance' | 'general';
  assignee_role?: string;
  due_date?: string;
  is_required: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completed_by?: string;
  completed_at?: string;
  notes?: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface OnboardingInstance {
  id: string;
  user_id: string;
  template_id?: string;
  template_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  department?: string;
  position?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  start_date?: string;
  target_completion_date?: string;
  completed_date?: string;
  probation_days: number;
  probation_end_date?: string;
  probation_outcome?: 'confirmed' | 'extended' | 'terminated';
  probation_outcome_notes?: string;
  probation_extended_until?: string;
  created_by?: string;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  tasks?: OnboardingTask[];
  created_at: string;
  updated_at: string;
}

export interface OffboardingTask {
  id: string;
  offboarding_id: string;
  template_item_id?: string;
  title: string;
  description?: string;
  category: 'it' | 'hr' | 'manager' | 'facilities' | 'finance' | 'general';
  assignee_role?: string;
  due_date?: string;
  is_required: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completed_by?: string;
  completed_at?: string;
  notes?: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ExitInterview {
  id: string;
  offboarding_id: string;
  user_id?: string;
  satisfaction_score?: number;
  reason_for_leaving?: string;
  feedback?: string;
  is_anonymous: boolean;
  submitted_at: string;
}

export interface OffboardingInstance {
  id: string;
  user_id: string;
  template_id?: string;
  template_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  department?: string;
  position?: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'cancelled';
  last_working_day?: string;
  reason?: string;
  initiated_by?: string;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  exit_interview_count?: number;
  exit_interview?: ExitInterview;
  tasks?: OffboardingTask[];
  created_at: string;
  updated_at: string;
}

export interface OnboardingStats {
  total_onboarding: number;
  completed_onboarding: number;
  in_progress_onboarding: number;
  overdue_tasks: number;
  avg_completion_days: number;
  upcoming_probation_reviews: number;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to process request' }));
    throw new Error(err.message || 'Failed to process request');
  }
  const data = await res.json();
  return data.data !== undefined ? data.data : data;
}

export function useOnboarding() {
  const queryClient = useQueryClient();
  const { activeCompanyId, activeBranchId } = useAuth();

  const buildQueryString = (extraParams?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (activeCompanyId) params.append('company_id', activeCompanyId);
    if (activeBranchId) params.append('branch_id', activeBranchId);
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, String(val));
        }
      });
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  // Queries
  const useTemplates = (type?: string) =>
    useQuery<OnboardingTemplate[]>({
      queryKey: ['hrms-onboarding-templates', activeCompanyId, activeBranchId, type],
      queryFn: () =>
        fetcher<OnboardingTemplate[]>(
          `${API_BASE_URL}/hrms/onboarding/templates${buildQueryString(type ? { type } : undefined)}`,
        ),
    });

  const useTemplate = (id: string | null) =>
    useQuery<OnboardingTemplate>({
      queryKey: ['hrms-onboarding-template', id],
      queryFn: () => fetcher<OnboardingTemplate>(`${API_BASE_URL}/hrms/onboarding/templates/${id}`),
      enabled: !!id,
    });

  const useOnboardings = (filters?: { status?: string; user_id?: string }) =>
    useQuery<OnboardingInstance[]>({
      queryKey: ['hrms-onboarding-instances', activeCompanyId, activeBranchId, filters],
      queryFn: () =>
        fetcher<OnboardingInstance[]>(
          `${API_BASE_URL}/hrms/onboarding/instances${buildQueryString(filters)}`,
        ),
    });

  const useOnboardingInstance = (id: string | null) =>
    useQuery<OnboardingInstance>({
      queryKey: ['hrms-onboarding-instance', id],
      queryFn: () => fetcher<OnboardingInstance>(`${API_BASE_URL}/hrms/onboarding/instances/${id}`),
      enabled: !!id,
    });

  const useOffboardings = () =>
    useQuery<OffboardingInstance[]>({
      queryKey: ['hrms-offboarding-instances', activeCompanyId, activeBranchId],
      queryFn: () =>
        fetcher<OffboardingInstance[]>(`${API_BASE_URL}/hrms/offboarding/instances${buildQueryString()}`),
    });

  const useOffboardingInstance = (id: string | null) =>
    useQuery<OffboardingInstance>({
      queryKey: ['hrms-offboarding-instance', id],
      queryFn: () => fetcher<OffboardingInstance>(`${API_BASE_URL}/hrms/offboarding/instances/${id}`),
      enabled: !!id,
    });

  const useOnboardingStats = () =>
    useQuery<OnboardingStats>({
      queryKey: ['hrms-onboarding-stats', activeCompanyId, activeBranchId],
      queryFn: () => fetcher<OnboardingStats>(`${API_BASE_URL}/hrms/onboarding/stats`),
    });

  // Mutations
  const startOnboardingMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      template_id?: string;
      start_date?: string;
      probation_days?: number;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/onboarding/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to start onboarding' }));
        throw new Error(err.message || 'Failed to start onboarding');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-instances'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-stats'] });
    },
  });

  const updateOnboardingTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
      notes,
    }: {
      taskId: string;
      status: string;
      notes?: string;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/onboarding/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to update task' }));
        throw new Error(err.message || 'Failed to update task');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-instances'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-instance'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-stats'] });
    },
  });

  const recordProbationOutcomeMutation = useMutation({
    mutationFn: async (data: {
      onboarding_id: string;
      outcome: 'confirmed' | 'extended' | 'terminated';
      notes?: string;
      extended_until?: string;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/onboarding/probation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to record probation outcome' }));
        throw new Error(err.message || 'Failed to record probation outcome');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-instances'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-instance'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-stats'] });
    },
  });

  const startOffboardingMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      template_id?: string;
      last_working_day?: string;
      reason?: string;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/offboarding/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to start offboarding' }));
        throw new Error(err.message || 'Failed to start offboarding');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-offboarding-instances'] });
    },
  });

  const updateOffboardingTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
      notes,
    }: {
      taskId: string;
      status: string;
      notes?: string;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/offboarding/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to update offboarding task' }));
        throw new Error(err.message || 'Failed to update offboarding task');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-offboarding-instances'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-offboarding-instance'] });
    },
  });

  const submitExitInterviewMutation = useMutation({
    mutationFn: async (data: {
      offboarding_id: string;
      satisfaction_score?: number;
      reason_for_leaving?: string;
      feedback?: string;
      is_anonymous?: boolean;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/offboarding/exit-interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to submit exit interview' }));
        throw new Error(err.message || 'Failed to submit exit interview');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-offboarding-instances'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-offboarding-instance'] });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      type: 'onboarding' | 'offboarding';
      department?: string;
      employment_type?: string;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/onboarding/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to create template' }));
        throw new Error(err.message || 'Failed to create template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-templates'] });
    },
  });

  const createTemplateItemMutation = useMutation({
    mutationFn: async ({
      templateId,
      ...data
    }: {
      templateId: string;
      title: string;
      description?: string;
      category: string;
      assignee_role?: string;
      due_days_from_start?: number;
      is_required?: boolean;
      sort_order?: number;
    }) => {
      const res = await fetch(`${API_BASE_URL}/hrms/onboarding/templates/${templateId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ...data, template_id: templateId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to add item to template' }));
        throw new Error(err.message || 'Failed to add item to template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-templates'] });
      queryClient.invalidateQueries({ queryKey: ['hrms-onboarding-template'] });
    },
  });

  return {
    // Queries
    useTemplates,
    useTemplate,
    useOnboardings,
    useOnboardingInstance,
    useOffboardings,
    useOffboardingInstance,
    useOnboardingStats,

    // Mutations
    startOnboarding: startOnboardingMutation.mutateAsync,
    isStartingOnboarding: startOnboardingMutation.isPending,

    updateOnboardingTask: updateOnboardingTaskMutation.mutateAsync,
    isUpdatingOnboardingTask: updateOnboardingTaskMutation.isPending,

    recordProbationOutcome: recordProbationOutcomeMutation.mutateAsync,
    isRecordingProbationOutcome: recordProbationOutcomeMutation.isPending,

    startOffboarding: startOffboardingMutation.mutateAsync,
    isStartingOffboarding: startOffboardingMutation.isPending,

    updateOffboardingTask: updateOffboardingTaskMutation.mutateAsync,
    isUpdatingOffboardingTask: updateOffboardingTaskMutation.isPending,

    submitExitInterview: submitExitInterviewMutation.mutateAsync,
    isSubmittingExitInterview: submitExitInterviewMutation.isPending,

    createTemplate: createTemplateMutation.mutateAsync,
    isCreatingTemplate: createTemplateMutation.isPending,

    createTemplateItem: createTemplateItemMutation.mutateAsync,
    isCreatingTemplateItem: createTemplateItemMutation.isPending,
  };
}
