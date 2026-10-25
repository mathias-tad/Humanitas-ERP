import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/expenses/models/expense_model.dart';
import 'package:humanitas_erp_mobile/features/expenses/providers/expense_provider.dart';

class ExpensesScreen extends ConsumerStatefulWidget {
  final List<ExpenseReportModel>? initialMyReports;
  final List<ExpenseReportModel>? initialAllReports;
  final ExpenseAnalyticsModel? initialAnalytics;

  const ExpensesScreen({
    super.key,
    this.initialMyReports,
    this.initialAllReports,
    this.initialAnalytics,
  });

  @override
  ConsumerState<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends ConsumerState<ExpensesScreen> {
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
              'view_expenses',
              'view_my_expenses',
              'submit_expenses',
            ]));

    if (!hasPermission) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'Expense Claims',
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
                'You do not have permission to view expense claims.',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final statsAsync = widget.initialAnalytics != null
        ? AsyncValue.data(widget.initialAnalytics!)
        : ref.watch(expenseAnalyticsProvider);

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            'Expense Claims',
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh',
              onPressed: () {
                ref.invalidate(expenseAnalyticsProvider);
                ref.invalidate(myExpenseReportsProvider);
                ref.invalidate(allExpenseReportsProvider);
              },
            ),
          ],
          bottom: TabBar(
            indicatorColor: AppColors.primary,
            labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
            unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.normal, fontSize: 14),
            tabs: const [
              Tab(text: 'My Claims'),
              Tab(text: 'Approvals'),
            ],
          ),
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: statsAsync.when(
                data: (stats) => _buildStatsRow(stats),
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => const SizedBox.shrink(),
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _MyClaimsTab(initialReports: widget.initialMyReports),
                  _ApprovalsTab(initialReports: widget.initialAllReports),
                ],
              ),
            ),
          ],
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () => _showCreateDialog(context),
          backgroundColor: AppColors.primary,
          child: const Icon(Icons.add, color: Colors.white),
        ),
      ),
    );
  }

  Widget _buildStatsRow(ExpenseAnalyticsModel stats) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildStatTile(
                title: 'Report Count',
                value: stats.reportCount.toString(),
                color: AppColors.primary,
                icon: Icons.receipt_long_outlined,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatTile(
                title: 'Total Approved',
                value: '\$${stats.totalApproved.toStringAsFixed(2)}',
                color: AppColors.success,
                icon: Icons.check_circle_outline,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildStatTile(
                title: 'Pending Approvals',
                value: stats.pendingApprovals.toString(),
                color: Colors.amber.shade700,
                icon: Icons.pending_actions_outlined,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatTile(
                title: 'Pending Amount',
                value: '\$${stats.totalPending.toStringAsFixed(2)}',
                color: Colors.blue.shade700,
                icon: Icons.hourglass_top_outlined,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatTile({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 26),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppColors.textSecondaryLight,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showCreateDialog(BuildContext context) {
    final titleController = TextEditingController();
    final notesController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (dialogCtx) {
        bool isSubmitting = false;
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(
                'New Expense Claim',
                style: GoogleFonts.inter(fontWeight: FontWeight.bold),
              ),
              content: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextFormField(
                        controller: titleController,
                        decoration: const InputDecoration(
                          labelText: 'Title *',
                          hintText: 'e.g. Travel to Client Site',
                        ),
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) {
                            return 'Please enter a title';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: notesController,
                        decoration: const InputDecoration(
                          labelText: 'Notes',
                          hintText: 'Optional details',
                        ),
                        maxLines: 3,
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting
                      ? null
                      : () => Navigator.of(dialogCtx).pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          if (formKey.currentState?.validate() ?? false) {
                            setDialogState(() => isSubmitting = true);
                            try {
                              await ref
                                  .read(expenseRepositoryProvider)
                                  .createReport(
                                    title: titleController.text.trim(),
                                    notes: notesController.text.trim().isNotEmpty
                                        ? notesController.text.trim()
                                        : null,
                                  );
                              ref.invalidate(myExpenseReportsProvider);
                              ref.invalidate(expenseAnalyticsProvider);
                              if (mounted) {
                                Navigator.of(dialogCtx).pop();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Expense report created successfully'),
                                    backgroundColor: AppColors.success,
                                  ),
                                );
                              }
                            } catch (e) {
                              setDialogState(() => isSubmitting = false);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Error: $e'),
                                    backgroundColor: AppColors.error,
                                  ),
                                );
                              }
                            }
                          }
                        },
                  child: isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Create'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _MyClaimsTab extends ConsumerWidget {
  final List<ExpenseReportModel>? initialReports;

  const _MyClaimsTab({this.initialReports});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = initialReports != null
        ? AsyncValue.data(initialReports!)
        : ref.watch(myExpenseReportsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(myExpenseReportsProvider);
        ref.invalidate(expenseAnalyticsProvider);
      },
      child: reportsAsync.when(
        data: (reports) {
          if (reports.isEmpty) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 60),
                Center(
                  child: Column(
                    children: [
                      Icon(Icons.receipt_outlined, size: 48, color: Colors.grey.shade400),
                      const SizedBox(height: 12),
                      Text(
                        'No expense claims found',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textSecondaryLight,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          }

          return ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: reports.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final report = reports[index];
              final reportNumber = report.reportNumber.isNotEmpty
                  ? report.reportNumber
                  : '#${report.id}';

              return Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade200),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            reportNumber,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          _buildStatusChip(report.status),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        report.title,
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimaryLight,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '${report.currency} ${report.totalAmount.toStringAsFixed(2)}',
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Text(
              'Error loading claims: $err',
              style: GoogleFonts.inter(color: AppColors.error),
            ),
          ),
        ),
      ),
    );
  }
}

