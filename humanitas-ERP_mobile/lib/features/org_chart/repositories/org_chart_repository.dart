import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../models/org_node_model.dart';

class OrgChartRepository {
  final ApiClient _apiClient;
  OrgChartRepository(this._apiClient);

  Future<Map<String, dynamic>> getOrgChart({String? department}) async {
    final query = (department != null && department.isNotEmpty && department != 'all')
        ? {'department': department}
        : null;

    final res = await _apiClient.dio.get(
      ApiConstants.orgChartTree,
      queryParameters: query,
    );

    final data = res.data as Map<String, dynamic>;
    final rawRoots = (data['rootNodes'] as List<dynamic>?) ?? [];
    final rootNodes = rawRoots
        .map((e) => OrgNodeModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final departments = ((data['departments'] as List<dynamic>?) ?? [])
        .map((e) => e.toString())
        .toList();

    return {
      'totalEmployees': (data['totalEmployees'] as num?)?.toInt() ?? 0,
      'rootCount': (data['rootCount'] as num?)?.toInt() ?? 0,
      'departments': departments,
      'rootNodes': rootNodes,
    };
  }

  Future<Map<String, dynamic>> getReportingChain(String userId) async {
    final res = await _apiClient.dio.get('/users/$userId/reporting-chain');
    final data = res.data as Map<String, dynamic>;

    final user = OrgNodeModel.fromJson(data['user'] as Map<String, dynamic>);
    final ancestors = ((data['ancestors'] as List<dynamic>?) ?? [])
        .map((e) => OrgNodeModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final directReports = ((data['directReports'] as List<dynamic>?) ?? [])
        .map((e) => OrgNodeModel.fromJson(e as Map<String, dynamic>))
        .toList();

    return {
      'user': user,
      'ancestors': ancestors,
      'directReports': directReports,
    };
  }
}
