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
  deep_link?: string;
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
  recruitment_interview_scheduled: 'Interview Scheduled',
  recruitment_offer_generated:     'Offer Letter Generated',
  recruitment_candidate_hired:     'Candidate Hired & Onboarded',
  approval_request_created:        'New Approval Request',
  approval_request_decided:        'Approval Decision Update',
  approval_escalation_alert:       'Approval Escalation Alert',
  pms_task_assigned:               'Task Assigned to You',
  pms_sprint_started:              'Sprint Started',
  pms_sprint_completed:            'Sprint Completed',
  pms_milestone_due:               'Project Milestone Due',
  pms_project_status_update:       'Project Status Updated',
  webhook_delivery_failed:         'Webhook Delivery Failed',
  api_key_provisioned:             'API Key Provisioned',
  birthday_greeting:               'Birthday Greeting',
  colleague_birthday_alert:        "Colleague's Birthday Alert",
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
  birthday_greeting:         'Personal birthday greeting and warm wishes from the company',
  colleague_birthday_alert:  'Alert when a team colleague is celebrating their birthday today',
  leave_approval_requests:   'Pending leave requests awaiting your approval',
  expense_approval_requests: 'Pending expense reports awaiting your review',
  grievance_filed:           'When a new grievance is filed requiring your attention',
  onboarding_review:         'When an employee onboarding needs your review',
  task_assignment_alerts:    'When tasks are assigned to team members you manage',
  payroll_run_completed:     'When a payroll processing cycle completes',
  device_offline_alert:      'When a biometric attendance device goes offline',
  import_export_completed:   'When a bulk import or export job finishes',
  system_health_alert:       'Critical system health and error notifications',
  recruitment_interview_scheduled: 'Alert when a candidate interview is scheduled or rescheduled',
  recruitment_offer_generated:     'Alert when a job offer letter is created or sent',
  recruitment_candidate_hired:     'Alert when a candidate is hired and converted to an active employee',
  approval_request_created:        'Notification when an item requires your review and approval',
  approval_request_decided:        'Notification when your submitted request has been approved or rejected',
  approval_escalation_alert:       'Alert when an approval request exceeds its review SLA and escalates',
  pms_task_assigned:               'When a project task or story is assigned to you',
  pms_sprint_started:              'When an agile sprint is kicked off in your project',
  pms_sprint_completed:            'When a sprint cycle completes and retro opens',
  pms_milestone_due:               'Upcoming milestone deadlines for active projects',
  pms_project_status_update:       'When project health, timeline, or status changes occur',
  webhook_delivery_failed:         'Alert when an outgoing webhook event delivery fails after retries',
  api_key_provisioned:             'Alert when a new developer API key is generated or rotated',
};

export const CATEGORY_GROUPS: Record<string, string[]> = {
  'Personal & Self-Service': [
    'leave_status_updates', 'payslip_ready', 'shift_assigned',
    'announcement', 'survey_invite', 'onboarding_task',
    'asset_assigned', 'training_enrolled', 'profile_update',
    'birthday_greeting', 'colleague_birthday_alert',
    'pms_task_assigned',
  ],
  'Approvals & Management': [
    'leave_approval_requests', 'expense_approval_requests',
    'grievance_filed', 'onboarding_review', 'task_assignment_alerts',
    'recruitment_interview_scheduled', 'recruitment_offer_generated', 'recruitment_candidate_hired',
    'approval_request_created', 'approval_request_decided', 'approval_escalation_alert',
    'pms_sprint_started', 'pms_sprint_completed', 'pms_milestone_due', 'pms_project_status_update',
  ],
  'Admin & System': [
    'payroll_run_completed', 'device_offline_alert',
    'import_export_completed', 'system_health_alert',
    'webhook_delivery_failed', 'api_key_provisioned',
  ],
};

