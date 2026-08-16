import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/attendance_provider.dart';
import 'qr_scanner_screen.dart';

class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key});

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
                          subtitle: Text(
                            'In: ${item.clockInTime ?? '--:--'}  •  Out: ${item.clockOutTime ?? '--:--'}',
                            style: GoogleFonts.inter(fontSize: 12),
                          ),
                          trailing: Text(
                            item.workHours != null ? '${item.workHours!.toStringAsFixed(1)} hrs' : '',
                            style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.primary),
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
