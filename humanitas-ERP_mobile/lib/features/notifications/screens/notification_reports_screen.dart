import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../providers/notification_reports_provider.dart';

class NotificationReportsScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? initialDeliveryStats;
  final Map<String, dynamic>? initialPreferenceDistribution;

  const NotificationReportsScreen({
    super.key,
    this.initialDeliveryStats,
    this.initialPreferenceDistribution,
  });

  @override
  ConsumerState<NotificationReportsScreen> createState() =>
      _NotificationReportsScreenState();
}

class _NotificationReportsScreenState
    extends ConsumerState<NotificationReportsScreen> {
  int _selectedDays = 30;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    final bool isOwnerOrAdmin = user?.role == 'owner' ||
        user?.role == 'admin' ||
        user?.role == 'administrator';
    final bool hasPermission = isOwnerOrAdmin ||
        (user != null &&
            authState.hasAnyPermission([
              'view_notification_reports',
              'manage_notifications',
            ]));

    if (!hasPermission) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'Notification Reports',
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
              Text(
                'You do not have permission to view notification reports.',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.textSecondaryLight,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final deliveryAsync = widget.initialDeliveryStats != null
        ? AsyncValue.data(widget.initialDeliveryStats!)
        : ref.watch(notificationDeliveryStatsProvider(_selectedDays));

    final prefDistAsync = widget.initialPreferenceDistribution != null
        ? AsyncValue.data(widget.initialPreferenceDistribution!)
        : ref.watch(notificationPreferenceDistributionProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Notification Reports',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              ref.invalidate(notificationDeliveryStatsProvider);
              ref.invalidate(notificationPreferenceDistributionProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(notificationDeliveryStatsProvider);
          ref.invalidate(notificationPreferenceDistributionProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Days selector
              _buildDaysSelector(),
              const SizedBox(height: 20),

              // Delivery Stats
              Text(
                'Delivery Statistics',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondaryLight,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 12),
              deliveryAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(
                    'Error loading delivery stats: $e',
                    style: GoogleFonts.inter(color: AppColors.error),
                  ),
                ),
                data: (stats) => _buildDeliveryStatsGrid(stats),
              ),
              const SizedBox(height: 24),

              // Preference Distribution
              Text(
                'Preference Distribution',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondaryLight,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 12),
              prefDistAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(
                    'Error loading preference distribution: $e',
                    style: GoogleFonts.inter(color: AppColors.error),
                  ),
                ),
                data: (dist) => _buildPreferenceDistribution(dist),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDaysSelector() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Text(
            'Period:',
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondaryLight,
            ),
          ),
          const SizedBox(width: 12),
          Wrap(
            spacing: 8,
            children: [7, 30, 90].map((d) {
              final isSelected = _selectedDays == d;
              return ChoiceChip(
                label: Text('$d days'),
                selected: isSelected,
                onSelected: (selected) {
                  if (selected) setState(() => _selectedDays = d);
                },
                selectedColor: AppColors.primary.withOpacity(0.15),
                labelStyle: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected
                      ? AppColors.primary
                      : AppColors.textSecondaryLight,
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveryStatsGrid(Map<String, dynamic> stats) {
    final totalSent = stats['totalSent'] ?? stats['total_sent'] ?? 0;
    final delivered = stats['delivered'] ?? 0;
    final failed = stats['failed'] ?? 0;
    final deliveryRate =
        stats['deliveryRate'] ?? stats['delivery_rate'] ?? 0.0;

    final items = [
      _StatItem(
          'Total Sent', totalSent.toString(), Icons.send_outlined, AppColors.primary),
      _StatItem(
          'Delivered', delivered.toString(), Icons.check_circle_outline, AppColors.success),
      _StatItem(
          'Failed', failed.toString(), Icons.cancel_outlined, AppColors.error),
      _StatItem(
        'Delivery Rate',
        '${(deliveryRate is double ? deliveryRate : (deliveryRate as num).toDouble()).toStringAsFixed(1)}%',
        Icons.analytics_outlined,
        Colors.indigo,
      ),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.6,
      children: items.map((item) => _buildStatCard(item)).toList(),
    );
  }

  Widget _buildStatCard(_StatItem item) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: item.color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: item.color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(item.icon, color: item.color, size: 18),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  item.label,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppColors.textSecondaryLight,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          Text(
            item.value,
            style: GoogleFonts.inter(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: item.color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreferenceDistribution(Map<String, dynamic> dist) {
    final emailOnly = dist['emailOnly'] ?? dist['email_only'] ?? 0;
    final pushOnly = dist['pushOnly'] ?? dist['push_only'] ?? 0;
    final both = dist['both'] ?? 0;
    final none = dist['none'] ?? 0;

    final items = [
      _PrefItem('Email Only', emailOnly, Icons.email_outlined, Colors.blue),
      _PrefItem(
          'Push Only', pushOnly, Icons.notifications_outlined, Colors.orange),
      _PrefItem('Both', both, Icons.all_inclusive, AppColors.success),
      _PrefItem('None', none, Icons.notifications_off_outlined,
          Colors.grey.shade500),
    ];

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Column(
        children: items.asMap().entries.map((entry) {
          final idx = entry.key;
          final item = entry.value;
          return Column(
            children: [
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: item.color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(item.icon, color: item.color, size: 18),
                ),
                title: Text(
                  item.label,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimaryLight,
                  ),
                ),
                trailing: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: item.color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    item.count.toString(),
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: item.color,
                    ),
                  ),
                ),
              ),
              if (idx < items.length - 1)
                Divider(
                    height: 1,
                    indent: 16,
                    endIndent: 16,
                    color: Colors.grey.shade100),
            ],
          );
        }).toList(),
      ),
    );
  }
}

class _StatItem {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _StatItem(this.label, this.value, this.icon, this.color);
}

class _PrefItem {
  final String label;
  final dynamic count;
  final IconData icon;
  final Color color;
  const _PrefItem(this.label, this.count, this.icon, this.color);
}
