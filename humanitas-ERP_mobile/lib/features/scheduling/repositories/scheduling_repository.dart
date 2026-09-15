import '../../../core/api/api_client.dart';
import '../models/shift_model.dart';

class SchedulingRepository {
  final ApiClient _apiClient;

  SchedulingRepository(this._apiClient);

  Future<List<ShiftModel>> getShifts() async {
    try {
      final response = await _apiClient.dio.get('/scheduling/shifts');
      final data = response.data;
      if (data is List) {
        return data.map((e) => ShiftModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<UserScheduleItem>> getUserSchedule(String userId, {String? startDate, String? endDate}) async {
    try {
      final query = <String, dynamic>{};
      if (startDate != null) query['startDate'] = startDate;
      if (endDate != null) query['endDate'] = endDate;

      final response = await _apiClient.dio.get(
        '/scheduling/user-schedule/$userId',
        queryParameters: query,
      );
      final data = response.data;
      if (data is List) {
        return data.map((e) => UserScheduleItem.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}
