class AttendanceRecordModel {
  final String id;
  final String userId;
  final String date;
  final String? clockInTime;
  final String? clockOutTime;
  final String status;
  final double? workHours;
  final String? deviceId;

  AttendanceRecordModel({
    required this.id,
    required this.userId,
    required this.date,
    this.clockInTime,
    this.clockOutTime,
    required this.status,
    this.workHours,
    this.deviceId,
  });

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordModel(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      date: json['date'] ?? '',
      clockInTime: json['clock_in_time'] ?? json['clockInTime'],
      clockOutTime: json['clock_out_time'] ?? json['clockOutTime'],
      status: json['status'] ?? 'present',
      workHours: (json['work_hours'] ?? json['total_hours']) != null
          ? double.tryParse((json['work_hours'] ?? json['total_hours']).toString())
          : null,
      deviceId: json['device_id']?.toString(),
    );
  }
}
