import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../models/stock_models.dart';

class InventoryApiException implements Exception {
  final String message;
  const InventoryApiException(this.message);
  @override
  String toString() => message;
}

/// Inventory API (tenant backend). The company/branch switcher's headers go with every call.
class InventoryRepository {
  final ApiClient _apiClient;
  InventoryRepository(this._apiClient);

  Dio get _dio => _apiClient.dio;

  Future<T> _call<T>(Future<T> Function() run, String fallback) async {
    try {
      return await run();
    } on DioException catch (e) {
      final data = e.response?.data;
      var message = fallback;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        message = m is List ? m.join('\n') : m.toString();
      } else if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
        message = 'No connection to the server. Check your internet and try again.';
      }
      throw InventoryApiException(message);
    }
  }

  Future<StockPage> stock({String? search, String? productId, int page = 1}) => _call(() async {
        final res = await _dio.get('/inventory/stock', queryParameters: {
          if (search != null && search.isNotEmpty) 'search': search,
          'product_id': ?productId,
          'in_stock_only': true,
          'page': page,
          'limit': 40,
        });
        return StockPage.fromJson(res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : {});
      }, 'Could not load the stock');

  /// +quantity adds stock at the location, -quantity removes it; the reason is kept in the history.
  Future<void> adjust({required String productId, required String locationId, String? lotId, required double quantity, required String reason}) =>
      _call(() async {
        await _dio.post('/inventory/stock/adjust', data: {
          'product_id': productId,
          'location_id': locationId,
          'lot_id': ?lotId,
          'quantity': quantity,
          'reason': reason,
        });
      }, 'Could not adjust the stock');
}
