import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';

// Provider family parameterized by number of days
final notificationDeliveryStatsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, days) async {
  final client = ref.watch(apiClientProvider);
  final response =
      await client.dio.get('/notifications/reports/delivery-stats?days=$days');
  final data = response.data;
  return data is Map<String, dynamic> ? data : <String, dynamic>{};
});

final notificationPreferenceDistributionProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final response =
      await client.dio.get('/notifications/reports/preference-distribution');
  final data = response.data;
  return data is Map<String, dynamic> ? data : <String, dynamic>{};
});
