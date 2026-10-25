import '../../../core/api/api_client.dart';
import '../models/hrms_summary_model.dart';

class HrmsReportsRepository {
  final ApiClient apiClient;

  HrmsReportsRepository({required this.apiClient});

  Future<HrmsSummaryModel> getSummary({String? companyId, String? branchId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (companyId != null && companyId.isNotEmpty) queryParams['company_id'] = companyId;
      if (branchId != null && branchId.isNotEmpty) queryParams['branch_id'] = branchId;

      final response = await apiClient.dio.get(
        '/hrms/reports/summary',
        queryParameters: queryParams,
      );

      final data = response.data;
      if (data is Map<String, dynamic>) {
        final payload = data['data'] is Map<String, dynamic> ? data['data'] : data;
        return HrmsSummaryModel.fromJson(payload as Map<String, dynamic>);
      }
      throw Exception('Unexpected response format');
    } catch (e) {
      throw Exception('Failed to load HRMS summary: $e');
    }
  }

  Future<HeadcountDemographicsModel> getHeadcount({String? companyId, String? branchId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (companyId != null && companyId.isNotEmpty) queryParams['company_id'] = companyId;
      if (branchId != null && branchId.isNotEmpty) queryParams['branch_id'] = branchId;

      final response = await apiClient.dio.get(
        '/hrms/reports/headcount',
        queryParameters: queryParams,
      );

      final data = response.data;
      if (data is Map<String, dynamic>) {
        final payload = data['data'] is Map<String, dynamic> ? data['data'] : data;
        return HeadcountDemographicsModel.fromJson(payload as Map<String, dynamic>);
      }
      throw Exception('Unexpected response format');
    } catch (e) {
      throw Exception('Failed to load headcount demographics: $e');
    }
  }
}
