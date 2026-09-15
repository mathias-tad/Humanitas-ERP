class ShiftModel {
  final String id;
  final String name;
  final String startTime;
  final String endTime;
  final String? color;
  final int breakMinutes;
  final bool isNightShift;
  final String? notes;

  const ShiftModel({
    required this.id,
    required this.name,
    required this.startTime,
    required this.endTime,
    this.color,
    this.breakMinutes = 0,
    this.isNightShift = false,
    this.notes,
  });

  factory ShiftModel.fromJson(Map<String, dynamic> json) {
    return ShiftModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Standard Shift',
      startTime: json['start_time']?.toString() ?? json['startTime']?.toString() ?? '09:00',
      endTime: json['end_time']?.toString() ?? json['endTime']?.toString() ?? '17:00',
      color: json['color']?.toString(),
      breakMinutes: (json['break_minutes'] ?? json['breakMinutes'] ?? 0) as int,
      isNightShift: json['is_night_shift'] == true || json['isNightShift'] == true,
      notes: json['notes']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'start_time': startTime,
    'end_time': endTime,
    'color': color,
    'break_minutes': breakMinutes,
    'is_night_shift': isNightShift,
    'notes': notes,
  };
}

class UserScheduleItem {
  final String date;
  final String dayOfWeek;
  final ShiftModel? shift;
  final bool isOffDay;

  const UserScheduleItem({
    required this.date,
    required this.dayOfWeek,
    this.shift,
    this.isOffDay = false,
  });

  factory UserScheduleItem.fromJson(Map<String, dynamic> json) {
    return UserScheduleItem(
      date: json['date']?.toString() ?? '',
      dayOfWeek: json['day_of_week']?.toString() ?? json['dayOfWeek']?.toString() ?? '',
      shift: json['shift'] != null ? ShiftModel.fromJson(json['shift'] as Map<String, dynamic>) : null,
      isOffDay: json['is_off_day'] == true || json['isOffDay'] == true,
    );
  }
}
