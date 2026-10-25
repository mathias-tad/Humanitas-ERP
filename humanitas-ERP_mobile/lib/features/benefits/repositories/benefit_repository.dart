import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/benefits/models/benefit_model.dart';

class BenefitRepository {
  final ApiClient _apiClient;

  BenefitRepository(this._apiClient);

  Future<List<BenefitPlanModel>> getPlans() async {
    try {
      final response = await _apiClient.dio.get('/hrms/benefits/plans');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => BenefitPlanModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load benefit plans');
    }
  }

  Future<List<BenefitEnrollmentModel>> getEnrollments({String? userId, String? status}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (userId != null && userId.isNotEmpty) queryParams['userId'] = userId;
      if (status != null && status.isNotEmpty) queryParams['status'] = status;

      final response = await _apiClient.dio.get(
        '/hrms/benefits/enrollments',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => BenefitEnrollmentModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load benefit enrollments');
    }
  }

  Future<List<BenefitEnrollmentModel>> getMyEnrollments() async {
    try {
      final response = await _apiClient.dio.get('/hrms/benefits/my-enrollments');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => BenefitEnrollmentModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load my benefits');
    }
  }

  Future<BenefitStatsModel> getStats() async {
    try {
      final response = await _apiClient.dio.get('/hrms/benefits/stats');
      final dynamic data = response.data;
      final Map<String, dynamic> item = data is Map<String, dynamic> && data.containsKey('data')
          ? data['data'] as Map<String, dynamic>
          : (data is Map<String, dynamic> ? data : <String, dynamic>{});

      return BenefitStatsModel.fromJson(item);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load benefit stats');
    }
  }

  Future<BenefitEnrollmentModel> enrollEmployee({
    required String userId,
    required String planId,
    String coverageTier = 'employee_only',
    String? effectiveDate,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/hrms/benefits/enroll',
        data: {
          'user_id': userId,
          'plan_id': planId,
          'coverage_tier': coverageTier,
          if (effectiveDate != null) 'effective_date': effectiveDate,
        },
      );
      final dynamic data = response.data;
      final Map<String, dynamic> item = data is Map<String, dynamic> && data.containsKey('data')
          ? data['data'] as Map<String, dynamic>
          : data as Map<String, dynamic>;

      return BenefitEnrollmentModel.fromJson(item);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to enroll in benefit');
    }
  }
}
