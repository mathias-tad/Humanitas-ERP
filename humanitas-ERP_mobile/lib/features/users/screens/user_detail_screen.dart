import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../attendance/providers/admin_attendance_provider.dart';
import '../models/user_model.dart';
import '../providers/users_provider.dart';

class UserDetailScreen extends ConsumerStatefulWidget {
  final UserModel user;
  const UserDetailScreen({super.key, required this.user});

  @override
  ConsumerState<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends ConsumerState<UserDetailScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = widget.user;
    final initials = user.displayName.trim().split(' ').take(2)
        .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '').join();

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        title: Text(user.displayName, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        bottom: TabBar(
          controller: _tabCtrl,
          labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Info'),
            Tab(text: 'Biometrics'),
            Tab(text: 'Attendance'),
          ],
        ),
      ),
      body: Column(
        children: [
          // ── Profile header ─────────────────────────────────────────
          Container(
            color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Row(children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                child: Text(initials, style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 18)),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(user.displayName, style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16,
                    color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight)),
                if ((user.position ?? '').isNotEmpty)
                  Text(user.position!, style: GoogleFonts.inter(fontSize: 13,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
              ])),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: (user.isActive ? AppColors.success : AppColors.error).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(user.isActive ? 'Active' : 'Inactive',
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700,
                        color: user.isActive ? AppColors.success : AppColors.error)),
              ),
            ]),
          ),

          // ── Tabs ───────────────────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabCtrl,
              children: [
                _InfoTab(user: user, isDark: isDark),
                _BiometricsTab(userId: user.id, isDark: isDark),
                _AttendanceTab(userId: user.id, isDark: isDark),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Info tab ───────────────────────────────────────────────────────────────

class _InfoTab extends StatelessWidget {
  final UserModel user;
  final bool isDark;

  const _InfoTab({required this.user, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final rows = <_InfoRow>[
      _InfoRow(icon: Icons.badge_outlined, label: 'Employee ID', value: user.employeeId ?? '—'),
      _InfoRow(icon: Icons.email_outlined, label: 'Email', value: user.email),
      _InfoRow(icon: Icons.phone_outlined, label: 'Phone', value: user.phone ?? '—'),
      _InfoRow(icon: Icons.work_outline_rounded, label: 'Position', value: user.position ?? '—'),
      _InfoRow(icon: Icons.corporate_fare_rounded, label: 'Department', value: user.department ?? '—'),
      _InfoRow(icon: Icons.shield_outlined, label: 'Role', value: user.role),
      _InfoRow(icon: Icons.calendar_today_rounded, label: 'Hire Date', value: user.hireDate ?? '—'),
    ];

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: rows.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (ctx, i) {
        final row = rows[i];
        return ListTile(
          leading: Icon(row.icon, color: AppColors.primary, size: 20),
          title: Text(row.label, style: GoogleFonts.inter(fontSize: 12,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
          subtitle: Text(row.value, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
          dense: true,
        );
      },
    );
  }
}

class _InfoRow {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});
}

// ── Biometrics tab ─────────────────────────────────────────────────────────

class _BiometricsTab extends ConsumerWidget {
  final String userId;
  final bool isDark;

  const _BiometricsTab({required this.userId, required this.isDark});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncStatus = ref.watch(biometricStatusProvider(userId));

    return asyncStatus.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Icon(Icons.fingerprint, size: 56, color: Colors.grey),
        const SizedBox(height: 12),
        Text('Could not load biometric status', style: GoogleFonts.inter(color: Colors.grey)),
        const SizedBox(height: 8),
        Text(e.toString().replaceAll('Exception: ', ''), textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade500)),
        const SizedBox(height: 16),
        ElevatedButton.icon(icon: const Icon(Icons.refresh), label: const Text('Retry'),
            onPressed: () => ref.invalidate(biometricStatusProvider(userId))),
      ])),
      data: (status) {
        final devices = status['devices'];
        final deviceList = devices is List
            ? devices.map((d) => Map<String, dynamic>.from(d as Map)).toList()
            : <Map<String, dynamic>>[];

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Enrollment Status', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
            const SizedBox(height: 10),
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Column(children: [
                _BiometricRow(label: 'PIN', icon: Icons.pin_outlined,
                    enrolled: status['has_pin'] == true || status['hasPin'] == true),
                const Divider(height: 1, indent: 16, endIndent: 16),
                _BiometricRow(label: 'Fingerprint', icon: Icons.fingerprint_rounded,
                    enrolled: status['fingerprint_enrolled'] == true || status['fingerprintEnrolled'] == true),
                const Divider(height: 1, indent: 16, endIndent: 16),
                _BiometricRow(label: 'Face ID', icon: Icons.face_rounded,
                    enrolled: status['face_enrolled'] == true || status['faceEnrolled'] == true),
                const Divider(height: 1, indent: 16, endIndent: 16),
                _BiometricRow(label: 'Palm', icon: Icons.back_hand_outlined,
                    enrolled: status['palm_enrolled'] == true || status['palmEnrolled'] == true),
                const Divider(height: 1, indent: 16, endIndent: 16),
                _BiometricRow(label: 'RFID Card', icon: Icons.credit_card_rounded,
                    enrolled: status['rfid_enrolled'] == true || status['rfidEnrolled'] == true),
              ]),
            ),

            if (deviceList.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text('Synced Devices', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
              const SizedBox(height: 10),
              ...deviceList.map((d) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: ListTile(
                  leading: const Icon(Icons.devices_rounded, color: AppColors.primary),
                  title: Text(d['name']?.toString() ?? 'Device',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: Text(d['serial_number']?.toString() ?? d['serialNumber']?.toString() ?? '',
                      style: GoogleFonts.inter(fontSize: 12)),
                ),
              )),
            ],
          ],
        );
      },
    );
  }
}

