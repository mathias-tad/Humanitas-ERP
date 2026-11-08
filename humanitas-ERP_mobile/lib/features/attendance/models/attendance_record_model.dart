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
  // Biometric debouncing & shift lifecycle enhancements
  final String? missedPunchType; // 'missed_in' | 'missed_out' | null
  final bool isOvernight;
  final double? overtimeHours;
  final String? autoClosedAt;
  final String? autoCloseReason;
  final String? correctionStatus;

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
    this.missedPunchType,
    this.isOvernight = false,
    this.overtimeHours,
    this.autoClosedAt,
    this.autoCloseReason,
    this.correctionStatus,
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
      missedPunchType: json['missed_punch_type']?.toString(),
      isOvernight: json['is_overnight'] == true || json['is_overnight'] == 1,
      overtimeHours: json['overtime_hours'] != null
          ? double.tryParse(json['overtime_hours'].toString())
          : null,
      autoClosedAt: json['auto_closed_at']?.toString(),
      autoCloseReason: json['auto_close_reason']?.toString(),
      correctionStatus: json['correction_status']?.toString(),
    );
  }
}
