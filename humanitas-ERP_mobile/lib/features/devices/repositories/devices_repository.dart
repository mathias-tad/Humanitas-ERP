import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../models/device_model.dart';

class DevicesRepository {
  final ApiClient _apiClient;

  DevicesRepository(this._apiClient);

  /// Fetches all registered biometric devices.
  Future<List<DeviceModel>> getDevices() async {
    final res = await _apiClient.dio.get(ApiConstants.biometricDevices);
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => DeviceModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  /// Authorizes a pending device by ID.
  Future<void> authorizeDevice(String id) async {
    await _apiClient.dio.post(ApiConstants.biometricDeviceAuthorize(id));
  }

  /// Revokes authorization from a device by ID.
  Future<void> revokeDevice(String id) async {
    await _apiClient.dio.delete(ApiConstants.biometricDeviceAuthorize(id));
  }

  /// Triggers a user sync on the device.
  Future<void> syncUsers(String id) async {
    await _apiClient.dio.post(ApiConstants.biometricDeviceSyncUsers(id));
  }

  /// Fetches ADMS server info (push URL, port, etc.).
  Future<Map<String, dynamic>> getServerInfo() async {
    final res = await _apiClient.dio.get(ApiConstants.biometricDeviceServerInfo);
    return (res.data as Map<String, dynamic>?) ?? {};
  }

  /// Permanently deletes a device record.
  Future<void> deleteDevice(String id) async {
    await _apiClient.dio.delete(ApiConstants.biometricDeviceDelete(id));
  }
}
