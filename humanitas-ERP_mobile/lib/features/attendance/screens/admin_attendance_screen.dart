import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../models/attendance_record_model.dart';
import '../providers/admin_attendance_provider.dart';

class AdminAttendanceScreen extends ConsumerStatefulWidget {
  const AdminAttendanceScreen({super.key});

  @override
  ConsumerState<AdminAttendanceScreen> createState() => _AdminAttendanceScreenState();
}

class _AdminAttendanceScreenState extends ConsumerState<AdminAttendanceScreen> {
  int _selectedMonth = DateTime.now().month;
  int _selectedYear = DateTime.now().year;
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<AttendanceRecordModel> _filtered(List<AttendanceRecordModel> records) {
    if (_searchQuery.isEmpty) return records;
    final q = _searchQuery.toLowerCase();
    return records.where((r) {
      final name = (r.employeeName ?? '').toLowerCase();
      return name.contains(q);
    }).toList();
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'present': return AppColors.success;
      case 'late': return AppColors.warning;
      case 'absent': return AppColors.error;
      default: return Colors.grey;
    }
  }

  String _statusLabel(String status) => status[0].toUpperCase() + status.substring(1);

  Color _methodColor(String? method) {
    switch ((method ?? '').toLowerCase()) {
      case 'biometric': return const Color(0xFF7C3AED); // purple
      case 'qr': return AppColors.info;
      default: return Colors.grey;
    }
  }

  IconData _methodIcon(String? method) {
    switch ((method ?? '').toLowerCase()) {
      case 'biometric': return Icons.fingerprint_rounded;
      case 'qr': return Icons.qr_code_rounded;
      default: return Icons.edit_note_rounded;
    }
  }

  String _methodLabel(String? method) {
    switch ((method ?? '').toLowerCase()) {
      case 'biometric': return 'Biometric';
      case 'qr': return 'QR';
      default: return 'Manual';
    }
  }

  String _formatTime(String? raw) {
    if (raw == null || raw.isEmpty) return '--:--';
    try {
      final dt = DateTime.parse(raw).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return raw.length >= 5 ? raw.substring(0, 5) : raw;
    }
  }

  String _formatDate(String raw) {
    try {
      final dt = DateTime.parse(raw);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final key = (month: _selectedMonth, year: _selectedYear);
    final asyncRecords = ref.watch(allRecordsProvider(key));

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        title: Text('Attendance Management', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded),
            tooltip: 'Filter',
            onPressed: () => _showFilterSheet(context),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(allRecordsProvider(key)),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Month/Year chip row ─────────────────────────────────────
          Container(
            color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Row(
              children: [
                const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  _monthName(_selectedMonth),
                  style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.primary, fontSize: 14),
                ),
                const SizedBox(width: 4),
                Text(
                  '$_selectedYear',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w400, fontSize: 14,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => _showFilterSheet(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('Change', style: GoogleFonts.inter(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ),

          // ── Search bar ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search by employee name…',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(icon: const Icon(Icons.clear_rounded, size: 18), onPressed: () { _searchCtrl.clear(); setState(() => _searchQuery = ''); })
                    : null,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                filled: true,
                fillColor: isDark ? AppColors.surfaceDark : Colors.grey.shade100,
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
          ),

          // ── Body ────────────────────────────────────────────────────
          Expanded(
            child: asyncRecords.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _buildError(e, key),
              data: (records) {
                final filtered = _filtered(records);
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(allRecordsProvider(key)),
                  child: CustomScrollView(
                    slivers: [
                      // Stats cards
                      SliverToBoxAdapter(child: _buildStats(records, isDark)),

                      if (filtered.isEmpty)
                        SliverFillRemaining(
                          child: Center(
                            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Icon(Icons.event_busy_rounded, size: 60, color: isDark ? Colors.white24 : Colors.black26),
                              const SizedBox(height: 12),
                              Text(_searchQuery.isNotEmpty ? 'No results for "$_searchQuery"' : 'No records this month',
                                  style: GoogleFonts.inter(fontSize: 15, color: isDark ? Colors.white54 : Colors.black45)),
                            ]),
                          ),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                          sliver: SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (ctx, i) => _RecordCard(
                                record: filtered[i],
                                isDark: isDark,
                                statusColor: _statusColor(filtered[i].status),
                                statusLabel: _statusLabel(filtered[i].status),
                                methodColor: _methodColor(filtered[i].clockMethod),
                                methodIcon: _methodIcon(filtered[i].clockMethod),
                                methodLabel: _methodLabel(filtered[i].clockMethod),
                                clockIn: _formatTime(filtered[i].clockInTime),
                                clockOut: _formatTime(filtered[i].clockOutTime),
                                date: _formatDate(filtered[i].date),
                              ),
                              childCount: filtered.length,
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStats(List<AttendanceRecordModel> records, bool isDark) {
    final total = records.length;
    final present = records.where((r) => r.status.toLowerCase() == 'present').length;
    final late = records.where((r) => r.status.toLowerCase() == 'late').length;
    final absent = records.where((r) => r.status.toLowerCase() == 'absent').length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          _StatChip(label: 'Total', value: '$total', color: AppColors.primary, isDark: isDark),
          const SizedBox(width: 8),
          _StatChip(label: 'Present', value: '$present', color: AppColors.success, isDark: isDark),
          const SizedBox(width: 8),
          _StatChip(label: 'Late', value: '$late', color: AppColors.warning, isDark: isDark),
          const SizedBox(width: 8),
          _StatChip(label: 'Absent', value: '$absent', color: AppColors.error, isDark: isDark),
        ],
      ),
    );
  }

  Widget _buildError(Object e, ({int month, int year}) key) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.error_outline, color: AppColors.error, size: 48),
      const SizedBox(height: 12),
      Text(e.toString().replaceAll('Exception: ', ''), textAlign: TextAlign.center),
      const SizedBox(height: 16),
      ElevatedButton.icon(
        icon: const Icon(Icons.refresh),
        label: const Text('Retry'),
        onPressed: () => ref.invalidate(allRecordsProvider(key)),
      ),
    ]),
  );

  void _showFilterSheet(BuildContext context) {
    int tempMonth = _selectedMonth;
    int tempYear = _selectedYear;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setMS) => Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Filter Period', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: tempMonth,
                  decoration: InputDecoration(labelText: 'Month', border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                  items: List.generate(12, (i) => DropdownMenuItem(value: i + 1, child: Text(_monthName(i + 1)))),
                  onChanged: (v) => setMS(() => tempMonth = v!),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<int>(
                  value: tempYear,
                  decoration: InputDecoration(labelText: 'Year', border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                  items: List.generate(5, (i) => DateTime.now().year - i)
                      .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
                      .toList(),
                  onChanged: (v) => setMS(() => tempYear = v!),
                ),
              ),
            ]),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () {
                  setState(() { _selectedMonth = tempMonth; _selectedYear = tempYear; });
                  Navigator.pop(ctx);
                },
                child: Text('Apply', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  String _monthName(int m) {
    const names = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return names[m - 1];
  }
}

