class ApprovalRequestModel {
  final String id;
  final String workflowType;
  final String entityType;
  final String referenceNumber;
  final String title;
  final double? amount;
  final String currency;
  final String submitterName;
  final String submitterEmail;
  final String department;
  final int currentStepOrder;
  final int totalSteps;
  final String status;
  final DateTime createdAt;

  const ApprovalRequestModel({
    required this.id,
    required this.workflowType,
    required this.entityType,
    required this.referenceNumber,
    required this.title,
    this.amount,
    this.currency = 'USD',
    required this.submitterName,
    required this.submitterEmail,
    required this.department,
    required this.currentStepOrder,
    required this.totalSteps,
    required this.status,
    required this.createdAt,
  });

  bool get isPending => status.toLowerCase() == 'pending';
  bool get isApproved => status.toLowerCase() == 'approved';
  bool get isRejected => status.toLowerCase() == 'rejected';

  String get formattedAmount {
    if (amount == null) return '';
    final symbol = currency == 'USD'
        ? '\$'
        : (currency == 'EUR'
            ? '€'
            : (currency == 'GBP' ? '£' : '$currency '));
    return '$symbol${amount!.toStringAsFixed(2)}';
  }

  factory ApprovalRequestModel.fromJson(Map<String, dynamic> json) {
    return ApprovalRequestModel(
      id: json['id']?.toString() ?? '',
      workflowType: json['workflow_type']?.toString() ??
          json['workflowType']?.toString() ??
          '',
      entityType: json['entity_type']?.toString() ??
          json['entityType']?.toString() ??
          '',
      referenceNumber: json['reference_number']?.toString() ??
          json['referenceNumber']?.toString() ??
          '',
      title: json['title']?.toString() ?? '',
      amount: num.tryParse(json['amount']?.toString() ?? '')?.toDouble(),
      currency: json['currency']?.toString() ?? 'USD',
      submitterName: json['submitter_name']?.toString() ??
          json['submitterName']?.toString() ??
          (json['submitter'] is Map ? json['submitter']['name']?.toString() ?? '' : ''),
      submitterEmail: json['submitter_email']?.toString() ??
          json['submitterEmail']?.toString() ??
          (json['submitter'] is Map ? json['submitter']['email']?.toString() ?? '' : ''),
      department: json['department']?.toString() ?? '',
      currentStepOrder: (json['current_step_order'] ?? json['currentStepOrder'] ?? 1) is int
          ? (json['current_step_order'] ?? json['currentStepOrder'] ?? 1)
          : int.tryParse(json['current_step_order']?.toString() ?? '1') ?? 1,
      totalSteps: (json['total_steps'] ?? json['totalSteps'] ?? 1) is int
          ? (json['total_steps'] ?? json['totalSteps'] ?? 1)
          : int.tryParse(json['total_steps']?.toString() ?? '1') ?? 1,
      status: json['status']?.toString() ?? 'pending',
      createdAt: DateTime.tryParse(
              json['created_at']?.toString() ?? json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'workflow_type': workflowType,
      'entity_type': entityType,
      'reference_number': referenceNumber,
      'title': title,
      if (amount != null) 'amount': amount,
      'currency': currency,
      'submitter_name': submitterName,
      'submitter_email': submitterEmail,
      'department': department,
      'current_step_order': currentStepOrder,
      'total_steps': totalSteps,
      'status': status,
      'created_at': createdAt.toIso8601String(),
    };
  }

  ApprovalRequestModel copyWith({
    String? id,
    String? workflowType,
    String? entityType,
    String? referenceNumber,
    String? title,
    double? amount,
    String? currency,
    String? submitterName,
    String? submitterEmail,
    String? department,
    int? currentStepOrder,
    int? totalSteps,
    String? status,
    DateTime? createdAt,
  }) {
    return ApprovalRequestModel(
      id: id ?? this.id,
      workflowType: workflowType ?? this.workflowType,
      entityType: entityType ?? this.entityType,
      referenceNumber: referenceNumber ?? this.referenceNumber,
      title: title ?? this.title,
      amount: amount ?? this.amount,
      currency: currency ?? this.currency,
      submitterName: submitterName ?? this.submitterName,
      submitterEmail: submitterEmail ?? this.submitterEmail,
      department: department ?? this.department,
      currentStepOrder: currentStepOrder ?? this.currentStepOrder,
      totalSteps: totalSteps ?? this.totalSteps,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class ApprovalActionModel {
  final String id;
  final int stepOrder;
  final String approverName;
  final String approverRole;
  final String action; // 'approved', 'rejected'
  final String? comments;
  final DateTime createdAt;

  const ApprovalActionModel({
    required this.id,
    required this.stepOrder,
    required this.approverName,
    required this.approverRole,
    required this.action,
    this.comments,
    required this.createdAt,
  });

  bool get isApproved => action.toLowerCase() == 'approved';
  bool get isRejected => action.toLowerCase() == 'rejected';

  factory ApprovalActionModel.fromJson(Map<String, dynamic> json) {
    return ApprovalActionModel(
      id: json['id']?.toString() ?? '',
      stepOrder: (json['step_order'] ?? json['stepOrder'] ?? 1) is int
          ? (json['step_order'] ?? json['stepOrder'] ?? 1)
          : int.tryParse(json['step_order']?.toString() ?? '1') ?? 1,
      approverName: json['approver_name']?.toString() ??
          json['approverName']?.toString() ??
          (json['approver'] is Map ? json['approver']['name']?.toString() ?? '' : ''),
      approverRole: json['approver_role']?.toString() ??
          json['approverRole']?.toString() ??
          '',
      action: json['action']?.toString() ?? '',
      comments: json['comments']?.toString() ?? json['comment']?.toString(),
      createdAt: DateTime.tryParse(
              json['created_at']?.toString() ?? json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'step_order': stepOrder,
      'approver_name': approverName,
      'approver_role': approverRole,
      'action': action,
      if (comments != null) 'comments': comments,
      'created_at': createdAt.toIso8601String(),
    };
  }
}

class ApprovalStepModel {
  final String id;
  final int stepOrder;
  final String name;
  final String? approverRole;
  final String? approverName;
  final String status; // 'pending', 'approved', 'rejected', 'skipped'

  const ApprovalStepModel({
    required this.id,
    required this.stepOrder,
    required this.name,
    this.approverRole,
    this.approverName,
    required this.status,
  });

  factory ApprovalStepModel.fromJson(Map<String, dynamic> json) {
    return ApprovalStepModel(
      id: json['id']?.toString() ?? '',
      stepOrder: (json['step_order'] ?? json['stepOrder'] ?? 1) is int
          ? (json['step_order'] ?? json['stepOrder'] ?? 1)
          : int.tryParse(json['step_order']?.toString() ?? '1') ?? 1,
      name: json['name']?.toString() ?? json['title']?.toString() ?? 'Step',
      approverRole: json['approver_role']?.toString() ?? json['approverRole']?.toString(),
      approverName: json['approver_name']?.toString() ?? json['approverName']?.toString(),
      status: json['status']?.toString() ?? 'pending',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'step_order': stepOrder,
      'name': name,
      if (approverRole != null) 'approver_role': approverRole,
      if (approverName != null) 'approver_name': approverName,
      'status': status,
    };
  }
}

class ApprovalRequestDetailModel {
  final ApprovalRequestModel request;
  final List<ApprovalActionModel> actions;
  final List<ApprovalStepModel> steps;

  const ApprovalRequestDetailModel({
    required this.request,
    this.actions = const [],
    this.steps = const [],
  });

  factory ApprovalRequestDetailModel.fromJson(Map<String, dynamic> json) {
    final reqJson = json['request'] is Map<String, dynamic>
        ? json['request'] as Map<String, dynamic>
        : json;
    final actionsList = json['actions'] is List
        ? (json['actions'] as List)
        : (json['audit_trail'] is List
            ? (json['audit_trail'] as List)
            : (json['history'] is List ? (json['history'] as List) : []));
    final stepsList = json['steps'] is List ? (json['steps'] as List) : [];

    return ApprovalRequestDetailModel(
      request: ApprovalRequestModel.fromJson(reqJson),
      actions: actionsList
          .map((e) => ApprovalActionModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      steps: stepsList
          .map((e) => ApprovalStepModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'request': request.toJson(),
      'actions': actions.map((e) => e.toJson()).toList(),
      'steps': steps.map((e) => e.toJson()).toList(),
    };
  }
}
