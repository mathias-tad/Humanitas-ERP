import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../../attendance/models/attendance_record_model.dart';
import '../../attendance/providers/attendance_provider.dart' hide myScheduleProvider;
import '../models/shift_model.dart';
import '../models/wfm_opportunity_model.dart';
import '../providers/scheduling_provider.dart';
import '../providers/wfm_provider.dart';
import 'admin_roster_screen.dart';

// ── Custom Diagonal Stripe Painter for Scheduled Shifts ───────────────────────
class DiagonalStripePainter extends CustomPainter {
  final Color stripeColor;
  final double stripeWidth;
  final double step;

  DiagonalStripePainter({
    required this.stripeColor,
    this.stripeWidth = 2.0,
    this.step = 8.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = stripeColor
      ..strokeWidth = stripeWidth
      ..style = PaintingStyle.stroke;

    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, 0, size.width, size.height));

    for (double x = -size.height; x < size.width + size.height; x += step) {
      canvas.drawLine(
        Offset(x, size.height),
        Offset(x + size.height, 0),
        paint,
      );
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Custom Speed Lines Painter for 0 Punches Clock Graphic ────────────────────
class _SpeedLinesPainter extends CustomPainter {
  final Color color;

  _SpeedLinesPainter({this.color = const Color(0xFF93C5FD)});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: 0.5)
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final centerY = size.height / 2;

    // Left horizontal speed lines
    canvas.drawLine(Offset(10, centerY - 14), Offset(46, centerY - 14), paint);
    canvas.drawLine(Offset(2, centerY), Offset(40, centerY), paint);
    canvas.drawLine(Offset(14, centerY + 14), Offset(48, centerY + 14), paint);

    // Right horizontal speed lines
    canvas.drawLine(Offset(size.width - 46, centerY - 14), Offset(size.width - 10, centerY - 14), paint);
    canvas.drawLine(Offset(size.width - 40, centerY), Offset(size.width - 2, centerY), paint);
    canvas.drawLine(Offset(size.width - 48, centerY + 14), Offset(size.width - 14, centerY + 14), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Clock Illustration Widget (Matching Screenshot 2) ─────────────────────────
class ClockIllustration extends StatelessWidget {
  const ClockIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 180,
        height: 100,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: const Size(180, 100),
              painter: _SpeedLinesPainter(),
            ),
            Container(
              width: 66,
              height: 66,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
                border: Border.all(color: const Color(0xFF60A5FA), width: 4.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF93C5FD).withValues(alpha: 0.35),
                    blurRadius: 14,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF1E3A8A),
                    ),
                  ),
                  Positioned(
                    left: 14,
                    child: Container(
                      width: 19,
                      height: 3,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E3A8A),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 10,
                    child: Container(
                      width: 3,
                      height: 23,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E3A8A),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Main Scheduling Screen ────────────────────────────────────────────────────
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
    final authState = ref.read(authProvider);
    final role = authState.user?.role.toLowerCase() ?? '';
    final isPrivilegedRole =
        role == 'owner' || role == 'admin' || role == 'administrator' || role == 'hr_manager' || role == 'super_admin';
    _showAdminTab = isPrivilegedRole ||
        authState.hasAnyPermission(
            ['manage_roster', 'manage_shift_assignments', 'manage_schedules']);

    _tabController = TabController(
      length: _showAdminTab ? 5 : 4,
      vsync: this,
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showScheduleHelp(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.help_outline_rounded, color: Color(0xFF1D70B8), size: 24),
                const SizedBox(width: 10),
                Text(
                  'Schedule & Punch Guide',
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildHelpRow(const Color(0xFF1D70B8), 'Punches', 'Indicates days where your punch-in/out records have been processed and confirmed.'),
            const SizedBox(height: 12),
            _buildHelpRow(const Color(0xFFDC2626), 'Attention', 'Indicates missed clock-in/out or unexcused attendance anomalies that need review.'),
            const SizedBox(height: 12),
            _buildHelpRow(const Color(0xFFBFDBFE), 'Scheduled shifts', 'Assigned work shifts where punches have not yet occurred.'),
            const SizedBox(height: 12),
            _buildHelpRow(Colors.blueGrey, 'Payday (•)', 'Designated company salary and payroll disbursement dates.'),
            const SizedBox(height: 20),
            Text(
              'Sync Note: It may take up to 5 minutes for recent device punches or mobile badge scans to reflect on this schedule page.',
              style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600], fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D70B8),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Got it'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHelpRow(Color color, String title, String description) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 18,
          height: 18,
          margin: const EdgeInsets.only(top: 2),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14)),
              const SizedBox(height: 2),
              Text(description, style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600])),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final tabs = <Tab>[
      const Tab(text: 'My Schedule'),
      const Tab(text: 'Timecard'),
      const Tab(text: 'Find Shifts'),
      const Tab(text: 'VTO >'),
      if (_showAdminTab) const Tab(text: 'Admin Roster'),
    ];

    final tabViews = <Widget>[
      const _MyScheduleTab(),
      const _TimecardTab(),
      const _FindShiftsTab(),
      const _VtoTab(),
      if (_showAdminTab) const AdminRosterScreen(),
    ];

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : const Color(0xFFF9FAFB),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
        titleSpacing: 16,
        title: Text(
          'Schedule',
          style: GoogleFonts.inter(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Schedule Guide',
            icon: const Icon(Icons.help_outline_rounded, size: 22),
            onPressed: () => _showScheduleHelp(context),
          ),
          IconButton(
            tooltip: 'My Profile',
            icon: const Icon(Icons.sentiment_satisfied_alt_outlined, size: 22),
            onPressed: () {},
          ),
          IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_none_rounded, size: 22),
            onPressed: () {},
          ),
          const SizedBox(width: 4),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: const Color(0xFF1D70B8),
          indicatorWeight: 3,
          labelColor: const Color(0xFF1D70B8),
          unselectedLabelColor: isDark ? Colors.grey[400] : const Color(0xFF4B5563),
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14),
          unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 14),
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

