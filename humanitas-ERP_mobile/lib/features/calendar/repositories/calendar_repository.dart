import '../../../core/api/api_client.dart';
import '../models/calendar_day_model.dart';

class CalendarRepository {
  final ApiClient _apiClient;

  CalendarRepository(this._apiClient);

  Future<List<CalendarAttendanceItem>> getMyMonthlyAttendance(int month, int year) async {
    try {
      final response = await _apiClient.dio.get(
        '/attendance/my-monthly-calendar',
        queryParameters: {'month': month, 'year': year},
      );
      final data = response.data;
      if (data is List) {
        return data.map((e) => CalendarAttendanceItem.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<CalendarHolidayItem>> getHolidays(int year) async {
    try {
      final response = await _apiClient.dio.get(
        '/holidays',
        queryParameters: {'year': year},
      );
      final data = response.data;
      if (data is List) {
        return data.map((e) => CalendarHolidayItem.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<MonthlyCalendarData> getMonthlyCalendarData(int month, int year) async {
    final results = await Future.wait([
      getMyMonthlyAttendance(month, year),
      getHolidays(year),
    ]);

    return MonthlyCalendarData(
      month: month,
      year: year,
      attendance: results[0] as List<CalendarAttendanceItem>,
      holidays: results[1] as List<CalendarHolidayItem>,
    );
  }
}
