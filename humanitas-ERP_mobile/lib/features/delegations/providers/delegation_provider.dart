import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/delegation_model.dart';
import '../repositories/delegation_repository.dart';

final delegationRepositoryProvider = Provider<DelegationRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return DelegationRepository(apiClient);
});

final myDelegationsProvider =
    FutureProvider.autoDispose<Map<String, List<UserDelegationModel>>>((ref) async {
  return ref.watch(delegationRepositoryProvider).getMyDelegations();
});

final activeDelegationsProvider =
    FutureProvider.autoDispose<List<UserDelegationModel>>((ref) async {
  return ref.watch(delegationRepositoryProvider).getActiveDelegations();
});

final delegationAuditLogsProvider =
    FutureProvider.autoDispose<List<DelegationAuditModel>>((ref) async {
  return ref.watch(delegationRepositoryProvider).getAuditLogs();
});
