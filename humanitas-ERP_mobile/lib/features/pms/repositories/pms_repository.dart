import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/task_model.dart';
import '../../../core/models/project_model.dart';

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
  }) async {
    await _apiClient.dio.post(
      ApiConstants.logTime,
      data: {
        'task_id': taskId,
        'hours': hours,
        if (description != null && description.isNotEmpty) 'description': description,
        if (date != null && date.isNotEmpty) 'date': date,
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
}
