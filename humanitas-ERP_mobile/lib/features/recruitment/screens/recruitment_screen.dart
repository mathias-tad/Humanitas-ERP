import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/recruitment_models.dart';
import '../providers/recruitment_provider.dart';

class RecruitmentScreen extends ConsumerStatefulWidget {
  final List<JobPostModel>? initialJobs;
  final List<CandidateApplicationModel>? initialApplications;
  final List<InterviewModel>? initialInterviews;
  final RecruitmentFunnelModel? initialFunnel;

  const RecruitmentScreen({
    super.key,
    this.initialJobs,
    this.initialApplications,
    this.initialInterviews,
    this.initialFunnel,
  });

  @override
  ConsumerState<RecruitmentScreen> createState() => _RecruitmentScreenState();
}

class _RecruitmentScreenState extends ConsumerState<RecruitmentScreen> with SingleTickerProviderStateMixin {
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

  bool _hasPermission() {
    final auth = ref.watch(authProvider);
    return auth.hasAnyPermission(['manage_recruitment', 'view_recruitment', 'recruitment']);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (!_hasPermission()) {
      return Scaffold(
        backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
        appBar: AppBar(
          title: Text(
            'Recruitment & ATS',
            style: GoogleFonts.inter(fontWeight: FontWeight.w700),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline, size: 48, color: Colors.grey),
                const SizedBox(height: 16),
                Text(
                  'Access Denied',
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'You do not have permission to access Recruitment & ATS.',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Text(
          'Recruitment & ATS',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(recruitmentJobsProvider);
              ref.invalidate(recruitmentApplicationsProvider);
              ref.invalidate(recruitmentInterviewsProvider);
              ref.invalidate(recruitmentOffersProvider);
              ref.invalidate(recruitmentFunnelProvider);
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Pipeline'),
            Tab(text: 'Interviews'),
            Tab(text: 'Analytics'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _PipelineTab(
            initialJobs: widget.initialJobs,
            initialApplications: widget.initialApplications,
          ),
          _InterviewsTab(
            initialInterviews: widget.initialInterviews,
          ),
          _AnalyticsTab(
            initialFunnel: widget.initialFunnel,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: PIPELINE / CANDIDATES
// ─────────────────────────────────────────────────────────────────────────────

class _PipelineTab extends ConsumerStatefulWidget {
  final List<JobPostModel>? initialJobs;
  final List<CandidateApplicationModel>? initialApplications;

  const _PipelineTab({
    this.initialJobs,
    this.initialApplications,
  });

  @override
  ConsumerState<_PipelineTab> createState() => _PipelineTabState();
}

class _PipelineTabState extends ConsumerState<_PipelineTab> {
  Color _stageColor(String stage) {
    switch (stage.toLowerCase()) {
      case 'applied':
      case 'received':
        return Colors.blue;
      case 'screened':
      case 'shortlisted':
        return AppColors.teal;
      case 'interview':
      case 'interviewing':
        return Colors.orange;
      case 'offer':
        return Colors.amber.shade800;
      case 'hired':
      case 'accepted':
        return AppColors.success;
      case 'rejected':
      case 'declined':
        return AppColors.error;
      default:
        return Colors.grey;
    }
  }

  void _showScheduleInterviewDialog(BuildContext context, CandidateApplicationModel candidate) {
    final formKey = GlobalKey<FormState>();
    final interviewerCtrl = TextEditingController(text: 'HR Manager');
    final meetingLinkCtrl = TextEditingController(text: 'https://meet.google.com/abc-defg-hij');
    String interviewType = 'Technical';
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1, hours: 2));

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            return AlertDialog(
              title: Text(
                'Schedule Interview',
                style: GoogleFonts.inter(fontWeight: FontWeight.w700),
              ),
              content: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Candidate: ${candidate.candidateName}',
                        style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      if (candidate.jobTitle != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Position: ${candidate.jobTitle}',
                          style: GoogleFonts.inter(color: Colors.grey.shade600, fontSize: 13),
                        ),
                      ],
                      const SizedBox(height: 16),
                      Text('Interview Type', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<String>(
                        value: interviewType,
                        items: const [
                          DropdownMenuItem(value: 'Technical', child: Text('Technical Round')),
                          DropdownMenuItem(value: 'HR', child: Text('HR Screening')),
                          DropdownMenuItem(value: 'Cultural Fit', child: Text('Cultural Fit')),
                          DropdownMenuItem(value: 'Executive', child: Text('Executive Interview')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setDialogState(() => interviewType = val);
                          }
                        },
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text('Interviewer Name', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: interviewerCtrl,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                        validator: (val) => val == null || val.trim().isEmpty ? 'Enter interviewer name' : null,
                      ),
                      const SizedBox(height: 12),
                      Text('Meeting Link', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: meetingLinkCtrl,
                        decoration: InputDecoration(
                          hintText: 'https://...',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            DateFormat('MMM dd, yyyy - hh:mm a').format(selectedDate),
                            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                          TextButton(
                            onPressed: () async {
                              final pickedDate = await showDatePicker(
                                context: context,
                                initialDate: selectedDate,
                                firstDate: DateTime.now(),
                                lastDate: DateTime.now().add(const Duration(days: 90)),
                              );
                              if (pickedDate != null) {
                                final pickedTime = await showTimePicker(
                                  context: context,
                                  initialTime: TimeOfDay.fromDateTime(selectedDate),
                                );
                                if (pickedTime != null) {
                                  setDialogState(() {
                                    selectedDate = DateTime(
                                      pickedDate.year,
                                      pickedDate.month,
                                      pickedDate.day,
                                      pickedTime.hour,
                                      pickedTime.minute,
                                    );
                                  });
                                }
                              }
                            },
                            child: const Text('Change Date'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    if (formKey.currentState?.validate() ?? false) {
                      Navigator.of(context).pop();
                      final repo = ref.read(recruitmentRepositoryProvider);
                      final success = await repo.scheduleInterview({
                        'candidate_id': candidate.id,
                        'candidate_name': candidate.candidateName,
                        'job_title': candidate.jobTitle,
                        'interviewer_name': interviewerCtrl.text.trim(),
                        'interview_type': interviewType,
                        'meeting_link': meetingLinkCtrl.text.trim(),
                        'scheduled_at': selectedDate.toIso8601String(),
                      });

                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              success
                                  ? 'Interview scheduled with ${candidate.candidateName}!'
                                  : 'Failed to schedule interview.',
                            ),
                            backgroundColor: success ? AppColors.success : AppColors.error,
                          ),
                        );
                        ref.invalidate(recruitmentInterviewsProvider);
                      }
                    }
                  },
                  child: const Text('Schedule'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showHireCandidateDialog(BuildContext context, CandidateApplicationModel candidate) {
    final formKey = GlobalKey<FormState>();
    final salaryCtrl = TextEditingController(text: '75000');
    final roleCtrl = TextEditingController(text: candidate.jobTitle ?? 'Software Engineer');

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(
            'Hire Candidate',
            style: GoogleFonts.inter(fontWeight: FontWeight.w700),
          ),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Convert ${candidate.candidateName} to an active employee?',
                  style: GoogleFonts.inter(fontSize: 14),
                ),
                const SizedBox(height: 16),
                Text('Designation / Role', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: roleCtrl,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  validator: (val) => val == null || val.trim().isEmpty ? 'Enter role' : null,
                ),
                const SizedBox(height: 12),
                Text('Offered Annual Salary (\$)', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: salaryCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  validator: (val) => val == null || val.trim().isEmpty ? 'Enter salary' : null,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.success, foregroundColor: Colors.white),
              onPressed: () async {
                if (formKey.currentState?.validate() ?? false) {
                  Navigator.of(context).pop();
                  final repo = ref.read(recruitmentRepositoryProvider);
                  final success = await repo.convertToEmployee(candidate.id, {
                    'candidate_id': candidate.id,
                    'designation': roleCtrl.text.trim(),
                    'offered_salary': double.tryParse(salaryCtrl.text.trim()) ?? 0,
                    'status': 'hired',
                  });

                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          success
                              ? '${candidate.candidateName} successfully hired & onboarded!'
                              : 'Failed to hire candidate.',
                        ),
                        backgroundColor: success ? AppColors.success : AppColors.error,
                      ),
                    );
                    ref.invalidate(recruitmentApplicationsProvider);
                    ref.invalidate(recruitmentFunnelProvider);
                  }
                }
              },
              child: const Text('Confirm Hire'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final appsAsync = ref.watch(recruitmentApplicationsProvider);
    final jobsAsync = ref.watch(recruitmentJobsProvider);
    final selectedJob = ref.watch(selectedJobFilterProvider);

    final apps = widget.initialApplications ?? appsAsync.valueOrNull ?? [];
    final jobs = widget.initialJobs ?? jobsAsync.valueOrNull ?? [];

    return Column(
      children: [
        // Job filter selector
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            border: Border(bottom: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight)),
          ),
          child: Row(
            children: [
              Icon(Icons.filter_list, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String?>(
                    value: selectedJob,
                    isExpanded: true,
                    hint: Text(
                      'All Job Positions (${apps.length} candidates)',
                      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    items: [
                      DropdownMenuItem<String?>(
                        value: null,
                        child: Text(
                          'All Job Positions',
                          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                      ...jobs.map((j) {
                        return DropdownMenuItem<String?>(
                          value: j.id,
                          child: Text(
                            j.title,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(fontSize: 13),
                          ),
                        );
                      }),
                    ],
                    onChanged: (val) {
                      ref.read(selectedJobFilterProvider.notifier).state = val;
                    },
                  ),
                ),
              ),
            ],
          ),
        ),

        // Applications list
        Expanded(
          child: appsAsync.when(
            loading: () => widget.initialApplications != null
                ? _buildCandidateList(apps, isDark)
                : const Center(child: CircularProgressIndicator()),
            error: (err, _) => widget.initialApplications != null
                ? _buildCandidateList(apps, isDark)
                : Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.people_outline, size: 48, color: AppColors.error),
                        const SizedBox(height: 12),
                        Text('Failed to load candidate applications: $err'),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: () => ref.refresh(recruitmentApplicationsProvider),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
            data: (loadedApps) {
              final activeApps = widget.initialApplications ?? loadedApps;
              return _buildCandidateList(activeApps, isDark);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCandidateList(List<CandidateApplicationModel> candidates, bool isDark) {
    if (candidates.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.people_outline,
              size: 48,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
            const SizedBox(height: 12),
            Text(
              'No candidate applications found',
              style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Text(
              'Candidates who apply to open roles will appear here.',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(recruitmentApplicationsProvider),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: candidates.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final c = candidates[index];
          final stage = c.stage ?? c.status;
          final color = _stageColor(stage);
          final hasAiScore = c.aiScore != null && c.aiScore! > 0;

          return Card(
            elevation: 1.5,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            color: isDark ? AppColors.surfaceDark : Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top row: Avatar + Name/Job + Badges
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: AppColors.primary.withOpacity(0.15),
                        child: Text(
                          c.candidateName.isNotEmpty ? c.candidateName[0].toUpperCase() : 'C',
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c.candidateName,
                              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              c.jobTitle ?? 'Applicant',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          // Stage badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: color.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: color.withOpacity(0.4)),
                            ),
                            child: Text(
                              stage.toUpperCase(),
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: color,
                              ),
                            ),
                          ),
                          if (hasAiScore) ...[
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: c.aiScore! >= 80
                                    ? AppColors.success.withOpacity(0.15)
                                    : AppColors.primary.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.auto_awesome,
                                    size: 11,
                                    color: c.aiScore! >= 80 ? AppColors.success : AppColors.primary,
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    '${c.aiScore!.toStringAsFixed(0)}%',
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 10,
                                      color: c.aiScore! >= 80 ? AppColors.success : AppColors.primary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),

                  // Candidate details (Email/Phone/Experience)
                  if (c.candidateEmail != null || c.experienceYears != null) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        if (c.candidateEmail != null) ...[
                          const Icon(Icons.email_outlined, size: 13, color: Colors.grey),
                          const SizedBox(width: 4),
                          Text(
                            c.candidateEmail!,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        if (c.experienceYears != null) ...[
                          const Icon(Icons.work_history_outlined, size: 13, color: Colors.grey),
                          const SizedBox(width: 4),
                          Text(
                            '${c.experienceYears!.toStringAsFixed(1)} yrs exp',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],

                  const SizedBox(height: 14),
                  const Divider(height: 1),
                  const SizedBox(height: 10),

                  // Quick action buttons: Schedule Interview & Hire
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          visualDensity: VisualDensity.compact,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        icon: const Icon(Icons.calendar_today_outlined, size: 14),
                        label: Text(
                          'Schedule Interview',
                          style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                        onPressed: () => _showScheduleInterviewDialog(context, c),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.success,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          visualDensity: VisualDensity.compact,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        icon: const Icon(Icons.how_to_reg, size: 14),
                        label: Text(
                          'Hire',
                          style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                        onPressed: () => _showHireCandidateDialog(context, c),
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
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: INTERVIEWS
// ─────────────────────────────────────────────────────────────────────────────

class _InterviewsTab extends ConsumerWidget {
  final List<InterviewModel>? initialInterviews;

  const _InterviewsTab({this.initialInterviews});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final interviewsAsync = ref.watch(recruitmentInterviewsProvider);

    final interviews = initialInterviews ?? interviewsAsync.valueOrNull ?? [];

    return interviewsAsync.when(
      loading: () => initialInterviews != null
          ? _buildInterviewList(interviews, isDark, ref)
          : const Center(child: CircularProgressIndicator()),
      error: (err, _) => initialInterviews != null
          ? _buildInterviewList(interviews, isDark, ref)
          : Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.event_busy, size: 48, color: AppColors.error),
                  const SizedBox(height: 12),
                  Text('Failed to load interviews: $err'),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => ref.refresh(recruitmentInterviewsProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
      data: (loadedInterviews) {
        final active = initialInterviews ?? loadedInterviews;
        return _buildInterviewList(active, isDark, ref);
      },
    );
  }

  Widget _buildInterviewList(List<InterviewModel> list, bool isDark, WidgetRef ref) {
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.event_available_outlined,
              size: 48,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
            const SizedBox(height: 12),
            Text(
              'No Scheduled Interviews',
              style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              'Interviews scheduled from the Pipeline tab will appear here.',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => ref.refresh(recruitmentInterviewsProvider),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final item = list[index];
          final dateStr = DateFormat('EEE, MMM dd, yyyy • hh:mm a').format(item.scheduledAt);

          return Card(
            elevation: 1.5,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight),
            ),
            color: isDark ? AppColors.surfaceDark : Colors.white,
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
                          item.candidateName,
                          style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                        ),
                        child: Text(
                          item.interviewType.toUpperCase(),
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (item.jobTitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.jobTitle!,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.calendar_month_outlined, size: 14, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        dateStr,
                        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.person_outline, size: 14, color: AppColors.teal),
                      const SizedBox(width: 6),
                      Text(
                        'Interviewer: ${item.interviewerName}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                        ),
                      ),
                    ],
                  ),
                  if (item.meetingLink != null && item.meetingLink!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.cardDark : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: isDark ? AppColors.borderDark : Colors.grey.shade200),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.videocam_outlined, size: 16, color: Colors.blue),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              item.meetingLink!,
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: Colors.blue.shade700,
                                decoration: TextDecoration.underline,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: ANALYTICS (FUNNEL)
// ─────────────────────────────────────────────────────────────────────────────

class _AnalyticsTab extends ConsumerWidget {
  final RecruitmentFunnelModel? initialFunnel;

  const _AnalyticsTab({this.initialFunnel});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final funnelAsync = ref.watch(recruitmentFunnelProvider);
    final funnel = initialFunnel ?? funnelAsync.valueOrNull ?? const RecruitmentFunnelModel();

    return funnelAsync.when(
      loading: () => initialFunnel != null
          ? _buildFunnelContent(funnel, isDark, ref)
          : const Center(child: CircularProgressIndicator()),
      error: (err, _) => initialFunnel != null
          ? _buildFunnelContent(funnel, isDark, ref)
          : Center(child: Text('Failed to load funnel analytics: $err')),
      data: (loadedFunnel) {
        final active = initialFunnel ?? loadedFunnel;
        return _buildFunnelContent(active, isDark, ref);
      },
    );
  }

  Widget _buildFunnelContent(RecruitmentFunnelModel funnel, bool isDark, WidgetRef ref) {
    return RefreshIndicator(
      onRefresh: () async => ref.refresh(recruitmentFunnelProvider),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Recruitment Funnel Overview',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              'Candidate progression from application to onboarding.',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
            const SizedBox(height: 16),

            // Conversion rate overview banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primary.withOpacity(0.18), AppColors.teal.withOpacity(0.18)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primary.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.insights, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Overall Conversion Rate',
                          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${funnel.overallConversionRate.toStringAsFixed(1)}%',
                          style: GoogleFonts.inter(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Total Hired',
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade600),
                      ),
                      Text(
                        '${funnel.hired} / ${funnel.applied}',
                        style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),
            Text(
              'Funnel Conversion Stages',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 12),

            // Step 1: Applied
            _buildStageCard(
              stageName: 'Applied',
              count: funnel.applied,
              conversionRate: 100.0,
              icon: Icons.people_outline,
              color: Colors.blue,
              isDark: isDark,
              isFirst: true,
            ),
            _buildFunnelArrow(isDark),

            // Step 2: Screened
            _buildStageCard(
              stageName: 'Screened',
              count: funnel.screened,
              conversionRate: funnel.screenRate,
              icon: Icons.filter_alt_outlined,
              color: AppColors.teal,
              isDark: isDark,
            ),
            _buildFunnelArrow(isDark),

            // Step 3: Interview
            _buildStageCard(
              stageName: 'Interview',
              count: funnel.interview,
              conversionRate: funnel.interviewRate,
              icon: Icons.video_call_outlined,
              color: Colors.orange,
              isDark: isDark,
            ),
            _buildFunnelArrow(isDark),

            // Step 4: Offer
            _buildStageCard(
              stageName: 'Offer',
              count: funnel.offer,
              conversionRate: funnel.offerRate,
              icon: Icons.description_outlined,
              color: Colors.amber.shade800,
              isDark: isDark,
            ),
            _buildFunnelArrow(isDark),

            // Step 5: Hired
            _buildStageCard(
              stageName: 'Hired',
              count: funnel.hired,
              conversionRate: funnel.hireRate,
              icon: Icons.celebration_outlined,
              color: AppColors.success,
              isDark: isDark,
              isLast: true,
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildFunnelArrow(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Icon(
          Icons.arrow_downward,
          size: 18,
          color: isDark ? AppColors.textSecondaryDark.withOpacity(0.5) : Colors.grey.shade400,
        ),
      ),
    );
  }

  Widget _buildStageCard({
    required String stageName,
    required int count,
    required double conversionRate,
    required IconData icon,
    required Color color,
    required bool isDark,
    bool isFirst = false,
    bool isLast = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.35)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stageName,
                  style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(
                  isFirst
                      ? '$count Total Candidates'
                      : '$count Candidates (${conversionRate.toStringAsFixed(0)}% from previous)',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
          Text(
            count.toString(),
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
