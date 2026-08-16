import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/payslip_model.dart';

class PayrollRepository {
  final ApiClient _apiClient;
  PayrollRepository(this._apiClient);

  Future<List<PayslipModel>> getMyPayslips() async {
    final res = await _apiClient.dio.get(ApiConstants.myPayslips);
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => PayslipModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<PayslipModel> getPayslipDetail(String id) async {
    final res = await _apiClient.dio.get('${ApiConstants.myPayslips}/$id');
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return PayslipModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }
}
