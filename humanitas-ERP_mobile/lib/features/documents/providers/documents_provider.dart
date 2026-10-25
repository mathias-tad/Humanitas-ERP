import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/documents/models/document_model.dart';
import 'package:humanitas_erp_mobile/features/documents/repositories/documents_repository.dart';

final documentsRepositoryProvider = Provider<DocumentsRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return DocumentsRepository(apiClient);
});

final documentsListProvider = FutureProvider.autoDispose<List<EmployeeDocumentModel>>((ref) async {
  final repo = ref.watch(documentsRepositoryProvider);
  return repo.getDocuments();
});

final expiringSummaryProvider = FutureProvider.autoDispose<ExpiringDocumentsSummaryModel>((ref) async {
  final repo = ref.watch(documentsRepositoryProvider);
  return repo.getExpiringSummary();
});
