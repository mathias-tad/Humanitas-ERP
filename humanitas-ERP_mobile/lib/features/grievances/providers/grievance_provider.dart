import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/grievances/models/grievance_model.dart';
import 'package:humanitas_erp_mobile/features/grievances/repositories/grievance_repository.dart';

final grievanceRepositoryProvider = Provider<GrievanceRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return GrievanceRepository(apiClient);
});

final grievancesListProvider =
    FutureProvider.autoDispose<List<GrievanceModel>>((ref) async {
  final repo = ref.watch(grievanceRepositoryProvider);
  return repo.getGrievances();
});

final grievanceStatsProvider =
    FutureProvider.autoDispose<GrievanceStatsModel>((ref) async {
  final repo = ref.watch(grievanceRepositoryProvider);
  return repo.getStats();
});
