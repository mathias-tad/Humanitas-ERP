import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/surveys/models/survey_model.dart';

class SurveyRepository {
  final ApiClient _apiClient;

  SurveyRepository(this._apiClient);

  Future<List<SurveyModel>> getSurveys({String? status}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null && status.isNotEmpty && status != 'all') {
        queryParams['status'] = status;
      }
      final response = await _apiClient.dio.get(
        '/hrms/surveys',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => SurveyModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load surveys');
    }
  }

  Future<SurveyModel> getSurveyById(String id) async {
    try {
      final response = await _apiClient.dio.get('/hrms/surveys/$id');
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? (data['data'] is Map ? data['data'] as Map<String, dynamic> : data)
          : <String, dynamic>{};
      return SurveyModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load survey details');
    }
  }

  Future<SurveyAnalyticsModel> getAnalytics() async {
    try {
      final response = await _apiClient.dio.get('/hrms/surveys/analytics');
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? (data['data'] is Map ? data['data'] as Map<String, dynamic> : data)
          : <String, dynamic>{};
      return SurveyAnalyticsModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load survey analytics');
    }
  }

  Future<List<SurveyActionItemModel>> getActionItems({String? surveyId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (surveyId != null && surveyId.isNotEmpty) {
        queryParams['survey_id'] = surveyId;
      }
      final response = await _apiClient.dio.get(
        '/hrms/surveys/actions',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => SurveyActionItemModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load survey actions');
    }
  }

  Future<void> submitResponse({
    required String surveyId,
    required List<Map<String, dynamic>> answers,
  }) async {
    try {
      await _apiClient.dio.post('/hrms/surveys/respond', data: {
        'survey_id': surveyId,
        'answers': answers,
      });
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to submit survey response');
    }
  }
}
