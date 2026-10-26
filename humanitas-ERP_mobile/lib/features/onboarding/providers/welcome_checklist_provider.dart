import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';

/// Fetches the welcome checklist for a given user.
/// Parameterized by userId.
final welcomeChecklistProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
        (ref, userId) async {
  final client = ref.watch(apiClientProvider);
  final response =
      await client.dio.get('/hrms/onboarding/welcome/$userId');
  final data = response.data;
  return data is Map<String, dynamic> ? data : <String, dynamic>{};
});