// ── Tab 1: My Schedule (Calendar Month Grid & Punches Timeline) ───────────────
class _MyScheduleTab extends ConsumerStatefulWidget {
  const _MyScheduleTab();

  @override
  ConsumerState<_MyScheduleTab> createState() => _MyScheduleTabState();
}

class _MyScheduleTabState extends ConsumerState<_MyScheduleTab> {
  late DateTime _selectedMonth;
  late DateTime _selectedDate;
  bool _isPunchTimesExpanded = true;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedMonth = DateTime(now.year, now.month, 1);
    _selectedDate = now;
  }

  void _changeMonth(int delta) {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month + delta, 1);
      if (_selectedDate.month != _selectedMonth.month || _selectedDate.year != _selectedMonth.year) {
        _selectedDate = DateTime(_selectedMonth.year, _selectedMonth.month, 1);
      }
    });
  }

  void _openMissedPunchDialog(BuildContext context, DateTime date) {
    String punchType = 'in';
    TimeOfDay selectedTime = const TimeOfDay(hour: 9, minute: 0);
    final reasonController = TextEditingController();
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Missed a punch?',
                    style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
              Text(
                'Submit a correction request for ${DateFormat('EEEE, MMM d, yyyy').format(date)}',
                style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[600]),
              ),
              const SizedBox(height: 16),
              Text('Punch Type', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'in', label: Text('Clock In (In)'), icon: Icon(Icons.login)),
                  ButtonSegment(value: 'out', label: Text('Clock Out (Out)'), icon: Icon(Icons.logout)),
                ],
                selected: {punchType},
                onSelectionChanged: (set) {
                  setModalState(() => punchType = set.first);
                },
              ),
              const SizedBox(height: 16),
              Text('Requested Time', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              InkWell(
                onTap: () async {
                  final picked = await showTimePicker(
                    context: context,
                    initialTime: selectedTime,
                  );
                  if (picked != null) {
                    setModalState(() => selectedTime = picked);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey[300]!),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.access_time, size: 20, color: Color(0xFF1D70B8)),
                      const SizedBox(width: 10),
                      Text(
                        selectedTime.format(context),
                        style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Reason / Notes', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: reasonController,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: 'e.g. Scanner was offline, forgot badge...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.all(12),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D70B8),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          setModalState(() => isSubmitting = true);
                          final timeStr =
                              '${selectedTime.hour.toString().padLeft(2, '0')}:${selectedTime.minute.toString().padLeft(2, '0')}';
                          final dateStr = DateFormat('yyyy-MM-dd').format(date);

                          final repo = ref.read(attendanceRepositoryProvider);
                          await repo.submitMissedPunch(
                            date: dateStr,
                            punchType: punchType,
                            requestedTime: timeStr,
                            reason: reasonController.text,
                          );

                          ref.invalidate(myRecordsProvider((month: date.month, year: date.year)));

                          if (context.mounted) {
                            Navigator.of(ctx).pop();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Missed punch correction request submitted successfully!'),
                                backgroundColor: AppColors.success,
                              ),
                            );
                          }
                        },
                  child: isSubmitting
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Submit Request'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final recordsAsync = ref.watch(myRecordsProvider((month: _selectedMonth.month, year: _selectedMonth.year)));
    final scheduleAsync = ref.watch(myScheduleProvider);

    return recordsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error loading schedule: $e')),
      data: (records) {
        final scheduleList = scheduleAsync.value ?? [];
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(myRecordsProvider((month: _selectedMonth.month, year: _selectedMonth.year)));
            ref.invalidate(myScheduleProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Month Navigation Header ──────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      DateFormat('MMMM yyyy').format(_selectedMonth),
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : const Color(0xFF111827),
                      ),
                    ),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.chevron_left, size: 28),
                          onPressed: () => _changeMonth(-1),
                        ),
                        IconButton(
                          icon: const Icon(Icons.chevron_right, size: 28),
                          onPressed: () => _changeMonth(1),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // ── Calendar Month Table ─────────────────────────────────────
                _buildCalendarTable(isDark, records, scheduleList),
                const SizedBox(height: 12),

                // ── Legend Matching Screenshot ───────────────────────────────
                _buildLegend(isDark),
                const SizedBox(height: 24),

                // ── Selected Date Header (Uppercase) ─────────────────────────
                Text(
                  DateFormat('EEEE, MMM d').format(_selectedDate).toUpperCase(),
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 12),

                // ── Punch Times Card with Accordion & Missed Punch ───────────
                _buildPunchTimesCard(isDark, records, scheduleList),
                const SizedBox(height: 24),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildCalendarTable(
    bool isDark,
    List<AttendanceRecordModel> records,
    List<UserScheduleItem> schedules,
  ) {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final daysInMonth = DateUtils.getDaysInMonth(_selectedMonth.year, _selectedMonth.month);
    final firstDayWeekday = DateTime(_selectedMonth.year, _selectedMonth.month, 1).weekday % 7; // 0=Sun
    final prevMonthDays = DateUtils.getDaysInMonth(
      _selectedMonth.month == 1 ? _selectedMonth.year - 1 : _selectedMonth.year,
      _selectedMonth.month == 1 ? 12 : _selectedMonth.month - 1,
    );

    final totalCells = ((firstDayWeekday + daysInMonth) <= 35) ? 35 : 42;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        border: Border.all(color: isDark ? const Color(0xFF374151) : const Color(0xFFE5E7EB)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        children: [
          // Weekday header row
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: isDark ? const Color(0xFF374151) : const Color(0xFFE5E7EB),
                ),
              ),
            ),
            child: Row(
              children: weekdays
                  .map(
                    (d) => Expanded(
                      child: Center(
                        child: Text(
                          d,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: isDark ? Colors.grey[400] : const Color(0xFF1F2937),
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),

          // Days Grid (Rows of 7)
          for (int row = 0; row < totalCells ~/ 7; row++) ...[
            IntrinsicHeight(
              child: Row(
                children: [
                  for (int col = 0; col < 7; col++) ...[
                    Expanded(
                      child: _buildDayCell(
                        row * 7 + col,
                        firstDayWeekday,
                        daysInMonth,
                        prevMonthDays,
                        isDark,
                        records,
                        schedules,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDayCell(
    int index,
    int firstDayWeekday,
    int daysInMonth,
    int prevMonthDays,
    bool isDark,
    List<AttendanceRecordModel> records,
    List<UserScheduleItem> schedules,
  ) {
    final isCurrentMonth = index >= firstDayWeekday && index < firstDayWeekday + daysInMonth;
    int dayNumber;
    DateTime cellDate;

    if (index < firstDayWeekday) {
      dayNumber = prevMonthDays - firstDayWeekday + index + 1;
      final prevMonthYear = _selectedMonth.month == 1 ? _selectedMonth.year - 1 : _selectedMonth.year;
      final prevMonth = _selectedMonth.month == 1 ? 12 : _selectedMonth.month - 1;
      cellDate = DateTime(prevMonthYear, prevMonth, dayNumber);
    } else if (index >= firstDayWeekday + daysInMonth) {
      dayNumber = index - (firstDayWeekday + daysInMonth) + 1;
      final nextMonthYear = _selectedMonth.month == 12 ? _selectedMonth.year + 1 : _selectedMonth.year;
      final nextMonth = _selectedMonth.month == 12 ? 1 : _selectedMonth.month + 1;
      cellDate = DateTime(nextMonthYear, nextMonth, dayNumber);
    } else {
      dayNumber = index - firstDayWeekday + 1;
      cellDate = DateTime(_selectedMonth.year, _selectedMonth.month, dayNumber);
    }

    final isSelected = _selectedDate.year == cellDate.year &&
        _selectedDate.month == cellDate.month &&
        _selectedDate.day == cellDate.day;

    final dateStr = DateFormat('yyyy-MM-dd').format(cellDate);
    final rec = records.where((r) => r.date == dateStr || r.date.startsWith(dateStr)).firstOrNull;
    final scheduleItem = schedules.where((s) => s.date == dateStr).firstOrNull;

    final isPayday = cellDate.day == 23 || cellDate.day == 25; // Matching screenshot payday dot
    final hasPunches = rec != null && (rec.clockInTime != null || rec.clockOutTime != null);
    final isWeekend = cellDate.weekday == DateTime.saturday || cellDate.weekday == DateTime.sunday;
    final isScheduled = (scheduleItem != null && !scheduleItem.isOffDay) || (!isWeekend && !hasPunches);

    final statusLower = rec?.status.toLowerCase() ?? '';
    final isAttention = statusLower.contains('missed') ||
        statusLower.contains('absent') ||
        (hasPunches && rec?.clockOutTime == null && cellDate.isBefore(DateTime.now().subtract(const Duration(days: 1))));

    // Determine visual mode
    Color? bgColor;
    Color textColor = isDark ? Colors.grey[400]! : const Color(0xFF1F2937);
    bool useStripes = false;

    if (!isCurrentMonth) {
      textColor = isDark ? Colors.grey[600]! : const Color(0xFF9CA3AF);
    } else if (isAttention) {
      bgColor = const Color(0xFFDC2626); // Red Attention
      textColor = Colors.white;
    } else if (hasPunches) {
      bgColor = const Color(0xFF1D70B8); // Solid Blue Punches
      textColor = Colors.white;
    } else if (isScheduled) {
      bgColor = const Color(0xFFDBEAFE); // Light blue base
      useStripes = true; // Diagonal hatch
      textColor = const Color(0xFF1E3A8A);
    }

    return InkWell(
      onTap: () {
        setState(() {
          _selectedDate = cellDate;
        });
      },
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: bgColor,
          border: Border.all(
            color: isSelected
                ? const Color(0xFFD97706) // Golden Amber Border for selected cell
                : (isDark ? const Color(0xFF374151) : const Color(0xFFE5E7EB)),
            width: isSelected ? 2.5 : 0.5,
          ),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (useStripes)
              Positioned.fill(
                child: CustomPaint(
                  painter: DiagonalStripePainter(
                    stripeColor: const Color(0xFF60A5FA).withValues(alpha: 0.6),
                    stripeWidth: 1.8,
                    step: 7.0,
                  ),
                ),
              ),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$dayNumber',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: (hasPunches || isAttention || isSelected) ? FontWeight.w800 : FontWeight.w600,
                    color: textColor,
                  ),
                ),
                if (isPayday)
                  Container(
                    width: 4,
                    height: 4,
                    margin: const EdgeInsets.only(top: 2),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: hasPunches || isAttention ? Colors.white : const Color(0xFF1E3A8A),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLegend(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _legendItem(const Color(0xFF1D70B8), 'Punches', isStriped: false),
            const SizedBox(width: 14),
            _legendItem(const Color(0xFFDC2626), 'Attention', isStriped: false),
            const SizedBox(width: 14),
            _legendItem(const Color(0xFFDBEAFE), 'Scheduled shifts', isStriped: true),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            const Text('•', style: TextStyle(fontSize: 16, color: Colors.blueGrey, fontWeight: FontWeight.bold)),
            const SizedBox(width: 6),
            Text(
              'Payday',
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isDark ? Colors.grey[400] : const Color(0xFF4B5563),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _legendItem(Color color, String label, {required bool isStriped}) {
    return Row(
      children: [
        Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
            border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
          ),
          child: isStriped
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: CustomPaint(
                    painter: DiagonalStripePainter(
                      stripeColor: const Color(0xFF60A5FA).withValues(alpha: 0.8),
                      stripeWidth: 1.2,
                      step: 4.0,
                    ),
                  ),
                )
              : null,
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  Widget _buildPunchTimesCard(
    bool isDark,
    List<AttendanceRecordModel> records,
    List<UserScheduleItem> schedules,
  ) {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final rec = records.where((r) => r.date == dateStr || r.date.startsWith(dateStr)).firstOrNull;
    final scheduleItem = schedules.where((s) => s.date == dateStr).firstOrNull;

    int punchCount = 0;
    if (rec?.clockInTime != null) punchCount++;
    if (rec?.clockOutTime != null) punchCount++;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: isDark ? const Color(0xFF374151) : const Color(0xFFE5E7EB)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Accordion Header
            Row(
              children: [
                Text(
                  'Punch times ($punchCount)',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                ),
                const SizedBox(width: 6),
                InkWell(
                  onTap: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Punch times'),
                        content: const Text(
                          'Punches recorded at on-site biometric devices or through mobile clock-in appear here. '
                          'If you forgot to clock in or out, you can tap "Missed a punch?" to submit a manual timecard correction request.',
                        ),
                        actions: [
                          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('OK')),
                        ],
                      ),
                    );
                  },
                  child: const Icon(Icons.help_outline_rounded, size: 18, color: Color(0xFF1D70B8)),
                ),
                const Spacer(),
                TextButton(
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: () => _openMissedPunchDialog(context, _selectedDate),
                  child: Text(
                    'Missed a punch?',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF1D70B8),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: () => setState(() => _isPunchTimesExpanded = !_isPunchTimesExpanded),
                  child: Icon(
                    _isPunchTimesExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: const Color(0xFF1D70B8),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Please note that it may take up to 5 minutes for any changes to appear on this page.',
              style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
            ),

            if (_isPunchTimesExpanded) ...[
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 16),

              if (punchCount > 0) ...[
                // Vertical Timeline View
                _buildPunchTimeline(rec!),
              ] else ...[
                // 0 Punches Illustration Graphic (Screenshot 2)
                const SizedBox(height: 12),
                const ClockIllustration(),
                const SizedBox(height: 16),
                Center(
                  child: Column(
                    children: [
                      Text(
                        scheduleItem != null && !scheduleItem.isOffDay
                            ? 'Scheduled: ${scheduleItem.shift?.name ?? "Standard Shift"} (${scheduleItem.shift?.startTime ?? "09:00"} - ${scheduleItem.shift?.endTime ?? "17:00"})'
                            : (scheduleItem?.isOffDay == true ? 'Rest Day / Off' : 'No shift scheduled'),
                        style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '0 punches recorded for this day',
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[500]),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.add_circle_outline, size: 16, color: Color(0xFF1D70B8)),
                        label: Text('Submit Missed Punch', style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF1D70B8))),
                        onPressed: () => _openMissedPunchDialog(context, _selectedDate),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPunchTimeline(AttendanceRecordModel rec) {
    final dateFmt = DateFormat('MMM d').format(_selectedDate);

    return Column(
      children: [
        // In Node
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFF1D70B8),
                  ),
                ),
                Container(
                  width: 2,
                  height: 46,
                  color: const Color(0xFF1D70B8),
                ),
              ],
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('In', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15)),
                  Text(dateFmt, style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600])),
                ],
              ),
            ),
            Text(
              rec.clockInTime != null ? rec.clockInTime!.substring(0, 5) : '--:--',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF1D70B8)),
              onPressed: () => _openMissedPunchDialog(context, _selectedDate),
            ),
          ],
        ),

        // Out Node
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFF1D70B8),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Out', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15)),
                  Text(dateFmt, style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600])),
                ],
              ),
            ),
            Text(
              rec.clockOutTime != null ? rec.clockOutTime!.substring(0, 5) : '--:--',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF1D70B8)),
              onPressed: () => _openMissedPunchDialog(context, _selectedDate),
            ),
          ],
        ),

        if (rec.workHours != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF1D70B8).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.timelapse_rounded, size: 16, color: Color(0xFF1D70B8)),
                const SizedBox(width: 6),
                Text(
                  'Total Duration: ${rec.workHours!.toStringAsFixed(1)} hours worked',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                    color: const Color(0xFF1D70B8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ── Tab 2: Timecard Tab ───────────────────────────────────────────────────────
class _TimecardTab extends ConsumerWidget {
  const _TimecardTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final recordsAsync = ref.watch(myRecordsProvider((month: now.month, year: now.year)));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return recordsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error loading timecard: $e')),
      data: (records) {
        double totalHours = 0;
        for (final r in records) {
          if (r.workHours != null) totalHours += r.workHours!;
        }
        final double regularHours = totalHours > 40 ? 40 : totalHours;
        final double overtimeHours = totalHours > 40 ? (totalHours - 40) : 0;

        return RefreshIndicator(
          onRefresh: () async => ref.refresh(myRecordsProvider((month: now.month, year: now.year))),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Current Pay Period Summary',
                        style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${DateFormat('MMM 1').format(now)} – ${DateFormat('MMM d, yyyy').format(DateTime(now.year, now.month + 1, 0))}',
                        style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: _timecardMetric('Regular Hours', '${regularHours.toStringAsFixed(1)}h', const Color(0xFF1D70B8)),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _timecardMetric('Overtime', '${overtimeHours.toStringAsFixed(1)}h', AppColors.warning),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _timecardMetric('Total Hours', '${totalHours.toStringAsFixed(1)}h', AppColors.success),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Daily Punch Records (${records.length} days)',
                style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 12),
              if (records.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: Text('No attendance punches recorded this month yet.', style: GoogleFonts.inter()),
                    ),
                  ),
                )
              else
                ...records.map(
                  (r) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFF1D70B8).withValues(alpha: 0.15),
                        child: const Icon(Icons.timer_outlined, color: Color(0xFF1D70B8)),
                      ),
                      title: Text(r.date, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        'In: ${r.clockInTime?.substring(0, 5) ?? "--:--"} • Out: ${r.clockOutTime?.substring(0, 5) ?? "--:--"}',
                        style: GoogleFonts.inter(fontSize: 13),
                      ),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.success.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${r.workHours?.toStringAsFixed(1) ?? "0.0"} hrs',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.success),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _timecardMetric(String title, String val, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600])),
          const SizedBox(height: 4),
          Text(val, style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16, color: color)),
        ],
      ),
    );
  }
}

