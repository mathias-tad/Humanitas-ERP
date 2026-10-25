class OnboardingTaskModel {
  final String id;
  final String onboardingId;
  final String? templateItemId;
  final String title;
  final String? description;
  final String category;
  final String? assigneeRole;
  final DateTime? dueDate;
  final bool isRequired;
  final String status; // pending, in_progress, completed, skipped
  final String? completedBy;
  final DateTime? completedAt;
  final String? notes;
  final int sortOrder;

  const OnboardingTaskModel({
    required this.id,
    required this.onboardingId,
    this.templateItemId,
    required this.title,
    this.description,
    this.category = 'general',
    this.assigneeRole,
    this.dueDate,
    this.isRequired = true,
    this.status = 'pending',
    this.completedBy,
    this.completedAt,
    this.notes,
    this.sortOrder = 0,
  });

  bool get isCompleted => status == 'completed';

  factory OnboardingTaskModel.fromJson(Map<String, dynamic> json) {
    return OnboardingTaskModel(
      id: json['id'] as String? ?? '',
      onboardingId: json['onboarding_id'] as String? ?? '',
      templateItemId: json['template_item_id'] as String?,
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      category: json['category'] as String? ?? 'general',
      assigneeRole: json['assignee_role'] as String?,
      dueDate: json['due_date'] != null
          ? DateTime.tryParse(json['due_date'].toString())
          : null,
      isRequired: json['is_required'] == true || json['is_required'] == 1,
      status: json['status'] as String? ?? 'pending',
      completedBy: json['completed_by'] as String?,
      completedAt: json['completed_at'] != null
          ? DateTime.tryParse(json['completed_at'].toString())
          : null,
      notes: json['notes'] as String?,
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
    );
  }
}

class OnboardingInstanceModel {
  final String id;
  final String userId;
  final String? templateId;
  final String? templateName;
  final String? firstName;
  final String? lastName;
  final String? email;
  final String? department;
  final String? position;
  final String status; // not_started, in_progress, completed, overdue
  final DateTime? startDate;
  final DateTime? targetCompletionDate;
  final DateTime? completedDate;
  final int probationDays;
  final DateTime? probationEndDate;
  final String? probationOutcome; // confirmed, extended, terminated
  final String? probationOutcomeNotes;
  final int totalTasks;
  final int completedTasks;
  final double completionPercentage;
  final List<OnboardingTaskModel> tasks;

  const OnboardingInstanceModel({
    required this.id,
    required this.userId,
    this.templateId,
    this.templateName,
    this.firstName,
    this.lastName,
    this.email,
    this.department,
    this.position,
    this.status = 'not_started',
    this.startDate,
    this.targetCompletionDate,
    this.completedDate,
    this.probationDays = 90,
    this.probationEndDate,
    this.probationOutcome,
    this.probationOutcomeNotes,
    this.totalTasks = 0,
    this.completedTasks = 0,
    this.completionPercentage = 0.0,
    this.tasks = const [],
  });

  String get employeeFullName {
    final fn = firstName?.trim() ?? '';
    final ln = lastName?.trim() ?? '';
    final full = '$fn $ln'.trim();
    return full.isNotEmpty ? full : (email ?? 'Employee');
  }

  factory OnboardingInstanceModel.fromJson(Map<String, dynamic> json) {
    final taskList = (json['tasks'] as List<dynamic>?)
            ?.map((e) => OnboardingTaskModel.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final total = (json['total_tasks'] as num?)?.toInt() ?? taskList.length;
    final completed = (json['completed_tasks'] as num?)?.toInt() ??
        taskList.where((t) => t.isCompleted).length;
    final pct = total > 0
        ? (completed / total * 100).toDouble()
        : ((json['completion_percentage'] as num?)?.toDouble() ?? 0.0);

    return OnboardingInstanceModel(
      id: json['id'] as String? ?? '',
      userId: json['user_id'] as String? ?? '',
      templateId: json['template_id'] as String?,
      templateName: json['template_name'] as String?,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      email: json['email'] as String?,
      department: json['department'] as String?,
      position: json['position'] as String?,
      status: json['status'] as String? ?? 'not_started',
      startDate: json['start_date'] != null
          ? DateTime.tryParse(json['start_date'].toString())
          : null,
      targetCompletionDate: json['target_completion_date'] != null
          ? DateTime.tryParse(json['target_completion_date'].toString())
          : null,
      completedDate: json['completed_date'] != null
          ? DateTime.tryParse(json['completed_date'].toString())
          : null,
      probationDays: (json['probation_days'] as num?)?.toInt() ?? 90,
      probationEndDate: json['probation_end_date'] != null
          ? DateTime.tryParse(json['probation_end_date'].toString())
          : null,
      probationOutcome: json['probation_outcome'] as String?,
      probationOutcomeNotes: json['probation_outcome_notes'] as String?,
      totalTasks: total,
      completedTasks: completed,
      completionPercentage: pct,
      tasks: taskList,
    );
  }
}

class OnboardingStatsModel {
  final int totalOnboarding;
  final int inProgressOnboarding;
  final int completedOnboarding;
  final int overdueTasks;
  final double avgCompletionDays;
  final int upcomingProbationReviews;

  const OnboardingStatsModel({
    this.totalOnboarding = 0,
    this.inProgressOnboarding = 0,
    this.completedOnboarding = 0,
    this.overdueTasks = 0,
    this.avgCompletionDays = 0.0,
    this.upcomingProbationReviews = 0,
  });

  factory OnboardingStatsModel.fromJson(Map<String, dynamic> json) {
    return OnboardingStatsModel(
      totalOnboarding: (json['total_onboarding'] as num?)?.toInt() ?? 0,
      inProgressOnboarding:
          (json['in_progress_onboarding'] as num?)?.toInt() ?? 0,
      completedOnboarding: (json['completed_onboarding'] as num?)?.toInt() ?? 0,
      overdueTasks: (json['overdue_tasks'] as num?)?.toInt() ?? 0,
      avgCompletionDays:
          (json['avg_completion_days'] as num?)?.toDouble() ?? 0.0,
      upcomingProbationReviews:
          (json['upcoming_probation_reviews'] as num?)?.toInt() ?? 0,
    );
  }
}
