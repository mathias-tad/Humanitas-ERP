import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/per_diem_model.dart';

class PerDiemRepository {
  final ApiClient _apiClient;
  PerDiemRepository(this._apiClient);

  Future<List<PerDiemModel>> getMyClaims({int? year}) async {
    final res = await _apiClient.dio.get(
      ApiConstants.myPerDiemClaims,
      queryParameters: year != null ? {'year': year} : null,
    );
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => PerDiemModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<PerDiemModel> getClaim(String id) async {
    final res = await _apiClient.dio.get('/per-diem/claim/$id');
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return PerDiemModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  /// choice: 'WITH_RECEIPT' or 'WITHOUT_RECEIPT'
  Future<void> submitChoice(String claimId, String choice) async {
    await _apiClient.dio.post(
      '${ApiConstants.perDiemChoice}/$claimId',
      data: {'choice': choice},
    );
  }

  Future<void> uploadReceipt({
    required String claimId,
    required List<int> bytes,
    required String filename,
    required String mime,
    double? receiptAmount,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: filename,
        contentType: DioMediaType.parse(mime),
      ),
      if (receiptAmount != null) 'receipt_amount': receiptAmount.toString(),
    });
    await _apiClient.dio.post(
      '${ApiConstants.perDiemUploadReceipt}/$claimId',
      data: formData,
      options: Options(headers: {'Content-Type': 'multipart/form-data'}),
    );
  }
}
