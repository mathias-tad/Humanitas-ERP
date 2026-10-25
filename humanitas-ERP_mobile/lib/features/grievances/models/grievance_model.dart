class GrievanceTimelineModel {
  final String id;
  final String grievanceId;
  final String? actorId;
  final String? actorName;
  final String action;
  final String? notes;
  final bool isConfidential;
  final DateTime? createdAt;

  const GrievanceTimelineModel({
    required this.id,
    required this.grievanceId,
    this.actorId,
    this.actorName,
    required this.action,
    this.notes,
    this.isConfidential = false,
    this.createdAt,
  });

  factory GrievanceTimelineModel.fromJson(Map<String, dynamic> json) {
    return GrievanceTimelineModel(
      id: json['id'] as String? ?? '',
      grievanceId: json['grievance_id'] as String? ?? '',
      actorId: json['actor_id'] as String?,
      actorName: json['actor_name'] as String?,
      action: json['action'] as String? ?? '',
      notes: json['notes'] as String?,
      isConfidential: json['is_confidential'] == true || json['is_confidential'] == 1,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
    );
  }
}

class GrievanceModel {
  final String id;
  final String ticketNumber;
  final String? userId;
  final bool isAnonymous;
  final String category;
  final String subject;
  final String description;
  final String priority;
  final String status;
  final String? incidentDate;
  final String? incidentLocation;
  final String? accusedParties;
  final String? witnesses;
  final String? assignedInvestigatorId;
  final String? investigatorName;
  final String? resolutionSummary;
  final String? resolutionActionItems;
  final bool isSlaBreached;
  final bool retaliationMonitoringFlag;
  final int? satisfactionScore;
  final String? satisfactionFeedback;
  final String? submitterName;
  final String? submitterDepartment;
  final int attachmentsCount;
  final DateTime? createdAt;
  final List<GrievanceTimelineModel> timeline;

  const GrievanceModel({
    required this.id,
    required this.ticketNumber,
    this.userId,
    this.isAnonymous = false,
    required this.category,
    required this.subject,
    required this.description,
    this.priority = 'medium',
    this.status = 'filed',
    this.incidentDate,
    this.incidentLocation,
    this.accusedParties,
    this.witnesses,
    this.assignedInvestigatorId,
    this.investigatorName,
    this.resolutionSummary,
    this.resolutionActionItems,
    this.isSlaBreached = false,
    this.retaliationMonitoringFlag = false,
    this.satisfactionScore,
    this.satisfactionFeedback,
    this.submitterName,
    this.submitterDepartment,
    this.attachmentsCount = 0,
    this.createdAt,
    this.timeline = const [],
  });

  factory GrievanceModel.fromJson(Map<String, dynamic> json) {
    return GrievanceModel(
      id: json['id'] as String? ?? '',
      ticketNumber: json['ticket_number'] as String? ?? '',
      userId: json['user_id'] as String?,
      isAnonymous: json['is_anonymous'] == true || json['is_anonymous'] == 1,
      category: json['category'] as String? ?? 'other',
      subject: json['subject'] as String? ?? '',
      description: json['description'] as String? ?? '',
      priority: json['priority'] as String? ?? 'medium',
      status: json['status'] as String? ?? 'filed',
      incidentDate: json['incident_date'] as String?,
      incidentLocation: json['incident_location'] as String?,
      accusedParties: json['accused_parties'] as String?,
      witnesses: json['witnesses'] as String?,
      assignedInvestigatorId: json['assigned_investigator_id'] as String?,
      investigatorName: json['investigator_name'] as String?,
      resolutionSummary: json['resolution_summary'] as String?,
      resolutionActionItems: json['resolution_action_items'] as String?,
      isSlaBreached: json['is_sla_breached'] == true || json['is_sla_breached'] == 1,
      retaliationMonitoringFlag: json['retaliation_monitoring_flag'] == true || json['retaliation_monitoring_flag'] == 1,
      satisfactionScore: json['satisfaction_score'] != null
          ? int.tryParse(json['satisfaction_score'].toString())
          : null,
      satisfactionFeedback: json['satisfaction_feedback'] as String?,
      submitterName: json['submitter_name'] as String?,
      submitterDepartment: json['submitter_department'] as String?,
      attachmentsCount: json['attachments_count'] != null
          ? int.tryParse(json['attachments_count'].toString()) ?? 0
          : 0,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      timeline: (json['timeline'] as List<dynamic>?)
              ?.map((t) => GrievanceTimelineModel.fromJson(t as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }
}

class GrievanceStatsModel {
  final int totalCases;
  final int openCases;
  final int closedCases;
  final int slaBreachedCases;
  final int retaliationMonitoringCount;
  final double avgResolutionDays;
  final int slaComplianceRate;

  const GrievanceStatsModel({
    this.totalCases = 0,
    this.openCases = 0,
    this.closedCases = 0,
    this.slaBreachedCases = 0,
    this.retaliationMonitoringCount = 0,
    this.avgResolutionDays = 0.0,
    this.slaComplianceRate = 100,
  });

  factory GrievanceStatsModel.fromJson(Map<String, dynamic> json) {
    return GrievanceStatsModel(
      totalCases: int.tryParse(json['total_cases']?.toString() ?? '0') ?? 0,
      openCases: int.tryParse(json['open_cases']?.toString() ?? '0') ?? 0,
      closedCases: int.tryParse(json['closed_cases']?.toString() ?? '0') ?? 0,
      slaBreachedCases: int.tryParse(json['sla_breached_cases']?.toString() ?? '0') ?? 0,
      retaliationMonitoringCount: int.tryParse(json['retaliation_monitoring_count']?.toString() ?? '0') ?? 0,
      avgResolutionDays: double.tryParse(json['avg_resolution_days']?.toString() ?? '0') ?? 0.0,
      slaComplianceRate: int.tryParse(json['sla_compliance_rate']?.toString() ?? '100') ?? 100,
    );
  }
}
