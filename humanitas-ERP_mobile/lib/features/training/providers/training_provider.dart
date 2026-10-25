import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/training/models/training_model.dart';
import 'package:humanitas_erp_mobile/features/training/repositories/training_repository.dart';

final trainingRepositoryProvider = Provider<TrainingRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return TrainingRepository(apiClient);
});

final trainingCoursesProvider =
    FutureProvider.autoDispose<List<TrainingCourseModel>>((ref) async {
  final repo = ref.watch(trainingRepositoryProvider);
  return repo.getCourses();
});

final trainingSessionsProvider =
    FutureProvider.autoDispose<List<TrainingSessionModel>>((ref) async {
  final repo = ref.watch(trainingRepositoryProvider);
  return repo.getSessions();
});

final trainingEnrollmentsProvider =
    FutureProvider.autoDispose<List<TrainingEnrollmentModel>>((ref) async {
  final repo = ref.watch(trainingRepositoryProvider);
  return repo.getEnrollments();
});

final myTrainingEnrollmentsProvider =
    FutureProvider.autoDispose<List<TrainingEnrollmentModel>>((ref) async {
  final repo = ref.watch(trainingRepositoryProvider);
  return repo.getMyEnrollments();
});

final trainingStatsProvider =
    FutureProvider.autoDispose<TrainingStatsModel>((ref) async {
  final repo = ref.watch(trainingRepositoryProvider);
  return repo.getStats();
});
