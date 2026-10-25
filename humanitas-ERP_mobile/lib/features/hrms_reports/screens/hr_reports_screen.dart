import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/hrms_summary_model.dart';
import '../providers/hrms_reports_provider.dart';

class HrReportsScreen extends ConsumerStatefulWidget {
  final HrmsSummaryModel? initialSummary;
  final HeadcountDemographicsModel? initialHeadcount;

  const HrReportsScreen({
    super.key,
    this.initialSummary,
    this.initialHeadcount,
  });

  @override
  ConsumerState<HrReportsScreen> createState() => _HrReportsScreenState();
}

class _HrReportsScreenState extends ConsumerState<HrReportsScreen> {
  int _selectedTab = 0; // 0 = Demographics, 1 = Turnover & Tenure

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    // Check permission
    final bool isOwnerOrAdmin = user?.role == 'owner' ||
        user?.role == 'admin' ||
        user?.role == 'administrator';
    final bool hasPermission = isOwnerOrAdmin ||
        (user != null &&
            authState.hasAnyPermission(['view_hrms_reports', 'manage_employees']));

    if (!hasPermission) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'People Analytics',
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline, size: 54, color: AppColors.textSecondaryLight),
                const SizedBox(height: 16),
                Text(
                  'Access Denied',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                    color: AppColors.textPrimaryLight,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'You do not have permission to view HRMS executive reports.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final summaryAsync = ref.watch(hrmsSummaryProvider);
    final headcountAsync = ref.watch(hrmsHeadcountProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'People Analytics',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(hrmsSummaryProvider);
              ref.invalidate(hrmsHeadcountProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(hrmsSummaryProvider);
          ref.invalidate(hrmsHeadcountProvider);
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // KPI Metrics Grid
              summaryAsync.when(
                data: (summary) => _buildKpiGrid(summary),
                loading: () => widget.initialSummary != null
                    ? _buildKpiGrid(widget.initialSummary!)
                    : const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: CircularProgressIndicator(),
                        ),
                      ),
                error: (err, _) => widget.initialSummary != null
                    ? _buildKpiGrid(widget.initialSummary!)
                    : Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.error.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Failed to load metrics: $err',
                          style: GoogleFonts.inter(color: AppColors.error, fontSize: 12),
                        ),
                      ),
              ),

              const SizedBox(height: 20),

              // Segmented Tab Selector
              Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedTab = 0),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _selectedTab == 0
                                ? AppColors.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Center(
                            child: Text(
                              'Department Breakdown',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: _selectedTab == 0
                                    ? Colors.white
                                    : AppColors.textSecondaryLight,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _selectedTab = 1),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _selectedTab == 1
                                ? AppColors.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Center(
                            child: Text(
                              'Gender & Tenure',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: _selectedTab == 1
                                    ? Colors.white
                                    : AppColors.textSecondaryLight,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Tab Content
              headcountAsync.when(
                data: (hc) => _selectedTab == 0
                    ? _buildDepartmentList(hc.byDepartment)
                    : _buildGenderAndTenureList(hc.byGender, hc.byTenure),
                loading: () => widget.initialHeadcount != null
                    ? (_selectedTab == 0
                        ? _buildDepartmentList(widget.initialHeadcount!.byDepartment)
                        : _buildGenderAndTenureList(
                            widget.initialHeadcount!.byGender,
                            widget.initialHeadcount!.byTenure))
                    : const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: CircularProgressIndicator(),
                        ),
                      ),
                error: (err, _) => widget.initialHeadcount != null
                    ? (_selectedTab == 0
                        ? _buildDepartmentList(widget.initialHeadcount!.byDepartment)
                        : _buildGenderAndTenureList(
                            widget.initialHeadcount!.byGender,
                            widget.initialHeadcount!.byTenure))
                    : Text(
                        'Failed to load breakdown: $err',
                        style: GoogleFonts.inter(color: AppColors.error, fontSize: 12),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKpiGrid(HrmsSummaryModel summary) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildMetricTile(
                title: 'Total Headcount',
                value: '${summary.totalHeadcount}',
                subtitle: '${summary.newHiresThisMonth} new this month',
                icon: Icons.people_outline,
                color: Colors.blue,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricTile(
                title: 'Active Workforce',
                value: '${summary.activeEmployees}',
                subtitle: 'Active staff',
                icon: Icons.check_circle_outline,
                color: AppColors.success,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildMetricTile(
                title: 'Turnover Rate',
                value: '${summary.turnoverRatePercentage}%',
                subtitle: 'Annualized',
                icon: Icons.trending_down,
                color: Colors.amber,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricTile(
                title: 'Avg. Tenure',
                value: '${summary.averageTenureYears} yrs',
                subtitle: 'Longevity',
                icon: Icons.access_time,
                color: Colors.purple,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondaryLight,
                ),
              ),
              Icon(icon, size: 18, color: color),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: GoogleFonts.inter(
              fontSize: 10,
              color: AppColors.textSecondaryLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDepartmentList(List<DepartmentHeadcountItem> items) {
    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Text(
            'No department records found',
            style: GoogleFonts.inter(color: AppColors.textSecondaryLight, fontSize: 13),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: items.map((dept) {
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.borderLight),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                dept.name,
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: AppColors.textPrimaryLight,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${dept.count} staff',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildGenderAndTenureList(
    List<DepartmentHeadcountItem> genderList,
    List<DepartmentHeadcountItem> tenureList,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Gender Representation',
          style: GoogleFonts.inter(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: AppColors.textPrimaryLight,
          ),
        ),
        const SizedBox(height: 8),
        ...genderList.map((g) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.borderLight),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    g.name,
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w500,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    '${g.count} staff',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: AppColors.textPrimaryLight,
                    ),
                  ),
                ],
              ),
            )),
        const SizedBox(height: 16),
        Text(
          'Tenure Distribution',
          style: GoogleFonts.inter(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: AppColors.textPrimaryLight,
          ),
        ),
        const SizedBox(height: 8),
        ...tenureList.map((t) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.borderLight),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    t.name,
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w500,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    '${t.count} staff',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }
}
