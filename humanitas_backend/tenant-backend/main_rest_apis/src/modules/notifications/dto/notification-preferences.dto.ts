import { IsString, IsIn } from 'class-validator';

export type NotificationChannel = 'email' | 'push' | 'both' | 'none';

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['email', 'push', 'both', 'none'];

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

  // Manager/HR level
  leave_approval_requests:   'approve_leave',
  expense_approval_requests: 'approve_expenses',
  grievance_filed:           'manage_grievances',
  onboarding_review:         'manage_onboarding',
  task_assignment_alerts:    'manage_sprints',

  // Admin level
  payroll_run_completed:   'run_payroll',
  device_offline_alert:    'authorize_devices',
  import_export_completed: 'view_import_export',
  system_health_alert:     'view_logs',
};

export class UpdateNotificationPreferenceDto {
  @IsString()
  category: string;

  @IsIn(['email', 'push', 'both', 'none'])
  channel: NotificationChannel;
}

export class BulkUpdateNotificationPreferencesDto {
  preferences: UpdateNotificationPreferenceDto[];
}
