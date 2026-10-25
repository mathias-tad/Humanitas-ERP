import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/expenses/models/expense_model.dart';

class ExpenseRepository {
  final ApiClient _apiClient;

  ExpenseRepository(this._apiClient);

  Future<List<ExpenseCategoryModel>> getCategories() async {
    try {
      final response = await _apiClient.dio.get('/hrms/expenses/categories');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => ExpenseCategoryModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load categories');
    }
  }

  Future<List<ExpenseReportModel>> getMyReports() async {
    try {
      final response = await _apiClient.dio.get('/hrms/expenses/my-reports');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => ExpenseReportModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load my reports');
    }
  }

  Future<List<ExpenseReportModel>> getReports({String? status}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null && status.isNotEmpty && status != 'all') {
        queryParams['status'] = status;
      }
      final response = await _apiClient.dio.get(
        '/hrms/expenses/reports',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => ExpenseReportModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load reports');
    }
  }

  Future<ExpenseAnalyticsModel> getAnalytics() async {
    try {
      final response = await _apiClient.dio.get('/hrms/expenses/analytics');
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? data
          : (data is Map && data['data'] is Map
              ? data['data'] as Map<String, dynamic>
              : <String, dynamic>{});
      return ExpenseAnalyticsModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load analytics');
    }
  }

  Future<void> createReport({required String title, String? notes}) async {
    try {
      await _apiClient.dio.post('/hrms/expenses/reports', data: {
        'title': title,
        if (notes != null) 'notes': notes,
      });
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to create report');
    }
  }

  Future<void> submitReport(String reportId) async {
    try {
      await _apiClient.dio.post('/hrms/expenses/reports/$reportId/submit');
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to submit report');
    }
  }
}
