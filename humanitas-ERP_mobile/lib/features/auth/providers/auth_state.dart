import '../../../core/models/user_model.dart';

enum AuthStatus {
  initial,
  loading,       // app startup auth check (shows splash)
  loginLoading,  // user is actively logging in (stay on login screen)
  authenticated,
  unauthenticated,
  requiresSetup,
  error
}

class AuthState {
  final AuthStatus status;
  final UserModel? user;
  final String? tenantSlug;
  final List<String> permissions;
  final String? errorMessage;

  AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.tenantSlug,
    this.permissions = const [],
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? tenantSlug,
    List<String>? permissions,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      tenantSlug: tenantSlug ?? this.tenantSlug,
      permissions: permissions ?? this.permissions,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
