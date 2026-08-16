class LeaveRequestModel {
  final String id;
  final String leaveTypeName;
  final String startDate;
  final String endDate;
  final double totalDays;
  final String status;
  final String? reason;
  final String? createdAt;

  LeaveRequestModel({
    required this.id,
    required this.leaveTypeName,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.status,
    this.reason,
    this.createdAt,
  });

  factory LeaveRequestModel.fromJson(Map<String, dynamic> json) {
    return LeaveRequestModel(
      id: json['id']?.toString() ?? '',
      leaveTypeName: json['leave_type']?['name'] ?? json['leave_type_name'] ?? 'Leave',
      startDate: json['start_date'] ?? json['from_date'] ?? '',
      endDate: json['end_date'] ?? json['to_date'] ?? '',
      totalDays: double.tryParse((json['total_days'] ?? json['days'] ?? 1).toString()) ?? 1.0,
      status: json['status'] ?? 'pending',
      reason: json['reason'],
      createdAt: json['created_at']?.toString(),
    );
  }
}
