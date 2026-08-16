import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../models/attendance_record_model.dart';
import '../models/schedule_model.dart';

class AttendanceRepository {
  final ApiClient _apiClient;
  AttendanceRepository(this._apiClient);

  Future<List<AttendanceRecordModel>> getMyRecords({int? month, int? year}) async {
    try {
      final Map<String, dynamic> params = {};
      if (month != null) params['month'] = month;
      if (year != null) params['year'] = year;
      final res = await _apiClient.dio.get(
        ApiConstants.myAttendance,
        queryParameters: params.isEmpty ? null : params,
      );
      if (res.data is List) {
        return (res.data as List)
            .map((item) => AttendanceRecordModel.fromJson(item))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<ScheduleModel> getMySchedule() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.mySchedule);
      return ScheduleModel.fromJson(res.data);
    } catch (_) {
      return ScheduleModel();
    }
  }

  Future<Map<String, dynamic>> clockIn() async {
    final res = await _apiClient.dio.post(ApiConstants.clockIn);
    return Map<String, dynamic>.from(res.data);
  }

  Future<Map<String, dynamic>> clockOut() async {
    final res = await _apiClient.dio.post(ApiConstants.clockOut);
    return Map<String, dynamic>.from(res.data);
  }

  Future<Map<String, dynamic>> secureClockIn({
    required String qrCode,
    required String deviceId,
  }) async {
    final res = await _apiClient.dio.post(
      ApiConstants.secureClockIn,
      data: {
        'qr_code': qrCode,
        'device_id': deviceId,
      },
    );
    return Map<String, dynamic>.from(res.data);
  }

  Future<Map<String, dynamic>> secureClockOut({
    required String qrCode,
    required String deviceId,
  }) async {
    final res = await _apiClient.dio.post(
      ApiConstants.secureClockOut,
      data: {
        'qr_code': qrCode,
        'device_id': deviceId,
      },
    );
    return Map<String, dynamic>.from(res.data);
  }

  Future<void> registerDevice({
    required String deviceId,
    String? deviceName,
    String? deviceType,
  }) async {
    await _apiClient.dio.post(
      ApiConstants.registerDevice,
      data: {
        'device_id': deviceId,
        'device_name': deviceName ?? 'Mobile Phone',
        'device_type': deviceType ?? 'mobile',
      },
    );
  }
}
