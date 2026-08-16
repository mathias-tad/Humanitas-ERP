import '../../../core/api/api_client.dart';
import '../../../core/models/overtime_model.dart';

class OvertimeRepository {
  final ApiClient _apiClient;
  OvertimeRepository(this._apiClient);

  Future<List<OvertimeModel>> getOvertimeRecords() async {
    try {
      final res = await _apiClient.dio.get('/overtime');
      final data = res.data;
      if (data is List) {
        return data
            .map((e) => OvertimeModel.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>> getPeriodStatus() async {
    try {
      final res = await _apiClient.dio.get('/overtime/period-status');
      if (res.data is Map) return Map<String, dynamic>.from(res.data as Map);
      return {};
    } catch (_) {
      return {};
    }
  }
}
