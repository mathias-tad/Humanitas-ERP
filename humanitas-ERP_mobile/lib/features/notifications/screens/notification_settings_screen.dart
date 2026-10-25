import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/notifications/models/notification_preference_model.dart';
import 'package:humanitas_erp_mobile/features/notifications/providers/notification_provider.dart';

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  final List<NotificationPreferenceModel>? initialPreferences;

  const NotificationSettingsScreen({
    super.key,
    this.initialPreferences,
  });

  @override
  ConsumerState<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends ConsumerState<NotificationSettingsScreen> {
  final Map<String, String> _pendingChanges = {};
  bool _isSaving = false;

  static const List<({String value, String label, IconData icon})>
      _channelOptions = [
    (value: 'email', label: 'Email Only', icon: Icons.email_outlined),
    (
      value: 'push',
      label: 'Push Only',
      icon: Icons.notifications_active_outlined
    ),
    (value: 'both', label: 'Both', icon: Icons.layers_outlined),
    (value: 'none', label: 'Off', icon: Icons.notifications_off_outlined),
  ];

  static const List<String> _groupOrder = [
    'Personal & Self-Service',
    'Approvals & Management',
    'Admin & System',
  ];

  bool _isChannelSelected(String current, String optionValue) {
    if (current == optionValue) return true;
    if ((current == 'none' || current == 'off') &&
        (optionValue == 'none' || optionValue == 'off')) {
      return true;
    }
    return false;
  }

  Future<void> _saveChanges() async {
    if (_pendingChanges.isEmpty) return;

    setState(() => _isSaving = true);
    try {
      final updates = _pendingChanges.entries
          .map((e) => {'category': e.key, 'channel': e.value})
          .toList();

      final repo = ref.read(notificationRepositoryProvider);
      await repo.bulkUpdatePreferences(updates);

      if (mounted) {
        setState(() {
          _pendingChanges.clear();
          _isSaving = false;
        });
        ref.invalidate(notificationPreferencesProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Notification preferences saved successfully',
              style: GoogleFonts.inter(),
            ),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Failed to save notification preferences: $e',
              style: GoogleFonts.inter(),
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    final String? role = user?.role?.toLowerCase();
    final bool isOwnerOrAdmin =
        role == 'owner' || role == 'admin' || role == 'administrator';
    final bool hasPermission = isOwnerOrAdmin ||
        authState.hasAnyPermission([
          'view_notification_preferences',
          'use_ai',
        ]);

    if (!hasPermission) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'Notification Preferences',
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 64, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                'Access Denied',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimaryLight,
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Text(
                  'You do not have permission to manage notification preferences.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.textSecondaryLight,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final prefsAsync = widget.initialPreferences != null
        ? AsyncValue.data(widget.initialPreferences!)
        : ref.watch(notificationPreferencesProvider);

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Notification Preferences',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          if (_pendingChanges.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: TextButton.icon(
                icon: _isSaving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        ),
                      )
                    : const Icon(Icons.check, size: 18, color: AppColors.primary),
                label: Text(
                  'Save',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
                onPressed: _isSaving ? null : _saveChanges,
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh',
              onPressed: () {
                setState(() => _pendingChanges.clear());
                ref.invalidate(notificationPreferencesProvider);
              },
            ),
        ],
      ),
      body: prefsAsync.when(
        data: (preferences) {
          if (preferences.isEmpty) {
            return _buildEmptyState();
          }
          return RefreshIndicator(
            onRefresh: () async {
              setState(() => _pendingChanges.clear());
              ref.invalidate(notificationPreferencesProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                _buildHeaderNote(isDark),
                const SizedBox(height: 16),
                ..._buildGroupedSections(preferences, isDark),
              ],
            ),
          );
        },
        loading: () => const Center(
          child: Padding(
            padding: EdgeInsets.all(32.0),
            child: CircularProgressIndicator(),
          ),
        ),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    size: 48, color: AppColors.error),
                const SizedBox(height: 12),
                Text(
                  'Error loading notification preferences: $err',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(color: AppColors.error),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                  onPressed: () =>
                      ref.invalidate(notificationPreferencesProvider),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderNote(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.primary.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.primary, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Select how you want to receive alerts for each category. Tap Save to apply changes.',
              style: GoogleFonts.inter(
                fontSize: 12,
                color: isDark
                    ? AppColors.textSecondaryDark
                    : AppColors.textSecondaryLight,
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildGroupedSections(
      List<NotificationPreferenceModel> preferences, bool isDark) {
    final Map<String, List<NotificationPreferenceModel>> groups = {};

    for (final pref in preferences) {
      final group =
          kNotificationCategoryGroups[pref.category] ?? 'Personal & Self-Service';
      groups.putIfAbsent(group, () => []).add(pref);
    }

    final List<Widget> widgets = [];

    // Render in designated group order first
    for (final group in _groupOrder) {
      final list = groups[group];
      if (list != null && list.isNotEmpty) {
        widgets.add(_buildGroupCard(group, list, isDark));
        widgets.add(const SizedBox(height: 16));
      }
    }

    // Render any remaining custom groups
    for (final entry in groups.entries) {
      if (!_groupOrder.contains(entry.key) && entry.value.isNotEmpty) {
        widgets.add(_buildGroupCard(entry.key, entry.value, isDark));
        widgets.add(const SizedBox(height: 16));
      }
    }

    return widgets;
  }

  Widget _buildGroupCard(String groupTitle,
      List<NotificationPreferenceModel> items, bool isDark) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isDark ? AppColors.borderDark : Colors.grey.shade200,
        ),
      ),
      color: isDark ? AppColors.cardDark : AppColors.cardLight,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Text(
                groupTitle.toUpperCase(),
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                  color: AppColors.primary,
                ),
              ),
            ),
            const Divider(height: 16),
            ...items.asMap().entries.map((entry) {
              final idx = entry.key;
              final item = entry.value;
              return Column(
                children: [
                  if (idx > 0)
                    Divider(
                      height: 16,
                      indent: 16,
                      endIndent: 16,
                      color: isDark ? AppColors.borderDark : Colors.grey.shade100,
                    ),
                  _buildCategoryItem(item, isDark),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryItem(
      NotificationPreferenceModel item, bool isDark) {
    final currentChannel = _pendingChanges[item.category] ?? item.channel;
    final label = kNotificationCategoryLabels[item.category] ??
        _formatCategoryName(item.category);
    final isModified = _pendingChanges.containsKey(item.category);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: isDark
                        ? AppColors.textPrimaryDark
                        : AppColors.textPrimaryLight,
                  ),
                ),
              ),
              if (isModified)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'Modified',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _channelOptions.map((opt) {
                final isSelected =
                    _isChannelSelected(currentChannel, opt.value);
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        if (_isChannelSelected(item.channel, opt.value)) {
                          _pendingChanges.remove(item.category);
                        } else {
                          _pendingChanges[item.category] = opt.value;
                        }
                      });
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color:
                            isSelected ? AppColors.primary : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primary
                              : (isDark
                                  ? AppColors.borderDark
                                  : Colors.grey.shade300),
                          width: 1.2,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isSelected) ...[
                            const Icon(Icons.check,
                                size: 14, color: Colors.white),
                            const SizedBox(width: 4),
                          ],
                          Text(
                            opt.label,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: isSelected
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                              color: isSelected
                                  ? Colors.white
                                  : (isDark
                                      ? AppColors.textPrimaryDark
                                      : AppColors.textPrimaryLight),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.notifications_off_outlined,
                size: 56, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              'No notification categories available',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimaryLight,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'No notification categories available for your role.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatCategoryName(String category) {
    return category
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
        .join(' ');
  }
}
