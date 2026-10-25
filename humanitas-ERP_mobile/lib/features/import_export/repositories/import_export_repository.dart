import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/import_export/models/import_export_model.dart';

class ImportExportRepository {
  final ApiClient _apiClient;

  ImportExportRepository(this._apiClient);

  Future<ImportExportStatsModel> getStats() async {
    try {
      final response = await _apiClient.dio.get('/hrms/import-export/stats');
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? (data['data'] is Map ? data['data'] as Map<String, dynamic> : data)
          : <String, dynamic>{};
      return ImportExportStatsModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load import/export stats');
    }
  }

  Future<List<ImportExportJobModel>> getJobs({int limit = 50}) async {
    try {
      final response = await _apiClient.dio.get(
        '/hrms/import-export/jobs',
        queryParameters: {'limit': limit},
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => ImportExportJobModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load audit jobs');
    }
  }

  Future<List<ExportTemplateModel>> getExportTemplates() async {
    try {
      final response = await _apiClient.dio.get('/hrms/import-export/export-templates');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => ExportTemplateModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load export recipes');
    }
  }

  Future<void> rollbackJob(String jobId) async {
    try {
      await _apiClient.dio.post('/hrms/import-export/rollback/$jobId');
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to rollback import batch');
    }
  }
}
