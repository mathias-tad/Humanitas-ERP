import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/documents/models/document_model.dart';

class DocumentsRepository {
  final ApiClient _apiClient;

  DocumentsRepository(this._apiClient);

  Future<List<EmployeeDocumentModel>> getDocuments({
    String? category,
    String? verificationStatus,
    String? expiringWithinDays,
    String? search,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (category != null && category.isNotEmpty && category != 'all') {
        queryParams['category'] = category;
      }
      if (verificationStatus != null && verificationStatus.isNotEmpty && verificationStatus != 'all') {
        queryParams['verificationStatus'] = verificationStatus;
      }
      if (expiringWithinDays != null && expiringWithinDays.isNotEmpty && expiringWithinDays != 'all') {
        queryParams['expiringWithinDays'] = expiringWithinDays;
      }
      if (search != null && search.isNotEmpty) {
        queryParams['search'] = search;
      }

      final response = await _apiClient.dio.get(
        '/hrms/documents',
        queryParameters: queryParams,
      );

      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items.map((e) => EmployeeDocumentModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load documents');
    }
  }

  Future<ExpiringDocumentsSummaryModel> getExpiringSummary() async {
    try {
      final response = await _apiClient.dio.get('/hrms/documents/expirations');
      final dynamic data = response.data;
      final Map<String, dynamic> map = data is Map<String, dynamic>
          ? (data['data'] is Map<String, dynamic> ? data['data'] : data)
          : {};
      return ExpiringDocumentsSummaryModel.fromJson(map);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load expiration summary');
    }
  }
}
