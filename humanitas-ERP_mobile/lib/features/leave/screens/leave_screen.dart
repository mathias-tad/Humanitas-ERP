import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/leave_provider.dart';
import 'apply_leave_screen.dart';

class LeaveScreen extends ConsumerWidget {
  const LeaveScreen({super.key});

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return AppColors.success;
      case 'rejected':
        return AppColors.error;
      case 'pending':
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balancesAsync = ref.watch(myLeaveBalancesProvider);
    final requestsAsync = ref.watch(myLeaveRequestsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Management'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Apply Leave',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ApplyLeaveScreen()),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myLeaveBalancesProvider);
          ref.invalidate(myLeaveRequestsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Apply Banner Button
              ElevatedButton.icon(
                icon: const Icon(Icons.beach_access_rounded),
                label: const Text('Apply For Leave'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: const Color(0xFF1A1200),
                ),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ApplyLeaveScreen()),
                  );
                },
              ),
              const SizedBox(height: 24),

              // Balances Section
              Text(
                'Leave Balances',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              balancesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => const Text('Failed to load leave balances'),
                data: (balances) {
                  if (balances.isEmpty) {
                    return const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No leave balance details available.'),
                      ),
                    );
                  }
                  return GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 1.6,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: balances.length,
                    itemBuilder: (context, index) {
                      final item = balances[index];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                item.leaveTypeName,
                                style: GoogleFonts.inter(fontSize: 12, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${item.remaining.toStringAsFixed(0)} days left',
                                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${item.used.toStringAsFixed(0)} used of ${item.allocated.toStringAsFixed(0)}',
                                style: GoogleFonts.inter(fontSize: 10, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),

              const SizedBox(height: 24),

              // Requests Section
              Text(
                'My Requests',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              requestsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => const Text('Failed to load leave requests'),
                data: (requests) {
                  if (requests.isEmpty) {
                    return const Card(
                      child: Padding(
                        padding: EdgeInsets.all(24.0),
                        child: Center(child: Text('No leave requests submitted yet.')),
                      ),
                    );
                  }

                  return ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: requests.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final req = requests[index];
                      final statusColor = _getStatusColor(req.status);

                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    req.leaveTypeName,
                                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      req.status.toUpperCase(),
                                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: statusColor),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${req.startDate}  →  ${req.endDate} (${req.totalDays.toStringAsFixed(0)} days)',
                                style: GoogleFonts.inter(fontSize: 13, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                              ),
                              if (req.reason != null && req.reason!.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text('Reason: ${req.reason}', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey)),
                              ],
                              if (req.status.toLowerCase() == 'pending') ...[
                                const SizedBox(height: 8),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton.icon(
                                    icon: const Icon(Icons.cancel_outlined, size: 16, color: AppColors.error),
                                    label: const Text('Cancel Request', style: TextStyle(color: AppColors.error, fontSize: 12)),
                                    onPressed: () async {
                                      final repo = ref.read(leaveRepositoryProvider);
                                      try {
                                        await repo.cancelRequest(req.id);
                                        ref.invalidate(myLeaveRequestsProvider);
                                        ref.invalidate(myLeaveBalancesProvider);
                                      } catch (_) {}
                                    },
                                  ),
                                ),
                              ],
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
