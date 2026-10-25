import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/onboarding/models/onboarding_model.dart';

class OnboardingRepository {
  final ApiClient _apiClient;

  OnboardingRepository(this._apiClient);

  Future<List<OnboardingInstanceModel>> getOnboardings({
    String? status,
    String? department,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null && status.isNotEmpty && status != 'all') {
        queryParams['status'] = status;
      }
      if (department != null && department.isNotEmpty && department != 'all') {
        queryParams['department'] = department;
      }

      final response = await _apiClient.dio.get(
        '/hrms/onboarding/instances',
        queryParameters: queryParams,
      );

      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) =>
              OnboardingInstanceModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to load onboarding list');
    }
  }

  Future<OnboardingInstanceModel> getOnboardingById(String id) async {
    try {
      final response =
          await _apiClient.dio.get('/hrms/onboarding/instances/$id');
      final dynamic data = response.data;
      final Map<String, dynamic> map = data is Map<String, dynamic>
          ? (data['data'] is Map<String, dynamic> ? data['data'] : data)
          : {};
      return OnboardingInstanceModel.fromJson(map);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ??
          'Failed to load onboarding details');
    }
  }

  Future<OnboardingStatsModel> getStats() async {
    try {
      final response = await _apiClient.dio.get('/hrms/onboarding/stats');
      final dynamic data = response.data;
      final Map<String, dynamic> map = data is Map<String, dynamic>
          ? (data['data'] is Map<String, dynamic> ? data['data'] : data)
          : {};
      return OnboardingStatsModel.fromJson(map);
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to load onboarding stats');
    }
  }

  Future<void> updateTask(
    String taskId, {
    required String status,
    String? notes,
  }) async {
    try {
      await _apiClient.dio.put(
        '/hrms/onboarding/tasks/$taskId',
        data: {
          'status': status,
          if (notes != null) 'notes': notes,
        },
      );
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to update task');
    }
  }
}
