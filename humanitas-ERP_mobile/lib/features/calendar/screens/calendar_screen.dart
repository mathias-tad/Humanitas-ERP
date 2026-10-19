import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../attendance/screens/qr_scanner_screen.dart';
import '../models/calendar_day_model.dart';
import '../providers/calendar_provider.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _selectedDate;
  late DateTime _viewMonth;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedDate = DateTime(now.year, now.month, now.day);
    _viewMonth = DateTime(now.year, now.month, 1);
  }

  void _prevMonth() {
    setState(() {
      _viewMonth = DateTime(_viewMonth.year, _viewMonth.month - 1, 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _viewMonth = DateTime(_viewMonth.year, _viewMonth.month + 1, 1);
    });
  }

  void _jumpToToday() {
    final now = DateTime.now();
    setState(() {
      _selectedDate = DateTime(now.year, now.month, now.day);
      _viewMonth = DateTime(now.year, now.month, 1);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final calendarAsync = ref.watch(
      monthlyCalendarProvider((month: _viewMonth.month, year: _viewMonth.year)),
    );

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Text(
          'Calendar & Attendance',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
        actions: [
          TextButton.icon(
            onPressed: _jumpToToday,
            icon: const Icon(Icons.today_rounded, size: 18, color: AppColors.primary),
            label: Text(
              'Today',
              style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.primary),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: const Color(0xFF1A1200),
        icon: const Icon(Icons.login_rounded),
        label: Text('Clock In', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        onPressed: () async {
          final res = await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const QrScannerScreen(isClockIn: true)),
          );
          if (res == true) {
            ref.invalidate(monthlyCalendarProvider((month: _viewMonth.month, year: _viewMonth.year)));
          }
        },
      ),
      body: calendarAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 12),
              Text('Failed to load calendar: $err', style: GoogleFonts.inter()),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.refresh(
                  monthlyCalendarProvider((month: _viewMonth.month, year: _viewMonth.year)),
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.refresh(
            monthlyCalendarProvider((month: _viewMonth.month, year: _viewMonth.year)),
          ),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Month Switcher Header
              _buildMonthHeader(isDark),
              const SizedBox(height: 12),

              // KPI Stats
              _buildStatsRow(data, isDark),
              const SizedBox(height: 16),

              // Calendar Grid Card
              _buildCalendarGridCard(data, isDark),
              const SizedBox(height: 16),

              // Selected Day Detail
              _buildSelectedDayDetail(data, isDark),
              const SizedBox(height: 70), // Spacing for FAB
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMonthHeader(bool isDark) {
    final title = DateFormat('MMMM yyyy').format(_viewMonth);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left_rounded),
            onPressed: _prevMonth,
            tooltip: 'Previous Month',
          ),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right_rounded),
            onPressed: _nextMonth,
            tooltip: 'Next Month',
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(MonthlyCalendarData data, bool isDark) {
    return Row(
      children: [
        _buildStatCard('Present', '${data.presentCount}', AppColors.success, Icons.check_circle_rounded, isDark),
        const SizedBox(width: 8),
        _buildStatCard('Absent', '${data.absentCount}', AppColors.error, Icons.cancel_rounded, isDark),
        const SizedBox(width: 8),
        _buildStatCard('Late', '${data.lateCount}', AppColors.warning, Icons.access_time_rounded, isDark),
        const SizedBox(width: 8),
        _buildStatCard('Holidays', '${data.holidaysCount}', Colors.purple, Icons.celebration_rounded, isDark),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, Color color, IconData icon, bool isDark) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 4),
            Text(
              value,
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16, color: color),
            ),
            Text(
              label,
              style: GoogleFonts.inter(fontSize: 10, color: isDark ? Colors.white60 : Colors.black54),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCalendarGridCard(MonthlyCalendarData data, bool isDark) {
    final weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final year = _viewMonth.year;
    final month = _viewMonth.month;
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final firstWeekday = DateTime(year, month, 1).weekday % 7; // Sunday = 0

    final totalCells = firstWeekday + daysInMonth;
    final rowsCount = (totalCells / 7).ceil();

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            // Weekday Headers
            Row(
              children: weekdays.map((d) {
                final isWeekend = d == 'Sun' || d == 'Sat';
                return Expanded(
                  child: Center(
                    child: Text(
                      d,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isWeekend ? AppColors.error.withValues(alpha: 0.8) : (isDark ? Colors.white54 : Colors.black45),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 8),
            const Divider(height: 1),
            const SizedBox(height: 8),

            // Days Grid
            for (int r = 0; r < rowsCount; r++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    for (int c = 0; c < 7; c++)
                      Expanded(
                        child: _buildDayCell(r * 7 + c, firstWeekday, daysInMonth, data, isDark),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDayCell(
    int index,
    int firstWeekday,
    int daysInMonth,
    MonthlyCalendarData data,
    bool isDark,
  ) {
    final dayNum = index - firstWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      return const SizedBox(height: 38);
    }

    final date = DateTime(_viewMonth.year, _viewMonth.month, dayNum);
    final isSelected = date.year == _selectedDate.year &&
        date.month == _selectedDate.month &&
        date.day == _selectedDate.day;

    final now = DateTime.now();
    final isToday = date.year == now.year && date.month == now.month && date.day == now.day;

    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    final att = data.attendance.firstWhere(
      (a) => a.date == dateStr,
      orElse: () => const CalendarAttendanceItem(date: '', status: ''),
    );
    final hasAtt = att.date.isNotEmpty;

    final holiday = data.holidays.firstWhere(
      (h) => h.date == dateStr,
      orElse: () => const CalendarHolidayItem(id: '', name: '', date: ''),
    );
    final isHoliday = holiday.id.isNotEmpty;

    // Status Dot Color
    Color? dotColor;
    if (isHoliday) {
      dotColor = Colors.purple;
    } else if (hasAtt) {
      final s = att.status.toLowerCase();
      if (s.contains('present')) {
        dotColor = AppColors.success;
      } else if (s.contains('absent')) {
        dotColor = AppColors.error;
      } else if (s.contains('late') || s.contains('early')) {
        dotColor = AppColors.warning;
      } else {
        dotColor = AppColors.info;
      }
    }

    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => setState(() => _selectedDate = date),
      child: Container(
        height: 38,
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.25)
              : (isToday ? AppColors.primary.withValues(alpha: 0.08) : Colors.transparent),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? AppColors.primary
                : (isToday ? AppColors.primary.withValues(alpha: 0.5) : Colors.transparent),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '$dayNum',
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: isSelected || isToday ? FontWeight.bold : FontWeight.w500,
                color: isSelected
                    ? (isDark ? Colors.white : Colors.black87)
                    : (isToday ? AppColors.primary : (isDark ? Colors.white70 : Colors.black87)),
              ),
            ),
            if (dotColor != null)
              Container(
                width: 5,
                height: 5,
                margin: const EdgeInsets.only(top: 2),
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              )
            else
              const SizedBox(height: 7),
          ],
        ),
      ),
    );
  }

  Widget _buildSelectedDayDetail(MonthlyCalendarData data, bool isDark) {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final formattedDate = DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate);

    final att = data.attendance.firstWhere(
      (a) => a.date == dateStr,
      orElse: () => const CalendarAttendanceItem(date: '', status: 'No Record'),
    );
    final hasAtt = att.date.isNotEmpty;

    final holiday = data.holidays.firstWhere(
      (h) => h.date == dateStr,
      orElse: () => const CalendarHolidayItem(id: '', name: '', date: ''),
    );
    final isHoliday = holiday.id.isNotEmpty;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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
                    formattedDate,
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                if (hasAtt)
                  _buildStatusBadge(att.status)
                else if (isHoliday)
                  _buildBadge('Holiday', Colors.purple)
                else
                  _buildBadge('No Record', Colors.grey),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 12),

            if (isHoliday) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.purple.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.celebration_rounded, color: Colors.purple, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Company Holiday: ${holiday.name}',
                        style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.purple, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Attendance Times
            Row(
              children: [
                Expanded(
                  child: _buildDetailBox(
                    'Clock In',
                    att.actualIn ?? '--:--',
                    Icons.login_rounded,
                    AppColors.success,
                    isDark,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildDetailBox(
                    'Clock Out',
                    att.actualOut ?? '--:--',
                    Icons.logout_rounded,
                    AppColors.error,
                    isDark,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: _buildDetailBox(
                    'Working Hours',
                    att.workHours ?? '--',
                    Icons.timelapse_rounded,
                    AppColors.primary,
                    isDark,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildDetailBox(
                    'Clock Method',
                    att.clockMethod?.toUpperCase() ?? 'NONE',
                    Icons.fingerprint_rounded,
                    AppColors.teal,
                    isDark,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailBox(String label, String value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? Colors.black26 : Colors.white60,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: GoogleFonts.inter(fontSize: 10, color: Colors.grey)),
                Text(
                  value,
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    final s = status.toLowerCase();
    Color color = AppColors.info;
    if (s.contains('present')) color = AppColors.success;
    if (s.contains('absent')) color = AppColors.error;
    if (s.contains('late')) color = AppColors.warning;

    return _buildBadge(status.toUpperCase(), color);
  }

  Widget _buildBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color),
      ),
    );
  }
}
