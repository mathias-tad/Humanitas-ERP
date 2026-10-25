class NotificationPreferenceModel {
  final String category;
  final String channel;
  final String? requiredPermission;
  final String? module;

  const NotificationPreferenceModel({
    required this.category,
    required this.channel,
    this.requiredPermission,
    this.module,
  });

  factory NotificationPreferenceModel.fromJson(Map<String, dynamic> json) {
    return NotificationPreferenceModel(
      category: json['category']?.toString() ?? '',
      channel: json['channel']?.toString() ?? 'both',
      requiredPermission: json['required_permission']?.toString(),
      module: json['module']?.toString(),
    );
  }

  NotificationPreferenceModel copyWith({String? channel}) {
    return NotificationPreferenceModel(
      category: category,
      channel: channel ?? this.channel,
      requiredPermission: requiredPermission,
      module: module,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'category': category,
      'channel': channel,
      if (requiredPermission != null) 'required_permission': requiredPermission,
      if (module != null) 'module': module,
    };
  }
}

const Map<String, String> kNotificationCategoryLabels = {
  'leave_status_updates': 'Leave Request Updates',
  'payslip_ready': 'Payslip Available',
  'shift_assigned': 'Shift Assignments',
  'announcement': 'Company Announcements',
  'survey_invite': 'Survey Invitations',
  'onboarding_task': 'Onboarding Tasks',
  'asset_assigned': 'Asset Assignments',
  'training_enrolled': 'Training Enrollments',
  'profile_update': 'Profile Updates',
  'leave_approval_requests': 'Pending Leave Approvals',
  'expense_approval_requests': 'Pending Expense Approvals',
  'grievance_filed': 'New Grievance Filed',
  'onboarding_review': 'Onboarding Review Required',
  'task_assignment_alerts': 'Task Assignment Alerts',
  'payroll_run_completed': 'Payroll Run Completed',
  'device_offline_alert': 'Device Offline Alert',
  'import_export_completed': 'Import/Export Job Completed',
  'system_health_alert': 'System Health Alert',
  'recruitment_interview_scheduled': 'Interview Scheduled',
  'recruitment_offer_generated': 'Offer Letter Generated',
  'recruitment_candidate_hired': 'Candidate Hired & Onboarded',
  'approval_request_created': 'New Approval Request',
  'approval_request_decided': 'Approval Decision Update',
  'approval_escalation_alert': 'Approval Escalation Alert',
  'pms_task_assigned': 'Task Assigned to You',
  'pms_sprint_started': 'Sprint Started',
  'pms_sprint_completed': 'Sprint Completed',
  'pms_milestone_due': 'Project Milestone Due',
  'pms_project_status_update': 'Project Status Updated',
  'webhook_delivery_failed': 'Webhook Delivery Failed',
  'api_key_provisioned': 'API Key Provisioned',
};

const Map<String, String> kNotificationCategoryGroups = {
  'leave_status_updates': 'Personal & Self-Service',
  'payslip_ready': 'Personal & Self-Service',
  'shift_assigned': 'Personal & Self-Service',
  'announcement': 'Personal & Self-Service',
  'survey_invite': 'Personal & Self-Service',
  'onboarding_task': 'Personal & Self-Service',
  'asset_assigned': 'Personal & Self-Service',
  'training_enrolled': 'Personal & Self-Service',
  'profile_update': 'Personal & Self-Service',
  'pms_task_assigned': 'Personal & Self-Service',
  'leave_approval_requests': 'Approvals & Management',
  'expense_approval_requests': 'Approvals & Management',
  'grievance_filed': 'Approvals & Management',
  'onboarding_review': 'Approvals & Management',
  'task_assignment_alerts': 'Approvals & Management',
  'recruitment_interview_scheduled': 'Approvals & Management',
  'recruitment_offer_generated': 'Approvals & Management',
  'recruitment_candidate_hired': 'Approvals & Management',
  'approval_request_created': 'Approvals & Management',
  'approval_request_decided': 'Approvals & Management',
  'approval_escalation_alert': 'Approvals & Management',
  'pms_sprint_started': 'Approvals & Management',
  'pms_sprint_completed': 'Approvals & Management',
  'pms_milestone_due': 'Approvals & Management',
  'pms_project_status_update': 'Approvals & Management',
  'payroll_run_completed': 'Admin & System',
  'device_offline_alert': 'Admin & System',
  'import_export_completed': 'Admin & System',
  'system_health_alert': 'Admin & System',
  'webhook_delivery_failed': 'Admin & System',
  'api_key_provisioned': 'Admin & System',
};

const Map<String, String?> kNotificationCategoryPermissionMap = {
  // Available to ALL authenticated users (Personal & Self-Service)
  'leave_status_updates': null,
  'payslip_ready': null,
  'shift_assigned': null,
  'announcement': null,
  'survey_invite': null,
  'onboarding_task': null,
  'asset_assigned': null,
  'training_enrolled': null,
  'profile_update': null,
  'approval_request_decided': null,
  'pms_task_assigned': null,

  // Manager/HR level
  'leave_approval_requests': 'approve_leave',
  'expense_approval_requests': 'approve_expenses',
  'grievance_filed': 'manage_grievances',
  'onboarding_review': 'manage_onboarding',
  'task_assignment_alerts': 'manage_sprints',
  'recruitment_interview_scheduled': 'manage_recruitment',
  'recruitment_offer_generated': 'manage_recruitment',
  'recruitment_candidate_hired': 'manage_recruitment',
  'approval_request_created': 'approve_requests',
  'pms_sprint_started': 'view_sprints',
  'pms_sprint_completed': 'view_sprints',
  'pms_milestone_due': 'view_projects',
  'pms_project_status_update': 'view_projects',

  // Admin level
  'payroll_run_completed': 'run_payroll',
  'device_offline_alert': 'authorize_devices',
  'import_export_completed': 'view_import_export',
  'system_health_alert': 'view_logs',
  'approval_escalation_alert': 'manage_approval_rules',
  'webhook_delivery_failed': 'manage_developer_api',
  'api_key_provisioned': 'manage_developer_api',
};

/**
 * Maps notification category to its parent tenant module.
 * If the tenant has not subscribed to or has disabled this module,
 * the category will be excluded from preferences.
 */
const Map<String, String> kNotificationCategoryModuleMap = {
  // Core / Universal
  'announcement': 'core',
  'profile_update': 'core',
  'system_health_alert': 'core',
  'import_export_completed': 'core',
  'approval_request_created': 'core',
  'approval_request_decided': 'core',
  'approval_escalation_alert': 'core',
  'webhook_delivery_failed': 'core',
  'api_key_provisioned': 'core',

  // HRMS
  'leave_status_updates': 'hrms',
  'leave_approval_requests': 'hrms',
  'payslip_ready': 'hrms',
  'payroll_run_completed': 'hrms',
  'shift_assigned': 'hrms',
  'device_offline_alert': 'hrms',
  'survey_invite': 'hrms',
  'onboarding_task': 'hrms',
  'onboarding_review': 'hrms',
  'grievance_filed': 'hrms',
  'asset_assigned': 'hrms',
  'training_enrolled': 'hrms',
  'expense_approval_requests': 'hrms',
  'recruitment_interview_scheduled': 'hrms',
  'recruitment_offer_generated': 'hrms',
  'recruitment_candidate_hired': 'hrms',

  // PMS
  'task_assignment_alerts': 'pms',
  'pms_task_assigned': 'pms',
  'pms_sprint_started': 'pms',
  'pms_sprint_completed': 'pms',
  'pms_milestone_due': 'pms',
  'pms_project_status_update': 'pms',
};
