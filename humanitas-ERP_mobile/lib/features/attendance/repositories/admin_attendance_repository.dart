import '../../../core/api/api_client.dart';
import '../models/attendance_record_model.dart';

class AdminAttendanceRepository {
  final ApiClient _apiClient;
  AdminAttendanceRepository(this._apiClient);

  Future<List<AttendanceRecordModel>> getAllRecords({int? month, int? year}) async {
    final params = <String, dynamic>{};
    if (month != null) params['month'] = month;
    if (year != null) params['year'] = year;
    final res = await _apiClient.dio.get(
      '/attendance/records',
      queryParameters: params.isEmpty ? null : params,
    );
    if (res.data is List) {
      return (res.data as List)
          .map((e) => AttendanceRecordModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }
}
