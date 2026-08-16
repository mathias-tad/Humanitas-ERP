class LoanModel {
  final String id;
  final String? loanType;
  final String? description;
  final double totalAmount;
  final double monthlyDeduction;
  final double remainingBalance;
  final int startMonth;
  final int startYear;
  final int termMonths;
  final String status; // pending | active | completed | rejected | frozen
  final String? approvalStatus;
  final int currentStep;
  final String? createdAt;
  final List<Map<String, dynamic>> approvalHistory;

  LoanModel({
    required this.id,
    this.loanType,
    this.description,
    required this.totalAmount,
    required this.monthlyDeduction,
    required this.remainingBalance,
    required this.startMonth,
    required this.startYear,
    required this.termMonths,
    required this.status,
    this.approvalStatus,
    this.currentStep = 1,
    this.createdAt,
    this.approvalHistory = const [],
  });

  bool get isPending => status == 'pending';
  bool get isActive => status == 'active';
  bool get isCompleted => status == 'completed';
  bool get isRejected => status == 'rejected';

  String get startPeriodLabel => '$startMonth/$startYear';

  factory LoanModel.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> parseList(dynamic raw) {
      if (raw is List) return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      return [];
    }

    return LoanModel(
      id: json['id']?.toString() ?? '',
      loanType: json['loan_type']?.toString(),
      description: json['description']?.toString(),
      totalAmount: _toDouble(json['total_amount']),
      monthlyDeduction: _toDouble(json['monthly_deduction']),
      remainingBalance: _toDouble(json['remaining_balance']),
      startMonth: _toInt(json['start_month']),
      startYear: _toInt(json['start_year']),
      termMonths: _toInt(json['term_months']),
      status: json['status']?.toString() ?? 'pending',
      approvalStatus: json['approval_status']?.toString(),
      currentStep: _toInt(json['current_step'] ?? 1),
      createdAt: json['created_at']?.toString(),
      approvalHistory: parseList(json['approval_history']),
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }

  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    return int.tryParse(v.toString()) ?? 0;
  }
}
