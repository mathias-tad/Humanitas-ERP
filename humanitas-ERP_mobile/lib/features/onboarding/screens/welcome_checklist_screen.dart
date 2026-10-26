import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';
import '../providers/welcome_checklist_provider.dart';

class WelcomeChecklistScreen extends ConsumerStatefulWidget {
  final String userId;
  final Map<String, dynamic>? initialData;

  const WelcomeChecklistScreen({
    super.key,
    required this.userId,
    this.initialData,
  });

  @override
  ConsumerState<WelcomeChecklistScreen> createState() =>
      _WelcomeChecklistScreenState();
}

class _WelcomeChecklistScreenState
    extends ConsumerState<WelcomeChecklistScreen> {
  // Local toggle state, initialized from data
  bool _documentUploaded = false;
  bool _policyAccepted = false;
  bool _profileCompleted = false;
  bool _orientationViewed = false;
  bool _welcomePacketViewed = false;
  String _onboardingId = '';
  bool _initialised = false;

  void _initFromData(Map<String, dynamic> data) {
    if (_initialised) return;
    _initialised = true;
    _onboardingId =
        data['onboarding_id']?.toString() ?? data['id']?.toString() ?? '';
    _documentUploaded = data['document_uploaded'] as bool? ?? false;
    _policyAccepted = data['policy_accepted'] as bool? ?? false;
    _profileCompleted = data['profile_completed'] as bool? ?? false;
    _orientationViewed = data['orientation_viewed'] as bool? ?? false;
    _welcomePacketViewed = data['welcome_packet_viewed'] as bool? ?? false;
  }

  Future<void> _toggleItem(String key, bool value) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.put(
        '/hrms/onboarding/welcome/${widget.userId}',
        data: {
          'onboarding_id': _onboardingId,
          'updates': {key: value},
        },
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update: $e'),
            backgroundColor: AppColors.error,
          ),
        );
        // revert on failure
        setState(() {
          _initialised = false;
        });
        ref.invalidate(welcomeChecklistProvider(widget.userId));
      }
    }
  }

  double get _completionProgress {
    final checks = [
      _documentUploaded,
      _policyAccepted,
      _profileCompleted,
      _orientationViewed,
      _welcomePacketViewed,
    ];
    final completed = checks.where((c) => c).length;
    return completed / checks.length;
  }

  @override
  Widget build(BuildContext context) {
    final checklistAsync = widget.initialData != null
        ? AsyncValue.data(widget.initialData!)
        : ref.watch(welcomeChecklistProvider(widget.userId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'My Onboarding Checklist',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              setState(() => _initialised = false);
              ref.invalidate(welcomeChecklistProvider(widget.userId));
            },
          ),
        ],
      ),
      body: checklistAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    size: 48, color: AppColors.error),
                const SizedBox(height: 12),
                Text(
                  'Error loading checklist:\n$err',
                  style: GoogleFonts.inter(color: AppColors.error, fontSize: 14),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () {
                    setState(() => _initialised = false);
                    ref.invalidate(welcomeChecklistProvider(widget.userId));
                  },
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (data) {
          _initFromData(data);
          return RefreshIndicator(
            onRefresh: () async {
              setState(() => _initialised = false);
              ref.invalidate(welcomeChecklistProvider(widget.userId));
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildProgressHeader(),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Text(
                      'Complete the steps below to finish your onboarding.',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: AppColors.textSecondaryLight,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  _buildChecklistCard(
                    icon: Icons.upload_file_outlined,
                    iconColor: Colors.blue,
                    title: 'Upload Documents',
                    subtitle:
                        'Upload required identification and employment documents.',
                    value: _documentUploaded,
                    onChanged: (val) {
                      setState(() => _documentUploaded = val);
                      _toggleItem('document_uploaded', val);
                    },
                  ),
                  _buildChecklistCard(
                    icon: Icons.policy_outlined,
                    iconColor: Colors.purple,
                    title: 'Accept Company Policies',
                    subtitle:
                        "Read and accept the company's policies and code of conduct.",
                    value: _policyAccepted,
                    onChanged: (val) {
                      setState(() => _policyAccepted = val);
                      _toggleItem('policy_accepted', val);
                    },
                  ),
                  _buildChecklistCard(
                    icon: Icons.person_outline,
                    iconColor: AppColors.primary,
                    title: 'Complete Your Profile',
                    subtitle:
                        'Fill in your personal details, emergency contacts, and profile picture.',
                    value: _profileCompleted,
                    onChanged: (val) {
                      setState(() => _profileCompleted = val);
                      _toggleItem('profile_completed', val);
                    },
                  ),
                  _buildChecklistCard(
                    icon: Icons.play_circle_outline,
                    iconColor: Colors.orange,
                    title: 'View Orientation Material',
                    subtitle: 'Watch or read the company orientation content.',
                    value: _orientationViewed,
                    onChanged: (val) {
                      setState(() => _orientationViewed = val);
                      _toggleItem('orientation_viewed', val);
                    },
                  ),
                  _buildChecklistCard(
                    icon: Icons.mail_outline,
                    iconColor: AppColors.success,
                    title: 'View Welcome Packet',
                    subtitle:
                        'Review the welcome packet with important first-day information.',
                    value: _welcomePacketViewed,
                    onChanged: (val) {
                      setState(() => _welcomePacketViewed = val);
                      _toggleItem('welcome_packet_viewed', val);
                    },
                  ),
                  const SizedBox(height: 24),
                  if (_completionProgress == 1.0)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.success.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: AppColors.success.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.celebration,
                                color: AppColors.success, size: 28),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                "Congratulations! You've completed all onboarding steps.",
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.success,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildProgressHeader() {
    final percentage = (_completionProgress * 100).toInt();
    final completedCount = [
      _documentUploaded,
      _policyAccepted,
      _profileCompleted,
      _orientationViewed,
      _welcomePacketViewed
    ].where((c) => c).length;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.06),
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Overall Progress',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimaryLight,
                ),
              ),
              Text(
                '$completedCount / 5 completed',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: _completionProgress,
              backgroundColor: Colors.grey.shade200,
              color: _completionProgress == 1.0
                  ? AppColors.success
                  : AppColors.primary,
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '$percentage%',
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: _completionProgress == 1.0
                  ? AppColors.success
                  : AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChecklistCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(
            color: value ? iconColor.withOpacity(0.3) : Colors.grey.shade200,
          ),
        ),
        color: value ? iconColor.withOpacity(0.04) : null,
        child: SwitchListTile(
          secondary: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          title: Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimaryLight,
              decoration: value ? TextDecoration.lineThrough : null,
              decorationColor: AppColors.textSecondaryLight,
            ),
          ),
          subtitle: Text(
            subtitle,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: AppColors.textSecondaryLight,
            ),
          ),
          value: value,
          onChanged: onChanged,
          activeColor: iconColor,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        ),
      ),
    );
  }
}
