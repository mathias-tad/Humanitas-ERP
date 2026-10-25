import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/import_export/models/import_export_model.dart';
import 'package:humanitas_erp_mobile/features/import_export/repositories/import_export_repository.dart';

final importExportRepositoryProvider = Provider<ImportExportRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return ImportExportRepository(apiClient);
});

final importExportStatsProvider = FutureProvider.autoDispose<ImportExportStatsModel>((ref) async {
  return ref.watch(importExportRepositoryProvider).getStats();
});

final importExportJobsProvider = FutureProvider.autoDispose<List<ImportExportJobModel>>((ref) async {
  return ref.watch(importExportRepositoryProvider).getJobs();
});

final exportTemplatesProvider = FutureProvider.autoDispose<List<ExportTemplateModel>>((ref) async {
  return ref.watch(importExportRepositoryProvider).getExportTemplates();
});
