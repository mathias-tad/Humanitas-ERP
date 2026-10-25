import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/approval_model.dart';
import '../repositories/approval_repository.dart';

final approvalRepositoryProvider = Provider<ApprovalRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return ApprovalRepository(apiClient);
});

final pendingApprovalsProvider =
    FutureProvider.autoDispose<List<ApprovalRequestModel>>((ref) async {
  return ref
      .watch(approvalRepositoryProvider)
      .getRequests(status: 'pending', myPending: true);
});

final mySubmittedApprovalsProvider =
    FutureProvider.autoDispose<List<ApprovalRequestModel>>((ref) async {
  return ref.watch(approvalRepositoryProvider).getRequests(myPending: false);
});

final allApprovalsHistoryProvider =
    FutureProvider.autoDispose<List<ApprovalRequestModel>>((ref) async {
  return ref.watch(approvalRepositoryProvider).getRequests(status: 'history');
});

final myPendingApprovalsCountProvider =
    FutureProvider.autoDispose<int>((ref) async {
  return ref.watch(approvalRepositoryProvider).getMyPendingCount();
});

final approvalRequestDetailProvider = FutureProvider.autoDispose
    .family<ApprovalRequestDetailModel, String>((ref, id) async {
  return ref.watch(approvalRepositoryProvider).getRequestDetail(id);
});
