class JobPostModel {
  final String id;
  final String title;
  final String? department;
  final String? location;
  final String? type;
  final String status;
  final int applicationsCount;
  final String? description;
  final int? experienceYears;
  final DateTime? createdAt;
  final DateTime? closedAt;

  const JobPostModel({
    required this.id,
    required this.title,
    this.department,
    this.location,
    this.type,
    this.status = 'open',
    this.applicationsCount = 0,
    this.description,
    this.experienceYears,
    this.createdAt,
    this.closedAt,
  });

  factory JobPostModel.fromJson(Map<String, dynamic> json) {
    return JobPostModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Position',
      department: json['department']?.toString(),
      location: json['location']?.toString(),
      type: json['type']?.toString() ?? 'Full-time',
      status: json['status']?.toString() ?? (json['is_active'] == true ? 'open' : 'closed'),
      applicationsCount: (json['applications_count'] ?? json['applicationsCount'] ?? 0) as int,
      description: json['description']?.toString(),
      experienceYears: int.tryParse(json['experience_years']?.toString() ?? '') ??
          int.tryParse(json['experienceYears']?.toString() ?? ''),
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'].toString()) : null,
      closedAt: json['closed_at'] != null ? DateTime.tryParse(json['closed_at'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      if (department != null) 'department': department,
      if (location != null) 'location': location,
      if (type != null) 'type': type,
      'status': status,
      'applications_count': applicationsCount,
      if (description != null) 'description': description,
      if (experienceYears != null) 'experience_years': experienceYears,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (closedAt != null) 'closed_at': closedAt!.toIso8601String(),
    };
  }
}

// Backward compatibility alias
typedef JobPostingModel = JobPostModel;

class CandidateApplicationModel {
  final String id;
  final String jobId;
  final String candidateName;
  final String? candidateEmail;
  final String? candidatePhone;
  final String? jobTitle;
  final String status;
  final String? stage;
  final double? aiScore;
  final String? resumeUrl;
  final double? experienceYears;
  final String? notes;
  final DateTime? createdAt;

  const CandidateApplicationModel({
    required this.id,
    required this.jobId,
    required this.candidateName,
    this.candidateEmail,
    this.candidatePhone,
    this.jobTitle,
    this.status = 'applied',
    this.stage,
    this.aiScore,
    this.resumeUrl,
    this.experienceYears,
    this.notes,
    this.createdAt,
  });

  factory CandidateApplicationModel.fromJson(Map<String, dynamic> json) {
    final firstName = json['first_name']?.toString() ?? '';
    final lastName = json['last_name']?.toString() ?? '';
    final rawName = json['candidate_name']?.toString() ??
        json['name']?.toString() ??
        '$firstName $lastName'.trim();

    return CandidateApplicationModel(
      id: json['id']?.toString() ?? '',
      jobId: json['job_id']?.toString() ?? json['jobId']?.toString() ?? '',
      candidateName: rawName.isNotEmpty ? rawName : 'Applicant',
      candidateEmail: json['candidate_email']?.toString() ?? json['email']?.toString(),
      candidatePhone: json['candidate_phone']?.toString() ?? json['phone']?.toString(),
      jobTitle: json['job_title']?.toString() ?? json['jobTitle']?.toString(),
      status: json['status']?.toString() ?? 'applied',
      stage: json['stage']?.toString() ?? json['status']?.toString() ?? 'applied',
      aiScore: json['ai_score'] != null
          ? double.tryParse(json['ai_score'].toString())
          : (json['aiScore'] != null ? double.tryParse(json['aiScore'].toString()) : null),
      resumeUrl: json['resume_url']?.toString() ?? json['resumeUrl']?.toString(),
      experienceYears: json['experience_years'] != null
          ? double.tryParse(json['experience_years'].toString())
          : null,
      notes: json['notes']?.toString(),
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'job_id': jobId,
      'candidate_name': candidateName,
      if (candidateEmail != null) 'candidate_email': candidateEmail,
      if (candidatePhone != null) 'candidate_phone': candidatePhone,
      if (jobTitle != null) 'job_title': jobTitle,
      'status': status,
      if (stage != null) 'stage': stage,
      if (aiScore != null) 'ai_score': aiScore,
      if (resumeUrl != null) 'resume_url': resumeUrl,
      if (experienceYears != null) 'experience_years': experienceYears,
      if (notes != null) 'notes': notes,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
    };
  }

  CandidateApplicationModel copyWith({
    String? status,
    String? stage,
    double? aiScore,
    String? notes,
  }) {
    return CandidateApplicationModel(
      id: id,
      jobId: jobId,
      candidateName: candidateName,
      candidateEmail: candidateEmail,
      candidatePhone: candidatePhone,
      jobTitle: jobTitle,
      status: status ?? this.status,
      stage: stage ?? this.stage,
      aiScore: aiScore ?? this.aiScore,
      resumeUrl: resumeUrl,
      experienceYears: experienceYears,
      notes: notes ?? this.notes,
      createdAt: createdAt,
    );
  }
}

class InterviewModel {
  final String id;
  final String candidateId;
  final String candidateName;
  final String? jobTitle;
  final String interviewerName;
  final DateTime scheduledAt;
  final String interviewType;
  final String? meetingLink;
  final String status;
  final String? feedback;
  final double? rating;

