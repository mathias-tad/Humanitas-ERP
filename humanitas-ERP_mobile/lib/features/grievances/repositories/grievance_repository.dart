import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/grievances/models/grievance_model.dart';

class GrievanceRepository {
  final ApiClient _apiClient;

  GrievanceRepository(this._apiClient);

  Future<List<GrievanceModel>> getGrievances({String? status, String? category}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null && status.isNotEmpty && status != 'all') {
        queryParams['status'] = status;
      }
      if (category != null && category.isNotEmpty && category != 'all') {
        queryParams['category'] = category;
      }

      final response = await _apiClient.dio.get(
        '/hrms/grievances',
        queryParameters: queryParams,
      );

      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => GrievanceModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load grievances');
    }
  }

  Future<GrievanceModel> getGrievanceById(String id) async {
    try {
      final response = await _apiClient.dio.get('/hrms/grievances/$id');
      final dynamic data = response.data;
      final Map<String, dynamic> item = data is Map<String, dynamic> && data.containsKey('data')
          ? data['data'] as Map<String, dynamic>
          : data as Map<String, dynamic>;
      return GrievanceModel.fromJson(item);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load grievance details');
    }
  }

  Future<GrievanceStatsModel> getStats() async {
    try {
      final response = await _apiClient.dio.get('/hrms/grievances/reports/stats');
      final dynamic data = response.data;
      final Map<String, dynamic> item = data is Map<String, dynamic> && data.containsKey('data')
          ? data['data'] as Map<String, dynamic>
          : data as Map<String, dynamic>;
      return GrievanceStatsModel.fromJson(item);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load grievance stats');
    }
  }

  Future<GrievanceModel> fileGrievance({
    required String category,
    required String subject,
    required String description,
    String priority = 'medium',
    bool isAnonymous = false,
    String? incidentDate,
    String? incidentLocation,
    String? accusedParties,
    String? witnesses,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/hrms/grievances',
        data: {
          'category': category,
          'subject': subject,
          'description': description,
          'priority': priority,
          'is_anonymous': isAnonymous,
          if (incidentDate != null) 'incident_date': incidentDate,
          if (incidentLocation != null) 'incident_location': incidentLocation,
          if (accusedParties != null) 'accused_parties': accusedParties,
          if (witnesses != null) 'witnesses': witnesses,
        },
      );
      final dynamic data = response.data;
      final Map<String, dynamic> item = data is Map<String, dynamic> && data.containsKey('data')
          ? data['data'] as Map<String, dynamic>
          : data as Map<String, dynamic>;
      return GrievanceModel.fromJson(item);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to file grievance');
    }
  }
}
