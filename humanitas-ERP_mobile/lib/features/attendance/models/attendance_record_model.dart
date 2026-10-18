class AttendanceRecordModel {
  final String id;
  final String userId;
  final String date;
  final String? clockInTime;
  final String? clockOutTime;
  final String status;
  final double? workHours;
  final String? deviceId;
  final String? clockMethod;
  final String? deviceName;
  // Admin-facing fields (null for personal records)
  final String? employeeName;
  final String? employeeId;

  AttendanceRecordModel({
    required this.id,
    required this.userId,
    required this.date,
    this.clockInTime,
    this.clockOutTime,
    required this.status,
    this.workHours,
    this.deviceId,
    this.clockMethod,
    this.deviceName,
    this.employeeName,
    this.employeeId,
  });

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordModel(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      date: json['date'] ?? '',
      clockInTime: json['actual_in'] ?? json['clock_in_time'] ?? json['clockInTime'],
      clockOutTime: json['actual_out'] ?? json['clock_out_time'] ?? json['clockOutTime'],
      status: json['status'] ?? 'present',
      workHours: (json['work_hours'] ?? json['total_hours']) != null
          ? double.tryParse((json['work_hours'] ?? json['total_hours']).toString())
          : null,
      deviceId: json['device_id']?.toString(),
      clockMethod: json['clock_method']?.toString(),
      deviceName: json['device_name']?.toString(),
      employeeName: json['employee_name']?.toString() ?? json['employeeName']?.toString(),
      employeeId: json['employee_id']?.toString() ?? json['employeeId']?.toString(),
    );
  }
}
