import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../models/leave_balance_model.dart';
import '../models/leave_request_model.dart';
import '../models/leave_type_model.dart';

class LeaveRepository {
  final ApiClient _apiClient;
  LeaveRepository(this._apiClient);

  Future<List<LeaveTypeModel>> getLeaveTypes() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.leaveTypes);
      if (res.data is List) {
        return (res.data as List).map((item) => LeaveTypeModel.fromJson(item)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<LeaveBalanceModel>> getMyBalances() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.myLeaveBalances);
      if (res.data is List) {
        return (res.data as List).map((item) => LeaveBalanceModel.fromJson(item)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<LeaveRequestModel>> getMyRequests() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.myLeaveRequests);
      if (res.data is List) {
        return (res.data as List).map((item) => LeaveRequestModel.fromJson(item)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<void> applyLeave({
    required String leaveTypeId,
    required String startDate,
    required String endDate,
    required String reason,
  }) async {
    await _apiClient.dio.post(
      ApiConstants.applyLeave,
      data: {
        'leave_type_id': leaveTypeId,
        'start_date': startDate,
        'end_date': endDate,
        'reason': reason,
      },
    );
  }

  Future<void> cancelRequest(String id) async {
    await _apiClient.dio.delete('${ApiConstants.myLeaveRequests}/$id');
  }
}
