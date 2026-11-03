import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_assets.dart';
import '../../../core/providers/auth_provider.dart';
import '../../attendance/screens/qr_scanner_screen.dart';
import '../../leave/screens/leave_screen.dart';
import '../../payroll/screens/payslips_screen.dart';
import '../../payroll/screens/loans_screen.dart';
import '../../payroll/screens/per_diem_screen.dart';
import '../../pms/screens/my_tasks_screen.dart';
import '../../messaging/screens/conversations_screen.dart';
import '../../ai/screens/ai_chat_screen.dart';
import '../../notifications/screens/notifications_screen.dart';
import '../../profile/screens/access_control_screen.dart';
import '../../profile/screens/system_settings_screen.dart';
import '../../profile/screens/hr_settings_screen.dart';
import '../../scheduling/screens/scheduling_screen.dart';
import '../../recruitment/screens/recruitment_screen.dart';
import '../../announcements/screens/announcements_list_screen.dart';
import '../../events/screens/events_list_screen.dart';
import '../../attendance/screens/admin_attendance_screen.dart';
import '../../users/screens/users_screen.dart';
import '../../payroll/screens/admin_payroll_screen.dart';
import '../../devices/screens/devices_screen.dart';
import '../../leave/screens/admin_leave_screen.dart';
import '../../calendar/screens/calendar_screen.dart';
import '../../organization/widgets/company_branch_switcher.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasHR = authState.isModuleSubscribed('hrms') || authState.isModuleSubscribed('hr');
    final hasPMS = authState.isModuleSubscribed('pms');

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        elevation: 0,
        titleSpacing: 20,
        title: Row(
          children: [
            SizedBox(
              width: 28,
              height: 28,
              child: Image.asset(AppAssets.logo, fit: BoxFit.contain),
            ),
            const SizedBox(width: 10),
            Text(
              'Humanitas',
              style: GoogleFonts.inter(
                color: AppColors.primary,
                fontWeight: FontWeight.w800,
                fontSize: 18,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        actions: [
          const Padding(
            padding: EdgeInsets.only(right: 4),
            child: Center(child: CompanyBranchSwitcher()),
          ),
          IconButton(
            icon: Icon(
              Icons.notifications_outlined,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            ),
          ),
          IconButton(
            icon: Icon(
              Icons.settings_outlined,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
            tooltip: 'System Settings',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SystemSettingsScreen()),
            ),
          ),
          IconButton(
            icon: Icon(
              Icons.logout_rounded,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
            tooltip: 'Logout',
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [

            // ── Welcome Card ─────────────────────────────────────────
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primaryDark, AppColors.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.35),
                    blurRadius: 20,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    // Avatar
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.2),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 2),
                      ),
                      child: Center(
                        child: Text(
                          (user?.displayName.isNotEmpty == true)
                              ? user!.displayName[0].toUpperCase()
                              : 'U',
                          style: GoogleFonts.inter(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Hello, ${user?.displayName.split(' ').first ?? 'Employee'} 👋',
                            style: GoogleFonts.inter(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user?.position ?? user?.email ?? '',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: Colors.white.withValues(alpha: 0.8),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              (user?.role ?? 'employee').toUpperCase(),
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // ── Today's Status ────────────────────────────────────────
            Text(
              "Today's Overview",
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _StatusCard(label: 'Clock In', value: '--:--', color: AppColors.success, icon: Icons.login_rounded)),
                const SizedBox(width: 10),
                Expanded(child: _StatusCard(label: 'Clock Out', value: '--:--', color: AppColors.primary, icon: Icons.logout_rounded)),
                const SizedBox(width: 10),
                Expanded(child: _StatusCard(label: 'Status', value: 'Absent', color: AppColors.error, icon: Icons.circle_outlined)),
              ],
            ),

            const SizedBox(height: 24),

            // ── Quick Actions ─────────────────────────────────────────
            Text(
              'Quick Actions',
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
              ),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              children: [
                if (hasHR)
                  _QuickActionItem(icon: Icons.qr_code_scanner_rounded, color: AppColors.primary, label: 'Clock In', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const QrScannerScreen(isClockIn: true)));
                  }),
                _QuickActionItem(icon: Icons.calendar_month_rounded, color: AppColors.primary, label: 'Calendar', onTap: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CalendarScreen()));
                }),
                if (hasHR)
                  _QuickActionItem(icon: Icons.calendar_month_outlined, color: AppColors.primaryDark, label: 'Schedule', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SchedulingScreen()));
                  }),
                if (hasHR)
                  _QuickActionItem(icon: Icons.beach_access_rounded, color: AppColors.teal, label: 'Leave', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LeaveScreen()));
                  }),
                if (hasHR)
                  _QuickActionItem(icon: Icons.receipt_long_rounded, color: AppColors.success, label: 'Payslip', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PayslipsScreen()));
                  }),
                if (hasHR)
                  _QuickActionItem(icon: Icons.request_quote_rounded, color: AppColors.warning, label: 'Loan', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoansScreen()));
                  }),
                if (hasHR)
                  _QuickActionItem(icon: Icons.card_travel_rounded, color: AppColors.teal, label: 'Per Diem', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PerDiemScreen()));
                  }),
                if (hasHR)
                  _QuickActionItem(icon: Icons.work_outline_rounded, color: AppColors.primary, label: 'Recruit', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RecruitmentScreen()));
                  }),
                if (hasPMS)
                  _QuickActionItem(icon: Icons.task_alt_rounded, color: AppColors.info, label: 'Tasks', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MyTasksScreen()));
                  }),
                _QuickActionItem(icon: Icons.chat_bubble_outline, color: AppColors.teal, label: 'Messages', onTap: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ConversationsScreen()));
                }),
                _QuickActionItem(icon: Icons.smart_toy_outlined, color: AppColors.primaryDark, label: 'AI', onTap: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AiChatScreen()));
                }),
                _QuickActionItem(icon: Icons.event_outlined, color: AppColors.info, label: 'Events', onTap: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EventsListScreen()));
                }),
                _QuickActionItem(icon: Icons.campaign_outlined, color: AppColors.warning, label: 'News', onTap: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AnnouncementsListScreen()));
                }),
                _QuickActionItem(icon: Icons.admin_panel_settings_outlined, color: AppColors.primary, label: 'Access', onTap: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AccessControlScreen()));
                }),
                _QuickActionItem(icon: Icons.settings_suggest_outlined, color: AppColors.teal, label: 'Settings', onTap: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SystemSettingsScreen()));
                }),
                if (hasHR)
                  _QuickActionItem(icon: Icons.fingerprint_rounded, color: AppColors.primaryDark, label: 'Devices', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const DevicesScreen()));
                  }),
              ],
            ),

            if (user?.role == 'admin' || user?.role == 'hr_manager' || user?.role == 'hr' || user?.role == 'super_admin') ...[
              const SizedBox(height: 24),
              Text(
                'Admin Management',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                ),
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 4,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  _QuickActionItem(icon: Icons.people_alt_rounded, color: AppColors.primary, label: 'Team', onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const UsersScreen()));
                  }),
                  if (hasHR)
                    _QuickActionItem(icon: Icons.how_to_reg_rounded, color: AppColors.teal, label: 'Attendance', onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminAttendanceScreen()));
                    }),
                  if (hasHR)
                    _QuickActionItem(icon: Icons.beach_access_rounded, color: AppColors.warning, label: 'Leaves', onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminLeaveScreen()));
                    }),
                  if (hasHR)
                    _QuickActionItem(icon: Icons.account_balance_wallet_rounded, color: AppColors.success, label: 'Payroll', onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdminPayrollScreen()));
                    }),
                  if (hasHR)
                    _QuickActionItem(icon: Icons.tune_rounded, color: AppColors.primaryDark, label: 'HR Settings', onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const HrSettingsScreen()));
                    }),
                ],
              ),
            ],

            const SizedBox(height: 24),

            // ── Announcements ─────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Latest Announcements',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const AnnouncementsListScreen()),
                  ),
                  child: Text(
                    'View All',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AnnouncementsListScreen()),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.campaign_outlined, color: AppColors.primary),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Company Updates & Bulletins',
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                              ),
                            ),
                            Text(
                              'Tap to read all company announcements',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: AppColors.primary, size: 20),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // ── Upcoming Events ─────────────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Company Calendar & Events',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CalendarScreen()),
                  ),
                  child: Text(
                    'Open Calendar',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.teal),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CalendarScreen()),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.teal.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.event_available_outlined, color: AppColors.teal),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Holidays & Company Events',
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                              ),
                            ),
                            Text(
                              'Stay tuned with company schedules and holidays',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: AppColors.teal, size: 20),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

// ── Sub-Widgets ──────────────────────────────────────────────────────────────

class _StatusCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  const _StatusCard({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        child: Column(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 6),
            Text(value,
                style: GoogleFonts.inter(
                    fontSize: 14, fontWeight: FontWeight.w700, color: color)),
            const SizedBox(height: 2),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55))),
          ],
        ),
      ),
    );
  }
}

class _QuickActionItem extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  const _QuickActionItem({required this.icon, required this.color, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: color.withValues(alpha: 0.2), width: 1),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 6),
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.75))),
        ],
      ),
    );
  }
}
