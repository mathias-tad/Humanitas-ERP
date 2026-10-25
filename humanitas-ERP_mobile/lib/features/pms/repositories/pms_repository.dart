import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/task_model.dart';
import '../../../core/models/project_model.dart';
import '../models/pms_agile_model.dart';

class PmsRepository {
  final ApiClient _apiClient;
  PmsRepository(this._apiClient);

  Future<List<TaskModel>> getTasks({String? status, String? projectId}) async {
    final res = await _apiClient.dio.get(
      ApiConstants.pmsTasks,
      queryParameters: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (projectId != null && projectId.isNotEmpty) 'projectId': projectId,
      },
    );
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => TaskModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<TaskModel> getTaskDetail(String taskId) async {
    final res = await _apiClient.dio.get('${ApiConstants.pmsTasks}/$taskId');
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return TaskModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<List<Map<String, dynamic>>> getTaskHistory(String taskId) async {
    try {
      final res = await _apiClient.dio.get('${ApiConstants.pmsTasks}/$taskId/history');
      final data = res.data;
      if (data is List) {
        return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<TaskModel> updateTask(String taskId, Map<String, dynamic> data) async {
    final res = await _apiClient.dio.patch(
      '${ApiConstants.pmsTasks}/$taskId',
      data: data,
    );
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return TaskModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<void> logTime({
    required String taskId,
    required double hours,
    String? description,
    String? date,
    bool isBillable = false,
    double? hourlyRate,
  }) async {
    await _apiClient.dio.post(
      ApiConstants.logTime,
      data: {
        'task_id': taskId,
        'hours': hours,
        if (description != null && description.isNotEmpty) 'description': description,
        if (date != null && date.isNotEmpty) 'date': date,
        'is_billable': isBillable,
        if (hourlyRate != null) 'hourly_rate': hourlyRate,
      },
    );
  }

  Future<List<ProjectModel>> getProjects() async {
    final res = await _apiClient.dio.get(ApiConstants.pmsProjects);
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => ProjectModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  // ── Agile Sprints & Backlog ──────────────────────────────────────────────

  Future<List<SprintModel>> getSprints(String projectId) async {
    final res = await _apiClient.dio.get('/pms/projects/$projectId/sprints');
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => SprintModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<SprintBurndownModel> getSprintBurndown(String sprintId) async {
    final res = await _apiClient.dio.get('/pms/sprints/$sprintId/burndown');
    final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : <String, dynamic>{};
    return SprintBurndownModel.fromJson(data);
  }

  Future<SprintVelocityModel> getSprintVelocity(String projectId) async {
    final res = await _apiClient.dio.get('/pms/projects/$projectId/velocity');
    final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : <String, dynamic>{};
    return SprintVelocityModel.fromJson(data);
  }

  Future<List<TaskModel>> getProjectBacklog(String projectId) async {
    final res = await _apiClient.dio.get('/pms/projects/$projectId/backlog');
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => TaskModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<void> updateBacklogOrder(List<String> taskIds) async {
    await _apiClient.dio.put(
      '/pms/tasks/backlog-order',
      data: {'task_ids': taskIds},
    );
  }

  Future<void> assignTaskToSprint(String taskId, String? sprintId) async {
    await _apiClient.dio.put(
      '/pms/tasks/$taskId/assign-sprint',
      data: {'sprint_id': sprintId},
    );
  }

  // ── Gantt, Calendar & Time Tracking ──────────────────────────────────────

  Future<List<GanttTaskModel>> getProjectGantt(String projectId) async {
    final res = await _apiClient.dio.get('/pms/projects/$projectId/gantt');
    final data = res.data;
    if (data is Map && data['tasks'] is List) {
      return (data['tasks'] as List)
          .map((e) => GanttTaskModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<List<ProjectCalendarEventModel>> getProjectCalendar(String projectId) async {
    final res = await _apiClient.dio.get('/pms/projects/$projectId/calendar');
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => ProjectCalendarEventModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<TimeTrackingSummaryModel> getTimeSummary(String projectId) async {
    final res = await _apiClient.dio.get('/pms/projects/$projectId/time-summary');
    final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : <String, dynamic>{};
    return TimeTrackingSummaryModel.fromJson(data);
  }
}
