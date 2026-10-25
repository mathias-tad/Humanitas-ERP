import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/recruitment_models.dart';
import '../repositories/recruitment_repository.dart';

final recruitmentRepositoryProvider = Provider<RecruitmentRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return RecruitmentRepository(client);
});

final recruitmentJobsProvider = FutureProvider<List<JobPostModel>>((ref) async {
  final repo = ref.watch(recruitmentRepositoryProvider);
  return repo.getJobs();
});

final selectedJobFilterProvider = StateProvider<String?>((ref) => null);

final recruitmentApplicationsProvider = FutureProvider<List<CandidateApplicationModel>>((ref) async {
  final repo = ref.watch(recruitmentRepositoryProvider);
  final selectedJobId = ref.watch(selectedJobFilterProvider);
  return repo.getApplications(selectedJobId);
});

final recruitmentInterviewsProvider = FutureProvider<List<InterviewModel>>((ref) async {
  final repo = ref.watch(recruitmentRepositoryProvider);
  return repo.getInterviews();
});

final recruitmentOffersProvider = FutureProvider<List<OfferLetterModel>>((ref) async {
  final repo = ref.watch(recruitmentRepositoryProvider);
  return repo.getOffers();
});

final recruitmentFunnelProvider = FutureProvider<RecruitmentFunnelModel>((ref) async {
  final repo = ref.watch(recruitmentRepositoryProvider);
  return repo.getFunnelReport();
});

// Alias for analytics
final recruitmentAnalyticsProvider = recruitmentFunnelProvider;
