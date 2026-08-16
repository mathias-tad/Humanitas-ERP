import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/widgets/full_screen_avatar_viewer.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/user_model.dart';
import '../../../core/providers/auth_provider.dart';
import '../providers/profile_provider.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  final UserModel user;
  const EditProfileScreen({super.key, required this.user});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _fullNameController;
  late TextEditingController _phoneController;
  late TextEditingController _positionController;
  late TextEditingController _departmentController;

  bool _isLoading = false;

  void _handleAvatarChange() {
    showAvatarPickerSheet(
      context: context,
      currentAvatarUrl: widget.user.avatarUrl,
      name: widget.user.displayName,
      onImagePicked: (bytes, filename, mime) async {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Uploading photo...'), duration: Duration(seconds: 2)),
        );
        try {
          await ref.read(profileProvider.notifier).uploadAvatar(bytes, filename, mime);
          await ref.read(authProvider.notifier).refreshUser();
          if (mounted) {
            setState(() {});
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Profile photo updated!'), backgroundColor: AppColors.success),
            );
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Failed to upload photo: ${e.toString().replaceAll("Exception: ", "")}'), backgroundColor: AppColors.error),
            );
          }
        }
      },
      onDelete: widget.user.avatarUrl != null && widget.user.avatarUrl!.isNotEmpty ? _handleAvatarDelete : null,
    );
  }

  Future<void> _handleAvatarDelete() async {
    try {
      await ref.read(profileProvider.notifier).deleteAvatar();
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile photo removed'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to remove photo: ${e.toString().replaceAll("Exception: ", "")}'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();

    // Backend stores a single full_name field
    String initialName = widget.user.displayName.trim();
    if (initialName.isEmpty) {
      final fn = widget.user.firstName ?? '';
      final ln = widget.user.lastName ?? '';
      initialName = '$fn $ln'.trim();
    }

    _fullNameController   = TextEditingController(text: initialName);
    _phoneController      = TextEditingController(text: widget.user.phoneNumber ?? '');
    _positionController   = TextEditingController(text: widget.user.position ?? '');
    _departmentController = TextEditingController(text: widget.user.department ?? '');
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    _positionController.dispose();
    _departmentController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_formKey.currentState?.validate() ?? false) {
      setState(() => _isLoading = true);

      final Map<String, dynamic> delta = {};

      // Backend uses full_name (single field)
      final newName = _fullNameController.text.trim();
      if (newName != widget.user.displayName.trim()) {
        delta['full_name'] = newName;
      }

      // Backend uses phone (not phone_number)
      final newPhone = _phoneController.text.trim();
      if (newPhone != (widget.user.phoneNumber ?? '')) {
        delta['phone'] = newPhone;
      }

      final canEditWorkInfo = ref.read(authProvider.notifier).hasPermission('edit_users');
      if (canEditWorkInfo) {
        final newPosition = _positionController.text.trim();
        if (newPosition != (widget.user.position ?? '')) {
          delta['position'] = newPosition;
        }

        final newDept = _departmentController.text.trim();
        if (newDept != (widget.user.department ?? '')) {
          delta['department'] = newDept;
        }
      }

      if (delta.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No changes detected.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        setState(() => _isLoading = false);
        return;
      }

      try {
        await ref.read(profileProvider.notifier).updateProfile(delta);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profile updated successfully!'),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
          Navigator.of(context).pop();
        }
      } catch (e) {
        if (mounted) {
          final cleanMsg = e.toString().replaceAll('Exception: ', '');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(cleanMsg),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final canEditWorkInfo = ref.watch(authProvider.notifier).hasPermission('edit_users');
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Profile'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Avatar Section
              Center(
                child: Stack(
                  alignment: Alignment.bottomRight,
                  children: [
                    GestureDetector(
                      onTap: () {
                        final currUser = ref.watch(authProvider).user ?? widget.user;
                        if (currUser.avatarUrl != null && currUser.avatarUrl!.isNotEmpty) {
                          FullScreenAvatarViewer.show(
                            context,
                            avatarUrl: currUser.avatarUrl,
                            title: currUser.displayName,
                            heroTag: 'edit_avatar_${currUser.id}',
                            onEditAvatar: _handleAvatarChange,
                            onDeleteAvatar: currUser.avatarUrl != null && currUser.avatarUrl!.isNotEmpty
                                ? _handleAvatarDelete
                                : null,
                          );
                        } else {
                          _handleAvatarChange();
                        }
                      },
                      child: Builder(builder: (context) {
                        final currUser = ref.watch(authProvider).user ?? widget.user;
                        return CircleAvatar(
                          radius: 50,
                          backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                          backgroundImage: currUser.avatarUrl != null && currUser.avatarUrl!.isNotEmpty
                              ? NetworkImage(currUser.avatarUrl!)
                              : null,
                          child: currUser.avatarUrl == null || currUser.avatarUrl!.isEmpty
                              ? Text(
                                  currUser.displayName.isNotEmpty
                                      ? currUser.displayName[0].toUpperCase()
                                      : 'U',
                                  style: GoogleFonts.inter(
                                    fontSize: 38,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                )
                              : null,
                        );
                      }),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: GestureDetector(
                        onTap: _handleAvatarChange,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          child: const Icon(Icons.camera_alt, size: 16, color: Color(0xFF1A1200)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Notice Banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: AppColors.primary, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Fields marked with a lock icon are protected by HR policy and cannot be edited directly.',
                        style: GoogleFonts.inter(fontSize: 12, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ── Read-Only Blurred Field: Email ──────────────────────────
              _buildBlurredLockedField(
                context,
                label: 'Email Address',
                value: widget.user.email,
                icon: Icons.email_outlined,
                reason: 'Managed by Organization Administrator',
                isDark: isDark,
              ),

              const SizedBox(height: 18),

              // ── Editable Field: Full Name ───────────────────────────────
              TextFormField(
                controller: _fullNameController,
                decoration: const InputDecoration(
                  labelText: 'Full Name',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (val) => val == null || val.trim().isEmpty ? 'Full name is required' : null,
              ),

              const SizedBox(height: 18),

              // ── Editable Field: Phone Number ───────────────────────────
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone Number',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
              ),

              const SizedBox(height: 18),

              // ── Department Field ───────────────────────────────────────
              if (canEditWorkInfo)
                TextFormField(
                  controller: _departmentController,
                  decoration: const InputDecoration(
                    labelText: 'Department',
                    prefixIcon: Icon(Icons.business_outlined),
                  ),
                )
              else
                _buildBlurredLockedField(
                  context,
                  label: 'Department',
                  value: widget.user.department ?? 'General Operations',
                  icon: Icons.business_outlined,
                  reason: 'Requires HR Admin Permission to edit',
                  isDark: isDark,
                ),

              const SizedBox(height: 18),

              // ── Position / Job Title Field ──────────────────────────────
              if (canEditWorkInfo)
                TextFormField(
                  controller: _positionController,
                  decoration: const InputDecoration(
                    labelText: 'Job Title / Position',
                    prefixIcon: Icon(Icons.work_outline),
                  ),
                )
              else
                _buildBlurredLockedField(
                  context,
                  label: 'Job Title / Position',
                  value: widget.user.position ?? 'Team Member',
                  icon: Icons.work_outline,
                  reason: 'Requires HR Admin Permission to edit',
                  isDark: isDark,
                ),

              const SizedBox(height: 32),

              ElevatedButton.icon(
                icon: _isLoading
                    ? const SizedBox.shrink()
                    : const Icon(Icons.check_circle_outline),
                label: _isLoading
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Save Changes'),
                onPressed: _isLoading ? null : _save,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Custom Frosted / Blurred Container for Locked Read-Only Fields ──────
  Widget _buildBlurredLockedField(
    BuildContext context, {
    required String label,
    required String value,
    required IconData icon,
    required String reason,
    required bool isDark,
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 3, sigmaY: 3),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.04)
                : Colors.black.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.12)
                  : Colors.black.withValues(alpha: 0.12),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 18, color: AppColors.primary.withValues(alpha: 0.7)),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.lock, size: 11, color: AppColors.error),
                        const SizedBox(width: 4),
                        Text(
                          'LOCKED',
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                value.isNotEmpty ? value : 'Not Set',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: (isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight)
                      .withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                reason,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
