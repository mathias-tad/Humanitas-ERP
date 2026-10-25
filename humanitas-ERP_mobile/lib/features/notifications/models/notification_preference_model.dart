class NotificationPreferenceModel {
  final String category;
  final String channel;
  final String? requiredPermission;

  const NotificationPreferenceModel({
    required this.category,
    required this.channel,
    this.requiredPermission,
  });

  factory NotificationPreferenceModel.fromJson(Map<String, dynamic> json) {
    return NotificationPreferenceModel(
      category: json['category']?.toString() ?? '',
      channel: json['channel']?.toString() ?? 'both',
      requiredPermission: json['required_permission']?.toString(),
    );
  }

  NotificationPreferenceModel copyWith({String? channel}) {
    return NotificationPreferenceModel(
      category: category,
      channel: channel ?? this.channel,
      requiredPermission: requiredPermission,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'category': category,
      'channel': channel,
      if (requiredPermission != null) 'required_permission': requiredPermission,
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
  'leave_approval_requests': 'Approvals & Management',
  'expense_approval_requests': 'Approvals & Management',
  'grievance_filed': 'Approvals & Management',
  'onboarding_review': 'Approvals & Management',
  'task_assignment_alerts': 'Approvals & Management',
  'recruitment_interview_scheduled': 'Approvals & Management',
  'recruitment_offer_generated': 'Approvals & Management',
  'recruitment_candidate_hired': 'Approvals & Management',
  'payroll_run_completed': 'Admin & System',
  'device_offline_alert': 'Admin & System',
  'import_export_completed': 'Admin & System',
  'system_health_alert': 'Admin & System',
};
