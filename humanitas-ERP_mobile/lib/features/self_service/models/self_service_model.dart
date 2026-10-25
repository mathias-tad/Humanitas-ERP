class SelfServiceDashboardModel {
  final String userId;
  final String employeeName;
  final String? email;
  final String? position;
  final String? department;
  final int streakDays;
  final int punctualityScore;
  final int pendingLeaveRequests;
  final int pendingProfileRequests;
  final int annualLeaveRemaining;
  final double latestNetPay;
  final String? latestPayPeriod;

  const SelfServiceDashboardModel({
    required this.userId,
    required this.employeeName,
    this.email,
    this.position,
    this.department,
    this.streakDays = 0,
    this.punctualityScore = 100,
    this.pendingLeaveRequests = 0,
    this.pendingProfileRequests = 0,
    this.annualLeaveRemaining = 0,
    this.latestNetPay = 0.0,
    this.latestPayPeriod,
  });

  factory SelfServiceDashboardModel.fromJson(Map<String, dynamic> json) {
    final user = (json['user'] as Map<String, dynamic>?) ?? {};
    final fn = user['first_name'] as String? ?? '';
    final ln = user['last_name'] as String? ?? '';
    final name = '$fn $ln'.trim().isNotEmpty
        ? '$fn $ln'.trim()
        : (user['email'] as String? ?? 'Employee');

    final att = (json['attendance_summary'] as Map<String, dynamic>?) ?? {};
    final pending = (json['pending_requests'] as Map<String, dynamic>?) ?? {};
    final balances = (json['leave_balances'] as List<dynamic>?) ?? [];
    int annualRemaining = 0;
    for (final b in balances) {
      if (b is Map &&
          (b['leave_type']?.toString().toLowerCase().contains('annual') ??
              false)) {
        annualRemaining = (b['remaining_days'] as num?)?.toInt() ?? 0;
        break;
      }
    }

    final latestPs = (json['latest_payslip'] as Map<String, dynamic>?);
    double net = 0.0;
    String? period;
    if (latestPs != null) {
      net = double.tryParse(latestPs['net_pay']?.toString() ?? '0') ?? 0.0;
      period = '${latestPs['month']}/${latestPs['year']}';
    }

    return SelfServiceDashboardModel(
      userId: user['id'] as String? ?? '',
      employeeName: name,
      email: user['email'] as String?,
      position: user['position'] as String?,
      department: user['department'] as String?,
      streakDays: (att['streak'] as num?)?.toInt() ?? 0,
      punctualityScore: (json['punctuality_score'] as num?)?.toInt() ?? 100,
      pendingLeaveRequests: (pending['leave'] as num?)?.toInt() ?? 0,
      pendingProfileRequests: (pending['profile_changes'] as num?)?.toInt() ?? 0,
      annualLeaveRemaining: annualRemaining,
      latestNetPay: net,
      latestPayPeriod: period,
    );
  }
}
