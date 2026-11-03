import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/calendar_event_model.dart';
import '../../../core/providers/auth_provider.dart';
import '../providers/calendar_provider.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  static const List<Map<String, String>> _categories = [
    {'id': 'all', 'label': 'All Modules'},
    {'id': 'workforce', 'label': 'HR & Workforce'},
    {'id': 'projects', 'label': 'Projects & PMS'},
    {'id': 'commercial', 'label': 'Commercial ERP'},
    {'id': 'financial', 'label': 'Financial & Tax'},
    {'id': 'common', 'label': 'General & Org'},
  ];

  static const List<Color> _presetColors = [
    Color(0xFFD4AF37), // Gold
    Color(0xFF10B981), // Emerald
    Color(0xFF06B6D4), // Cyan
    Color(0xFF8B5CF6), // Violet
    Color(0xFFF59E0B), // Amber
    Color(0xFF3B82F6), // Blue
    Color(0xFF6366F1), // Indigo
    Color(0xFFEC4899), // Pink
    Color(0xFFF97316), // Orange
    Color(0xFFEF4444), // Red
  ];

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(calendarProvider);
    final notifier = ref.read(calendarProvider.notifier);
    final authState = ref.watch(authProvider);

    final canCreate = authState.hasPermission('create_calendar_events') ||
        authState.hasPermission('manage_calendar');

    final monthTitle = DateFormat('MMMM yyyy').format(state.focusedMonth);
    final selectedDayEvents = state.getEventsForDay(state.selectedDate);

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.cardDark,
        elevation: 0,
        title: Text(
          'Unified Calendar',
          style: GoogleFonts.inter(
            color: AppColors.textPrimaryDark,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.today, color: AppColors.primary, size: 20),
            tooltip: 'Today',
            onPressed: () => notifier.goToToday(),
          ),
          IconButton(
            icon: const Icon(Icons.filter_list, color: AppColors.textSecondaryDark, size: 20),
            tooltip: 'Filter Sources',
            onPressed: () => _showFilterBottomSheet(context, state, notifier),
          ),
          if (canCreate)
            IconButton(
              icon: const Icon(Icons.add, color: AppColors.primary, size: 22),
              tooltip: 'New Event',
              onPressed: () => _showCreateEventBottomSheet(context, state.selectedDate),
            ),
        ],
      ),
      body: Column(
        children: [
          // Category selector tabs
          _buildCategoryFilter(state, notifier),

          // Month navigator (< Month Year >)
          _buildMonthNavigator(monthTitle, notifier),

          // Weekday header
          _buildWeekdayHeader(),

          // 7-column Calendar Grid
          _buildCalendarGrid(state, notifier),

          const Divider(color: AppColors.borderDark, height: 1),

          // Selected day events list
          Expanded(
            child: _buildSelectedDayEvents(state, selectedDayEvents),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryFilter(CalendarState state, CalendarNotifier notifier) {
    final authState = ref.watch(authProvider);
    final availableCategories = _categories.where((cat) {
      if (cat['id'] == 'all' || cat['id'] == 'common') return true;
      if (cat['id'] == 'workforce') return authState.isModuleSubscribed('hrms');
      if (cat['id'] == 'projects') return authState.isModuleSubscribed('pms');
      if (cat['id'] == 'commercial') {
        return authState.isModuleSubscribed('sales') || authState.isModuleSubscribed('purchasing');
      }
      if (cat['id'] == 'financial') return authState.isModuleSubscribed('accounting');
      return true;
    }).toList();

    return Container(
      color: AppColors.surfaceDark,
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: availableCategories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final cat = availableCategories[index];
          final isSelected = state.activeCategory == cat['id'];
          return GestureDetector(
            onTap: () => notifier.setCategory(cat['id']!),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary : AppColors.cardDark,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.borderDark,
                ),
              ),
              child: Center(
                child: Text(
                  cat['label']!,
                  style: GoogleFonts.inter(
                    color: isSelected ? AppColors.backgroundDark : AppColors.textSecondaryDark,
                    fontSize: 11,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMonthNavigator(String monthTitle, CalendarNotifier notifier) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppColors.backgroundDark,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left, color: AppColors.textSecondaryDark),
            onPressed: () => notifier.prevMonth(),
          ),
          Text(
            monthTitle,
            style: GoogleFonts.inter(
              color: AppColors.textPrimaryDark,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right, color: AppColors.textSecondaryDark),
            onPressed: () => notifier.nextMonth(),
          ),
        ],
      ),
    );
  }

  Widget _buildWeekdayHeader() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      color: AppColors.surfaceDark,
      child: Row(
        children: days.map((d) {
          final isWeekend = d == 'Sun' || d == 'Sat';
          return Expanded(
            child: Center(
              child: Text(
                d,
                style: GoogleFonts.inter(
                  color: isWeekend ? AppColors.textSecondaryDark.withOpacity(0.5) : AppColors.textSecondaryDark,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildCalendarGrid(CalendarState state, CalendarNotifier notifier) {
    final month = state.focusedMonth;
    final year = month.year;
    final monthNum = month.month;
    final daysInMonth = DateUtils.getDaysInMonth(year, monthNum);
    final firstDayIndex = DateTime(year, monthNum, 1).weekday % 7; // Sunday = 0

    final totalCells = firstDayIndex + daysInMonth;
    final rows = (totalCells / 7).ceil();

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final selected = DateTime(state.selectedDate.year, state.selectedDate.month, state.selectedDate.day);

    return Container(
      padding: const EdgeInsets.all(8),
      child: Column(
        children: List.generate(rows, (rowIndex) {
          return Row(
            children: List.generate(7, (colIndex) {
              final cellIndex = rowIndex * 7 + colIndex;
              final dayNum = cellIndex - firstDayIndex + 1;

              if (dayNum < 1 || dayNum > daysInMonth) {
                return const Expanded(child: SizedBox(height: 48));
              }

              final cellDate = DateTime(year, monthNum, dayNum);
              final isToday = cellDate == today;
              final isSelected = cellDate == selected;
              final dayEvents = state.getEventsForDay(cellDate);

              return Expanded(
                child: GestureDetector(
                  onTap: () => notifier.selectDate(cellDate),
                  child: Container(
                    height: 48,
                    margin: const EdgeInsets.all(1.5),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.primary.withOpacity(0.15)
                          : isToday
                              ? AppColors.surfaceDark
                              : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : isToday
                                ? AppColors.primary.withOpacity(0.4)
                                : Colors.transparent,
                        width: isSelected ? 1.5 : 1,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isToday ? AppColors.primary : Colors.transparent,
                          ),
                          child: Center(
                            child: Text(
                              '$dayNum',
                              style: GoogleFonts.inter(
                                color: isToday
                                    ? AppColors.backgroundDark
                                    : isSelected
                                        ? AppColors.primary
                                        : AppColors.textPrimaryDark,
                                fontSize: 12,
                                fontWeight: isToday || isSelected ? FontWeight.bold : FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 2),
                        // Event indicator dots (up to 3)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: dayEvents.take(3).map((e) {
                            return Container(
                              width: 4,
                              height: 4,
                              margin: const EdgeInsets.symmetric(horizontal: 1),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: e.color,
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          );
        }),
      ),
    );
  }

  Widget _buildSelectedDayEvents(CalendarState state, List<CalendarEventModel> events) {
    final dateStr = DateFormat('EEEE, MMMM d, yyyy').format(state.selectedDate);

    if (state.isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                dateStr,
                style: GoogleFonts.inter(
                  color: AppColors.textPrimaryDark,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '${events.length} event${events.length == 1 ? '' : 's'}',
                style: GoogleFonts.inter(
                  color: AppColors.textSecondaryDark,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: events.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.event_available, color: AppColors.textSecondaryDark.withOpacity(0.4), size: 40),
                      const SizedBox(height: 8),
                      Text(
                        'No events for this date',
                        style: GoogleFonts.inter(color: AppColors.textSecondaryDark, fontSize: 13),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  itemCount: events.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final ev = events[index];
                    return GestureDetector(
                      onTap: () => _showEventDetailsBottomSheet(context, ev),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.cardDark,
                          borderRadius: BorderRadius.circular(10),
                          border: Border(
                            left: BorderSide(color: ev.color, width: 4),
                            top: const BorderSide(color: AppColors.borderDark),
                            right: const BorderSide(color: AppColors.borderDark),
                            bottom: const BorderSide(color: AppColors.borderDark),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    ev.title,
                                    style: GoogleFonts.inter(
                                      color: AppColors.textPrimaryDark,
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: ev.color.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    ev.source.toUpperCase(),
                                    style: GoogleFonts.inter(
                                      color: ev.color,
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(Icons.access_time, size: 12, color: AppColors.textSecondaryDark),
                                const SizedBox(width: 4),
                                Text(
                                  ev.formattedTime,
                                  style: GoogleFonts.inter(color: AppColors.textSecondaryDark, fontSize: 11),
                                ),
                                if (ev.location != null && ev.location!.isNotEmpty) ...[
                                  const SizedBox(width: 12),
                                  Icon(Icons.location_on_outlined, size: 12, color: AppColors.textSecondaryDark),
                                  const SizedBox(width: 2),
                                  Expanded(
                                    child: Text(
                                      ev.location!,
                                      style: GoogleFonts.inter(color: AppColors.textSecondaryDark, fontSize: 11),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  void _showFilterBottomSheet(BuildContext context, CalendarState state, CalendarNotifier notifier) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Filter Event Sources',
                        style: GoogleFonts.inter(
                          color: AppColors.textPrimaryDark,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          notifier.state = notifier.state.copyWith(activeSources: []);
                          notifier.loadEvents();
                          Navigator.pop(context);
                        },
                        child: const Text('Reset All', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                      ),
                    ],
                  ),
                  const Divider(color: AppColors.borderDark),
                  Expanded(
                    child: ListView.builder(
                      itemCount: state.sources.length,
                      itemBuilder: (context, index) {
                        final src = state.sources[index];
                        final srcId = src['id']?.toString() ?? '';
                        final label = src['label']?.toString() ?? srcId;
                        final isChecked = state.activeSources.isEmpty || state.activeSources.contains(srcId);

                        return CheckboxListTile(
                          title: Text(label, style: GoogleFonts.inter(color: AppColors.textPrimaryDark, fontSize: 13)),
                          value: isChecked,
                          activeColor: AppColors.primary,
                          checkColor: AppColors.backgroundDark,
                          onChanged: (_) {
                            notifier.toggleSource(srcId);
                            setSheetState(() {});
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showEventDetailsBottomSheet(BuildContext context, CalendarEventModel ev) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: ev.color.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      ev.source.toUpperCase(),
                      style: GoogleFonts.inter(color: ev.color, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                  if (ev.allDay)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceDark,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'ALL DAY',
                        style: GoogleFonts.inter(color: AppColors.textSecondaryDark, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                ev.title,
                style: GoogleFonts.inter(
                  color: AppColors.textPrimaryDark,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.schedule, size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    ev.formattedTime,
                    style: GoogleFonts.inter(color: AppColors.textSecondaryDark, fontSize: 12),
                  ),
                ],
              ),
              if (ev.location != null && ev.location!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.location_on_outlined, size: 14, color: AppColors.error),
                    const SizedBox(width: 6),
                    Text(
                      ev.location!,
                      style: GoogleFonts.inter(color: AppColors.textSecondaryDark, fontSize: 12),
                    ),
                  ],
                ),
              ],
              if (ev.description != null && ev.description!.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceDark,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.borderDark),
                  ),
                  child: Text(
                    ev.description!,
                    style: GoogleFonts.inter(color: AppColors.textPrimaryDark, fontSize: 12, height: 1.4),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              if (ev.source == 'custom')
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.error,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: const Icon(Icons.delete_outline, size: 18),
                    label: const Text('Delete Event'),
                    onPressed: () async {
                      Navigator.pop(context);
                      await ref.read(calendarProvider.notifier).deleteEvent(ev.id);
                    },
                  ),
                )
              else
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Close'),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showCreateEventBottomSheet(BuildContext context, DateTime initialDate) {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    final locController = TextEditingController();
    DateTime startDate = initialDate;
    TimeOfDay startTime = const TimeOfDay(hour: 9, minute: 0);
    bool allDay = false;
    Color selectedColor = _presetColors[0];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Create Calendar Event',
                      style: GoogleFonts.inter(
                        color: AppColors.textPrimaryDark,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: titleController,
                      style: GoogleFonts.inter(color: AppColors.textPrimaryDark),
                      decoration: const InputDecoration(
                        labelText: 'Event Title *',
                        labelStyle: TextStyle(color: AppColors.textSecondaryDark),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Checkbox(
                          value: allDay,
                          activeColor: AppColors.primary,
                          checkColor: AppColors.backgroundDark,
                          onChanged: (val) {
                            setModalState(() => allDay = val ?? false);
                          },
                        ),
                        Text('All Day Event', style: GoogleFonts.inter(color: AppColors.textPrimaryDark, fontSize: 13)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: locController,
                      style: GoogleFonts.inter(color: AppColors.textPrimaryDark),
                      decoration: const InputDecoration(
                        labelText: 'Location / Link',
                        labelStyle: TextStyle(color: AppColors.textSecondaryDark),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descController,
                      maxLines: 3,
                      style: GoogleFonts.inter(color: AppColors.textPrimaryDark),
                      decoration: const InputDecoration(
                        labelText: 'Description',
                        labelStyle: TextStyle(color: AppColors.textSecondaryDark),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Color picker
                    Text('Event Color', style: GoogleFonts.inter(color: AppColors.textSecondaryDark, fontSize: 12)),
                    const SizedBox(height: 8),
                    Row(
                      children: _presetColors.take(6).map((c) {
                        final isSel = selectedColor == c;
                        return GestureDetector(
                          onTap: () => setModalState(() => selectedColor = c),
                          child: Container(
                            width: 28,
                            height: 28,
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: c,
                              border: Border.all(
                                color: isSel ? AppColors.textPrimaryDark : Colors.transparent,
                                width: 2,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.backgroundDark,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: () async {
                          if (titleController.text.trim().isEmpty) return;
                          final datePart = DateFormat('yyyy-MM-dd').format(startDate);
                          final startIso = allDay
                              ? '${datePart}T00:00:00'
                              : '${datePart}T${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}:00';

                          final colorHex = '#${selectedColor.value.toRadixString(16).substring(2)}';

                          final success = await ref.read(calendarProvider.notifier).createEvent({
                            'title': titleController.text.trim(),
                            'description': descController.text.trim(),
                            'start_date': startIso,
                            'all_day': allDay,
                            'location': locController.text.trim(),
                            'color': colorHex,
                          });

                          if (success && context.mounted) {
                            Navigator.pop(context);
                          }
                        },
                        child: Text(
                          'Create Event',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
