import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/reviews/models/review_model.dart';

class ReviewRepository {
  final ApiClient _apiClient;

  ReviewRepository(this._apiClient);

  Future<List<ReviewCycleModel>> getCycles() async {
    try {
      final response = await _apiClient.dio.get('/pms/reviews/cycles');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => ReviewCycleModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load review cycles');
    }
  }

  Future<Map<String, dynamic>> getMyReviews() async {
    try {
      final response = await _apiClient.dio.get('/pms/reviews/my');
      final dynamic data = response.data is Map && response.data['data'] != null
          ? response.data['data']
          : response.data;

      final List<dynamic> evals = data['evaluations'] as List? ?? [];
      final List<dynamic> pending = data['pending_requests'] as List? ?? [];
      final List<dynamic> completed = data['completed_requests'] as List? ?? [];

      return {
        'evaluations': evals
            .map((e) => EmployeeReviewModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        'pending_requests': pending
            .map((e) => ReviewFeedbackModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        'completed_requests': completed
            .map((e) => ReviewFeedbackModel.fromJson(e as Map<String, dynamic>))
            .toList(),
      };
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load personal reviews');
    }
  }

  Future<List<EmployeeReviewModel>> getEmployeeReviews({String? cycleId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (cycleId != null && cycleId.isNotEmpty) {
        queryParams['cycleId'] = cycleId;
      }

      final response = await _apiClient.dio.get(
        '/pms/reviews/employees',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => EmployeeReviewModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load employee reviews');
    }
  }

  Future<List<PipModel>> getPips() async {
    try {
      final response = await _apiClient.dio.get('/pms/reviews/pips');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => PipModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load PIPs');
    }
  }

  Future<ReviewAnalyticsModel> getAnalytics() async {
    try {
      final response = await _apiClient.dio.get('/pms/reviews/analytics');
      final dynamic data = response.data is Map && response.data['data'] != null
          ? response.data['data']
          : response.data;

      return ReviewAnalyticsModel.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load review analytics');
    }
  }

  Future<void> submitFeedback(String feedbackId, double rating, String comments) async {
    try {
      await _apiClient.dio.post(
        '/pms/reviews/feedbacks/$feedbackId/submit',
        data: {
          'overall_rating': rating,
          'general_feedback': comments,
        },
      );
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to submit feedback');
    }
  }
}
