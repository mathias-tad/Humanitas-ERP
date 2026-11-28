import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../models/stocktake_models.dart';
import 'inventory_repository.dart' show InventoryApiException;

/// Stocktake API (/inventory/counts). The company/branch switcher's headers go with every call.
class StocktakeRepository {
  final ApiClient _apiClient;

  StocktakeRepository(this._apiClient);

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

  Map<String, dynamic> _map(dynamic data) => data is Map<String, dynamic> ? data : <String, dynamic>{};

  /// The counts people can work on: being counted or in review.
  Future<List<Stocktake>> open() => _call(() async {
        final out = <Stocktake>[];
        for (final state in const ['counting', 'review']) {
          final res = await _dio.get('/inventory/counts', queryParameters: {'state': state, 'limit': 50});
          final data = _map(res.data)['data'];
          if (data is List) out.addAll(data.whereType<Map<String, dynamic>>().map(Stocktake.fromJson));
        }
        return out;
      }, 'Could not load the stocktakes');

  Future<Stocktake> get(String id) => _call(() async {
        final res = await _dio.get('/inventory/counts/$id');
        return Stocktake.fromJson(_map(res.data));
      }, 'Could not load the stocktake');

  /// [filter] is null (all), 'uncounted', 'counted', 'variance' or 'unexpected'.
  Future<CountLinePage> lines(String id, {String? filter, String? locationId, String? search, int page = 1}) => _call(() async {
        final res = await _dio.get('/inventory/counts/$id/lines', queryParameters: {
          'filter': ?filter,
          'location_id': ?locationId,
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
          'page': page,
          'limit': 100,
        });
        return CountLinePage.fromJson(_map(res.data));
      }, 'Could not load the count lines');

  Future<CountScanResult> scan(String id, String code, {String? locationId}) => _call(() async {
        final res = await _dio.post('/inventory/counts/$id/scan', data: {'code': code, 'location_id': ?locationId});
        return CountScanResult.fromJson(_map(res.data));
      }, 'Could not count that');

  /// Sets the counted quantity of a line (null clears it).
  Future<CountLine> setCounted(String id, String lineId, double? counted) => _call(() async {
        final res = await _dio.patch('/inventory/counts/$id/lines/$lineId', data: {'counted_qty': counted});
        return CountLine.fromJson(_map(res.data));
      }, 'Could not save the count');

  Future<void> submit(String id) => _call(() async {
        await _dio.post('/inventory/counts/$id/submit');
      }, 'Could not send it for review');
}
