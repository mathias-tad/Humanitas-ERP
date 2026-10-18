import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';

final adminPayrollRunsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, ({int month, int year})>(
  (ref, arg) async {
    try {
      final res = await ref.watch(apiClientProvider).dio.get(
        '/payroll/runs',
        queryParameters: {'month': arg.month, 'year': arg.year},
      );
      final data = res.data;
      if (data is List) {
        return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  },
);
