import 'dart:developer';
import '../../../core/api/api_client.dart';
import '../models/recruitment_models.dart';

class RecruitmentRepository {
  final ApiClient _apiClient;

  RecruitmentRepository(this._apiClient);

  Future<List<JobPostModel>> getJobs() async {
    try {
      final response = await _apiClient.dio.get('/recruitment/jobs');
      final data = response.data;
      if (data is List) {
        return data.map((e) => JobPostModel.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map && data['items'] is List) {
        return (data['items'] as List)
            .map((e) => JobPostModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      log('RecruitmentRepository.getJobs error: $e');
      return [];
    }
  }

  Future<List<CandidateApplicationModel>> getApplications([String? jobId]) async {
    try {
      final queryParams = <String, dynamic>{};
      if (jobId != null && jobId.isNotEmpty) {
        queryParams['job_id'] = jobId;
      }
      final response = await _apiClient.dio.get(
        '/recruitment/applications',
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );
      final data = response.data;
      if (data is List) {
        return data.map((e) => CandidateApplicationModel.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map && data['items'] is List) {
        return (data['items'] as List)
            .map((e) => CandidateApplicationModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      log('RecruitmentRepository.getApplications error: $e');
      return [];
    }
  }

  Future<List<InterviewModel>> getInterviews() async {
    try {
      final response = await _apiClient.dio.get('/recruitment/interviews');
      final data = response.data;
      if (data is List) {
        return data.map((e) => InterviewModel.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map && data['items'] is List) {
        return (data['items'] as List)
            .map((e) => InterviewModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      log('RecruitmentRepository.getInterviews error: $e');
      return [];
    }
  }

  Future<bool> scheduleInterview(Map<String, dynamic> data) async {
    try {
      final response = await _apiClient.dio.post('/recruitment/interviews', data: data);
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      log('RecruitmentRepository.scheduleInterview error: $e');
      return false;
    }
  }

  Future<List<OfferLetterModel>> getOffers() async {
    try {
      final response = await _apiClient.dio.get('/recruitment/offers');
      final data = response.data;
      if (data is List) {
        return data.map((e) => OfferLetterModel.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map && data['items'] is List) {
        return (data['items'] as List)
            .map((e) => OfferLetterModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      log('RecruitmentRepository.getOffers error: $e');
      return [];
    }
  }

  Future<bool> convertToEmployee(String candidateId, Map<String, dynamic> data) async {
    try {
      final response = await _apiClient.dio.post(
        '/recruitment/candidates/$candidateId/hire',
        data: data,
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      // Try fallback route
      try {
        final fallback = await _apiClient.dio.post(
          '/recruitment/candidates/$candidateId/convert-to-employee',
          data: data,
        );
        return fallback.statusCode == 200 || fallback.statusCode == 201;
      } catch (err) {
        log('RecruitmentRepository.convertToEmployee error: $err');
        return false;
      }
    }
  }

  Future<RecruitmentFunnelModel> getFunnelReport() async {
    try {
      final response = await _apiClient.dio.get('/recruitment/funnel');
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return RecruitmentFunnelModel.fromJson(data);
      }
    } catch (e) {
      log('RecruitmentRepository.getFunnelReport API error: $e');
    }

    // Fallback: derive funnel stats from loaded applications
    try {
      final apps = await getApplications();
      int applied = apps.length;
      int screened = 0;
      int interview = 0;
      int offer = 0;
      int hired = 0;

      for (final a in apps) {
        final s = (a.stage ?? a.status).toLowerCase();
        if (s == 'hired' || s == 'accepted') {
          hired++;
          offer++;
          interview++;
          screened++;
        } else if (s == 'offer') {
          offer++;
          interview++;
          screened++;
        } else if (s == 'interview' || s == 'interviewing') {
          interview++;
          screened++;
        } else if (s == 'screened' || s == 'shortlisted') {
          screened++;
        }
      }
      return RecruitmentFunnelModel(
        applied: applied,
        screened: screened,
        interview: interview,
        offer: offer,
        hired: hired,
      );
    } catch (_) {
      return const RecruitmentFunnelModel();
    }
  }
}
