import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/job_model.dart';
import '../repositories/recruitment_repository.dart';

final recruitmentRepositoryProvider = Provider<RecruitmentRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return RecruitmentRepository(client);
});

final recruitmentJobsProvider = FutureProvider<List<JobPostingModel>>((ref) async {
  final repo = ref.watch(recruitmentRepositoryProvider);
  return repo.getJobs();
});

final recruitmentApplicationsProvider = FutureProvider<List<CandidateApplicationModel>>((ref) async {
  final repo = ref.watch(recruitmentRepositoryProvider);
  return repo.getApplications();
});
