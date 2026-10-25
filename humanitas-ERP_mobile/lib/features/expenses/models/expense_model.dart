class ExpenseCategoryModel {
  final String id;
  final String name;
  final String? description;
  final double? spendingLimit;
  final bool requiresReceipt;

  const ExpenseCategoryModel({
    required this.id,
    required this.name,
    this.description,
    this.spendingLimit,
    this.requiresReceipt = true,
  });

  factory ExpenseCategoryModel.fromJson(Map<String, dynamic> json) {
    return ExpenseCategoryModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString(),
      spendingLimit: json['spending_limit'] != null
          ? double.tryParse(json['spending_limit'].toString())
          : null,
      requiresReceipt: json['requires_receipt'] == true || json['requires_receipt'] == 1,
    );
  }
}

class ExpenseItemModel {
  final String id;
  final String reportId;
  final String categoryId;
  final String? categoryName;
  final String description;
  final double amount;
  final String currency;
  final String? receiptUrl;
  final bool policyViolation;

  const ExpenseItemModel({
    required this.id,
    required this.reportId,
    required this.categoryId,
    this.categoryName,
    required this.description,
    required this.amount,
    this.currency = 'USD',
    this.receiptUrl,
    this.policyViolation = false,
  });

  factory ExpenseItemModel.fromJson(Map<String, dynamic> json) {
    return ExpenseItemModel(
      id: json['id']?.toString() ?? '',
      reportId: json['report_id']?.toString() ?? '',
      categoryId: json['category_id']?.toString() ?? '',
      categoryName: json['category_name']?.toString(),
      description: json['description']?.toString() ?? '',
      amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      currency: json['currency']?.toString() ?? 'USD',
      receiptUrl: json['receipt_url']?.toString(),
      policyViolation: json['policy_violation'] == true || json['policy_violation'] == 1,
    );
  }
}

class ExpenseReportModel {
  final String id;
  final String reportNumber;
  final String? userId;
  final String? firstName;
  final String? lastName;
  final String? department;
  final String title;
  final String status;
  final double totalAmount;
  final String currency;
  final String? submittedAt;
  final String? approvedAt;
  final String? rejectedAt;
  final String? approverNotes;
  final bool includeInPayroll;
  final List<ExpenseItemModel> items;

  const ExpenseReportModel({
    required this.id,
    required this.reportNumber,
    this.userId,
    this.firstName,
    this.lastName,
    this.department,
    required this.title,
    required this.status,
    required this.totalAmount,
    this.currency = 'USD',
    this.submittedAt,
    this.approvedAt,
    this.rejectedAt,
    this.approverNotes,
    this.includeInPayroll = false,
    this.items = const [],
  });

  String get employeeName => [firstName, lastName].where((s) => s != null && s.isNotEmpty).join(' ');

  factory ExpenseReportModel.fromJson(Map<String, dynamic> json) {
    final itemsData = json['items'] as List<dynamic>? ?? [];
    return ExpenseReportModel(
      id: json['id']?.toString() ?? '',
      reportNumber: json['report_number']?.toString() ?? '',
      userId: json['user_id']?.toString(),
      firstName: json['first_name']?.toString(),
      lastName: json['last_name']?.toString(),
      department: json['department']?.toString(),
      title: json['title']?.toString() ?? 'Expense Report',
      status: json['status']?.toString() ?? 'draft',
      totalAmount: double.tryParse(json['total_amount']?.toString() ?? '0') ?? 0.0,
      currency: json['currency']?.toString() ?? 'USD',
      submittedAt: json['submitted_at']?.toString(),
      approvedAt: json['approved_at']?.toString(),
      rejectedAt: json['rejected_at']?.toString(),
      approverNotes: json['approver_notes']?.toString(),
      includeInPayroll: json['include_in_payroll'] == true || json['include_in_payroll'] == 1,
      items: itemsData.map((e) => ExpenseItemModel.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class ExpenseAnalyticsModel {
  final double totalSubmitted;
  final double totalApproved;
  final double totalPending;
  final int reportCount;
  final int pendingApprovals;
  final List<Map<String, dynamic>> categoryBreakdown;

  const ExpenseAnalyticsModel({
    required this.totalSubmitted,
    required this.totalApproved,
    required this.totalPending,
    required this.reportCount,
    required this.pendingApprovals,
    required this.categoryBreakdown,
  });

  factory ExpenseAnalyticsModel.fromJson(Map<String, dynamic> json) {
    return ExpenseAnalyticsModel(
      totalSubmitted: double.tryParse(json['total_submitted']?.toString() ?? '0') ?? 0.0,
      totalApproved: double.tryParse(json['total_approved']?.toString() ?? '0') ?? 0.0,
      totalPending: double.tryParse(json['total_pending']?.toString() ?? '0') ?? 0.0,
      reportCount: int.tryParse(json['report_count']?.toString() ?? '0') ?? 0,
      pendingApprovals: int.tryParse(json['pending_approvals']?.toString() ?? '0') ?? 0,
      categoryBreakdown: (json['category_breakdown'] as List<dynamic>? ?? [])
          .map((e) => e as Map<String, dynamic>)
          .toList(),
    );
  }
}