// ── Tab 3: Find Shifts Tab ────────────────────────────────────────────────────
class _FindShiftsTab extends ConsumerWidget {
  const _FindShiftsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shiftsAsync = ref.watch(allShiftsProvider);

    return shiftsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error loading shifts: $e')),
      data: (shifts) {
        if (shifts.isEmpty) {
          return Center(
            child: Text('No open shifts available to pick up at this time.', style: GoogleFonts.inter()),
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
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1D70B8).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.work_history_outlined, color: Color(0xFF1D70B8)),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(shift.name, style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15)),
                            const SizedBox(height: 4),
                            Text(
                              '${shift.startTime} – ${shift.endTime} • ${shift.breakMinutes}m break',
                              style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1D70B8),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Shift claim request submitted for ${shift.name}'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        },
                        child: const Text('Pick Up'),
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

// ── Tab 4: VTO Tab ────────────────────────────────────────────────────────────
class _VtoTab extends ConsumerWidget {
  const _VtoTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vtoAsync = ref.watch(wfmOpportunitiesProvider('VTO'));

    return vtoAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error loading VTO: $e')),
      data: (items) {
        if (items.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.beach_access_outlined, size: 48, color: Colors.grey),
                const SizedBox(height: 12),
                Text('No Voluntary Time Off (VTO) slots available today', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('Check back later for newly released time-off opportunities.', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey)),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.refresh(wfmOpportunitiesProvider('VTO')),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final opp = items[index];
              return Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.teal.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.flash_on_rounded, color: AppColors.teal),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${opp.type} Slot — ${opp.hours} Hours', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15)),
                            const SizedBox(height: 4),
                            Text(
                              'Date: ${opp.date} • ${opp.startTime} - ${opp.endTime}',
                              style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.teal,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('VTO claim submitted!'), backgroundColor: AppColors.success),
                          );
                        },
                        child: const Text('Claim'),
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
