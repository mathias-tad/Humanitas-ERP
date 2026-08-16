import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/user_model.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/full_screen_avatar_viewer.dart';
import '../providers/profile_provider.dart';
import 'edit_profile_screen.dart';
import 'change_password_screen.dart';
import 'access_control_screen.dart';
import 'system_settings_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  void _handleAvatarChange(BuildContext context, WidgetRef ref, UserModel user) {
    showAvatarPickerSheet(
      context: context,
      currentAvatarUrl: user.avatarUrl,
      name: user.displayName,
      onImagePicked: (bytes, filename, mime) async {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Uploading photo...'), duration: Duration(seconds: 2)),
        );
        try {
          await ref.read(profileProvider.notifier).uploadAvatar(bytes, filename, mime);
          await ref.read(authProvider.notifier).refreshUser();
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Profile photo updated successfully!'),
                backgroundColor: AppColors.success,
              ),
            );
          }
        } catch (e) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Failed to upload photo: ${e.toString().replaceAll("Exception: ", "")}'),
                backgroundColor: AppColors.error,
              ),
            );
          }
        }
      },
      onDelete: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
          ? () => _handleAvatarDelete(context, ref)
          : null,
    );
  }

  Future<void> _handleAvatarDelete(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(profileProvider.notifier).deleteAvatar();
      await ref.read(authProvider.notifier).refreshUser();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile photo removed'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to remove photo: ${e.toString().replaceAll("Exception: ", "")}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authUser = ref.watch(authProvider).user;
    final profileAsync = ref.watch(profileProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final user = profileAsync.asData?.value ?? authUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'System Settings',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SystemSettingsScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Edit Profile',
            onPressed: () {
              if (user != null) {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => EditProfileScreen(user: user)),
                );
              }
            },
          ),
        ],
      ),
      body: user != null
          ? RefreshIndicator(
              onRefresh: () async {
                await ref.read(profileProvider.notifier).fetchProfile();
                await ref.read(authProvider.notifier).refreshUser();
              },
              child: _buildProfileContent(context, ref, user, isDark),
            )
          : profileAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) {
                String displayError = 'Failed to load profile. Please try again.';
                if (err.toString().contains('401')) {
                  displayError = 'Session expired or unauthorized. Please re-login.';
                }
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(28.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.error, size: 56),
                        const SizedBox(height: 16),
                        Text(
                          displayError,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                          onPressed: () => ref.read(profileProvider.notifier).fetchProfile(),
                        ),
                      ],
                    ),
                  ),
                );
              },
              data: (u) => RefreshIndicator(
                onRefresh: () async {
                  await ref.read(profileProvider.notifier).fetchProfile();
                  await ref.read(authProvider.notifier).refreshUser();
                },
                child: _buildProfileContent(context, ref, u, isDark),
              ),
            ),
    );
  }

  Widget _buildProfileContent(BuildContext context, WidgetRef ref, UserModel user, bool isDark) {
    final authState = ref.watch(authProvider);

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header Card (Avatar + Name + Role Badge) ───────────────
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  Stack(
                    alignment: Alignment.bottomRight,
                    children: [
                      GestureDetector(
                        onTap: () {
                          if (user.avatarUrl != null && user.avatarUrl!.isNotEmpty) {
                            FullScreenAvatarViewer.show(
                              context,
                              avatarUrl: user.avatarUrl,
                              title: user.displayName,
                              heroTag: 'user_avatar_${user.id}',
                              onEditAvatar: () => _handleAvatarChange(context, ref, user),
                              onDeleteAvatar: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                                  ? () => _handleAvatarDelete(context, ref)
                                  : null,
                            );
                          } else {
                            _handleAvatarChange(context, ref, user);
                          }
                        },
                        child: Hero(
                          tag: 'user_avatar_${user.id}',
                          child: Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.primary.withValues(alpha: 0.6),
                                width: 2.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primary.withValues(alpha: 0.2),
                                  blurRadius: 16,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                            child: CircleAvatar(
                              radius: 46,
                              backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                              backgroundImage: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                                  ? NetworkImage(user.avatarUrl!)
                                  : null,
                              child: user.avatarUrl == null || user.avatarUrl!.isEmpty
                                  ? Text(
                                      user.displayName.isNotEmpty
                                          ? user.displayName[0].toUpperCase()
                                          : 'U',
                                      style: GoogleFonts.inter(
                                        fontSize: 34,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primary,
                                      ),
                                    )
                                  : null,
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        right: 2,
                        bottom: 2,
                        child: GestureDetector(
                          onTap: () => _handleAvatarChange(context, ref, user),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 1.5),
                            ),
                            child: const Icon(Icons.camera_alt, size: 14, color: Color(0xFF1A1200)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    user.displayName,
                    style: GoogleFonts.inter(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user.position ?? 'Employee',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Role & Tenant Chips
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
                        ),
                        child: Text(
                          user.role.toUpperCase(),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      if (authState.tenantSlug != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.teal.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.teal.withValues(alpha: 0.4)),
                          ),
                          child: Text(
                            'Org: ${authState.tenantSlug}',
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.teal,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          // ── Section Title: Personal Information ──────────────────
          Text(
            'Personal Information',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 10),

          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            child: Column(
              children: [
                _buildInfoTile(
                  icon: Icons.person_outline,
                  title: 'Full Name',
                  subtitle: user.displayName,
                ),
                const Divider(height: 1, indent: 56),
                _buildInfoTile(
                  icon: Icons.email_outlined,
                  title: 'Email Address',
                  subtitle: user.email,
                ),
                if (user.phoneNumber != null && user.phoneNumber!.isNotEmpty) ...[
                  const Divider(height: 1, indent: 56),
                  _buildInfoTile(
                    icon: Icons.phone_outlined,
                    title: 'Phone Number',
                    subtitle: user.phoneNumber!,
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Section Title: Work & Organization Details ───────────
          Text(
            'Work & Organization',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 10),

          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            child: Column(
              children: [
                _buildInfoTile(
                  icon: Icons.business_outlined,
                  title: 'Department',
                  subtitle: user.department ?? 'General Operations',
                ),
                const Divider(height: 1, indent: 56),
                _buildInfoTile(
                  icon: Icons.work_outline,
                  title: 'Job Position',
                  subtitle: user.position ?? 'Team Member',
                ),
                const Divider(height: 1, indent: 56),
                _buildInfoTile(
                  icon: Icons.badge_outlined,
                  title: 'User ID',
                  subtitle: user.id.isNotEmpty ? user.id : 'N/A',
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Section Title: Admin & System Management ─────────────
          Text(
            'Admin & System Management',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 10),

          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.admin_panel_settings_outlined, color: AppColors.primary),
                  title: const Text('Access Control & Roles'),
                  subtitle: const Text('Manage roles, permissions & access rules'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const AccessControlScreen()),
                    );
                  },
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.settings_suggest_outlined, color: AppColors.teal),
                  title: const Text('System Settings'),
                  subtitle: const Text('Configure organization settings & rules'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SystemSettingsScreen()),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Section Title: Account & Security ─────────────────────
          Text(
            'Account & Security',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 10),

          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.edit_outlined, color: AppColors.primary),
                  title: const Text('Edit Profile'),
                  subtitle: const Text('Update name, phone & personal details'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => EditProfileScreen(user: user)),
                    );
                  },
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.lock_reset_outlined, color: AppColors.teal),
                  title: const Text('Change Password'),
                  subtitle: const Text('Update your account security password'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
                    );
                  },
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.logout, color: AppColors.error),
                  title: const Text('Logout', style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Sign out of your active HR session'),
                  onTap: () => _confirmLogout(context, ref),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary),
      title: Text(
        title,
        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
      ),
      subtitle: Text(
        subtitle,
        style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Confirm Logout'),
        content: const Text('Are you sure you want to sign out of your account?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () {
              Navigator.of(dialogCtx).pop();
              ref.read(authProvider.notifier).logout();
            },
            child: const Text('Logout', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
