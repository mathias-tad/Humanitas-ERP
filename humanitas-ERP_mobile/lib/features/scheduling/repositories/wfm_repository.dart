import '../../../core/api/api_client.dart';
import '../models/wfm_opportunity_model.dart';

class WfmRepository {
  final ApiClient _apiClient;

  WfmRepository(this._apiClient);

  Future<List<WfmOpportunityModel>> getOpportunities({String? type, String? status}) async {
    try {
      final query = <String, dynamic>{};
      if (type != null && type != 'all') query['type'] = type;
      if (status != null && status != 'all') query['status'] = status;

      final response = await _apiClient.dio.get('/wfm/opportunities', queryParameters: query);
      final data = response.data;
      if (data is List) {
        return data.map((e) => WfmOpportunityModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<WfmClaimModel>> getMyClaims() async {
    try {
      final response = await _apiClient.dio.get('/wfm/my-claims');
      final data = response.data;
      if (data is List) {
        return data.map((e) => WfmClaimModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>> claimOpportunity(String opportunityId, {bool usePtoBalance = false}) async {
    final response = await _apiClient.dio.post(
      '/wfm/opportunities/$opportunityId/claim',
      data: {'use_pto_balance': usePtoBalance},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<void> cancelClaim(String claimId) async {
    await _apiClient.dio.delete('/wfm/claims/$claimId/cancel');
  }

  Future<WfmSettingsModel> getSettings() async {
    try {
      final response = await _apiClient.dio.get('/wfm/settings');
      if (response.data is Map<String, dynamic>) {
        return WfmSettingsModel.fromJson(response.data as Map<String, dynamic>);
      }
      return const WfmSettingsModel();
    } catch (_) {
      return const WfmSettingsModel();
    }
  }

  Future<WfmOpportunityModel> broadcastOpportunity(Map<String, dynamic> payload) async {
    final response = await _apiClient.dio.post('/wfm/opportunities', data: payload);
    return WfmOpportunityModel.fromJson(response.data as Map<String, dynamic>);
  }
}
