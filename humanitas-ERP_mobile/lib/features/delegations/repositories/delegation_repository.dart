import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../models/delegation_model.dart';

class DelegationRepository {
  final ApiClient _apiClient;

  DelegationRepository(this._apiClient);

  Future<Map<String, List<UserDelegationModel>>> getMyDelegations() async {
    try {
      final response = await _apiClient.dio.get('/delegations/my');
      final data = response.data;
      final List<dynamic> grantedJson = data is Map ? (data['granted'] as List? ?? []) : [];
      final List<dynamic> receivedJson = data is Map ? (data['received'] as List? ?? []) : [];

      return {
        'granted': grantedJson.map((e) => UserDelegationModel.fromJson(e as Map<String, dynamic>)).toList(),
        'received': receivedJson.map((e) => UserDelegationModel.fromJson(e as Map<String, dynamic>)).toList(),
      };
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load delegations');
    }
  }

  Future<List<UserDelegationModel>> getActiveDelegations() async {
    try {
      final response = await _apiClient.dio.get('/delegations/active');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => UserDelegationModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load active delegations');
    }
  }

  Future<List<DelegationAuditModel>> getAuditLogs({String? delegationId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (delegationId != null) queryParams['delegation_id'] = delegationId;

      final response = await _apiClient.dio.get(
        '/delegations/audit',
        queryParameters: queryParams,
      );
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => DelegationAuditModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load delegation audit logs');
    }
  }

  Future<Map<String, dynamic>> getActingPreview({
    required String delegatorId,
    double? percentage,
    double? amount,
  }) async {
    try {
      final response = await _apiClient.dio.get(
        '/delegations/acting-preview',
        queryParameters: {
          'delegator_id': delegatorId,
          if (percentage != null) 'percentage': percentage,
          if (amount != null) 'amount': amount,
        },
      );
      return response.data is Map<String, dynamic> ? response.data : <String, dynamic>{};
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load acting preview');
    }
  }

  Future<UserDelegationModel> createDelegation(Map<String, dynamic> payload) async {
    try {
      final response = await _apiClient.dio.post('/delegations', data: payload);
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? (data['data'] is Map<String, dynamic> ? data['data'] : data)
          : <String, dynamic>{};
      return UserDelegationModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to create delegation');
    }
  }

  Future<void> revokeDelegation(String id) async {
    try {
      await _apiClient.dio.put('/delegations/$id/revoke');
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to revoke delegation');
    }
  }
}
