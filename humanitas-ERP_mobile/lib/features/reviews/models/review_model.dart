class ReviewCycleModel {
  final String id;
  final String title;
  final String cycleType;
  final String status;
  final String startDate;
  final String dueDate;
  final String? description;
  final int totalParticipants;
  final int completedReviews;

  const ReviewCycleModel({
    required this.id,
    required this.title,
    required this.cycleType,
    required this.status,
    required this.startDate,
    required this.dueDate,
    this.description,
    this.totalParticipants = 0,
    this.completedReviews = 0,
  });

  factory ReviewCycleModel.fromJson(Map<String, dynamic> json) {
    return ReviewCycleModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      cycleType: json['cycle_type'] as String? ?? 'quarterly',
      status: json['status'] as String? ?? 'active',
      startDate: json['start_date'] as String? ?? '',
      dueDate: json['due_date'] as String? ?? '',
      description: json['description'] as String?,
      totalParticipants: (json['total_participants'] as num?)?.toInt() ?? 0,
      completedReviews: (json['completed_reviews'] as num?)?.toInt() ?? 0,
    );
  }
}

class ReviewFeedbackModel {
  final String id;
  final String reviewId;
  final String cycleId;
  final String reviewerId;
  final String reviewerType;
  final String status;
  final double? overallRating;
  final String? generalFeedback;
  final String? cycleTitle;
  final String? cycleDueDate;
  final String? subjectFirstName;
  final String? subjectLastName;
  final String? subjectJobTitle;
  final String? subjectDepartment;

  const ReviewFeedbackModel({
    required this.id,
    required this.reviewId,
    required this.cycleId,
    required this.reviewerId,
    required this.reviewerType,
    required this.status,
    this.overallRating,
    this.generalFeedback,
    this.cycleTitle,
    this.cycleDueDate,
    this.subjectFirstName,
    this.subjectLastName,
    this.subjectJobTitle,
    this.subjectDepartment,
  });

  factory ReviewFeedbackModel.fromJson(Map<String, dynamic> json) {
    return ReviewFeedbackModel(
      id: json['id'] as String? ?? '',
      reviewId: json['review_id'] as String? ?? '',
      cycleId: json['cycle_id'] as String? ?? '',
      reviewerId: json['reviewer_id'] as String? ?? '',
      reviewerType: json['reviewer_type'] as String? ?? 'peer',
      status: json['status'] as String? ?? 'pending',
      overallRating: (json['overall_rating'] is num)
          ? (json['overall_rating'] as num).toDouble()
          : double.tryParse(json['overall_rating']?.toString() ?? ''),
      generalFeedback: json['general_feedback'] as String?,
      cycleTitle: json['cycle_title'] as String?,
      cycleDueDate: json['cycle_due_date'] as String?,
      subjectFirstName: json['subject_first_name'] as String?,
      subjectLastName: json['subject_last_name'] as String?,
      subjectJobTitle: json['subject_job_title'] as String?,
      subjectDepartment: json['subject_department'] as String?,
    );
  }
}

class EmployeeReviewModel {
  final String id;
  final String cycleId;
  final String employeeId;
  final String firstName;
  final String lastName;
  final String? department;
  final String? jobTitle;
  final String cycleTitle;
  final String status;
  final double? selfRating;
  final double? peerRatingAvg;
  final double? managerRating;
  final double? finalRating;
  final String? managerSummary;

  const EmployeeReviewModel({
    required this.id,
    required this.cycleId,
    required this.employeeId,
    required this.firstName,
    required this.lastName,
    this.department,
    this.jobTitle,
    required this.cycleTitle,
    required this.status,
    this.selfRating,
    this.peerRatingAvg,
    this.managerRating,
    this.finalRating,
    this.managerSummary,
  });

  factory EmployeeReviewModel.fromJson(Map<String, dynamic> json) {
    return EmployeeReviewModel(
      id: json['id'] as String? ?? '',
      cycleId: json['cycle_id'] as String? ?? '',
      employeeId: json['employee_id'] as String? ?? '',
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      department: json['department'] as String?,
      jobTitle: json['job_title'] as String?,
      cycleTitle: json['cycle_title'] as String? ?? 'Review Cycle',
      status: json['status'] as String? ?? 'pending_self',
      selfRating: (json['self_rating'] is num)
          ? (json['self_rating'] as num).toDouble()
          : double.tryParse(json['self_rating']?.toString() ?? ''),
      peerRatingAvg: (json['peer_rating_avg'] is num)
          ? (json['peer_rating_avg'] as num).toDouble()
          : double.tryParse(json['peer_rating_avg']?.toString() ?? ''),
      managerRating: (json['manager_rating'] is num)
          ? (json['manager_rating'] as num).toDouble()
          : double.tryParse(json['manager_rating']?.toString() ?? ''),
      finalRating: (json['final_rating'] is num)
          ? (json['final_rating'] as num).toDouble()
          : double.tryParse(json['final_rating']?.toString() ?? ''),
      managerSummary: json['manager_summary'] as String?,
    );
  }
}

class PipModel {
  final String id;
  final String employeeId;
  final String firstName;
  final String lastName;
  final String? department;
  final String title;
  final String reason;
  final String actionPlan;
  final String successCriteria;
  final String startDate;
  final String targetEndDate;
  final String status;

  const PipModel({
    required this.id,
    required this.employeeId,
    required this.firstName,
    required this.lastName,
    this.department,
    required this.title,
    required this.reason,
    required this.actionPlan,
    required this.successCriteria,
    required this.startDate,
    required this.targetEndDate,
    required this.status,
  });

  factory PipModel.fromJson(Map<String, dynamic> json) {
    return PipModel(
      id: json['id'] as String? ?? '',
      employeeId: json['employee_id'] as String? ?? '',
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      department: json['department'] as String?,
      title: json['title'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
      actionPlan: json['action_plan'] as String? ?? '',
      successCriteria: json['success_criteria'] as String? ?? '',
      startDate: json['start_date'] as String? ?? '',
      targetEndDate: json['target_end_date'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
    );
  }
}

class ReviewAnalyticsModel {
  final int totalCycles;
  final int totalReviews;
  final int completedReviews;
  final int completionRate;
  final double averageRating;
  final int activePips;

  const ReviewAnalyticsModel({
    this.totalCycles = 0,
    this.totalReviews = 0,
    this.completedReviews = 0,
    this.completionRate = 0,
    this.averageRating = 0.0,
    this.activePips = 0,
  });

  factory ReviewAnalyticsModel.fromJson(Map<String, dynamic> json) {
    return ReviewAnalyticsModel(
      totalCycles: (json['total_cycles'] as num?)?.toInt() ?? 0,
      totalReviews: (json['total_reviews'] as num?)?.toInt() ?? 0,
      completedReviews: (json['completed_reviews'] as num?)?.toInt() ?? 0,
      completionRate: (json['completion_rate'] as num?)?.toInt() ?? 0,
      averageRating: (json['average_rating'] is num)
          ? (json['average_rating'] as num).toDouble()
          : double.tryParse(json['average_rating']?.toString() ?? '0') ?? 0.0,
      activePips: (json['active_pips'] as num?)?.toInt() ?? 0,
    );
  }
}