export const NOTIFICATION_CATEGORY_PERMISSION_MAP: Record<string, string | null> = {
  // Available to ALL authenticated users (Personal & Self-Service)
  leave_status_updates:    null,
  payslip_ready:           null,
  shift_assigned:          null,
  announcement:            null,
  survey_invite:           null,
  onboarding_task:         null,
  asset_assigned:          null,
  training_enrolled:       null,
  profile_update:          null,
  approval_request_decided: null,
  birthday_greeting:       null,
  colleague_birthday_alert: null,
  pms_task_assigned:       null,

  // Manager/HR level
  leave_approval_requests:   'approve_leave',
  expense_approval_requests: 'approve_expenses',
  grievance_filed:           'manage_grievances',
  onboarding_review:         'manage_onboarding',
  task_assignment_alerts:    'manage_sprints',
  recruitment_interview_scheduled: 'manage_recruitment',
  recruitment_offer_generated:     'manage_recruitment',
  recruitment_candidate_hired:     'manage_recruitment',
  approval_request_created:        'approve_requests',
  pms_sprint_started:              'view_sprints',
  pms_sprint_completed:            'view_sprints',
  pms_milestone_due:               'view_projects',
  pms_project_status_update:       'view_projects',

  // Admin level
  payroll_run_completed:   'run_payroll',
  device_offline_alert:    'authorize_devices',
  import_export_completed: 'view_import_export',
  system_health_alert:     'view_logs',
  approval_escalation_alert: 'manage_approval_rules',
  webhook_delivery_failed:   'manage_developer_api',
  api_key_provisioned:       'manage_developer_api',
};

/**
 * Maps notification category to its owning module.
 * If the tenant does not subscribe to the module, category is hidden and alerts blocked.
 */
export const NOTIFICATION_CATEGORY_MODULE_MAP: Record<string, string> = {
  // Core / Universal
  announcement:              'core',
  profile_update:            'core',
  system_health_alert:       'core',
  import_export_completed:   'core',
  approval_request_created:  'core',
  approval_request_decided:  'core',
  approval_escalation_alert: 'core',
  webhook_delivery_failed:   'core',
  api_key_provisioned:       'core',

  // HRMS
  leave_status_updates:      'hrms',
  leave_approval_requests:   'hrms',
  payslip_ready:             'hrms',
  payroll_run_completed:     'hrms',
  shift_assigned:            'hrms',
  device_offline_alert:      'hrms',
  survey_invite:             'hrms',
  onboarding_task:           'hrms',
  onboarding_review:         'hrms',
  grievance_filed:           'hrms',
  asset_assigned:            'hrms',
  training_enrolled:         'hrms',
  expense_approval_requests: 'hrms',
  recruitment_interview_scheduled: 'hrms',
  recruitment_offer_generated:     'hrms',
  recruitment_candidate_hired:     'hrms',

  // PMS
  task_assignment_alerts:    'pms',
  pms_task_assigned:         'pms',
  pms_sprint_started:        'pms',
  pms_sprint_completed:      'pms',
  pms_milestone_due:         'pms',
  pms_project_status_update: 'pms',
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

export interface DigestConfig {
  mode: 'instant' | 'daily' | 'weekly';
  digest_time: string;
}

export function useDigestConfig() {
  return useQuery<DigestConfig>({
    queryKey: ['notification-digest-config'],
    queryFn: () => fetcher<DigestConfig>(`${API_BASE_URL}/notifications/digest-config`),
  });
}

export function useUpdateDigestConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: { mode: string; digest_time?: string }) => {
      const res = await fetch(`${API_BASE_URL}/notifications/digest-config`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to update digest config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-digest-config'] });
    },
  });
}

export interface BirthdayGreetingSettings {
  enabled: boolean;
  notifyColleagues: boolean;
  greetingMessage: string;
}

export function useBirthdaySettings() {
  return useQuery<BirthdayGreetingSettings>({
    queryKey: ['birthday-settings'],
    queryFn: () => fetcher<BirthdayGreetingSettings>(`${API_BASE_URL}/notifications/settings/birthday`),
  });
}

export function useUpdateBirthdaySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<BirthdayGreetingSettings>) => {
      const res = await fetch(`${API_BASE_URL}/notifications/settings/birthday`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to update birthday greeting settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthday-settings'] });
    },
  });
}


