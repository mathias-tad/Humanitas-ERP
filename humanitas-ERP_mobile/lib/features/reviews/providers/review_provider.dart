import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/reviews/models/review_model.dart';
import 'package:humanitas_erp_mobile/features/reviews/repositories/review_repository.dart';

final reviewRepositoryProvider = Provider<ReviewRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return ReviewRepository(apiClient);
});

final reviewCyclesProvider = FutureProvider<List<ReviewCycleModel>>((ref) async {
  final repo = ref.watch(reviewRepositoryProvider);
  return repo.getCycles();
});

final myReviewsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.watch(reviewRepositoryProvider);
  return repo.getMyReviews();
});

final employeeReviewsProvider = FutureProvider<List<EmployeeReviewModel>>((ref) async {
  final repo = ref.watch(reviewRepositoryProvider);
  return repo.getEmployeeReviews();
});

final pipsProvider = FutureProvider<List<PipModel>>((ref) async {
  final repo = ref.watch(reviewRepositoryProvider);
  return repo.getPips();
});

final reviewAnalyticsProvider = FutureProvider<ReviewAnalyticsModel>((ref) async {
  final repo = ref.watch(reviewRepositoryProvider);
  return repo.getAnalytics();
});
