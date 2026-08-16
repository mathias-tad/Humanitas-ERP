import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/notification_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  IconData _iconForType(String? type) {
    switch (type?.toLowerCase()) {
      case 'leave':
        return Icons.beach_access_rounded;
      case 'payroll':
        return Icons.receipt_long_rounded;
      case 'loan':
        return Icons.account_balance_rounded;
      case 'attendance':
        return Icons.access_time_rounded;
      case 'announcement':
        return Icons.campaign_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }

  Color _colorForType(String? type) {
    switch (type?.toLowerCase()) {
      case 'leave':
        return AppColors.teal;
      case 'payroll':
        return AppColors.success;
      case 'loan':
        return AppColors.warning;
      case 'attendance':
        return AppColors.primary;
      default:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.done_all_rounded, size: 18),
            label: const Text('Mark all read'),
            onPressed: () {
              ref.read(notificationsProvider.notifier).markAllAsRead();
              ref.invalidate(unreadNotificationsCountProvider);
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: notificationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(e.toString().replaceAll('Exception: ', ''),
                  textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 14)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                onPressed: () => ref.read(notificationsProvider.notifier).fetch(),
              ),
            ],
          ),
        ),
        data: (notifications) {
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_off_outlined,
                    size: 72,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                  const SizedBox(height: 16),
                  Text('No notifications',
                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text(
                    'You are all caught up! Updates will appear here.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(notificationsProvider.notifier).fetch(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              itemBuilder: (context, i) {
                final item = notifications[i];
                final icon = _iconForType(item.type);
                final color = _colorForType(item.type);

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  color: item.isRead
                      ? (isDark ? AppColors.cardDark : AppColors.cardLight)
                      : (isDark ? AppColors.surfaceDark : AppColors.primarySurface),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () {
                      if (!item.isRead) {
                        ref.read(notificationsProvider.notifier).markAsRead(item.id);
                        ref.invalidate(unreadNotificationsCountProvider);
                      }
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(icon, color: color, size: 22),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        item.title,
                                        style: GoogleFonts.inter(
                                          fontSize: 14,
                                          fontWeight: item.isRead ? FontWeight.w600 : FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    if (item.timeAgo.isNotEmpty)
                                      Text(
                                        item.timeAgo,
                                        style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[500]),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item.message,
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (!item.isRead)
                            Container(
                              margin: const EdgeInsets.only(left: 8, top: 4),
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
