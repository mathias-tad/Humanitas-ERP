import '../../../core/api/api_client.dart';
import '../models/company_model.dart';
import '../models/branch_model.dart';

class OrganizationRepository {
  final ApiClient apiClient;

  OrganizationRepository({required this.apiClient});

  Future<List<CompanyModel>> getCompanies() async {
    try {
      final response = await apiClient.dio.get('/settings/companies');
      final data = response.data;
      if (data is List) {
        return data
            .map((e) => CompanyModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      if (data is Map && data['data'] is List) {
        return (data['data'] as List)
            .map((e) => CompanyModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception('Failed to load companies: $e');
    }
  }

  Future<List<BranchModel>> getBranches({String? companyId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (companyId != null && companyId.isNotEmpty) {
        queryParams['company_id'] = companyId;
      }
      final response = await apiClient.dio.get(
        '/settings/branches',
        queryParameters: queryParams,
      );
      final data = response.data;
      if (data is List) {
        return data
            .map((e) => BranchModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      if (data is Map && data['data'] is List) {
        return (data['data'] as List)
            .map((e) => BranchModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception('Failed to load branches: $e');
    }
  }
}
