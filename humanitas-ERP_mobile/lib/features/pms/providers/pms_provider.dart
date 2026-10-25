import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/task_model.dart';
import '../../../core/models/project_model.dart';
import '../../../core/providers/providers.dart';
import '../models/pms_agile_model.dart';
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

// ── Agile Providers ────────────────────────────────────────────────────────

final pmsBacklogProvider =
    FutureProvider.autoDispose.family<List<TaskModel>, String>((ref, projectId) async {
  if (projectId.isEmpty) return [];
  return ref.watch(pmsRepositoryProvider).getProjectBacklog(projectId);
});

final pmsSprintsProvider =
    FutureProvider.autoDispose.family<List<SprintModel>, String>((ref, projectId) async {
  if (projectId.isEmpty) return [];
  return ref.watch(pmsRepositoryProvider).getSprints(projectId);
});

final pmsBurndownProvider =
    FutureProvider.autoDispose.family<SprintBurndownModel, String>((ref, sprintId) async {
  if (sprintId.isEmpty) {
    return const SprintBurndownModel(sprintId: '', sprintName: '', totalPoints: 0, days: []);
  }
  return ref.watch(pmsRepositoryProvider).getSprintBurndown(sprintId);
});

final pmsVelocityProvider =
    FutureProvider.autoDispose.family<SprintVelocityModel, String>((ref, projectId) async {
  if (projectId.isEmpty) return const SprintVelocityModel(averageVelocity: 0, sprints: []);
  return ref.watch(pmsRepositoryProvider).getSprintVelocity(projectId);
});

final pmsGanttProvider =
    FutureProvider.autoDispose.family<List<GanttTaskModel>, String>((ref, projectId) async {
  if (projectId.isEmpty) return [];
  return ref.watch(pmsRepositoryProvider).getProjectGantt(projectId);
});

final pmsCalendarProvider =
    FutureProvider.autoDispose.family<List<ProjectCalendarEventModel>, String>((ref, projectId) async {
  if (projectId.isEmpty) return [];
  return ref.watch(pmsRepositoryProvider).getProjectCalendar(projectId);
});

final pmsTimeSummaryProvider =
    FutureProvider.autoDispose.family<TimeTrackingSummaryModel, String>((ref, projectId) async {
  if (projectId.isEmpty) {
    return const TimeTrackingSummaryModel(
      totalHours: 0,
      billableHours: 0,
      nonBillableHours: 0,
      billableRatio: 0,
      totalBillableRevenue: 0,
      members: [],
    );
  }
  return ref.watch(pmsRepositoryProvider).getTimeSummary(projectId);
});
