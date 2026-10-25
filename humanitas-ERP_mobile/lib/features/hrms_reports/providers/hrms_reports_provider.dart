import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/hrms_summary_model.dart';
import '../repositories/hrms_reports_repository.dart';

final hrmsReportsRepositoryProvider = Provider<HrmsReportsRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return HrmsReportsRepository(apiClient: apiClient);
});

final hrmsSummaryProvider = FutureProvider.autoDispose<HrmsSummaryModel>((ref) async {
  final repo = ref.watch(hrmsReportsRepositoryProvider);
  return repo.getSummary();
});

final hrmsHeadcountProvider = FutureProvider.autoDispose<HeadcountDemographicsModel>((ref) async {
  final repo = ref.watch(hrmsReportsRepositoryProvider);
  return repo.getHeadcount();
});
