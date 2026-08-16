import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/task_model.dart';
import '../../../core/models/project_model.dart';
import '../../../core/providers/providers.dart';
import '../repositories/pms_repository.dart';

final pmsRepositoryProvider = Provider<PmsRepository>((ref) {
  return PmsRepository(ref.watch(apiClientProvider));
});

final pmsTasksProvider =
    StateNotifierProvider<PmsTasksNotifier, AsyncValue<List<TaskModel>>>((ref) {
  return PmsTasksNotifier(ref.watch(pmsRepositoryProvider));
});

class PmsTasksNotifier extends StateNotifier<AsyncValue<List<TaskModel>>> {
  final PmsRepository _repo;
  PmsTasksNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch({String? status, String? projectId}) async {
    state = const AsyncValue.loading();
    try {
      final list = await _repo.getTasks(status: status, projectId: projectId);
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final pmsProjectsProvider = FutureProvider<List<ProjectModel>>((ref) async {
  return ref.watch(pmsRepositoryProvider).getProjects();
});
