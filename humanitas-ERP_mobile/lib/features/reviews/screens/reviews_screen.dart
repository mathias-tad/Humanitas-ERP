import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/reviews/models/review_model.dart';
import 'package:humanitas_erp_mobile/features/reviews/providers/review_provider.dart';

class ReviewsScreen extends ConsumerStatefulWidget {
  final List<ReviewCycleModel>? initialCycles;
  final Map<String, dynamic>? initialMyReviews;
  final ReviewAnalyticsModel? initialAnalytics;

  const ReviewsScreen({
    super.key,
    this.initialCycles,
    this.initialMyReviews,
    this.initialAnalytics,
  });

  @override
  ConsumerState<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends ConsumerState<ReviewsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    final bool isOwnerOrAdmin = user?.role == 'owner' ||
        user?.role == 'admin' ||
        user?.role == 'administrator';
    final bool hasAccess = isOwnerOrAdmin ||
        (user != null &&
            authState.hasAnyPermission([
              'view_reviews',
              'view_my_reviews',
              'manage_reviews',
            ]));

    if (!hasAccess) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            '360° Performance Reviews',
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
                'You do not have permission to access performance reviews.',
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

    final cyclesAsync = ref.watch(reviewCyclesProvider);
    final myReviewsAsync = ref.watch(myReviewsProvider);
    final analyticsAsync = ref.watch(reviewAnalyticsProvider);

    final cycles = widget.initialCycles ?? cyclesAsync.value ?? [];
    final myData = widget.initialMyReviews ?? myReviewsAsync.value ?? {};
    final analytics = widget.initialAnalytics ?? analyticsAsync.value ?? const ReviewAnalyticsModel();

