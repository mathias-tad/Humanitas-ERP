import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/overtime_model.dart';
import '../../../core/providers/providers.dart';
import '../repositories/overtime_repository.dart';

final overtimeRepositoryProvider = Provider<OvertimeRepository>((ref) {
  return OvertimeRepository(ref.watch(apiClientProvider));
});

final overtimeRecordsProvider =
    StateNotifierProvider<OvertimeNotifier, AsyncValue<List<OvertimeModel>>>((ref) {
  return OvertimeNotifier(ref.watch(overtimeRepositoryProvider));
});

class OvertimeNotifier extends StateNotifier<AsyncValue<List<OvertimeModel>>> {
  final OvertimeRepository _repo;
  OvertimeNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repo.getOvertimeRecords();
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final overtimePeriodStatusProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(overtimeRepositoryProvider).getPeriodStatus();
});
