import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../../features/auth/providers/auth_state.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/setup_account_screen.dart';
import '../../features/auth/screens/splash_screen.dart';
import '../../features/home/screens/main_layout_screen.dart';
import '../../features/organization/models/company_scope.dart';
import '../../features/organization/providers/company_scope_provider.dart';
import '../api/scope_headers.dart';
import 'return_path.dart';

// ─── RouterNotifier ──────────────────────────────────────────────────────────
// Listens to AuthProvider and notifies GoRouter to re-run redirect logic.
// The GoRouter is created ONCE — this avoids re-mounting LoginScreen on error,
// which was clearing the typed email/password fields.
class RouterNotifier extends ChangeNotifier {
  final Ref _ref;
  late AuthState _authState;

  RouterNotifier(this._ref) {
    _authState = _ref.read(authProvider);
    _ref.listen<AuthState>(authProvider, (_, next) {
      _authState = next;
      if (next.status == AuthStatus.unauthenticated) {
        // A new sign-in starts without the last user's company/branch choice.
        ScopeHeaders.clear();
        _ref.read(scopeSelectionProvider.notifier).state = ScopeSelection.none;
      }
      notifyListeners(); // triggers GoRouter.redirect — does NOT recreate the router
    });
  }

  AuthStatus get status => _authState.status;
}

final _routerNotifierProvider = ChangeNotifierProvider<RouterNotifier>(
  (ref) => RouterNotifier(ref),
);

// ─── Router ──────────────────────────────────────────────────────────────────
final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.read(_routerNotifierProvider);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: (context, state) {
      final status = notifier.status;
      final loc = state.matchedLocation;
      final isSplash = loc == '/splash';
      final isLogin  = loc == '/login';
      final isSetup  = loc == '/setup-account';

      // App startup check → show splash
      if (status == AuthStatus.loading || status == AuthStatus.initial) {
        return isSplash ? null : withReturn('/splash', state.uri);
      }

      // User is actively logging in → stay exactly where we are
      if (status == AuthStatus.loginLoading) {
        return null;
      }

      // Not logged in → go to login
      if (status == AuthStatus.unauthenticated) {
        return isLogin ? null : withReturn('/login', state.uri);
      }

      // Login error → STAY on the current screen (snackbar shows the message)
      if (status == AuthStatus.error) {
        return null;
      }

      // Needs first-time setup
      if (status == AuthStatus.requiresSetup) {
        return isSetup ? null : '/setup-account';
      }

      // Fully authenticated → go home
      if (status == AuthStatus.authenticated) {
        // Back to where the app was going before sign-in (rule 24 item 22).
        if (isSplash || isLogin || isSetup) return returnPathFrom(state.uri) ?? '/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (_, _) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (_, _) => const LoginScreen(),
      ),
      GoRoute(
        path: '/setup-account',
        builder: (_, _) => const SetupAccountScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (_, _) => const _ScopedHome(),
      ),
    ],
  );
});

/// The home screens, opened again when the company/branch changes so everything they show
/// loads for the new selection (AGENTS.md rule 16).
class _ScopedHome extends ConsumerWidget {
  const _ScopedHome();

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      KeyedSubtree(key: ValueKey(ref.watch(scopeEpochProvider)), child: const MainLayoutScreen());
}
