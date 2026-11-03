class UserDelegationModel {
  final String id;
  final String delegatorId;
  final String delegateeId;
  final String? delegatorName;
  final String? delegatorEmail;
  final String? delegateeName;
  final String? delegateeEmail;
  final DateTime startDate;
  final DateTime endDate;
  final String scope;
  final String? reason;
  final String status;
  final DateTime? createdAt;

  // HR Acting Assignment & Allowance Extension
  final bool isActingAssignment;
  final String? actingPositionTitle;
  final String? actingAllowanceType;
  final double? actingAllowancePercentage;
  final double? actingAllowanceAmount;
  final String? actingNotes;

  UserDelegationModel({
    required this.id,
    required this.delegatorId,
    required this.delegateeId,
    this.delegatorName,
    this.delegatorEmail,
    this.delegateeName,
    this.delegateeEmail,
    required this.startDate,
    required this.endDate,
    required this.scope,
    this.reason,
    required this.status,
    this.createdAt,
    this.isActingAssignment = false,
    this.actingPositionTitle,
    this.actingAllowanceType,
    this.actingAllowancePercentage,
    this.actingAllowanceAmount,
    this.actingNotes,
  });

  factory UserDelegationModel.fromJson(Map<String, dynamic> json) {
    final delegatorFirst = json['delegator_first_name']?.toString() ?? '';
    final delegatorLast = json['delegator_last_name']?.toString() ?? '';
    final delegatorComposite = [delegatorFirst, delegatorLast].where((s) => s.isNotEmpty).join(' ');

    final delegateeFirst = json['delegatee_first_name']?.toString() ?? '';
    final delegateeLast = json['delegatee_last_name']?.toString() ?? '';
    final delegateeComposite = [delegateeFirst, delegateeLast].where((s) => s.isNotEmpty).join(' ');

    return UserDelegationModel(
      id: json['id']?.toString() ?? '',
      delegatorId: json['delegator_id']?.toString() ?? '',
      delegateeId: json['delegatee_id']?.toString() ?? '',
      delegatorName: json['delegator_name']?.toString() ?? (delegatorComposite.isNotEmpty ? delegatorComposite : json['delegator']?['full_name']),
      delegatorEmail: json['delegator_email']?.toString() ?? json['delegator']?['email'],
      delegateeName: json['delegatee_name']?.toString() ?? (delegateeComposite.isNotEmpty ? delegateeComposite : json['delegatee']?['full_name']),
      delegateeEmail: json['delegatee_email']?.toString() ?? json['delegatee']?['email'],
      startDate: DateTime.tryParse(json['start_date']?.toString() ?? '') ?? DateTime.now(),
      endDate: DateTime.tryParse(json['end_date']?.toString() ?? '') ?? DateTime.now(),
      scope: json['scope']?.toString() ?? 'ALL',
      reason: json['reason']?.toString(),
      status: json['status']?.toString() ?? 'active',
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'].toString()) : null,
      isActingAssignment: json['is_acting_assignment'] == true,
      actingPositionTitle: json['acting_position_title']?.toString(),
      actingAllowanceType: json['acting_allowance_type']?.toString() ?? 'percentage',
      actingAllowancePercentage: json['acting_allowance_percentage'] != null
          ? double.tryParse(json['acting_allowance_percentage'].toString())
          : null,
      actingAllowanceAmount: json['acting_allowance_amount'] != null
          ? double.tryParse(json['acting_allowance_amount'].toString())
          : null,
      actingNotes: json['acting_notes']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'delegator_id': delegatorId,
      'delegatee_id': delegateeId,
      'start_date': startDate.toIso8601String(),
      'end_date': endDate.toIso8601String(),
      'scope': scope,
      'reason': reason,
      'status': status,
      'is_acting_assignment': isActingAssignment,
      'acting_position_title': actingPositionTitle,
      'acting_allowance_type': actingAllowanceType,
      'acting_allowance_percentage': actingAllowancePercentage,
      'acting_allowance_amount': actingAllowanceAmount,
      'acting_notes': actingNotes,
    };
  }

  bool get isActive {
    if (status.toLowerCase() != 'active') return false;
    final now = DateTime.now();
    return now.isAfter(startDate) && now.isBefore(endDate);
  }
}

class DelegationAuditModel {
  final String id;
  final String? delegationId;
  final String performedBy;
  final String onBehalfOf;
  final String? performedByName;
  final String? onBehalfOfName;
  final String action;
  final String? endpoint;
  final bool isActingAssignment;
  final String? actingPositionTitle;
  final DateTime createdAt;

  DelegationAuditModel({
    required this.id,
    this.delegationId,
    required this.performedBy,
    required this.onBehalfOf,
    this.performedByName,
    this.onBehalfOfName,
    required this.action,
    this.endpoint,
    this.isActingAssignment = false,
    this.actingPositionTitle,
    required this.createdAt,
  });

  factory DelegationAuditModel.fromJson(Map<String, dynamic> json) {
    return DelegationAuditModel(
      id: json['id']?.toString() ?? '',
      delegationId: json['delegation_id']?.toString(),
      performedBy: json['performed_by']?.toString() ?? '',
      onBehalfOf: json['on_behalf_of']?.toString() ?? '',
      performedByName: json['performed_by_name']?.toString() ??
          [json['performed_by_first_name'], json['performed_by_last_name']]
              .where((s) => s != null && s.toString().isNotEmpty)
              .join(' '),
      onBehalfOfName: json['on_behalf_of_name']?.toString() ??
          [json['on_behalf_of_first_name'], json['on_behalf_of_last_name']]
              .where((s) => s != null && s.toString().isNotEmpty)
              .join(' '),
      action: json['action']?.toString() ?? '',
      endpoint: json['endpoint']?.toString() ?? json['resource']?.toString(),
      isActingAssignment: json['is_acting_assignment'] == true,
      actingPositionTitle: json['acting_position_title']?.toString(),
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}
