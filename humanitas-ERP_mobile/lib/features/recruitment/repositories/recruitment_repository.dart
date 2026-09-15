import '../../../core/api/api_client.dart';
import '../models/job_model.dart';

class RecruitmentRepository {
  final ApiClient _apiClient;

  RecruitmentRepository(this._apiClient);

  Future<List<JobPostingModel>> getJobs() async {
    try {
      final response = await _apiClient.dio.get('/recruitment/jobs');
      final data = response.data;
      if (data is List) {
        return data.map((e) => JobPostingModel.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map && data['items'] is List) {
        return (data['items'] as List).map((e) => JobPostingModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<CandidateApplicationModel>> getApplications() async {
    try {
      final response = await _apiClient.dio.get('/recruitment/applications');
      final data = response.data;
      if (data is List) {
        return data.map((e) => CandidateApplicationModel.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map && data['items'] is List) {
        return (data['items'] as List).map((e) => CandidateApplicationModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}
