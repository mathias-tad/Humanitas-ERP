import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/shift_pattern_model.dart';
import '../providers/scheduling_provider.dart';
import '../repositories/scheduling_repository.dart';

// ── Day labels (0 = Monday … 6 = Sunday) ─────────────────────────────────
const List<String> _kDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

class AdminRosterScreen extends ConsumerStatefulWidget {
  const AdminRosterScreen({super.key});

  @override
  ConsumerState<AdminRosterScreen> createState() => _AdminRosterScreenState();
}

class _AdminRosterScreenState extends ConsumerState<AdminRosterScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ── Permission check ──────────────────────────────────────────────────────

  bool _hasAccess() {
    final authState = ref.read(authProvider);
    final role = authState.user?.role.toLowerCase() ?? '';
    if (role == 'owner' || role == 'admin' || role == 'administrator') return true;
    return authState.hasAnyPermission([
      'manage_roster',
      'manage_shift_assignments',
      'manage_schedules',
    ]);
  }

  // ── Confirmation dialog for remove ────────────────────────────────────────

  Future<void> _confirmRemove(UserWithAssignmentModel user) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Remove Assignment',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Remove the shift assignment for ${user.fullName}? They will revert to the Standard Schedule.',
          style: GoogleFonts.inter(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: GoogleFonts.inter()),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Remove', style: GoogleFonts.inter(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      final repo = ref.read(schedulingRepositoryProvider);
      await repo.removeAssignment(user.id);
      ref.invalidate(rosterUsersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Assignment removed for ${user.fullName}',
                style: GoogleFonts.inter()),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e', style: GoogleFonts.inter()),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  // ── Assignment bottom sheet ───────────────────────────────────────────────

  void _showAssignPatternSheet(UserWithAssignmentModel user) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AssignPatternSheet(
        user: user,
        onAssigned: () {
          ref.invalidate(rosterUsersProvider);
        },
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (!_hasAccess()) {
      return _buildPermissionDenied(isDark);
    }

    final rosterAsync = ref.watch(rosterUsersProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        title: Text(
          'Team Roster & Assignments',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(rosterUsersProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Search bar ──────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              onChanged: (v) => setState(() => _searchQuery = v.toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search by name, department…',
                hintStyle: GoogleFonts.inter(fontSize: 13),
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: isDark ? AppColors.cardDark : Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                ),
              ),
            ),
          ),

          // ── User list ────────────────────────────────────────────────────
          Expanded(
            child: rosterAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                    const SizedBox(height: 12),
                    Text(
                      'Failed to load roster',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 16),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      err.toString().replaceAll('Exception: ', ''),
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(rosterUsersProvider),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (users) {
                final filtered = _searchQuery.isEmpty
                    ? users
                    : users.where((u) {
                        return u.fullName.toLowerCase().contains(_searchQuery) ||
                            (u.department?.toLowerCase().contains(_searchQuery) ?? false) ||
                            (u.position?.toLowerCase().contains(_searchQuery) ?? false) ||
                            (u.email?.toLowerCase().contains(_searchQuery) ?? false);
                      }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.people_outline_rounded,
                          size: 56,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _searchQuery.isNotEmpty ? 'No users match your search.' : 'No team members found.',
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(rosterUsersProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, index) => _UserRosterCard(
                      user: filtered[index],
                      isDark: isDark,
                      onAssign: () => _showAssignPatternSheet(filtered[index]),
                      onRemove: filtered[index].patternId != null
                          ? () => _confirmRemove(filtered[index])
                          : null,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPermissionDenied(bool isDark) {
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.lock_outline_rounded,
                size: 64,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
              const SizedBox(height: 16),
              Text(
                'Access Restricted',
                style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 18),
              ),
              const SizedBox(height: 8),
              Text(
                'You do not have permission to manage rosters.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── User roster card ──────────────────────────────────────────────────────────

class _UserRosterCard extends StatelessWidget {
  const _UserRosterCard({
    required this.user,
    required this.isDark,
    required this.onAssign,
    this.onRemove,
  });

  final UserWithAssignmentModel user;
  final bool isDark;
  final VoidCallback onAssign;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final hasPattern = user.patternId != null;

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: hasPattern
              ? AppColors.primary.withValues(alpha: 0.4)
              : (isDark ? AppColors.borderDark : AppColors.borderLight),
          width: hasPattern ? 1.2 : 0.8,
        ),
      ),
      color: isDark ? AppColors.cardDark : AppColors.surfaceLight,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // ── Avatar ──────────────────────────────────────────────────────
            _AvatarWidget(user: user),
            const SizedBox(width: 12),

            // ── Name / dept / pattern ────────────────────────────────────────
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.fullName,
                    style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (user.department != null || user.position != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      [user.position, user.department].whereType<String>().join(' · '),
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 6),
                  // Pattern badge
                  Row(
                    children: [
                      Icon(
                        hasPattern ? Icons.event_repeat_rounded : Icons.schedule_rounded,
                        size: 13,
                        color: hasPattern ? AppColors.primary : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          hasPattern ? (user.patternName ?? 'Custom Pattern') : 'Standard Schedule',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: hasPattern ? AppColors.primary : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  // Day-off pills
                  if (user.dayOffDays.isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Wrap(
                      spacing: 4,
                      children: user.dayOffDays.map((d) {
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.warning.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            _kDayLabels[d.clamp(0, 6)],
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: AppColors.warning,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),

            // ── Action buttons ───────────────────────────────────────────────
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ActionIconButton(
                  icon: Icons.edit_calendar_rounded,
                  tooltip: 'Assign Shift Pattern',
                  color: AppColors.primary,
                  onTap: onAssign,
                ),
                if (onRemove != null) ...[
                  const SizedBox(height: 4),
                  _ActionIconButton(
                    icon: Icons.remove_circle_outline_rounded,
                    tooltip: 'Remove Assignment',
                    color: AppColors.error,
                    onTap: onRemove!,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionIconButton extends StatelessWidget {
  const _ActionIconButton({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }
}

class _AvatarWidget extends StatelessWidget {
  const _AvatarWidget({required this.user});

  final UserWithAssignmentModel user;

  String get _initials {
    final parts = user.fullName.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return user.fullName.isNotEmpty ? user.fullName[0].toUpperCase() : '?';
  }

  @override
  Widget build(BuildContext context) {
    if (user.avatarUrl != null && user.avatarUrl!.isNotEmpty) {
      return CircleAvatar(
        radius: 24,
        backgroundImage: NetworkImage(user.avatarUrl!),
        onBackgroundImageError: (_, __) {},
        backgroundColor: AppColors.primary.withValues(alpha: 0.15),
        child: null,
      );
    }
    return CircleAvatar(
      radius: 24,
      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
      child: Text(
        _initials,
        style: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

// ── Assignment bottom sheet ───────────────────────────────────────────────────

class _AssignPatternSheet extends ConsumerStatefulWidget {
  const _AssignPatternSheet({
    required this.user,
    required this.onAssigned,
  });

  final UserWithAssignmentModel user;
  final VoidCallback onAssigned;

  @override
  ConsumerState<_AssignPatternSheet> createState() => _AssignPatternSheetState();
}

class _AssignPatternSheetState extends ConsumerState<_AssignPatternSheet> {
  final _formKey = GlobalKey<FormState>();

  // Form state
  String? _selectedPatternId;          // null = Standard Schedule
  late TextEditingController _startDateController;
  late TextEditingController _weekController;
  bool _autoRotate = true;
  late List<int> _selectedDayOffs;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    // Pre-populate from existing assignment
    _selectedPatternId = widget.user.patternId;
    _selectedDayOffs = List<int>.from(widget.user.dayOffDays);
    _autoRotate = widget.user.autoRotateDayoff;
    _weekController = TextEditingController(
      text: widget.user.currentWeekInRotation.toString(),
    );
    _startDateController = TextEditingController(
      text: DateTime.now().toIso8601String().split('T').first,
    );
  }

  @override
  void dispose() {
    _startDateController.dispose();
    _weekController.dispose();
    super.dispose();
  }

  // ── Date picker ───────────────────────────────────────────────────────────

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      _startDateController.text = picked.toIso8601String().split('T').first;
    }
  }

  // ── Day-off toggle ────────────────────────────────────────────────────────

  void _toggleDayOff(int day) {
    setState(() {
      if (_selectedDayOffs.contains(day)) {
        _selectedDayOffs.remove(day);
      } else {
        _selectedDayOffs.add(day);
      }
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  Future<void> _submit(SchedulingRepository repo) async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    try {
      await repo.assignPattern(
        userId: widget.user.id,
        patternId: _selectedPatternId,
        startDate: _startDateController.text.trim(),
        currentWeekInRotation: int.tryParse(_weekController.text.trim()) ?? 1,
        dayOffDays: _selectedDayOffs,
        autoRotateDayoff: _autoRotate,
      );
      widget.onAssigned();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Pattern assigned to ${widget.user.fullName}',
              style: GoogleFonts.inter(),
            ),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e', style: GoogleFonts.inter()),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final patternsAsync = ref.watch(allPatternsProvider);
    final repo = ref.read(schedulingRepositoryProvider);

    final sheetBg = isDark ? AppColors.surfaceDark : Colors.white;
    final sectionBg = isDark ? AppColors.cardDark : AppColors.backgroundLight;
    final borderColor = isDark ? AppColors.borderDark : AppColors.borderLight;
    final secondaryText = isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight;

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.6,
      maxChildSize: 0.97,
      expand: false,
      builder: (_, scrollCtrl) => Container(
        decoration: BoxDecoration(
          color: sheetBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Form(
          key: _formKey,
          child: ListView(
            controller: scrollCtrl,
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 8,
              bottom: MediaQuery.of(context).viewInsets.bottom + 24,
            ),
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: borderColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // ── Sheet title ───────────────────────────────────────────────
              Text(
                'Assign Shift Pattern',
                style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 18),
              ),
              const SizedBox(height: 16),

              // ── Employee header ───────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: sectionBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: borderColor),
                ),
                child: Row(
                  children: [
                    _AvatarWidget(user: widget.user),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.user.fullName,
                            style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
                          ),
                          if (widget.user.department != null || widget.user.position != null)
                            Text(
                              [widget.user.position, widget.user.department]
                                  .whereType<String>()
                                  .join(' · '),
                              style: GoogleFonts.inter(fontSize: 12, color: secondaryText),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── Pattern dropdown ──────────────────────────────────────────
              _SectionLabel(label: 'Schedule Pattern'),
              const SizedBox(height: 6),
              patternsAsync.when(
                loading: () => const SizedBox(
                  height: 56,
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                ),
                error: (_, __) => Text(
                  'Could not load patterns. Standard Schedule only.',
                  style: GoogleFonts.inter(fontSize: 12, color: AppColors.error),
                ),
                data: (patterns) => DropdownButtonFormField<String?>(
                  value: _selectedPatternId,
                  decoration: _inputDecoration(isDark: isDark, hint: 'Select a pattern'),
                  items: [
                    DropdownMenuItem<String?>(
                      value: null,
                      child: Text(
                        'Standard Schedule (Default)',
                        style: GoogleFonts.inter(fontSize: 14),
                      ),
                    ),
                    ...patterns.map(
                      (p) => DropdownMenuItem<String?>(
                        value: p.id,
                        child: Text(
                          '${p.name}${p.rotationType == 'rotating' ? ' (${p.totalWeeks}w rotating)' : ''}',
                          style: GoogleFonts.inter(fontSize: 14),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                  onChanged: (v) => setState(() => _selectedPatternId = v),
                ),
              ),
              const SizedBox(height: 16),

              // ── Effective start date ──────────────────────────────────────
              _SectionLabel(label: 'Effective Start Date'),
              const SizedBox(height: 6),
              TextFormField(
                controller: _startDateController,
                readOnly: true,
                onTap: _pickDate,
                decoration: _inputDecoration(
                  isDark: isDark,
                  hint: 'YYYY-MM-DD',
                  suffixIcon: const Icon(Icons.calendar_today_rounded, size: 18),
                ),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Please select a start date' : null,
                style: GoogleFonts.inter(fontSize: 14),
              ),
              const SizedBox(height: 16),

              // ── Starting week in rotation ─────────────────────────────────
              _SectionLabel(label: 'Starting Week in Rotation'),
              const SizedBox(height: 6),
              TextFormField(
                controller: _weekController,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: _inputDecoration(isDark: isDark, hint: 'e.g. 1'),
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  if (n == null || n < 1) return 'Must be at least 1';
                  return null;
                },
                style: GoogleFonts.inter(fontSize: 14),
              ),
              const SizedBox(height: 20),

              // ── Day-off & rotation settings ───────────────────────────────
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: sectionBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: borderColor),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Day-Off & Rotation Settings',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                    const SizedBox(height: 10),

                    // Auto-rotate checkbox
                    Row(
                      children: [
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: Checkbox(
                            value: _autoRotate,
                            activeColor: AppColors.primary,
                            onChanged: (v) => setState(() => _autoRotate = v ?? true),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _autoRotate = !_autoRotate),
                            child: Text(
                              'Rotate Day-Offs Automatically',
                              style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Day-off pills label
                    Text(
                      'Select Days Off',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: secondaryText,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Day pill buttons
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: List.generate(7, (i) {
                        final selected = _selectedDayOffs.contains(i);
                        return GestureDetector(
                          onTap: () => _toggleDayOff(i),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                              color: selected
                                  ? AppColors.primary
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: selected ? AppColors.primary : borderColor,
                                width: 1.5,
                              ),
                            ),
                            child: Text(
                              _kDayLabels[i],
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: selected
                                    ? Colors.white
                                    : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 10),

                    // Helper text
                    Text(
                      _autoRotate
                          ? 'Selected days off shift forward by 1 day every week (e.g. Mon → Tue).'
                          : 'Selected days off will repeat every week.',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: secondaryText,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ── Assign button ─────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  onPressed: _isSubmitting ? null : () => _submit(repo),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          'Assign Pattern',
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 10),

              // ── Cancel button ─────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.primary),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _isSubmitting ? null : () => Navigator.pop(context),
                  child: Text(
                    'Cancel',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required bool isDark,
    String? hint,
    Widget? suffixIcon,
  }) {
    final borderColor = isDark ? AppColors.borderDark : AppColors.borderLight;
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.inter(fontSize: 13),
      filled: true,
      fillColor: isDark ? AppColors.cardDark : Colors.white,
      suffixIcon: suffixIcon,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: borderColor),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: borderColor),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.error, width: 1.5),
      ),
    );
  }
}

// ── Helper widgets ────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
    );
  }
}
