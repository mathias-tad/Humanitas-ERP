import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';

/// Fetches AI settings from GET /ai/settings
final aiSettingsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final response = await client.dio.get('/ai/settings');
  final data = response.data;
  return data is Map<String, dynamic> ? data : <String, dynamic>{};
});