class _ApprovalsTab extends ConsumerWidget {
  final List<ExpenseReportModel>? initialReports;

  const _ApprovalsTab({this.initialReports});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    final bool isOwnerOrAdmin = user?.role == 'owner' ||
        user?.role == 'admin' ||
        user?.role == 'administrator';
    final bool canApprove = isOwnerOrAdmin ||
        (user != null &&
            authState.hasAnyPermission([
              'approve_expenses',
              'manage_expenses',
              'admin_expenses',
            ]));

    if (!canApprove) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(
              'Approvals Restricted',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimaryLight,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'You do not have permission to approve expense claims.',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      );
    }

    final reportsAsync = initialReports != null
        ? AsyncValue.data(initialReports!)
        : ref.watch(allExpenseReportsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(allExpenseReportsProvider);
        ref.invalidate(expenseAnalyticsProvider);
      },
      child: reportsAsync.when(
        data: (reports) {
          final pending = reports.where((r) {
            final st = r.status.toLowerCase();
            return st == 'submitted' || st == 'under_review';
          }).toList();

          if (pending.isEmpty) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 60),
                Center(
                  child: Column(
                    children: [
                      Icon(Icons.check_circle_outline, size: 48, color: Colors.grey.shade400),
                      const SizedBox(height: 12),
                      Text(
                        'No pending approval claims',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textSecondaryLight,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          }

          return ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: pending.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final report = pending[index];
              final displayName = report.employeeName.isNotEmpty
                  ? report.employeeName
                  : 'Employee';

              return Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.shade200),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppColors.primary.withOpacity(0.1),
                        child: Text(
                          _getInitials(displayName),
                          style: GoogleFonts.inter(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              displayName,
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: AppColors.textPrimaryLight,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              report.title,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: AppColors.textSecondaryLight,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${report.currency} ${report.totalAmount.toStringAsFixed(2)}',
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      _buildStatusChip(report.status),
                    ],
                  ),
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Text(
              'Error loading approvals: $err',
              style: GoogleFonts.inter(color: AppColors.error),
            ),
          ),
        ),
      ),
    );
  }
}

Widget _buildStatusChip(String status) {
  Color color;
  String text;
  switch (status.toLowerCase()) {
    case 'draft':
      color = Colors.grey;
      text = 'Draft';
      break;
    case 'submitted':
      color = Colors.blue;
      text = 'Submitted';
      break;
    case 'under_review':
      color = Colors.orange;
      text = 'Under Review';
      break;
    case 'approved':
      color = AppColors.success;
      text = 'Approved';
      break;
    case 'paid':
      color = AppColors.success;
      text = 'Paid';
      break;
    case 'rejected':
      color = AppColors.error;
      text = 'Rejected';
      break;
    default:
      color = Colors.grey;
      text = status.toUpperCase();
  }

  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: color.withOpacity(0.1),
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: color),
    ),
    child: Text(
      text,
      style: GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: color,
      ),
    ),
  );
}

String _getInitials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts[0].isEmpty) return '?';
  if (parts.length == 1) return parts[0][0].toUpperCase();
  return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
}
