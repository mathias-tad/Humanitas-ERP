import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/user_model.dart';
import '../../../core/providers/providers.dart';
import '../repositories/user_repository.dart';

final userRepositoryProvider = Provider<UserRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return UserRepository(apiClient);
});

final profileProvider = StateNotifierProvider<ProfileNotifier, AsyncValue<UserModel>>((ref) {
  final repo = ref.watch(userRepositoryProvider);
  return ProfileNotifier(repo);
});

class ProfileNotifier extends StateNotifier<AsyncValue<UserModel>> {
  final UserRepository _repo;

  ProfileNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetchProfile();
  }

  Future<void> fetchProfile() async {
    state = const AsyncValue.loading();
    try {
      final user = await _repo.getProfile();
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> updateProfile(Map<String, dynamic> data) async {
    try {
      final updated = await _repo.updateProfile(data);
      state = AsyncValue.data(updated);
    } catch (e) {
      rethrow;
    }
  }

  Future<String?> uploadAvatar(List<int> bytes, String filename, String mime) async {
    try {
      final avatarUrl = await _repo.uploadAvatar(bytes, filename, mime);
      await fetchProfile();
      return avatarUrl;
    } catch (e) {
      rethrow;
    }
  }

  Future<void> deleteAvatar() async {
    try {
      await _repo.deleteAvatar();
      await fetchProfile();
    } catch (e) {
      rethrow;
    }
  }
}
