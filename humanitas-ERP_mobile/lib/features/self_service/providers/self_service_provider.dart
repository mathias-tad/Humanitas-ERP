import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/self_service/models/self_service_model.dart';
import 'package:humanitas_erp_mobile/features/self_service/repositories/self_service_repository.dart';

final selfServiceRepositoryProvider = Provider<SelfServiceRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return SelfServiceRepository(apiClient);
});

final selfServiceDashboardProvider =
    FutureProvider.autoDispose<SelfServiceDashboardModel>((ref) async {
  final repo = ref.watch(selfServiceRepositoryProvider);
  return repo.getDashboard();
});
