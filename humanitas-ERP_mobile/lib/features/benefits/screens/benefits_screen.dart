import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/benefits/models/benefit_model.dart';
import 'package:humanitas_erp_mobile/features/benefits/providers/benefit_provider.dart';

class BenefitsScreen extends ConsumerStatefulWidget {
  final List<BenefitPlanModel>? initialPlans;
  final List<BenefitEnrollmentModel>? initialEnrollments;
  final BenefitStatsModel? initialStats;

  const BenefitsScreen({
    super.key,
    this.initialPlans,
    this.initialEnrollments,
    this.initialStats,
  });

  @override
  ConsumerState<BenefitsScreen> createState() => _BenefitsScreenState();
}

class _BenefitsScreenState extends ConsumerState<BenefitsScreen>
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
              'view_benefit_plans',
              'view_my_benefits',
              'manage_benefits',
            ]));

    if (!hasAccess) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'Benefits & Insurance',
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
                'You do not have permission to view benefits & insurance.',
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

    final statsAsync = ref.watch(benefitStatsProvider);
    final plansAsync = ref.watch(benefitPlansProvider);
    final enrollmentsAsync = ref.watch(benefitEnrollmentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Benefits & Insurance',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondaryLight,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(icon: Icon(Icons.shield_outlined), text: 'Plans Catalog'),
            Tab(icon: Icon(Icons.verified_user_outlined), text: 'Enrollments'),
          ],
        ),
      ),
      body: Column(
        children: [
          // KPI Stats Header
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: widget.initialStats != null
                ? _buildStatsRow(widget.initialStats!)
                : statsAsync.when(
                    data: (stats) => _buildStatsRow(stats),
                    loading: () => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(8.0),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    error: (_, __) => const SizedBox.shrink(),
                  ),
          ),
          const Divider(height: 1),
          // Tab Views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Plans Catalog Tab
                widget.initialPlans != null
                    ? _buildPlansList(widget.initialPlans!)
                    : plansAsync.when(
                        data: (plans) => _buildPlansList(plans),
                        loading: () =>
                            const Center(child: CircularProgressIndicator()),
                        error: (err, _) => Center(
                          child: Text(
                            'Error: ${err.toString()}',
                            style: GoogleFonts.inter(color: AppColors.error),
                          ),
                        ),
                      ),

                // Enrollments Tab
                widget.initialEnrollments != null
                    ? _buildEnrollmentsList(widget.initialEnrollments!)
                    : enrollmentsAsync.when(
                        data: (enrollments) =>
                            _buildEnrollmentsList(enrollments),
                        loading: () =>
                            const Center(child: CircularProgressIndicator()),
                        error: (err, _) => Center(
                          child: Text(
                            'Error: ${err.toString()}',
                            style: GoogleFonts.inter(color: AppColors.error),
                          ),
                        ),
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(BenefitStatsModel stats) {
    return Row(
      children: [
        Expanded(
          child: _buildMetricCard(
            'Active Plans',
            '${stats.totalPlans}',
            Icons.health_and_safety,
            AppColors.primary,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildMetricCard(
            'Enrolled',
            '${stats.activeEnrollments}',
            Icons.people_outline,
            AppColors.success,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildMetricCard(
            'Company Cost',
            '\$${stats.totalMonthlyEmployerCost.toStringAsFixed(0)}/mo',
            Icons.account_balance_wallet_outlined,
            AppColors.warning,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCard(
      String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondaryLight,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimaryLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlansList(List<BenefitPlanModel> plans) {
    if (plans.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inventory_2_outlined,
                size: 48, color: AppColors.textSecondaryLight),
            const SizedBox(height: 8),
            Text(
              'No Benefit Plans Found',
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: plans.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final plan = plans[index];
        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.withOpacity(0.2)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        plan.name,
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: plan.isActive
                            ? AppColors.success.withOpacity(0.1)
                            : Colors.grey.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        plan.type.toUpperCase(),
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: plan.isActive ? AppColors.success : Colors.grey,
                        ),
                      ),
                    ),
                  ],
                ),
                if (plan.providerName != null &&
                    plan.providerName!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Provider: ${plan.providerName}',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.textSecondaryLight,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Employer: \$${plan.employerContribution.toStringAsFixed(0)}/${plan.frequency}',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppColors.primary,
                      ),
                    ),
                    Text(
                      'Employee: \$${plan.employeeContribution.toStringAsFixed(0)}/${plan.frequency}',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildEnrollmentsList(List<BenefitEnrollmentModel> enrollments) {
    if (enrollments.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.people_alt_outlined,
                size: 48, color: AppColors.textSecondaryLight),
            const SizedBox(height: 8),
            Text(
              'No Enrollments Found',
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: enrollments.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final enr = enrollments[index];
        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.withOpacity(0.2)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      enr.userName ?? 'Employee ${enr.userId.substring(0, 6)}',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: enr.status == 'active'
                            ? AppColors.success.withOpacity(0.1)
                            : Colors.grey.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        enr.status.toUpperCase(),
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: enr.status == 'active'
                              ? AppColors.success
                              : Colors.grey,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${enr.planName ?? "Benefit"} â€¢ Tier: ${enr.coverageTier}',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppColors.textSecondaryLight,
                  ),
                ),
                if (enr.dependents.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    '${enr.dependents.length} dependent(s) covered',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
