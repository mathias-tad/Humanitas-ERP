import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/leave_balance_model.dart';
import '../models/leave_request_model.dart';
import '../models/leave_type_model.dart';
import '../repositories/leave_repository.dart';

final leaveRepositoryProvider = Provider<LeaveRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return LeaveRepository(apiClient);
});

final leaveTypesProvider = FutureProvider<List<LeaveTypeModel>>((ref) async {
  final repo = ref.watch(leaveRepositoryProvider);
  return await repo.getLeaveTypes();
});

final myLeaveBalancesProvider = FutureProvider<List<LeaveBalanceModel>>((ref) async {
  final repo = ref.watch(leaveRepositoryProvider);
  return await repo.getMyBalances();
});

final myLeaveRequestsProvider = FutureProvider<List<LeaveRequestModel>>((ref) async {
  final repo = ref.watch(leaveRepositoryProvider);
  return await repo.getMyRequests();
});