  const InterviewModel({
    required this.id,
    required this.candidateId,
    required this.candidateName,
    this.jobTitle,
    this.interviewerName = 'Interviewer',
    required this.scheduledAt,
    this.interviewType = 'Technical',
    this.meetingLink,
    this.status = 'scheduled',
    this.feedback,
    this.rating,
  });

  factory InterviewModel.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic val) {
      if (val == null) return DateTime.now();
      return DateTime.tryParse(val.toString()) ?? DateTime.now();
    }

    return InterviewModel(
      id: json['id']?.toString() ?? '',
      candidateId: json['candidate_id']?.toString() ?? json['candidateId']?.toString() ?? '',
      candidateName: json['candidate_name']?.toString() ??
          json['candidateName']?.toString() ??
          'Candidate',
      jobTitle: json['job_title']?.toString() ?? json['jobTitle']?.toString(),
      interviewerName: json['interviewer_name']?.toString() ??
          json['interviewerName']?.toString() ??
          'Interviewer',
      scheduledAt: parseDate(json['scheduled_at'] ?? json['date'] ?? json['scheduledAt']),
      interviewType: json['interview_type']?.toString() ??
          json['interviewType']?.toString() ??
          json['type']?.toString() ??
          'Technical',
      meetingLink: json['meeting_link']?.toString() ??
          json['meetingLink']?.toString() ??
          json['link']?.toString(),
      status: json['status']?.toString() ?? 'scheduled',
      feedback: json['feedback']?.toString(),
      rating: json['rating'] != null ? double.tryParse(json['rating'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'candidate_id': candidateId,
      'candidate_name': candidateName,
      if (jobTitle != null) 'job_title': jobTitle,
      'interviewer_name': interviewerName,
      'scheduled_at': scheduledAt.toIso8601String(),
      'interview_type': interviewType,
      if (meetingLink != null) 'meeting_link': meetingLink,
      'status': status,
      if (feedback != null) 'feedback': feedback,
      if (rating != null) 'rating': rating,
    };
  }
}

class OfferLetterModel {
  final String id;
  final String candidateId;
  final String candidateName;
  final String jobTitle;
  final double? offeredSalary;
  final String currency;
  final DateTime? joiningDate;
  final String status;
  final DateTime? createdAt;

  const OfferLetterModel({
    required this.id,
    required this.candidateId,
    required this.candidateName,
    required this.jobTitle,
    this.offeredSalary,
    this.currency = 'USD',
    this.joiningDate,
    this.status = 'draft',
    this.createdAt,
  });

  factory OfferLetterModel.fromJson(Map<String, dynamic> json) {
    return OfferLetterModel(
      id: json['id']?.toString() ?? '',
      candidateId: json['candidate_id']?.toString() ?? json['candidateId']?.toString() ?? '',
      candidateName: json['candidate_name']?.toString() ??
          json['candidateName']?.toString() ??
          'Candidate',
      jobTitle: json['job_title']?.toString() ??
          json['jobTitle']?.toString() ??
          'Position',
      offeredSalary: json['offered_salary'] != null
          ? double.tryParse(json['offered_salary'].toString())
          : (json['salary'] != null ? double.tryParse(json['salary'].toString()) : null),
      currency: json['currency']?.toString() ?? 'USD',
      joiningDate: json['joining_date'] != null
          ? DateTime.tryParse(json['joining_date'].toString())
          : null,
      status: json['status']?.toString() ?? 'draft',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'candidate_id': candidateId,
      'candidate_name': candidateName,
      'job_title': jobTitle,
      if (offeredSalary != null) 'offered_salary': offeredSalary,
      'currency': currency,
      if (joiningDate != null) 'joining_date': joiningDate!.toIso8601String(),
      'status': status,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
    };
  }
}

class RecruitmentFunnelModel {
  final int applied;
  final int screened;
  final int interview;
  final int offer;
  final int hired;

  const RecruitmentFunnelModel({
    this.applied = 0,
    this.screened = 0,
    this.interview = 0,
    this.offer = 0,
    this.hired = 0,
  });

  factory RecruitmentFunnelModel.fromJson(Map<String, dynamic> json) {
    return RecruitmentFunnelModel(
      applied: (json['applied'] ?? json['total_applied'] ?? 0) as int,
      screened: (json['screened'] ?? json['total_screened'] ?? 0) as int,
      interview: (json['interview'] ?? json['total_interview'] ?? json['interviews'] ?? 0) as int,
      offer: (json['offer'] ?? json['total_offer'] ?? json['offers'] ?? 0) as int,
      hired: (json['hired'] ?? json['total_hired'] ?? 0) as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'applied': applied,
      'screened': screened,
      'interview': interview,
      'offer': offer,
      'hired': hired,
    };
  }

  double get screenRate => applied > 0 ? (screened / applied * 100) : 0.0;
  double get interviewRate => screened > 0 ? (interview / screened * 100) : 0.0;
  double get offerRate => interview > 0 ? (offer / interview * 100) : 0.0;
  double get hireRate => offer > 0 ? (hired / offer * 100) : 0.0;
  double get overallConversionRate => applied > 0 ? (hired / applied * 100) : 0.0;
}
