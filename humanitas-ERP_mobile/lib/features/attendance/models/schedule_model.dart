class ScheduleModel {
  final String? shiftName;
  final String? startTime;
  final String? endTime;
  final bool isClockInEligible;
  final String? message;

  ScheduleModel({
    this.shiftName,
    this.startTime,
    this.endTime,
    this.isClockInEligible = true,
    this.message,
  });

  factory ScheduleModel.fromJson(Map<String, dynamic> json) {
    return ScheduleModel(
      shiftName: json['shift_name'] ?? json['shift']?['name'] ?? 'Default Shift',
      startTime: json['start_time'] ?? json['shift']?['start_time'] ?? '09:00',
      endTime: json['end_time'] ?? json['shift']?['end_time'] ?? '17:00',
      isClockInEligible: json['is_eligible'] ?? json['eligible'] ?? true,
      message: json['message'],
    );
  }
}
