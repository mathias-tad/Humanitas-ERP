class LeaveBalanceModel {
  final String leaveTypeId;
  final String leaveTypeName;
  final double allocated;
  final double used;
  final double remaining;

  LeaveBalanceModel({
    required this.leaveTypeId,
    required this.leaveTypeName,
    required this.allocated,
    required this.used,
    required this.remaining,
  });

  factory LeaveBalanceModel.fromJson(Map<String, dynamic> json) {
    return LeaveBalanceModel(
      leaveTypeId: json['leave_type_id']?.toString() ?? json['type_id']?.toString() ?? '',
      leaveTypeName: json['leave_type_name'] ?? json['type_name'] ?? json['name'] ?? 'Leave',
      allocated: double.tryParse((json['allocated'] ?? json['total_days'] ?? 0).toString()) ?? 0.0,
      used: double.tryParse((json['used'] ?? json['used_days'] ?? 0).toString()) ?? 0.0,
      remaining: double.tryParse((json['remaining'] ?? json['balance'] ?? 0).toString()) ?? 0.0,
    );
  }
}
