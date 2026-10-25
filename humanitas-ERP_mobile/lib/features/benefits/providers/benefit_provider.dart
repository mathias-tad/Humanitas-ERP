import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/benefits/models/benefit_model.dart';
import 'package:humanitas_erp_mobile/features/benefits/repositories/benefit_repository.dart';

final benefitRepositoryProvider = Provider<BenefitRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return BenefitRepository(apiClient);
});

final benefitPlansProvider =
    FutureProvider.autoDispose<List<BenefitPlanModel>>((ref) async {
  final repo = ref.watch(benefitRepositoryProvider);
  return repo.getPlans();
});

final benefitEnrollmentsProvider =
    FutureProvider.autoDispose<List<BenefitEnrollmentModel>>((ref) async {
  final repo = ref.watch(benefitRepositoryProvider);
  return repo.getEnrollments();
});

final myBenefitEnrollmentsProvider =
    FutureProvider.autoDispose<List<BenefitEnrollmentModel>>((ref) async {
  final repo = ref.watch(benefitRepositoryProvider);
  return repo.getMyEnrollments();
});

final benefitStatsProvider =
    FutureProvider.autoDispose<BenefitStatsModel>((ref) async {
  final repo = ref.watch(benefitRepositoryProvider);
  return repo.getStats();
});
