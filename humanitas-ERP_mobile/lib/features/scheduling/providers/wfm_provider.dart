import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/api_client_provider.dart';
import '../models/wfm_opportunity_model.dart';
import '../repositories/wfm_repository.dart';

final wfmRepositoryProvider = Provider<WfmRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return WfmRepository(apiClient);
});

final wfmOpportunitiesProvider = FutureProvider.autoDispose.family<List<WfmOpportunityModel>, String>((ref, type) async {
  final repo = ref.watch(wfmRepositoryProvider);
  return repo.getOpportunities(type: type);
});

final myWfmClaimsProvider = FutureProvider.autoDispose<List<WfmClaimModel>>((ref) async {
  final repo = ref.watch(wfmRepositoryProvider);
  return repo.getMyClaims();
});

final wfmSettingsProvider = FutureProvider.autoDispose<WfmSettingsModel>((ref) async {
  final repo = ref.watch(wfmRepositoryProvider);
  return repo.getSettings();
});
