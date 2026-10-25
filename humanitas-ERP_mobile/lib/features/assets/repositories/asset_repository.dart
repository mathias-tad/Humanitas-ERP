import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/assets/models/asset_model.dart';

class AssetRepository {
  final ApiClient _apiClient;

  AssetRepository(this._apiClient);

  Future<List<AssetCategoryModel>> getCategories() async {
    try {
      final response = await _apiClient.dio.get('/hrms/assets/categories');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => AssetCategoryModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load asset categories');
    }
  }

  Future<List<CompanyAssetModel>> getAssets({String? status, String? categoryId, String? search}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null && status.isNotEmpty && status != 'all') queryParams['status'] = status;
      if (categoryId != null && categoryId.isNotEmpty && categoryId != 'all') queryParams['category_id'] = categoryId;
      if (search != null && search.isNotEmpty) queryParams['search'] = search;

      final response = await _apiClient.dio.get('/hrms/assets', queryParameters: queryParams);
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => CompanyAssetModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load company assets');
    }
  }

  Future<List<CompanyAssetModel>> getMyAssets() async {
    try {
      final response = await _apiClient.dio.get('/hrms/assets/my-assets');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => CompanyAssetModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load my assets');
    }
  }

  Future<AssetAnalyticsModel> getAnalytics() async {
    try {
      final response = await _apiClient.dio.get('/hrms/assets/analytics');
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? data
          : (data is Map && data['data'] is Map ? data['data'] as Map<String, dynamic> : {});
      return AssetAnalyticsModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load asset analytics');
    }
  }

  Future<void> acknowledgeAsset(String assignmentId) async {
    try {
      await _apiClient.dio.post('/hrms/assets/assignments/$assignmentId/acknowledge');
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to acknowledge custody');
    }
  }

  Future<void> createAsset({
    required String name,
    required String categoryId,
    String? model,
    String? serialNumber,
    double? cost,
  }) async {
    try {
      await _apiClient.dio.post('/hrms/assets', data: {
        'name': name,
        'category_id': categoryId,
        if (model != null) 'model': model,
        if (serialNumber != null) 'serial_number': serialNumber,
        if (cost != null) 'purchase_cost': cost,
      });
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to create asset');
    }
  }
}
