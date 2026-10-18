import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';

// ─── Model ──────────────────────────────────────────────────────────────────
class LeaveRequestAdminModel {
  final String id;
  final String? employeeName;
  final String? employeeId;
  final String? leaveType;
  final String startDate;
  final String endDate;
  final int? days;
  final String status;
  final String? reason;
  final String? createdAt;

  const LeaveRequestAdminModel({
    required this.id,
    this.employeeName,
    this.employeeId,
    this.leaveType,
    required this.startDate,
    required this.endDate,
    this.days,
    required this.status,
    this.reason,
    this.createdAt,
  });

  factory LeaveRequestAdminModel.fromJson(Map<String, dynamic> json) {
    return LeaveRequestAdminModel(
      id: json['id']?.toString() ?? '',
      employeeName: json['employee_name']?.toString() ??
          json['full_name']?.toString() ??
          json['user_name']?.toString(),
      employeeId: json['employee_id']?.toString() ?? json['user_id']?.toString(),
      leaveType: json['leave_type']?.toString() ?? json['type_name']?.toString(),
      startDate: json['start_date']?.toString() ?? '',
      endDate: json['end_date']?.toString() ?? '',
      days: (json['days'] as num?)?.toInt() ?? (json['duration_days'] as num?)?.toInt(),
      status: json['status']?.toString() ?? 'pending',
      reason: json['reason']?.toString(),
      createdAt: json['created_at']?.toString(),
    );
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
final adminLeaveRequestsProvider =
    FutureProvider.family<List<LeaveRequestAdminModel>, String?>((ref, status) async {
  try {
    final params = <String, dynamic>{};
    if (status != null && status.isNotEmpty && status != 'all') {
      params['status'] = status;
    }
    final res = await ref.watch(apiClientProvider).dio.get(
      '/leave/requests',
      queryParameters: params.isEmpty ? null : params,
    );
    if (res.data is List) {
      return (res.data as List)
          .map((e) => LeaveRequestAdminModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  } catch (_) {
    return [];
  }
});

// ─── Screen ──────────────────────────────────────────────────────────────────
class AdminLeaveScreen extends ConsumerStatefulWidget {
  const AdminLeaveScreen({super.key});

  @override
  ConsumerState<AdminLeaveScreen> createState() => _AdminLeaveScreenState();
}

class _AdminLeaveScreenState extends ConsumerState<AdminLeaveScreen> {
  String _statusFilter = 'pending';
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';

  static const _statusOptions = ['all', 'pending', 'approved', 'rejected'];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Color _statusColor(String status) {
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

  IconData _statusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return Icons.check_circle_outline;
      case 'rejected':
        return Icons.cancel_outlined;
      default:
        return Icons.hourglass_empty_rounded;
    }
  }

  Future<void> _approveOrReject(String id, String action) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(action == 'approve' ? 'Approve Leave' : 'Reject Leave'),
        content: Text('Are you sure you want to ${action == 'approve' ? 'approve' : 'reject'} this leave request?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: action == 'approve' ? AppColors.success : AppColors.error,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: Text(action == 'approve' ? 'Approve' : 'Reject',
                style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(apiClientProvider).dio.patch(
        '/leave/requests/$id/${action == 'approve' ? 'approve' : 'reject'}',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Leave request ${action == 'approve' ? 'approved' : 'rejected'}'),
            backgroundColor: action == 'approve' ? AppColors.success : AppColors.error,
          ),
        );
        ref.invalidate(adminLeaveRequestsProvider(_statusFilter));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final requestsAsync = ref.watch(adminLeaveRequestsProvider(_statusFilter));

    return Scaffold(
      appBar: AppBar(
        title: Text('Leave Management', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(adminLeaveRequestsProvider(_statusFilter)),
          ),
        ],
      ),
      body: Column(
        children: [
          // Status filter chips
          Container(
            color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _statusOptions.map((s) {
                  final isActive = _statusFilter == s;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(s[0].toUpperCase() + s.substring(1)),
                      selected: isActive,
                      selectedColor: AppColors.primary.withValues(alpha: 0.2),
                      checkmarkColor: AppColors.primary,
                      labelStyle: GoogleFonts.inter(
                        fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                        color: isActive ? AppColors.primary : null,
                      ),
                      onSelected: (_) => setState(() => _statusFilter = s),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search employee...',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                isDense: true,
              ),
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
            ),
          ),

          // Content
          Expanded(
            child: requestsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                    const SizedBox(height: 12),
                    Text('Failed to load leave requests', style: GoogleFonts.inter()),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => ref.invalidate(adminLeaveRequestsProvider(_statusFilter)),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (requests) {
                final filtered = _searchQuery.isEmpty
                    ? requests
                    : requests.where((r) =>
                        (r.employeeName ?? '').toLowerCase().contains(_searchQuery)).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.beach_access_outlined, size: 56,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                        const SizedBox(height: 16),
                        Text('No leave requests found', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text('Filter: $_statusFilter',
                            style: GoogleFonts.inter(color: Colors.grey, fontSize: 13)),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(adminLeaveRequestsProvider(_statusFilter)),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: filtered.length,
                    itemBuilder: (context, i) {
                      final req = filtered[i];
                      final color = _statusColor(req.status);
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 18,
                                    backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                                    child: Text(
                                      (req.employeeName?.isNotEmpty == true)
                                          ? req.employeeName![0].toUpperCase()
                                          : 'E',
                                      style: GoogleFonts.inter(
                                          fontWeight: FontWeight.bold, color: AppColors.primary),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          req.employeeName ?? 'Unknown Employee',
                                          style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                                        ),
                                        Text(
                                          req.leaveType ?? 'Leave',
                                          style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: color.withValues(alpha: 0.3)),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(_statusIcon(req.status), size: 12, color: color),
                                        const SizedBox(width: 4),
                                        Text(
                                          req.status[0].toUpperCase() + req.status.substring(1),
                                          style: GoogleFonts.inter(
                                              fontSize: 11, fontWeight: FontWeight.w600, color: color),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  const Icon(Icons.date_range_outlined, size: 14, color: Colors.grey),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${req.startDate}  →  ${req.endDate}',
                                    style: GoogleFonts.inter(fontSize: 12),
                                  ),
                                  if (req.days != null) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.info.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        '${req.days} day${(req.days ?? 0) > 1 ? 's' : ''}',
                                        style: GoogleFonts.inter(
                                            fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.info),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              if (req.reason?.isNotEmpty == true) ...[
                                const SizedBox(height: 6),
                                Text(
                                  req.reason!,
                                  style: GoogleFonts.inter(fontSize: 12, color: Colors.grey, fontStyle: FontStyle.italic),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                              // Approve/Reject buttons for pending
                              if (req.status.toLowerCase() == 'pending') ...[
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        icon: const Icon(Icons.cancel_outlined, size: 16, color: AppColors.error),
                                        label: Text('Reject',
                                            style: GoogleFonts.inter(color: AppColors.error, fontSize: 13)),
                                        style: OutlinedButton.styleFrom(
                                          side: const BorderSide(color: AppColors.error),
                                          padding: const EdgeInsets.symmetric(vertical: 6),
                                        ),
                                        onPressed: () => _approveOrReject(req.id, 'reject'),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: ElevatedButton.icon(
                                        icon: const Icon(Icons.check_circle_outline, size: 16),
                                        label: Text('Approve',
                                            style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppColors.success,
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(vertical: 6),
                                        ),
                                        onPressed: () => _approveOrReject(req.id, 'approve'),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
