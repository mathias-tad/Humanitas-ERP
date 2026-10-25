import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/onboarding/models/onboarding_model.dart';
import 'package:humanitas_erp_mobile/features/onboarding/repositories/onboarding_repository.dart';

final onboardingRepositoryProvider = Provider<OnboardingRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return OnboardingRepository(apiClient);
});

final onboardingsListProvider =
    FutureProvider.autoDispose<List<OnboardingInstanceModel>>((ref) async {
  final repo = ref.watch(onboardingRepositoryProvider);
  return repo.getOnboardings();
});

final onboardingStatsProvider =
    FutureProvider.autoDispose<OnboardingStatsModel>((ref) async {
  final repo = ref.watch(onboardingRepositoryProvider);
  return repo.getStats();
});
