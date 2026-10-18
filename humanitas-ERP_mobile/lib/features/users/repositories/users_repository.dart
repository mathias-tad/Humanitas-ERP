import '../../../core/api/api_client.dart';
import '../models/user_model.dart';

class UsersRepository {
  final ApiClient _apiClient;
  UsersRepository(this._apiClient);

  Future<List<UserModel>> getUsers({String? search}) async {
    final params = search != null && search.isNotEmpty ? {'search': search} : null;
    final res = await _apiClient.dio.get('/users/list', queryParameters: params);
    if (res.data is List) {
      return (res.data as List)
          .map((e) => UserModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> getBiometricStatus(String userId) async {
    final res = await _apiClient.dio.get('/biometric-devices/users/$userId/biometric-status');
    return Map<String, dynamic>.from(res.data as Map);
  }
}
