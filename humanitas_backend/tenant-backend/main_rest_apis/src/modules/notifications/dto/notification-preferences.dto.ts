import { IsString, IsIn, IsOptional, IsEnum } from 'class-validator';

export type NotificationChannel = 'email' | 'push' | 'both' | 'none';

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['email', 'push', 'both', 'none'];

export enum DigestMode {
  INSTANT = 'instant',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

/**
 * Notification categories and the minimum permission required to see them.
 * null = available to ALL authenticated users.
 */
export const NOTIFICATION_CATEGORY_PERMISSION_MAP: Record<string, string | null> = {
  // Available to ALL authenticated users (no special permission needed)
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

  // PMS Agile & Sprints
  pms_task_assigned:         'view_tasks',
  pms_sprint_started:        'view_sprints',
  pms_sprint_completed:      'view_sprints',
  pms_milestone_due:         'view_projects',
  pms_project_status_update: 'view_projects',

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
 * Maps each notification category to its parent tenant module.
 * If the tenant has not subscribed to or has disabled this module,
 * the category will be excluded from preferences and alerts blocked.
 * 'core' = available across all tenants.
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
  birthday_greeting:               'hrms',
  colleague_birthday_alert:        'hrms',

  // PMS
  task_assignment_alerts:    'pms',
  pms_task_assigned:         'pms',
  pms_sprint_started:        'pms',
  pms_sprint_completed:      'pms',
  pms_milestone_due:         'pms',
  pms_project_status_update: 'pms',
};

export class UpdateNotificationPreferenceDto {
  @IsString()
  category: string;

  @IsIn(['email', 'push', 'both', 'none'])
  channel: NotificationChannel;

  @IsOptional()
  @IsEnum(DigestMode)
  digest_mode?: DigestMode;
}

export class BulkUpdateNotificationPreferencesDto {
  preferences: UpdateNotificationPreferenceDto[];
}
