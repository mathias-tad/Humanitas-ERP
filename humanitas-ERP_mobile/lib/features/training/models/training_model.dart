class TrainingCourseModel {
  final String id;
  final String title;
  final String category;
  final String? description;
  final String deliveryMethod;
  final double durationHours;
  final int capacityLimit;
  final bool isMandatory;
  final int passingScore;
  final String? providerName;
  final bool isActive;
  final int totalEnrolled;
  final int totalCompleted;

  const TrainingCourseModel({
    required this.id,
    required this.title,
    required this.category,
    this.description,
    this.deliveryMethod = 'online',
    this.durationHours = 1.0,
    this.capacityLimit = 50,
    this.isMandatory = false,
    this.passingScore = 80,
    this.providerName,
    this.isActive = true,
    this.totalEnrolled = 0,
    this.totalCompleted = 0,
  });

  factory TrainingCourseModel.fromJson(Map<String, dynamic> json) {
    return TrainingCourseModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      category: json['category'] as String? ?? 'general',
      description: json['description'] as String?,
      deliveryMethod: json['delivery_method'] as String? ?? 'online',
      durationHours: (json['duration_hours'] is num)
          ? (json['duration_hours'] as num).toDouble()
          : double.tryParse(json['duration_hours']?.toString() ?? '1') ?? 1.0,
      capacityLimit: (json['capacity_limit'] as num?)?.toInt() ?? 50,
      isMandatory: json['is_mandatory'] == true || json['is_mandatory'] == 1,
      passingScore: (json['passing_score'] as num?)?.toInt() ?? 80,
      providerName: json['provider_name'] as String?,
      isActive: json['is_active'] == true || json['is_active'] == 1,
      totalEnrolled: (json['total_enrolled'] as num?)?.toInt() ?? 0,
      totalCompleted: (json['total_completed'] as num?)?.toInt() ?? 0,
    );
  }
}

class TrainingSessionModel {
  final String id;
  final String courseId;
  final String? courseTitle;
  final String? instructorName;
  final String? venueOrLink;
  final String startTime;
  final String endTime;
  final int maxParticipants;
  final String status;
  final int enrolledCount;

  const TrainingSessionModel({
    required this.id,
    required this.courseId,
    this.courseTitle,
    this.instructorName,
    this.venueOrLink,
    required this.startTime,
    required this.endTime,
    this.maxParticipants = 30,
    this.status = 'scheduled',
    this.enrolledCount = 0,
  });

  factory TrainingSessionModel.fromJson(Map<String, dynamic> json) {
    return TrainingSessionModel(
      id: json['id'] as String? ?? '',
      courseId: json['course_id'] as String? ?? '',
      courseTitle: json['course_title'] as String?,
      instructorName: json['instructor_name'] as String?,
      venueOrLink: json['venue_or_link'] as String?,
      startTime: json['start_time'] as String? ?? '',
      endTime: json['end_time'] as String? ?? '',
      maxParticipants: (json['max_participants'] as num?)?.toInt() ?? 30,
      status: json['status'] as String? ?? 'scheduled',
      enrolledCount: (json['enrolled_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class TrainingEnrollmentModel {
  final String id;
  final String courseId;
  final String? courseTitle;
  final String? userName;
  final String status;
  final int completionPercentage;
  final double? score;
  final bool attendanceConfirmed;
  final bool certificateIssued;
  final String? expiryDate;

  const TrainingEnrollmentModel({
    required this.id,
    required this.courseId,
    this.courseTitle,
    this.userName,
    this.status = 'confirmed',
    this.completionPercentage = 0,
    this.score,
    this.attendanceConfirmed = false,
    this.certificateIssued = false,
    this.expiryDate,
  });

  factory TrainingEnrollmentModel.fromJson(Map<String, dynamic> json) {
    return TrainingEnrollmentModel(
      id: json['id'] as String? ?? '',
      courseId: json['course_id'] as String? ?? '',
      courseTitle: json['course_title'] as String?,
      userName: json['user_name'] as String?,
      status: json['status'] as String? ?? 'confirmed',
      completionPercentage: (json['completion_percentage'] as num?)?.toInt() ?? 0,
      score: (json['score'] is num)
          ? (json['score'] as num).toDouble()
          : (json['score'] != null ? double.tryParse(json['score'].toString()) : null),
      attendanceConfirmed: json['attendance_confirmed'] == true || json['attendance_confirmed'] == 1,
      certificateIssued: json['certificate_issued'] == true || json['certificate_issued'] == 1,
      expiryDate: json['expiry_date'] as String?,
    );
  }
}

class TrainingStatsModel {
  final int totalCourses;
  final int mandatoryCourses;
  final int totalEnrollments;
  final int completedEnrollments;
  final int activeEnrollments;
  final int completionRate;
  final int complianceRate;
  final double averageScore;
  final int totalSkillsLogged;
  final int verifiedSkills;

  const TrainingStatsModel({
    this.totalCourses = 0,
    this.mandatoryCourses = 0,
    this.totalEnrollments = 0,
    this.completedEnrollments = 0,
    this.activeEnrollments = 0,
    this.completionRate = 0,
    this.complianceRate = 0,
    this.averageScore = 0.0,
    this.totalSkillsLogged = 0,
    this.verifiedSkills = 0,
  });

  factory TrainingStatsModel.fromJson(Map<String, dynamic> json) {
    return TrainingStatsModel(
      totalCourses: (json['total_courses'] as num?)?.toInt() ?? 0,
      mandatoryCourses: (json['mandatory_courses'] as num?)?.toInt() ?? 0,
      totalEnrollments: (json['total_enrollments'] as num?)?.toInt() ?? 0,
      completedEnrollments: (json['completed_enrollments'] as num?)?.toInt() ?? 0,
      activeEnrollments: (json['active_enrollments'] as num?)?.toInt() ?? 0,
      completionRate: (json['completion_rate'] as num?)?.toInt() ?? 0,
      complianceRate: (json['compliance_rate'] as num?)?.toInt() ?? 0,
      averageScore: (json['average_score'] is num)
          ? (json['average_score'] as num).toDouble()
          : double.tryParse(json['average_score']?.toString() ?? '0') ?? 0.0,
      totalSkillsLogged: (json['total_skills_logged'] as num?)?.toInt() ?? 0,
      verifiedSkills: (json['verified_skills'] as num?)?.toInt() ?? 0,
    );
  }
}
