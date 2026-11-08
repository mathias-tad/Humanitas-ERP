import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../models/attendance_record_model.dart';
import '../providers/attendance_provider.dart';
import 'qr_scanner_screen.dart';

class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key});

  void _showRegularizationDialog(BuildContext context, WidgetRef ref, AttendanceRecordModel item) {
    final inController = TextEditingController(text: item.clockInTime ?? '');
    final outController = TextEditingController(text: item.clockOutTime ?? '');
    final reasonController = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(
            'Request Regularization',
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.grey.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Work Date: ${item.date}', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                      const SizedBox(height: 4),
                      Text('Recorded: In ${item.clockInTime ?? '--:--'} • Out ${item.clockOutTime ?? '--:--'}', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[700])),
                      if (item.missedPunchType != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          item.missedPunchType == 'missed_in' ? 'Flag: Missed Clock-In' : 'Flag: Missed Clock-Out',
                          style: GoogleFonts.inter(fontSize: 12, color: Colors.red, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: inController,
                  decoration: const InputDecoration(
                    labelText: 'Requested Clock-In (HH:mm)',
                    prefixIcon: Icon(Icons.login_rounded, size: 20),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: outController,
                  decoration: const InputDecoration(
                    labelText: 'Requested Clock-Out (HH:mm)',
                    prefixIcon: Icon(Icons.logout_rounded, size: 20),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reasonController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Reason / Explanation *',
                    hintText: 'e.g. Biometric scanner issue, client visit, forgot punch...',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final reason = reasonController.text.trim();
                      if (reason.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Please enter a reason for regularization.'), backgroundColor: AppColors.error),
                        );
                        return;
                      }

                      setState(() => isSubmitting = true);
                      try {
                        final repo = ref.read(attendanceRepositoryProvider);
                        await repo.requestAttendanceCorrection(
                          recordId: item.id,
                          requestedClockIn: inController.text.trim().isNotEmpty ? inController.text.trim() : null,
                          requestedClockOut: outController.text.trim().isNotEmpty ? outController.text.trim() : null,
                          reason: reason,
                        );
                        if (context.mounted) {
                          Navigator.of(ctx).pop();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Regularization request submitted for manager review.'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                          final now = DateTime.now();
                          ref.invalidate(myRecordsProvider((month: now.month, year: now.year)));
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
                          );
                        }
                      } finally {
                        setState(() => isSubmitting = false);
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Submit Request'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final recordsAsync = ref.watch(myRecordsProvider((month: now.month, year: now.year)));
    final scheduleAsync = ref.watch(myScheduleProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myRecordsProvider((month: now.month, year: now.year)));
          ref.invalidate(myScheduleProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Schedule Card
              scheduleAsync.when(
                loading: () => const Card(child: SizedBox(height: 100, child: Center(child: CircularProgressIndicator()))),
                error: (e, _) => const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('Default Shift: 09:00 - 17:00'))),
                data: (schedule) => Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.access_time_filled_rounded, color: AppColors.primary),
                            const SizedBox(width: 10),
                            Text(
                              schedule.shiftName ?? 'Standard Shift',
                              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Hours: ${schedule.startTime} - ${schedule.endTime}',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Action Buttons Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    children: [
                      ElevatedButton.icon(
                        icon: const Icon(Icons.qr_code_scanner),
                        label: const Text('Scan QR Code to Clock In'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: const Color(0xFF1A1200),
                        ),
                        onPressed: () async {
                          final result = await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const QrScannerScreen(isClockIn: true)),
                          );
                          if (result == true) {
                            ref.invalidate(myRecordsProvider((month: now.month, year: now.year)));
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.logout_rounded),
                        label: const Text('Clock Out'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.error,
                          side: const BorderSide(color: AppColors.error),
                        ),
                        onPressed: () async {
                          final repo = ref.read(attendanceRepositoryProvider);
                          try {
                            await repo.clockOut();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Clocked out successfully!'), backgroundColor: AppColors.success),
                              );
                              ref.invalidate(myRecordsProvider((month: now.month, year: now.year)));
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
                              );
                            }
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Recent History Title
              Text(
                'Attendance History (${now.month}/${now.year})',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),

              // Records List
              recordsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, _) => Text('Error loading history: $err'),
                data: (records) {
                  if (records.isEmpty) {
                    return const Card(
                      child: Padding(
                        padding: EdgeInsets.all(24.0),
                        child: Center(child: Text('No attendance records found for this month.')),
                      ),
                    );
                  }

                  return ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: records.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final item = records[index];
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: item.status == 'present'
                                ? AppColors.success.withValues(alpha: 0.15)
                                : AppColors.error.withValues(alpha: 0.15),
                            child: Icon(
                              item.status == 'present' ? Icons.check_circle_outline : Icons.cancel_outlined,
                              color: item.status == 'present' ? AppColors.success : AppColors.error,
                            ),
                          ),
                          title: Text(item.date, style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 2),
                              Text(
                                'In: ${item.clockInTime ?? '--:--'}  •  Out: ${item.clockOutTime ?? '--:--'}',
                                style: GoogleFonts.inter(fontSize: 12),
                              ),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: [
                                  if (item.clockMethod == 'biometric')
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.purple.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: Colors.purple.withValues(alpha: 0.3)),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.fingerprint, size: 12, color: Colors.purple),
                                          const SizedBox(width: 4),
                                          Text(
                                            item.deviceName ?? 'Biometric Terminal',
                                            style: GoogleFonts.inter(fontSize: 10, color: Colors.purple, fontWeight: FontWeight.w600),
                                          ),
                                        ],
                                      ),
                                    )
                                  else if (item.clockMethod == 'qr_code' || item.clockMethod == 'qr')
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.blue.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: Colors.blue.withValues(alpha: 0.3)),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.qr_code, size: 12, color: Colors.blue),
                                          const SizedBox(width: 4),
                                          Text(
                                            'QR Code Scan',
                                            style: GoogleFonts.inter(fontSize: 10, color: Colors.blue, fontWeight: FontWeight.w600),
                                          ),
                                        ],
                                      ),
                                    )
                                  else
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.grey.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
                                      ),
                                      child: Text(
                                        'Manual',
                                        style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[700], fontWeight: FontWeight.w500),
                                      ),
                                    ),
                                  if (item.missedPunchType == 'missed_in')
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.red.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                                      ),
                                      child: Text(
                                        'Missed In',
                                        style: GoogleFonts.inter(fontSize: 10, color: Colors.red, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  if (item.missedPunchType == 'missed_out')
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.amber.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                                      ),
                                      child: Text(
                                        'Missed Out',
                                        style: GoogleFonts.inter(fontSize: 10, color: Colors.amber[900], fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  if (item.isOvernight)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.indigo.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: Colors.indigo.withValues(alpha: 0.3)),
                                      ),
                                      child: Text(
                                        'Overnight',
                                        style: GoogleFonts.inter(fontSize: 10, color: Colors.indigo, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  if (item.autoClosedAt != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.grey.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
                                      ),
                                      child: Text(
                                        'Auto-Closed (0 OT)',
                                        style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[800], fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                item.workHours != null ? '${item.workHours!.toStringAsFixed(1)} hrs' : '',
                                style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.primary),
                              ),
                              TextButton(
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(60, 22),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                onPressed: () => _showRegularizationDialog(context, ref, item),
                                child: Text(
                                  'Regularize',
                                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
