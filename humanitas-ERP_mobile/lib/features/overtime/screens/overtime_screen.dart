import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/overtime_provider.dart';

class OvertimeScreen extends ConsumerWidget {
  const OvertimeScreen({super.key});

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return AppColors.success;
      case 'rejected':
        return AppColors.error;
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recordsAsync = ref.watch(overtimeRecordsProvider);
    final periodStatusAsync = ref.watch(overtimePeriodStatusProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Overtime'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              ref.read(overtimeRecordsProvider.notifier).fetch();
              ref.invalidate(overtimePeriodStatusProvider);
            },
          ),
        ],
      ),
      body: recordsAsync.when(
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
                onPressed: () => ref.read(overtimeRecordsProvider.notifier).fetch(),
              ),
            ],
          ),
        ),
        data: (records) {
          final totalApprovedHours = records
              .where((r) => r.status == 'approved')
              .fold(0.0, (sum, r) => sum + r.hours);

          return RefreshIndicator(
            onRefresh: () async {
              ref.read(overtimeRecordsProvider.notifier).fetch();
              ref.invalidate(overtimePeriodStatusProvider);
            },
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Summary Card ─────────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Approved Overtime',
                              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.black54),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${totalApprovedHours.toStringAsFixed(1)} hrs',
                              style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black87),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.timer_outlined, color: Colors.black87, size: 28),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Period Status ────────────────────────────────────────
                  periodStatusAsync.when(
                    data: (info) {
                      if (info.isEmpty) return const SizedBox.shrink();
                      return Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.teal.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.teal.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, color: AppColors.teal, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Current Period Phase: ${info['phase'] ?? info['status'] ?? 'Active'}',
                                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                  ),

                  // ── Records List Header ─────────────────────────────────
                  Text('Overtime Log', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),

                  if (records.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          children: [
                            Icon(Icons.more_time_rounded, size: 64, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                            const SizedBox(height: 12),
                            Text('No overtime records found', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    )
                  else
                    ...records.map((r) => Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: _statusColor(r.status).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(Icons.access_time_rounded, color: _statusColor(r.status), size: 22),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        r.formattedDate.isNotEmpty ? r.formattedDate : 'Overtime Entry',
                                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${r.hours} hours @ ${r.rateMultiplier}x rate',
                                        style: GoogleFonts.inter(fontSize: 12, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _statusColor(r.status).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    r.status.toUpperCase(),
                                    style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: _statusColor(r.status)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