class _BiometricRow extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool enrolled;

  const _BiometricRow({required this.label, required this.icon, required this.enrolled});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: enrolled ? AppColors.success : Colors.grey, size: 22),
      title: Text(label, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500)),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: (enrolled ? AppColors.success : AppColors.error).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(enrolled ? 'Enrolled' : 'Not enrolled',
            style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700,
                color: enrolled ? AppColors.success : AppColors.error)),
      ),
      dense: true,
    );
  }
}

// ── Attendance tab ─────────────────────────────────────────────────────────

class _AttendanceTab extends ConsumerWidget {
  final String userId;
  final bool isDark;

  const _AttendanceTab({required this.userId, required this.isDark});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final key = (month: now.month, year: now.year);
    final asyncRecords = ref.watch(allRecordsProvider(key));

    return asyncRecords.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Could not load attendance',
          style: GoogleFonts.inter(color: Colors.grey))),
      data: (all) {
        final records = all.where((r) => r.userId == userId).toList();
        if (records.isEmpty) {
          return Center(child: Text('No records this month',
              style: GoogleFonts.inter(fontSize: 15, color: Colors.grey)));
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: records.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (ctx, i) {
            final r = records[i];
            final statusColor = _statusColor(r.status);
            return Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: ListTile(
                leading: CircleAvatar(radius: 18,
                    backgroundColor: statusColor.withValues(alpha: 0.12),
                    child: Icon(Icons.event_available_rounded, color: statusColor, size: 18)),
                title: Text(_formatDate(r.date), style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                subtitle: Text(
                  '${_fmt(r.clockInTime)} → ${_fmt(r.clockOutTime)}'
                  '${r.workHours != null ? '  ·  ${r.workHours!.toStringAsFixed(1)}h' : ''}',
                  style: GoogleFonts.inter(fontSize: 12),
                ),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(r.status[0].toUpperCase() + r.status.substring(1),
                      style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
                ),
                dense: true,
              ),
            );
          },
        );
      },
    );
  }

  Color _statusColor(String s) {
    switch (s.toLowerCase()) {
      case 'present': return AppColors.success;
      case 'late': return AppColors.warning;
      case 'absent': return AppColors.error;
      default: return Colors.grey;
    }
  }

  String _fmt(String? raw) {
    if (raw == null || raw.isEmpty) return '--:--';
    try {
      final dt = DateTime.parse(raw).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return raw.length >= 5 ? raw.substring(0, 5) : raw;
    }
  }

  String _formatDate(String raw) {
    try {
      final dt = DateTime.parse(raw);
      const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${m[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) {
      return raw;
    }
  }
}
