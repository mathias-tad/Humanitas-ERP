import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_assets.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/providers.dart';
import '../providers/auth_state.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _tenantSlugController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  bool _slugLocked = false; // true when slug already stored → hide field
  String? _savedSlug;

  late AnimationController _animController;
  late Animation<Offset> _slideAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _fadeAnim =
        CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _animController.forward();

    // Load saved tenant slug once
    _loadSavedSlug();
  }

  Future<void> _loadSavedSlug() async {
    final storage = ref.read(secureStorageProvider);
    final slug = await storage.getTenantSlug();
    if (slug != null && slug.isNotEmpty) {
      setState(() {
        _savedSlug = slug;
        _slugLocked = true;
        _tenantSlugController.text = slug;
      });
    }
  }

  @override
  void dispose() {
    _tenantSlugController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _animController.dispose();
    super.dispose();
  }

  void _handleLogin() {
    if (_formKey.currentState?.validate() ?? false) {
      ref.read(authProvider.notifier).login(
            tenantSlug: _tenantSlugController.text.trim(),
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
    }
  }

  void _unlockSlug() {
    setState(() {
      _slugLocked = false;
      _tenantSlugController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    // Show spinner for BOTH initial app loading and active login submission
    final isLoading = authState.status == AuthStatus.loading ||
        authState.status == AuthStatus.loginLoading;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    ref.listen<AuthState>(authProvider, (previous, next) {
      if (next.status == AuthStatus.error && next.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.errorMessage!),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 4),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    });

    return Scaffold(
      body: Stack(
        children: [
          // ── Background gradient ────────────────────────────────────
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: isDark
                    ? [AppColors.backgroundDark, AppColors.surfaceDark]
                    : [AppColors.backgroundLight, Colors.white],
              ),
            ),
          ),

          // ── Gold top-left decorative glow ──────────────────────────
          Positioned(
            top: -60,
            left: -60,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: isDark ? 0.15 : 0.10),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // ── Teal bottom-right decorative glow ─────────────────────
          Positioned(
            bottom: -40,
            right: -40,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.teal.withValues(alpha: isDark ? 0.12 : 0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // ── Main form content ──────────────────────────────────────
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: SlideTransition(
                    position: _slideAnim,
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // ── Logo (fills circle) ──────────────────────
                          Center(
                            child: Container(
                              width: 96,
                              height: 96,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: AppColors.primary.withValues(alpha: 0.5),
                                  width: 2,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withValues(alpha: 0.25),
                                    blurRadius: 20,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                              child: ClipOval(
                                child: Image.asset(
                                  AppAssets.logo,
                                  fit: BoxFit.cover,
                                  width: 96,
                                  height: 96,
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(height: 24),

                          // ── Title ────────────────────────────────────
                          Text(
                            'Welcome back',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                              color: isDark
                                  ? AppColors.textPrimaryDark
                                  : AppColors.textPrimaryLight,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Sign in to your HR workspace',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: isDark
                                  ? AppColors.textSecondaryDark
                                  : AppColors.textSecondaryLight,
                            ),
                          ),

                          const SizedBox(height: 32),

                          // ── Organization — locked pill or text field ──
                          if (_slugLocked && _savedSlug != null) ...[
                            // Pill showing saved org with change option
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 14),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? AppColors.cardDark
                                    : AppColors.primarySurface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: AppColors.primary.withValues(alpha: 0.4),
                                  width: 1.5,
                                ),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.apartment_outlined,
                                      color: AppColors.primary, size: 20),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Organization',
                                          style: GoogleFonts.inter(
                                            fontSize: 11,
                                            color: isDark
                                                ? AppColors.textSecondaryDark
                                                : AppColors.textSecondaryLight,
                                          ),
                                        ),
                                        Text(
                                          _savedSlug!,
                                          style: GoogleFonts.inter(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Change button
                                  TextButton(
                                    onPressed: _unlockSlug,
                                    style: TextButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 4),
                                      minimumSize: Size.zero,
                                    ),
                                    child: Text(
                                      'Change',
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: AppColors.teal,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ] else ...[
                            // Full text field for first install
                            TextFormField(
                              controller: _tenantSlugController,
                              decoration: InputDecoration(
                                labelText: 'Organization Code',
                                hintText: 'e.g. acme-corp',
                                prefixIcon:
                                    const Icon(Icons.apartment_outlined),
                                helperText:
                                    'Ask your HR admin for your organization code',
                                helperStyle: GoogleFonts.inter(fontSize: 11),
                              ),
                              validator: (val) {
                                if (val == null || val.trim().isEmpty) {
                                  return 'Organization code is required';
                                }
                                return null;
                              },
                            ),
                          ],

                          const SizedBox(height: 16),

                          // ── Email ────────────────────────────────────
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: 'Work Email',
                              hintText: 'you@company.com',
                              prefixIcon: Icon(Icons.email_outlined),
                            ),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return 'Email is required';
                              }
                              if (!val.contains('@')) {
                                return 'Enter a valid email';
                              }
                              return null;
                            },
                          ),

                          const SizedBox(height: 16),

                          // ── Password ─────────────────────────────────
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'Password',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                ),
                                onPressed: () => setState(() =>
                                    _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (val) {
                              if (val == null || val.isEmpty) {
                                return 'Password is required';
                              }
                              return null;
                            },
                          ),

                          const SizedBox(height: 28),

                          // ── Sign In Button ────────────────────────────
                          ElevatedButton(
                            onPressed: isLoading ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: const Color(0xFF1A1200),
                              minimumSize: const Size(double.infinity, 54),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              elevation: 3,
                              shadowColor:
                                  AppColors.primary.withValues(alpha: 0.5),
                            ),
                            child: isLoading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                          Color(0xFF1A1200)),
                                    ),
                                  )
                                : Text(
                                    'Sign In',
                                    style: GoogleFonts.inter(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                          ),

                          const SizedBox(height: 32),

                          // ── Footer branding ───────────────────────────
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 24,
                                height: 24,
                                child: ClipOval(
                                  child: Image.asset(AppAssets.logo,
                                      fit: BoxFit.cover),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Humanitas HR Platform',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: isDark
                                      ? AppColors.textSecondaryDark
                                      : AppColors.textSecondaryLight,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
