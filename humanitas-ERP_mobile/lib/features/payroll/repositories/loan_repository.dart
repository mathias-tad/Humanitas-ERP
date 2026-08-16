import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/loan_model.dart';

class LoanRepository {
  final ApiClient _apiClient;
  LoanRepository(this._apiClient);

  /// Check if self-service loans are enabled
  Future<Map<String, dynamic>> getLoanConfig() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.loanConfig);
      if (res.data is Map) return Map<String, dynamic>.from(res.data as Map);
      return {};
    } catch (_) {
      return {};
    }
  }

  Future<List<LoanModel>> getMyLoans() async {
    final res = await _apiClient.dio.get(ApiConstants.myLoans);
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => LoanModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  /// Body: { total_amount, term_months, start_month, start_year }
  Future<LoanModel> requestLoan({
    required double totalAmount,
    required int termMonths,
    required int startMonth,
    required int startYear,
    String? description,
    String? loanType,
  }) async {
    final res = await _apiClient.dio.post(
      ApiConstants.myLoans,
      data: {
        'total_amount': totalAmount,
        'term_months': termMonths,
        'start_month': startMonth,
        'start_year': startYear,
        if (description != null && description.isNotEmpty) 'description': description,
        if (loanType != null && loanType.isNotEmpty) 'loan_type': loanType,
      },
    );
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return LoanModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<LoanModel> updateLoan(String id, Map<String, dynamic> data) async {
    final res = await _apiClient.dio.put(
      '${ApiConstants.myLoans}/$id',
      data: data,
    );
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return LoanModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }
}
