import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/training/models/training_model.dart';

class TrainingRepository {
  final ApiClient _apiClient;

  TrainingRepository(this._apiClient);

  Future<List<TrainingCourseModel>> getCourses({String? category, bool? isMandatory}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (category != null && category.isNotEmpty && category != 'all') {
        queryParams['category'] = category;
      }
      if (isMandatory != null) {
        queryParams['is_mandatory'] = isMandatory.toString();
      }

      final response = await _apiClient.dio.get(
        '/hrms/training/courses',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => TrainingCourseModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load training courses');
    }
  }

  Future<List<TrainingSessionModel>> getSessions({String? courseId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (courseId != null && courseId.isNotEmpty) {
        queryParams['course_id'] = courseId;
      }

      final response = await _apiClient.dio.get(
        '/hrms/training/sessions',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => TrainingSessionModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load sessions');
    }
  }

  Future<List<TrainingEnrollmentModel>> getEnrollments() async {
    try {
      final response = await _apiClient.dio.get('/hrms/training/enrollments');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => TrainingEnrollmentModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load enrollments');
    }
  }

  Future<List<TrainingEnrollmentModel>> getMyEnrollments() async {
    try {
      final response = await _apiClient.dio.get('/hrms/training/my-enrollments');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => TrainingEnrollmentModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load my enrollments');
    }
  }

  Future<TrainingStatsModel> getStats() async {
    try {
      final response = await _apiClient.dio.get('/hrms/training/stats');
      final dynamic data = response.data;
      final Map<String, dynamic> item = data is Map<String, dynamic> && data.containsKey('data')
          ? data['data'] as Map<String, dynamic>
          : (data is Map<String, dynamic> ? data : <String, dynamic>{});

      return TrainingStatsModel.fromJson(item);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load training stats');
    }
  }

  Future<TrainingEnrollmentModel> enrollLearner({
    required String courseId,
    String? sessionId,
    String? userId,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/hrms/training/enrollments',
        data: {
          'course_id': courseId,
          if (sessionId != null) 'session_id': sessionId,
          if (userId != null) 'user_id': userId,
        },
      );
      final dynamic data = response.data;
      final Map<String, dynamic> item = data is Map<String, dynamic> && data.containsKey('data')
          ? data['data'] as Map<String, dynamic>
          : data as Map<String, dynamic>;

      return TrainingEnrollmentModel.fromJson(item);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to enroll in training');
    }
  }
}
