import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/approval_model.dart';
import '../providers/approval_provider.dart';

class ApprovalsScreen extends ConsumerStatefulWidget {
  final List<ApprovalRequestModel>? initialPendingRequests;
  final List<ApprovalRequestModel>? initialMyRequests;
  final List<ApprovalRequestModel>? initialHistoryRequests;
  final int? initialPendingCount;

  const ApprovalsScreen({
    super.key,
    this.initialPendingRequests,
    this.initialMyRequests,
    this.initialHistoryRequests,
    this.initialPendingCount,
  });

  @override
  ConsumerState<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends ConsumerState<ApprovalsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  bool _hasAccess() {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final role = user?.role.toLowerCase() ?? '';
    final isOwnerOrAdmin =
        role == 'owner' || role == 'admin' || role == 'administrator';
    return isOwnerOrAdmin ||
        authState.hasAnyPermission([
          'approve_requests',
          'view_approval_requests',
        ]);
  }

  bool _canApprove() {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final role = user?.role.toLowerCase() ?? '';
    final isOwnerOrAdmin =
        role == 'owner' || role == 'admin' || role == 'administrator';
    return isOwnerOrAdmin || authState.hasPermission('approve_requests');
  }

  void _showDecisionDialog(
    ApprovalRequestModel request,
    String action,
  ) {
    final isApprove = action.toLowerCase() == 'approved';
    final commentController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(
              isApprove ? Icons.check_circle_outline : Icons.cancel_outlined,
              color: isApprove ? AppColors.success : AppColors.error,
              size: 28,
            ),
            const SizedBox(width: 10),
            Text(
              isApprove ? 'Approve Request' : 'Reject Request',
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              request.title,
              style: GoogleFonts.inter(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Ref: ${request.referenceNumber}',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: commentController,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: isApprove
                    ? 'Comments (Optional)'
                    : 'Rejection Reason (Optional)',
                hintText: isApprove
                    ? 'Add any approval remarks...'
                    : 'Specify reason for rejection...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Cancel',
              style: GoogleFonts.inter(color: Colors.grey.shade600),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isApprove ? AppColors.success : AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () async {
              final comments = commentController.text.trim();
              Navigator.pop(ctx);
              try {
                await ref.read(approvalRepositoryProvider).decideRequest(
                      request.id,
                      action: action,
                      comments: comments.isNotEmpty ? comments : null,
                    );
                ref.invalidate(pendingApprovalsProvider);
                ref.invalidate(mySubmittedApprovalsProvider);
                ref.invalidate(allApprovalsHistoryProvider);
                ref.invalidate(myPendingApprovalsCountProvider);

                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      isApprove
                          ? 'Request approved successfully'
                          : 'Request rejected',
                    ),
                    backgroundColor:
                        isApprove ? AppColors.success : AppColors.error,
                  ),
                );
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Action failed: $e'),
                    backgroundColor: AppColors.error,
                  ),
                );
              }
            },
            child: Text(
              isApprove ? 'Confirm Approve' : 'Confirm Reject',
              style: GoogleFonts.inter(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  void _showDetailBottomSheet(
    ApprovalRequestModel request,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ApprovalDetailBottomSheet(
        request: request,
        canApprove: _canApprove(),
        onDecide: (action) {
          Navigator.pop(ctx);
          _showDecisionDialog(request, action);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (!_hasAccess()) {
      return Scaffold(
        backgroundColor:
            isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
        appBar: AppBar(
          title: Text(
            'Approval Center',
            style: GoogleFonts.inter(fontWeight: FontWeight.bold),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.lock_outline,
                  size: 64,
                  color: AppColors.error,
                ),
                const SizedBox(height: 16),
                Text(
                  'Access Denied',
                  style: GoogleFonts.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: isDark
                        ? AppColors.textPrimaryDark
                        : AppColors.textPrimaryLight,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'You do not have permission to view or manage approvals.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: isDark
                        ? AppColors.textSecondaryDark
                        : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Pending count
    final pendingCountAsync = ref.watch(myPendingApprovalsCountProvider);
    final int pendingCount = widget.initialPendingCount ??
        (widget.initialPendingRequests != null
            ? widget.initialPendingRequests!.length
            : (pendingCountAsync.asData?.value ?? 0));

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Row(
          children: [
            Text(
              'Approval Center',
              style: GoogleFonts.inter(fontWeight: FontWeight.bold),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: pendingCount > 0
                    ? AppColors.primary
                    : (isDark ? Colors.grey.shade800 : Colors.grey.shade300),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '$pendingCount',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: pendingCount > 0
                      ? Colors.black87
                      : (isDark ? Colors.white70 : Colors.black54),
                ),
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor:
              isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          labelStyle:
              GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Pending Review'),
            Tab(text: 'My Requests'),
            Tab(text: 'History'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _PendingReviewTab(
            initialList: widget.initialPendingRequests,
            canApprove: _canApprove(),
            onTapCard: (req) => _showDetailBottomSheet(req),
            onApprove: (req) => _showDecisionDialog(req, 'approved'),
            onReject: (req) => _showDecisionDialog(req, 'rejected'),
          ),
          _MyRequestsTab(
            initialList: widget.initialMyRequests,
            onTapCard: (req) => _showDetailBottomSheet(req),
          ),
          _HistoryTab(
            initialList: widget.initialHistoryRequests,
            onTapCard: (req) => _showDetailBottomSheet(req),
          ),
        ],
      ),
    );
  }
}

// ── Tab 1: Pending Review ────────────────────────────────────────────────────

class _PendingReviewTab extends ConsumerWidget {
  final List<ApprovalRequestModel>? initialList;
  final bool canApprove;
  final void Function(ApprovalRequestModel) onTapCard;
  final void Function(ApprovalRequestModel) onApprove;
  final void Function(ApprovalRequestModel) onReject;

  const _PendingReviewTab({
    this.initialList,
    required this.canApprove,
    required this.onTapCard,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (initialList != null) {
      return _buildList(context, initialList!);
    }

    final asyncData = ref.watch(pendingApprovalsProvider);
    return asyncData.when(
      data: (items) => _buildList(context, items),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Text(
            'Failed to load pending approvals: $e',
            style: GoogleFonts.inter(color: AppColors.error),
          ),
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context, List<ApprovalRequestModel> items) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.task_alt, size: 54, color: AppColors.success),
            const SizedBox(height: 12),
            Text(
              'All Caught Up!',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'No pending approval requests require your review.',
              style: GoogleFonts.inter(fontSize: 13, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {},
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          return _ApprovalCard(
            item: item,
            showActions: canApprove,
            onTap: () => onTapCard(item),
            onApprove: () => onApprove(item),
            onReject: () => onReject(item),
          );
        },
      ),
    );
  }
}

// ── Tab 2: My Requests ───────────────────────────────────────────────────────

class _MyRequestsTab extends ConsumerWidget {
  final List<ApprovalRequestModel>? initialList;
  final void Function(ApprovalRequestModel) onTapCard;

  const _MyRequestsTab({
    this.initialList,
    required this.onTapCard,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (initialList != null) {
      return _buildList(context, initialList!);
    }

    final asyncData = ref.watch(mySubmittedApprovalsProvider);
    return asyncData.when(
      data: (items) => _buildList(context, items),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Text(
            'Failed to load your submitted requests: $e',
            style: GoogleFonts.inter(color: AppColors.error),
          ),
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context, List<ApprovalRequestModel> items) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inbox_outlined, size: 54, color: Colors.grey),
            const SizedBox(height: 12),
            Text(
              'No Requests Found',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'You have not submitted any approval requests yet.',
              style: GoogleFonts.inter(fontSize: 13, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _ApprovalCard(
          item: item,
          showActions: false,
          onTap: () => onTapCard(item),
        );
      },
    );
  }
}

// ── Tab 3: History ───────────────────────────────────────────────────────────

class _HistoryTab extends ConsumerWidget {
  final List<ApprovalRequestModel>? initialList;
  final void Function(ApprovalRequestModel) onTapCard;

  const _HistoryTab({
    this.initialList,
    required this.onTapCard,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (initialList != null) {
      return _buildList(context, initialList!);
    }

    final asyncData = ref.watch(allApprovalsHistoryProvider);
    return asyncData.when(
      data: (items) => _buildList(context, items),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Text(
            'Failed to load approval history: $e',
            style: GoogleFonts.inter(color: AppColors.error),
          ),
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context, List<ApprovalRequestModel> items) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.history, size: 54, color: Colors.grey),
            const SizedBox(height: 12),
            Text(
              'No Approval History',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'There are no historical approval logs recorded.',
              style: GoogleFonts.inter(fontSize: 13, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _ApprovalCard(
          item: item,
          showActions: false,
          onTap: () => onTapCard(item),
        );
      },
    );
  }
}

// ── Card Component ───────────────────────────────────────────────────────────

class _ApprovalCard extends StatelessWidget {
  final ApprovalRequestModel item;
  final bool showActions;
  final VoidCallback onTap;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;

  const _ApprovalCard({
    required this.item,
    required this.showActions,
    required this.onTap,
    this.onApprove,
    this.onReject,
  });

  Color _getStatusColor() {
    switch (item.status.toLowerCase()) {
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
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusColor = _getStatusColor();
    final dateFormat = DateFormat('MMM dd, yyyy');

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      color: isDark ? AppColors.cardDark : AppColors.cardLight,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row: Ref & Status pill
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          item.referenceNumber,
                          style: GoogleFonts.robotoMono(
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                            color: AppColors.primaryDark,
                          ),
                        ),
                      ),
                      if (item.workflowType.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Text(
                          item.workflowType.toUpperCase(),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isDark
                                ? AppColors.textSecondaryDark
                                : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ],
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      item.status.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Title
              Text(
                item.title,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDark
                      ? AppColors.textPrimaryDark
                      : AppColors.textPrimaryLight,
                ),
              ),
              const SizedBox(height: 6),

              // Amount if present
              if (item.amount != null) ...[
                Text(
                  item.formattedAmount,
                  style: GoogleFonts.inter(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryDark,
                  ),
                ),
                const SizedBox(height: 8),
              ],

              // Submitter & Department Info
              Row(
                children: [
                  Icon(
                    Icons.person_outline,
                    size: 15,
                    color: isDark
                        ? AppColors.textSecondaryDark
                        : AppColors.textSecondaryLight,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      '${item.submitterName}${item.department.isNotEmpty ? ' • ${item.department}' : ''}',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: isDark
                            ? AppColors.textSecondaryDark
                            : AppColors.textSecondaryLight,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    dateFormat.format(item.createdAt),
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Step Progress Indicator
              Row(
                children: [
                  Text(
                    'Step ${item.currentStepOrder} of ${item.totalSteps}',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: item.totalSteps > 0
                            ? (item.currentStepOrder / item.totalSteps)
                                .clamp(0.0, 1.0)
                            : 0.0,
                        backgroundColor:
                            isDark ? Colors.grey.shade800 : Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          item.isApproved
                              ? AppColors.success
                              : (item.isRejected
                                  ? AppColors.error
                                  : AppColors.primary),
                        ),
                        minHeight: 6,
                      ),
                    ),
                  ),
                ],
              ),

              // Action buttons (Pending Review direct approve / reject)
              if (showActions && item.isPending) ...[
                const SizedBox(height: 14),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      onPressed: onReject,
                      icon: const Icon(Icons.close, size: 16),
                      label: Text(
                        'Reject',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.success,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 18, vertical: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        elevation: 0,
                      ),
                      onPressed: onApprove,
                      icon: const Icon(Icons.check, size: 16),
                      label: Text(
                        'Approve',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Detail Bottom Sheet ──────────────────────────────────────────────────────

class _ApprovalDetailBottomSheet extends ConsumerWidget {
  final ApprovalRequestModel request;
  final bool canApprove;
  final void Function(String action) onDecide;

  const _ApprovalDetailBottomSheet({
    required this.request,
    required this.canApprove,
    required this.onDecide,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final detailAsync = ref.watch(approvalRequestDetailProvider(request.id));

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Drag Handle
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),

              // Title Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                request.referenceNumber,
                                style: GoogleFonts.robotoMono(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primaryDark,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: _getStatusBg(request.status),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  request.status.toUpperCase(),
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: _getStatusText(request.status),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            request.title,
                            style: GoogleFonts.inter(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: isDark
                                  ? AppColors.textPrimaryDark
                                  : AppColors.textPrimaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const Divider(),

              // Body Content
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Amount banner if present
                    if (request.amount != null) ...[
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.primarySurface.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Total Amount',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: isDark
                                    ? AppColors.textSecondaryDark
                                    : AppColors.textSecondaryLight,
                              ),
                            ),
                            Text(
                              request.formattedAmount,
                              style: GoogleFonts.inter(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primaryDark,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // Step Progress Section
                    Text(
                      'Approval Progress',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: isDark
                            ? AppColors.textPrimaryDark
                            : AppColors.textPrimaryLight,
                      ),
                    ),
                    const SizedBox(height: 12),
                    detailAsync.when(
                      data: (detail) => _buildStepperView(
                          context, detail.steps, request, isDark),
                      loading: () => _buildFallbackStepper(request, isDark),
                      error: (err, stack) =>
                          _buildFallbackStepper(request, isDark),
                    ),
                    const SizedBox(height: 20),

                    // Request Overview
                    Text(
                      'Request Details',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: isDark
                            ? AppColors.textPrimaryDark
                            : AppColors.textPrimaryLight,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _buildOverviewCard(context, isDark),
                    const SizedBox(height: 20),

                    // Audit Trail & Timeline History
                    Text(
                      'Audit Trail & History',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: isDark
                            ? AppColors.textPrimaryDark
                            : AppColors.textPrimaryLight,
                      ),
                    ),
                    const SizedBox(height: 10),
                    detailAsync.when(
                      data: (detail) =>
                          _buildAuditTrail(context, detail.actions, isDark),
                      loading: () => const Center(
                        child: Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(),
                        ),
                      ),
                      error: (e, _) => Text(
                        'Audit trail not available: $e',
                        style: GoogleFonts.inter(color: Colors.grey),
                      ),
                    ),
                  ],
                ),
              ),

              // Bottom Actions if pending and user can approve
              if (canApprove && request.isPending) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  decoration: BoxDecoration(
                    color:
                        isDark ? AppColors.cardDark : AppColors.surfaceLight,
                    border: Border(
                      top: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight,
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.error,
                            side: const BorderSide(color: AppColors.error),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          onPressed: () => onDecide('rejected'),
                          icon: const Icon(Icons.close),
                          label: Text(
                            'Reject',
                            style:
                                GoogleFonts.inter(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            elevation: 0,
                          ),
                          onPressed: () => onDecide('approved'),
                          icon: const Icon(Icons.check),
                          label: Text(
                            'Approve',
                            style:
                                GoogleFonts.inter(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildStepperView(
    BuildContext context,
    List<ApprovalStepModel> steps,
    ApprovalRequestModel req,
    bool isDark,
  ) {
    if (steps.isEmpty) {
      return _buildFallbackStepper(req, isDark);
    }

    return Column(
      children: steps.map((step) {
        final isCompleted = step.status == 'approved';
        final isRejected = step.status == 'rejected';
        final isCurrent = step.stepOrder == req.currentStepOrder && req.isPending;

        Color circleColor;
        IconData icon;
        if (isCompleted) {
          circleColor = AppColors.success;
          icon = Icons.check;
        } else if (isRejected) {
          circleColor = AppColors.error;
          icon = Icons.close;
        } else if (isCurrent) {
          circleColor = AppColors.primary;
          icon = Icons.hourglass_top;
        } else {
          circleColor = Colors.grey.shade400;
          icon = Icons.circle_outlined;
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: circleColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: circleColor, width: 1.5),
                ),
                child: Icon(icon, color: circleColor, size: 16),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      step.name,
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: isDark
                            ? AppColors.textPrimaryDark
                            : AppColors.textPrimaryLight,
                      ),
                    ),
                    if (step.approverRole != null || step.approverName != null)
                      Text(
                        'Approver: ${step.approverName ?? step.approverRole ?? ''}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: circleColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  step.status.toUpperCase(),
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: circleColor,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildFallbackStepper(ApprovalRequestModel req, bool isDark) {
    final steps = List.generate(req.totalSteps, (i) => i + 1);
    return Column(
      children: steps.map((order) {
        final isPassed = order < req.currentStepOrder || req.isApproved;
        final isCurrent = order == req.currentStepOrder && req.isPending;
        final isFailed = req.isRejected && order == req.currentStepOrder;

        Color col;
        IconData ic;
        String statusLabel;
        if (isFailed) {
          col = AppColors.error;
          ic = Icons.close;
          statusLabel = 'REJECTED';
        } else if (isPassed) {
          col = AppColors.success;
          ic = Icons.check;
          statusLabel = 'APPROVED';
        } else if (isCurrent) {
          col = AppColors.primary;
          ic = Icons.hourglass_top;
          statusLabel = 'CURRENT STEP';
        } else {
          col = Colors.grey.shade400;
          ic = Icons.circle_outlined;
          statusLabel = 'UPCOMING';
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: col.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: col, width: 1.5),
                ),
                child: Icon(ic, color: col, size: 16),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Step $order of ${req.totalSteps}',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: isDark
                        ? AppColors.textPrimaryDark
                        : AppColors.textPrimaryLight,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: col.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  statusLabel,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: col,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildOverviewCard(BuildContext context, bool isDark) {
    final dateFormat = DateFormat('MMM dd, yyyy • hh:mm a');
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      child: Column(
        children: [
          _buildRow('Submitter', request.submitterName, isDark),
          const Divider(height: 16),
          _buildRow('Email', request.submitterEmail, isDark),
          const Divider(height: 16),
          _buildRow('Department', request.department, isDark),
          const Divider(height: 16),
          _buildRow('Workflow', request.workflowType, isDark),
          const Divider(height: 16),
          _buildRow('Entity', request.entityType, isDark),
          const Divider(height: 16),
          _buildRow('Submitted At', dateFormat.format(request.createdAt), isDark),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 13, color: Colors.grey),
        ),
        Text(
          value.isNotEmpty ? value : '—',
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isDark
                ? AppColors.textPrimaryDark
                : AppColors.textPrimaryLight,
          ),
        ),
      ],
    );
  }

  Widget _buildAuditTrail(
    BuildContext context,
    List<ApprovalActionModel> actions,
    bool isDark,
  ) {
    if (actions.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : AppColors.cardLight,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          'No decisions recorded yet.',
          style: GoogleFonts.inter(fontSize: 13, color: Colors.grey),
        ),
      );
    }

    final dateFormat = DateFormat('MMM dd, yyyy • hh:mm a');

    return Column(
      children: actions.map((act) {
        final isApprove = act.isApproved;
        final color = isApprove ? AppColors.success : AppColors.error;

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : AppColors.cardLight,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? AppColors.borderDark : AppColors.borderLight,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        isApprove ? Icons.check_circle : Icons.cancel,
                        color: color,
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        act.approverName.isNotEmpty
                            ? act.approverName
                            : 'Approver',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: isDark
                              ? AppColors.textPrimaryDark
                              : AppColors.textPrimaryLight,
                        ),
                      ),
                      if (act.approverRole.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Text(
                          '(${act.approverRole})',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ],
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      act.action.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: color,
                      ),
                    ),
                  ),
                ],
              ),
              if (act.comments != null && act.comments!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.black26
                        : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '"${act.comments}"',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontStyle: FontStyle.italic,
                      color: isDark
                          ? AppColors.textSecondaryDark
                          : AppColors.textSecondaryLight,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  dateFormat.format(act.createdAt),
                  style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Color _getStatusBg(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return AppColors.success.withValues(alpha: 0.15);
      case 'rejected':
        return AppColors.error.withValues(alpha: 0.15);
      case 'pending':
      default:
        return AppColors.warning.withValues(alpha: 0.15);
    }
  }

  Color _getStatusText(String status) {
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
}