    final List<ReviewFeedbackModel> pendingRequests = (myData['pending_requests'] as List?)?.cast<ReviewFeedbackModel>() ?? [];
    final List<EmployeeReviewModel> evaluations = (myData['evaluations'] as List?)?.cast<EmployeeReviewModel>() ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          '360° Performance Reviews',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondaryLight,
          indicatorColor: AppColors.primary,
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: [
            Tab(
              text: pendingRequests.isNotEmpty
                  ? 'My 360 (${pendingRequests.length})'
                  : 'My 360',
              icon: const Icon(Icons.person_pin_outlined, size: 20),
            ),
            Tab(
              text: 'Cycles (${cycles.length})',
              icon: const Icon(Icons.sync_alt, size: 20),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // KPI Metric Header
          Container(
            color: Theme.of(context).cardColor,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                _buildMetricTile(
                  context,
                  title: 'Active Cycles',
                  value: analytics.totalCycles.toString(),
                  icon: Icons.sync,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 8),
                _buildMetricTile(
                  context,
                  title: 'Completion',
                  value: '${analytics.completionRate}%',
                  icon: Icons.check_circle_outline,
                  color: AppColors.success,
                ),
                const SizedBox(width: 8),
                _buildMetricTile(
                  context,
                  title: 'Org Rating',
                  value: '${analytics.averageRating} ★',
                  icon: Icons.star,
                  color: AppColors.warning,
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Tab Views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Tab 0: My 360 Reviews & Pending Feedback
                _buildMyReviewsTab(pendingRequests, evaluations),

                // Tab 1: Review Cycles
                _buildCyclesTab(cycles),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile(
    BuildContext context, {
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 4),
            Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              title,
              style: GoogleFonts.inter(
                fontSize: 10,
                color: AppColors.textSecondaryLight,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMyReviewsTab(
    List<ReviewFeedbackModel> pendingRequests,
    List<EmployeeReviewModel> evaluations,
  ) {
    if (pendingRequests.isEmpty && evaluations.isEmpty) {
      return Center(
        child: Text(
          'No personal reviews or pending feedback requests.',
          style: GoogleFonts.inter(color: AppColors.textSecondaryLight, fontSize: 14),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (pendingRequests.isNotEmpty) ...[
          Text(
            'Pending Feedback Requests',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 8),
          ...pendingRequests.map((req) => _buildFeedbackRequestCard(req)),
          const SizedBox(height: 16),
        ],
        if (evaluations.isNotEmpty) ...[
          Text(
            'My Evaluations & Scores',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 8),
          ...evaluations.map((ev) => _buildEvaluationCard(ev)),
        ],
      ],
    );
  }

  Widget _buildFeedbackRequestCard(ReviewFeedbackModel req) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.primary.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${req.reviewerType.toUpperCase()} REVIEW',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                Text(
                  'Due: ${req.cycleDueDate ?? 'Upcoming'}',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '${req.subjectFirstName ?? ''} ${req.subjectLastName ?? 'Colleague'}',
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimaryLight,
              ),
            ),
            Text(
              '${req.subjectJobTitle ?? 'Team Member'} • ${req.subjectDepartment ?? 'General'}',
              style: GoogleFonts.inter(
                fontSize: 12,
                color: AppColors.textSecondaryLight,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Cycle: ${req.cycleTitle ?? '360 Evaluation'}',
              style: GoogleFonts.inter(
                fontSize: 11,
                color: AppColors.textSecondaryLight,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _showFeedbackDialog(req),
                icon: const Icon(Icons.send, size: 14),
                label: Text(
                  'Submit Feedback',
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEvaluationCard(EmployeeReviewModel ev) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  ev.cycleTitle,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    ev.status.toUpperCase(),
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: AppColors.success,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildScoreColumn('Self', ev.selfRating?.toString() ?? '—'),
                _buildScoreColumn('Peers Avg', ev.peerRatingAvg?.toString() ?? '—'),
                _buildScoreColumn('Manager', ev.managerRating?.toString() ?? '—'),
                _buildScoreColumn('Final', ev.finalRating?.toString() ?? '—', isPrimary: true),
              ],
            ),
            if (ev.managerSummary != null) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Manager: "${ev.managerSummary}"',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontStyle: FontStyle.italic,
                    color: AppColors.textSecondaryLight,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildScoreColumn(String label, String value, {bool isPrimary = false}) {
    return Column(
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 10,
            color: AppColors.textSecondaryLight,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: isPrimary ? AppColors.primary : AppColors.textPrimaryLight,
          ),
        ),
      ],
    );
  }

  Widget _buildCyclesTab(List<ReviewCycleModel> cycles) {
    if (cycles.isEmpty) {
      return Center(
        child: Text(
          'No review cycles found.',
          style: GoogleFonts.inter(color: AppColors.textSecondaryLight, fontSize: 14),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: cycles.length,
      itemBuilder: (context, index) {
        final c = cycles[index];
        final percent = c.totalParticipants > 0
            ? ((c.completedReviews / c.totalParticipants) * 100).round()
            : 0;

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        c.cycleType.toUpperCase(),
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    Text(
                      '${c.startDate} → ${c.dueDate}',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  c.title,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (c.description != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    c.description!,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.textSecondaryLight,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Participants: ${c.totalParticipants}',
                      style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondaryLight),
                    ),
                    Text(
                      'Progress: $percent%',
                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                LinearProgressIndicator(
                  value: percent / 100,
                  backgroundColor: const Color(0xFFF1F5F9),
                  valueColor: const AlwaysStoppedAnimation<Color>(AppColors.success),
                  borderRadius: BorderRadius.circular(4),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showFeedbackDialog(ReviewFeedbackModel req) {
    double rating = 4.0;
    final commentsController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            'Submit Review Feedback',
            style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Evaluating: ${req.subjectFirstName} ${req.subjectLastName}',
                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                Text(
                  'Rating: ${rating.toStringAsFixed(1)} ★',
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
                Slider(
                  value: rating,
                  min: 1.0,
                  max: 5.0,
                  divisions: 8,
                  onChanged: (val) {
                    setDialogState(() {
                      rating = val;
                    });
                  },
                ),
                const SizedBox(height: 8),
                Text(
                  'Qualitative Feedback & Comments',
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: commentsController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Enter strengths, accomplishments, and suggestions...',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.all(8),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await ref.read(reviewRepositoryProvider).submitFeedback(
                    req.id,
                    rating,
                    commentsController.text,
                  );
                  ref.invalidate(myReviewsProvider);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Feedback submitted successfully')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: $e')),
                    );
                  }
                }
              },
              child: const Text('Submit'),
            ),
          ],
        ),
      ),
    );
  }
}
