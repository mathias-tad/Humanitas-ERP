import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/self_service/models/self_service_model.dart';

class SelfServiceRepository {
  final ApiClient _apiClient;

  SelfServiceRepository(this._apiClient);

  Future<SelfServiceDashboardModel> getDashboard() async {
    try {
      final response = await _apiClient.dio.get('/self-service/dashboard');
      final dynamic data = response.data;
      final Map<String, dynamic> map = data is Map<String, dynamic>
          ? (data['data'] is Map<String, dynamic> ? data['data'] : data)
          : {};
      return SelfServiceDashboardModel.fromJson(map);
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to load self-service dashboard');
    }
  }

  Future<void> submitChangeRequest({
    required String fieldName,
    required String proposedValue,
    String? reason,
  }) async {
    try {
      await _apiClient.dio.post(
        '/self-service/change-request',
        data: {
          'field_name': fieldName,
          'proposed_value': proposedValue,
          if (reason != null) 'reason': reason,
        },
      );
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to submit change request');
    }
  }
}
