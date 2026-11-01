import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../providers/scheduling_provider.dart';
import 'admin_roster_screen.dart';
import 'vet_vto_screen.dart';

class SchedulingScreen extends ConsumerStatefulWidget {
  const SchedulingScreen({super.key});

  @override
  ConsumerState<SchedulingScreen> createState() => _SchedulingScreenState();
}

class _SchedulingScreenState extends ConsumerState<SchedulingScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late bool _showAdminTab;

  @override
  void initState() {
    super.initState();
    // Evaluate permission once at init (before first build) so TabController
    // length is stable for the lifetime of this widget.
    final authState = ref.read(authProvider);
    final role = authState.user?.role.toLowerCase() ?? '';
    final isPrivilegedRole =
        role == 'owner' || role == 'admin' || role == 'administrator';
    _showAdminTab = isPrivilegedRole ||
        authState.hasAnyPermission(
            ['manage_roster', 'manage_shift_assignments', 'manage_schedules']);
    _tabController = TabController(
      length: _showAdminTab ? 4 : 3,
      vsync: this,
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final tabs = <Tab>[
      const Tab(text: 'My Roster'),
      const Tab(text: 'All Shifts'),
      const Tab(text: 'VET & VTO'),
      if (_showAdminTab) const Tab(text: 'Admin Roster'),
    ];

    final tabViews = <Widget>[
      const _MyRosterTab(),
      const _AllShiftsTab(),
      const VetVtoScreen(),
      if (_showAdminTab) const AdminRosterScreen(),
    ];

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Text(
          'Shifts & Roster',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Open VET & VTO Hub',
            icon: const Icon(Icons.flash_on),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const VetVtoScreen()),
              );
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor:
              isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: tabs,
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: tabViews,
      ),
    );
  }
}

class _MyRosterTab extends ConsumerWidget {
  const _MyRosterTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheduleAsync = ref.watch(myScheduleProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return scheduleAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.schedule_outlined, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text('Failed to load roster: $err', style: GoogleFonts.inter()),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => ref.refresh(myScheduleProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(myScheduleProvider),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildCurrentShiftCard(isDark),
                const SizedBox(height: 24),
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: Column(
                      children: [
                        Icon(Icons.calendar_today_outlined,
                            size: 48,
                            color: isDark
                                ? AppColors.textSecondaryDark
                                : AppColors.textSecondaryLight),
                        const SizedBox(height: 12),
                        Text(
                          'No upcoming scheduled overrides',
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600, fontSize: 15),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'You are on your standard assigned pattern.',
                          style: GoogleFonts.inter(
                              fontSize: 13,
                              color: isDark
                                  ? AppColors.textSecondaryDark
                                  : AppColors.textSecondaryLight),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.refresh(myScheduleProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = items[index];
              final isToday =
                  item.date == DateFormat('yyyy-MM-dd').format(DateTime.now());

              return Card(
                elevation: isToday ? 3 : 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: isToday
                      ? const BorderSide(color: AppColors.primary, width: 1.5)
                      : BorderSide.none,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isToday
                              ? AppColors.primary.withValues(alpha: 0.15)
                              : (isDark
                                  ? AppColors.surfaceDark
                                  : AppColors.borderLight),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          children: [
                            Text(
                              item.dayOfWeek.isNotEmpty
                                  ? item.dayOfWeek
                                      .substring(0, 3)
                                      .toUpperCase()
                                  : 'DAY',
                              style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: isToday ? AppColors.primary : null),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              item.date.split('-').last,
                              style: GoogleFonts.inter(
                                  fontSize: 16, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  item.isOffDay
                                      ? 'Rest Day / Off'
                                      : (item.shift?.name ?? 'Standard Shift'),
                                  style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14),
                                ),
                                if (isToday) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      'TODAY',
                                      style: GoogleFonts.inter(
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.black),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.isOffDay
                                  ? 'No shift scheduled'
                                  : '${item.shift?.startTime ?? "09:00"} - ${item.shift?.endTime ?? "17:00"} (${item.shift?.breakMinutes ?? 60}m break)',
                              style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: isDark
                                      ? AppColors.textSecondaryDark
                                      : AppColors.textSecondaryLight),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        item.isOffDay
                            ? Icons.weekend_outlined
                            : (item.shift?.isNightShift == true
                                ? Icons.nights_stay_outlined
                                : Icons.wb_sunny_outlined),
                        color: item.isOffDay
                            ? AppColors.warning
                            : AppColors.primary,
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

  Widget _buildCurrentShiftCard(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primaryDark, AppColors.primary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Today's Active Shift",
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 13),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'ON-DUTY',
                  style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 10),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Regular Morning Shift',
            style: GoogleFonts.inter(
                color: Colors.white, fontWeight: FontWeight.w700, fontSize: 20),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.access_time_filled,
                  color: Colors.white70, size: 16),
              const SizedBox(width: 6),
              Text(
                '08:30 AM – 05:30 PM (60 min break)',
                style: GoogleFonts.inter(color: Colors.white70, fontSize: 13),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AllShiftsTab extends ConsumerWidget {
  const _AllShiftsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shiftsAsync = ref.watch(allShiftsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return shiftsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
      data: (shifts) {
        if (shifts.isEmpty) {
          return Center(
            child: Text(
              'No company shifts configured yet.',
              style: GoogleFonts.inter(
                  color: isDark
                      ? AppColors.textSecondaryDark
                      : AppColors.textSecondaryLight),
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.refresh(allShiftsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: shifts.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final shift = shifts[index];
              return Card(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                    child: Icon(
                      shift.isNightShift
                          ? Icons.nightlight_round
                          : Icons.wb_sunny_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  title: Text(shift.name,
                      style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '${shift.startTime} – ${shift.endTime} • ${shift.breakMinutes}m break',
                    style: GoogleFonts.inter(fontSize: 12),
                  ),
                  trailing: shift.isNightShift
                      ? Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.warning.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Night Shift',
                            style: GoogleFonts.inter(
                                fontSize: 10,
                                color: AppColors.warning,
                                fontWeight: FontWeight.bold),
                          ),
                        )
                      : null,
                ),
              );
            },
          ),
        );
      },
    );
  }
}
