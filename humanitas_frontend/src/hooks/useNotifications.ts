import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';

export interface NotificationPreference {
  category: string;
  channel: 'email' | 'push' | 'both' | 'none';
  required_permission: string | null;
}

export interface Notification {
  id: string;
  type: string;
  reference_id?: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

export const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  leave_status_updates:      'Leave Request Updates',
  payslip_ready:             'Payslip Available',
  shift_assigned:            'Shift Assignments',
  announcement:              'Company Announcements',
  survey_invite:             'Survey Invitations',
  onboarding_task:           'Onboarding Tasks',
  asset_assigned:            'Asset Assignments',
  training_enrolled:         'Training Enrollments',
  profile_update:            'Profile Updates',
  leave_approval_requests:   'Pending Leave Approvals',
  expense_approval_requests: 'Pending Expense Approvals',
  grievance_filed:           'New Grievance Filed',
  onboarding_review:         'Onboarding Review Required',
  task_assignment_alerts:    'Task Assignment Alerts',
  payroll_run_completed:     'Payroll Run Completed',
  device_offline_alert:      'Device Offline Alert',
  import_export_completed:   'Import/Export Job Completed',
  system_health_alert:       'System Health Alert',
};

export const NOTIFICATION_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  leave_status_updates:      'Notified when your leave requests are approved or rejected',
  payslip_ready:             'Notified when your monthly payslip is ready to download',
  shift_assigned:            'Notified when a shift or schedule is assigned to you',
  announcement:              'Company-wide bulletins and important policy updates',
  survey_invite:             'Invitations to participate in employee pulse surveys',
  onboarding_task:           'Task assignments during your onboarding process',
  asset_assigned:            'When company assets or equipment are assigned to you',
  training_enrolled:         'When you are enrolled in a training course',
  profile_update:            'When changes are made to your employee profile',
  leave_approval_requests:   'Pending leave requests awaiting your approval',
  expense_approval_requests: 'Pending expense reports awaiting your review',
  grievance_filed:           'When a new grievance is filed requiring your attention',
  onboarding_review:         'When an employee onboarding needs your review',
  task_assignment_alerts:    'When tasks are assigned to team members you manage',
  payroll_run_completed:     'When a payroll processing cycle completes',
  device_offline_alert:      'When a biometric attendance device goes offline',
  import_export_completed:   'When a bulk import or export job finishes',
  system_health_alert:       'Critical system health and error notifications',
};

export const CATEGORY_GROUPS: Record<string, string[]> = {
  'Personal & Self-Service': [
    'leave_status_updates', 'payslip_ready', 'shift_assigned',
    'announcement', 'survey_invite', 'onboarding_task',
    'asset_assigned', 'training_enrolled', 'profile_update',
  ],
  'Approvals & Management': [
    'leave_approval_requests', 'expense_approval_requests',
    'grievance_filed', 'onboarding_review', 'task_assignment_alerts',
  ],
  'Admin & System': [
    'payroll_run_completed', 'device_offline_alert',
    'import_export_completed', 'system_health_alert',
  ],
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return (data.data || data) as T;
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreference[]>({
    queryKey: ['notification-preferences'],
    queryFn: () => fetcher<NotificationPreference[]>(`${API_BASE_URL}/notifications/preferences`),
  });
}

export function useNotifications(limit = 20) {
  return useQuery<Notification[]>({
    queryKey: ['notifications', limit],
    queryFn: () => fetcher<Notification[]>(`${API_BASE_URL}/notifications?limit=${limit}`),
  });
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ category, channel }: { category: string; channel: string }) => {
      const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, channel }),
      });
      if (!res.ok) throw new Error('Failed to update preference');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}

export function useBulkUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preferences: { category: string; channel: string }[]) => {
      const res = await fetch(`${API_BASE_URL}/notifications/preferences/bulk`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      if (!res.ok) throw new Error('Failed to bulk update preferences');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}
