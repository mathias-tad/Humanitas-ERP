class CalendarAttendanceItem {
  final String date;
  final String status;
  final String? actualIn;
  final String? actualOut;
  final String? workHours;
  final String? shiftName;
  final String? shiftColor;
  final String? clockMethod;

  const CalendarAttendanceItem({
    required this.date,
    required this.status,
    this.actualIn,
    this.actualOut,
    this.workHours,
    this.shiftName,
    this.shiftColor,
    this.clockMethod,
  });

  factory CalendarAttendanceItem.fromJson(Map<String, dynamic> json) {
    String? workHoursStr;
    final rawWh = json['work_hours'];
    if (rawWh is Map) {
      final h = rawWh['hours'] ?? 0;
      final m = rawWh['minutes'] ?? 0;
      workHoursStr = '${h}h ${m}m';
    } else if (rawWh != null) {
      workHoursStr = rawWh.toString();
    }

    return CalendarAttendanceItem(
      date: (json['date'] ?? '').toString().split('T')[0],
      status: (json['status'] ?? 'unknown').toString(),
      actualIn: json['actual_in']?.toString() ?? json['clock_in']?.toString(),
      actualOut: json['actual_out']?.toString() ?? json['clock_out']?.toString(),
      workHours: workHoursStr,
      shiftName: json['shift_name']?.toString(),
      shiftColor: json['shift_color']?.toString(),
      clockMethod: json['clock_method']?.toString(),
    );
  }
}

class CalendarHolidayItem {
  final String id;
  final String name;
  final String date;
  final String? type;

  const CalendarHolidayItem({
    required this.id,
    required this.name,
    required this.date,
    this.type,
  });

  factory CalendarHolidayItem.fromJson(Map<String, dynamic> json) {
    return CalendarHolidayItem(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? 'Holiday').toString(),
      date: (json['date'] ?? '').toString().split('T')[0],
      type: json['type']?.toString(),
    );
  }
}

class MonthlyCalendarData {
  final int month;
  final int year;
  final List<CalendarAttendanceItem> attendance;
  final List<CalendarHolidayItem> holidays;

  const MonthlyCalendarData({
    required this.month,
    required this.year,
    required this.attendance,
    required this.holidays,
  });

  int get presentCount => attendance.where((a) => a.status.toLowerCase().contains('present')).length;
  int get absentCount => attendance.where((a) => a.status.toLowerCase().contains('absent')).length;
  int get lateCount => attendance.where((a) => a.status.toLowerCase().contains('late')).length;
  int get holidaysCount => holidays.length;
}
