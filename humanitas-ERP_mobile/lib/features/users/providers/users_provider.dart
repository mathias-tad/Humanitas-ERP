import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/user_model.dart';
import '../repositories/users_repository.dart';

final usersRepositoryProvider = Provider<UsersRepository>((ref) {
  return UsersRepository(ref.watch(apiClientProvider));
});

final usersProvider = FutureProvider<List<UserModel>>((ref) async {
  return ref.watch(usersRepositoryProvider).getUsers();
});

final biometricStatusProvider = FutureProvider.family<Map<String, dynamic>, String>(
  (ref, userId) async {
    return ref.watch(usersRepositoryProvider).getBiometricStatus(userId);
  },
);
