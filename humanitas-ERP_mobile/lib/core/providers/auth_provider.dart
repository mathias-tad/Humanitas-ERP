import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/providers/auth_state.dart';
import '../../features/auth/repositories/auth_repository.dart';
import 'providers.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  return AuthNotifier(repository);
});

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(AuthState());

  Future<void> checkAuthStatus() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final user = await _repository.getCurrentUser();
      final permissions = await _repository.getPermissions();
      final enabledFeatures = await _repository.getEnabledFeatures();
      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: user,
        permissions: permissions,
        enabledFeatures: enabledFeatures,
      );
    } catch (_) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> refreshUser() async {
    try {
      final user = await _repository.getCurrentUser();
      state = state.copyWith(user: user);
    } catch (_) {}
  }

  Future<void> login({
    required String tenantSlug,
    required String email,
    required String password,
  }) async {
    // Use loginLoading (not loading) so the router stays on the LoginScreen
    state = state.copyWith(status: AuthStatus.loginLoading, errorMessage: null);
    try {
      final result = await _repository.login(
        tenantSlug: tenantSlug,
        email: email,
        password: password,
      );

      final user = result['user'];
      final requiresSetup = result['requires_setup'] ?? false;

      if (requiresSetup) {
        state = state.copyWith(
          status: AuthStatus.requiresSetup,
          user: user,
          tenantSlug: tenantSlug,
        );
      } else {
        final permissions = await _repository.getPermissions();
        final enabledFeatures = await _repository.getEnabledFeatures();
        state = state.copyWith(
          status: AuthStatus.authenticated,
          user: user,
          tenantSlug: tenantSlug,
          permissions: permissions,
          enabledFeatures: enabledFeatures,
        );
      }
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = AuthState(status: AuthStatus.unauthenticated);
  }

  bool hasPermission(String permission) {
    return state.permissions.contains(permission);
  }

  bool hasAnyPermission(List<String> perms) {
    return perms.any((p) => state.permissions.contains(p));
  }
}
