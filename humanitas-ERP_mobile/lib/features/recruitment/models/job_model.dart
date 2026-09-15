class JobPostingModel {
  final String id;
  final String title;
  final String? department;
  final String? location;
  final String? type;
  final String status;
  final int applicationsCount;
  final DateTime? createdAt;

  const JobPostingModel({
    required this.id,
    required this.title,
    this.department,
    this.location,
    this.type,
    this.status = 'open',
    this.applicationsCount = 0,
    this.createdAt,
  });

  factory JobPostingModel.fromJson(Map<String, dynamic> json) {
    return JobPostingModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Open Position',
      department: json['department']?.toString(),
      location: json['location']?.toString(),
      type: json['type']?.toString() ?? 'Full-time',
      status: json['status']?.toString() ?? (json['is_active'] == true ? 'open' : 'closed'),
      applicationsCount: (json['applications_count'] ?? json['applicationsCount'] ?? 0) as int,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'].toString()) : null,
    );
  }
}

class CandidateApplicationModel {
  final String id;
  final String jobId;
  final String candidateName;
  final String? jobTitle;
  final String status;
  final double? aiScore;
  final DateTime? createdAt;

  const CandidateApplicationModel({
    required this.id,
    required this.jobId,
    required this.candidateName,
    this.jobTitle,
    this.status = 'received',
    this.aiScore,
    this.createdAt,
  });

  factory CandidateApplicationModel.fromJson(Map<String, dynamic> json) {
    final firstName = json['first_name']?.toString() ?? '';
    final lastName = json['last_name']?.toString() ?? '';
    final rawName = json['candidate_name']?.toString() ?? '$firstName $lastName'.trim();

    return CandidateApplicationModel(
      id: json['id']?.toString() ?? '',
      jobId: json['job_id']?.toString() ?? json['jobId']?.toString() ?? '',
      candidateName: rawName.isNotEmpty ? rawName : 'Applicant',
      jobTitle: json['job_title']?.toString() ?? json['jobTitle']?.toString(),
      status: json['status']?.toString() ?? 'received',
      aiScore: json['ai_score'] != null ? double.tryParse(json['ai_score'].toString()) : null,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'].toString()) : null,
    );
  }
}
