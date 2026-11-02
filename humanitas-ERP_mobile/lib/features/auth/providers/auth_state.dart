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
  final List<String> enabledFeatures;
  final String? errorMessage;

  AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.tenantSlug,
    this.permissions = const [],
    this.enabledFeatures = const [],
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? tenantSlug,
    List<String>? permissions,
    List<String>? enabledFeatures,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      tenantSlug: tenantSlug ?? this.tenantSlug,
      permissions: permissions ?? this.permissions,
      enabledFeatures: enabledFeatures ?? this.enabledFeatures,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  bool hasPermission(String permission) {
    final role = user?.role.toLowerCase() ?? '';
    if (role == 'owner' || role == 'admin' || role == 'administrator') return true;
    return permissions.contains(permission) || permissions.contains('*');
  }

  bool hasAnyPermission(List<String> perms) {
    final role = user?.role.toLowerCase() ?? '';
    if (role == 'owner' || role == 'admin' || role == 'administrator') return true;
    if (permissions.contains('*')) return true;
    return perms.any((p) => permissions.contains(p));
  }

  bool isModuleSubscribed(String module) {
    if (enabledFeatures.isEmpty) return true; // Default open if not fetched
    final m = module.toLowerCase().trim();
    if (enabledFeatures.contains('*')) return true;
    if (enabledFeatures.contains(m)) return true;
    if ((m == 'hrms' || m == 'hr') &&
        (enabledFeatures.contains('hrms') ||
         enabledFeatures.contains('hr') ||
         enabledFeatures.contains('attendance') ||
         enabledFeatures.contains('leave') ||
         enabledFeatures.contains('payroll'))) return true;
    if (m == 'pms' &&
        (enabledFeatures.contains('pms') ||
         enabledFeatures.contains('tasks') ||
         enabledFeatures.contains('projects'))) return true;
    return false;
  }
}
