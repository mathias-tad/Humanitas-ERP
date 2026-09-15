import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/recruitment_provider.dart';

class RecruitmentScreen extends ConsumerStatefulWidget {
  const RecruitmentScreen({super.key});

  @override
  ConsumerState<RecruitmentScreen> createState() => _RecruitmentScreenState();
}

class _RecruitmentScreenState extends ConsumerState<RecruitmentScreen> with SingleTickerProviderStateMixin {
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Text(
          'Recruitment (ATS)',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Open Positions'),
            Tab(text: 'Candidates (AI Scored)'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _JobsListTab(),
          _ApplicationsListTab(),
        ],
      ),
    );
  }
}

class _JobsListTab extends ConsumerWidget {
  const _JobsListTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsAsync = ref.watch(recruitmentJobsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return jobsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.work_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text('Failed to load jobs: $err'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => ref.refresh(recruitmentJobsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (jobs) {
        if (jobs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.business_center_outlined, size: 48, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                const SizedBox(height: 12),
                Text('No open positions right now', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.refresh(recruitmentJobsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: jobs.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final job = jobs[index];
              return Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              job.title,
                              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: job.status == 'open' ? AppColors.success.withValues(alpha: 0.15) : (isDark ? AppColors.surfaceDark : AppColors.borderLight),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              job.status.toUpperCase(),
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: job.status == 'open' ? AppColors.success : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined, size: 14, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(
                            job.location ?? 'Remote',
                            style: GoogleFonts.inter(fontSize: 12, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                          ),
                          const SizedBox(width: 12),
                          const Icon(Icons.category_outlined, size: 14, color: AppColors.teal),
                          const SizedBox(width: 4),
                          Text(
                            job.department ?? 'General',
                            style: GoogleFonts.inter(fontSize: 12, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _ApplicationsListTab extends ConsumerWidget {
  const _ApplicationsListTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appsAsync = ref.watch(recruitmentApplicationsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return appsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
      data: (apps) {
        if (apps.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.people_outline, size: 48, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                const SizedBox(height: 12),
                Text('No candidate applications yet', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.refresh(recruitmentApplicationsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: apps.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final app = apps[index];
              final hasScore = app.aiScore != null && app.aiScore! > 0;

              return Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                        child: Text(
                          app.candidateName.isNotEmpty ? app.candidateName[0].toUpperCase() : 'C',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              app.candidateName,
                              style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              app.jobTitle ?? 'Applicant',
                              style: GoogleFonts.inter(fontSize: 12, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                            ),
                          ],
                        ),
                      ),
                      if (hasScore)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: app.aiScore! >= 80 ? AppColors.success.withValues(alpha: 0.15) : AppColors.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.auto_awesome, size: 12, color: app.aiScore! >= 80 ? AppColors.success : AppColors.primary),
                              const SizedBox(width: 4),
                              Text(
                                '${app.aiScore!.toStringAsFixed(0)}%',
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 11,
                                  color: app.aiScore! >= 80 ? AppColors.success : AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
