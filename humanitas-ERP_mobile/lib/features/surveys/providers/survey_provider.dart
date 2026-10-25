import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/surveys/models/survey_model.dart';
import 'package:humanitas_erp_mobile/features/surveys/repositories/survey_repository.dart';

final surveyRepositoryProvider = Provider<SurveyRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return SurveyRepository(apiClient);
});

final activeSurveysProvider = FutureProvider.autoDispose<List<SurveyModel>>((ref) async {
  return ref.watch(surveyRepositoryProvider).getSurveys(status: 'active');
});

final allSurveysProvider = FutureProvider.autoDispose<List<SurveyModel>>((ref) async {
  return ref.watch(surveyRepositoryProvider).getSurveys();
});

final surveyAnalyticsProvider = FutureProvider.autoDispose<SurveyAnalyticsModel>((ref) async {
  return ref.watch(surveyRepositoryProvider).getAnalytics();
});

final surveyActionItemsProvider = FutureProvider.autoDispose<List<SurveyActionItemModel>>((ref) async {
  return ref.watch(surveyRepositoryProvider).getActionItems();
});