// ── Stat chip ──────────────────────────────────────────────────────────────

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool isDark;

  const _StatChip({required this.label, required this.value, required this.color, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(children: [
          Text(value, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w500,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
        ]),
      ),
    );
  }
}

// ── Record card ────────────────────────────────────────────────────────────

class _RecordCard extends StatelessWidget {
  final AttendanceRecordModel record;
  final bool isDark;
  final Color statusColor;
  final String statusLabel;
  final Color methodColor;
  final IconData methodIcon;
  final String methodLabel;
  final String clockIn;
  final String clockOut;
  final String date;

  const _RecordCard({
    required this.record,
    required this.isDark,
    required this.statusColor,
    required this.statusLabel,
    required this.methodColor,
    required this.methodIcon,
    required this.methodLabel,
    required this.clockIn,
    required this.clockOut,
    required this.date,
  });

  @override
  Widget build(BuildContext context) {
    final name = record.employeeName ?? 'Employee';
    final initials = name.trim().split(' ').take(2).map((w) => w.isNotEmpty ? w[0].toUpperCase() : '').join();

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Top row: avatar + name + date + status badge
          Row(children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: AppColors.primary.withValues(alpha: 0.15),
              child: Text(initials, style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 13)),
            ),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14,
                  color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight)),
              Text(date, style: GoogleFonts.inter(fontSize: 12,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
            ])),
            // Status badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: statusColor.withValues(alpha: 0.3)),
              ),
              child: Text(statusLabel, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: statusColor)),
            ),
          ]),

          const SizedBox(height: 10),
          const Divider(height: 1),
          const SizedBox(height: 10),

          // Clock in/out + work hours
          Row(children: [
            _InfoCell(icon: Icons.login_rounded, label: 'Clock In', value: clockIn, color: AppColors.success),
            const SizedBox(width: 12),
            _InfoCell(icon: Icons.logout_rounded, label: 'Clock Out', value: clockOut, color: AppColors.primary),
            const SizedBox(width: 12),
            _InfoCell(icon: Icons.timer_outlined, label: 'Hours',
                value: record.workHours != null ? '${record.workHours!.toStringAsFixed(1)}h' : '--',
                color: AppColors.info),
          ]),

          const SizedBox(height: 10),

          // Method badge + device
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: methodColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: methodColor.withValues(alpha: 0.25)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(methodIcon, size: 12, color: methodColor),
                const SizedBox(width: 4),
                Text(methodLabel, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: methodColor)),
              ]),
            ),
            if (record.deviceName != null && record.deviceName!.isNotEmpty) ...[
              const SizedBox(width: 8),
              Icon(Icons.devices_rounded, size: 13, color: isDark ? Colors.white38 : Colors.black38),
              const SizedBox(width: 4),
              Flexible(child: Text(record.deviceName!, style: GoogleFonts.inter(fontSize: 11,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                  maxLines: 1, overflow: TextOverflow.ellipsis)),
            ],
          ]),
        ]),
      ),
    );
  }
}

class _InfoCell extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _InfoCell({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: GoogleFonts.inter(fontSize: 10, color: Colors.grey.shade500)),
          Text(value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
        ])),
      ]),
    );
  }
}
