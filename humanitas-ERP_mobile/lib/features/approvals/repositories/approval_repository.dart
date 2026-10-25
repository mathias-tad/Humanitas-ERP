import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../models/approval_model.dart';

class ApprovalRepository {
  final ApiClient _apiClient;

  ApprovalRepository(this._apiClient);

  Future<List<ApprovalRequestModel>> getRequests({
    String? status,
    bool? myPending,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null && status.isNotEmpty && status != 'all') {
        queryParams['status'] = status;
      }
      if (myPending != null) {
        queryParams['my_pending'] = myPending;
      }
      final response = await _apiClient.dio.get(
        '/approvals/requests',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List
              ? data['data']
              : (data is Map && data['items'] is List
                  ? data['items']
                  : (data is Map && data['requests'] is List ? data['requests'] : [])));
      return items
          .map((e) => ApprovalRequestModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to load approval requests');
    }
  }

  Future<ApprovalRequestDetailModel> getRequestDetail(String id) async {
    try {
      final response = await _apiClient.dio.get('/approvals/requests/$id');
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? (data['data'] is Map<String, dynamic> ? data['data'] : data)
          : <String, dynamic>{};
      return ApprovalRequestDetailModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to load approval detail');
    }
  }

  Future<ApprovalRequestModel> decideRequest(
    String id, {
    required String action,
    String? comments,
  }) async {
    try {
      final payload = <String, dynamic>{
        'action': action,
        if (comments != null && comments.trim().isNotEmpty)
          'comments': comments.trim(),
      };
      final response = await _apiClient.dio.post(
        '/approvals/requests/$id/decide',
        data: payload,
      );
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? (data['data'] is Map<String, dynamic> ? data['data'] : data)
          : <String, dynamic>{};
      return ApprovalRequestModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to decide approval request');
    }
  }

  Future<int> getMyPendingCount() async {
    try {
      final response =
          await _apiClient.dio.get('/approvals/requests/my-pending-count');
      final dynamic data = response.data;
      if (data is num) return data.toInt();
      if (data is Map) {
        if (data['count'] is num) return (data['count'] as num).toInt();
        if (data['pendingCount'] is num) {
          return (data['pendingCount'] as num).toInt();
        }
        if (data['data'] is num) return (data['data'] as num).toInt();
        if (data['data'] is Map && data['data']['count'] is num) {
          return (data['data']['count'] as num).toInt();
        }
      }
      return 0;
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['message'] ?? 'Failed to load pending approvals count');
    }
  }
}
