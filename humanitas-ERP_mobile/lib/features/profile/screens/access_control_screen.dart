import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';

class _PermDef {
  final String id;
  final String label;
  final String module;
  const _PermDef(this.id, this.label, this.module);
}

const List<_PermDef> _allPermissions = [
  _PermDef('view_dashboard', 'View Dashboard', 'Dashboard'),
  _PermDef('view_users', 'View Users', 'Users'),
  _PermDef('edit_users', 'Edit Users', 'Users'),
  _PermDef('create_users', 'Create Users', 'Users'),
  _PermDef('delete_users', 'Delete Users', 'Users'),
  _PermDef('view_user_attachments', 'View User Attachments', 'Users'),
  _PermDef('manage_user_attachments', 'Manage User Attachments', 'Users'),
  _PermDef('view_roles', 'View Roles', 'Access Control'),
  _PermDef('edit_roles', 'Edit Roles', 'Access Control'),
  _PermDef('create_roles', 'Create Roles', 'Access Control'),
  _PermDef('delete_roles', 'Delete Roles', 'Access Control'),
  _PermDef('view_devices', 'View Devices', 'Devices'),
  _PermDef('manage_devices', 'Manage Devices', 'Devices'),
  _PermDef('view_attendance', 'View All Attendance', 'Attendance'),
  _PermDef('edit_attendance', 'Edit Attendance', 'Attendance'),
  _PermDef('correct_attendance', 'Correct Attendance', 'Attendance'),
  _PermDef('view_my_attendance', 'View My Attendance', 'Attendance'),
  _PermDef('clock_in_out', 'Clock In/Out', 'Attendance'),
  _PermDef('view_qr_display', 'View QR Display', 'Attendance'),
  _PermDef('manage_attendance_devices', 'Manage Attendance Devices', 'Attendance'),
  _PermDef('manage_attendance_networks', 'Manage Allowed Networks', 'Attendance'),
  _PermDef('view_overtime_workers', 'View OT Monitor', 'Attendance'),
  _PermDef('force_clockout', 'Force Clock Out', 'Attendance'),
  _PermDef('manage_shift_assignments', 'Manage Shift Assignments', 'Attendance'),
  _PermDef('view_roster', 'View Roster', 'Roster'),
  _PermDef('manage_roster', 'Manage Roster (Create/Edit)', 'Roster'),
  _PermDef('view_shifts', 'View Shifts & Patterns', 'Roster'),
  _PermDef('manage_shifts', 'Manage Shifts & Patterns', 'Roster'),
  _PermDef('view_leave', 'View All Leave Requests', 'Leave'),
  _PermDef('approve_leave', 'Approve Leave Requests', 'Leave'),
  _PermDef('view_my_leave', 'View My Leave Requests', 'Leave'),
  _PermDef('request_leave', 'Request Leave', 'Leave'),
  _PermDef('view_payroll', 'View All Payroll', 'Payroll'),
  _PermDef('view_payroll_dashboard', 'View Payroll Dashboard', 'Payroll'),
  _PermDef('run_payroll', 'Run Payroll', 'Payroll'),
  _PermDef('view_my_payslip', 'View My Payslip', 'Payroll'),
  _PermDef('view_payroll_history', 'View Payroll History', 'Payroll'),
  _PermDef('view_tax_reports', 'View Tax Reports', 'Payroll'),
  _PermDef('absence_penalty_approve', 'Approve Absence Penalties', 'Payroll'),
  _PermDef('manage_loans', 'Manage Loans (Approve/Reject)', 'Loan Management'),
  _PermDef('manage_loan_workflows', 'Manage Loan Workflows', 'Loan Management'),
  _PermDef('view_pms', 'View PMS (Full Access)', 'PMS'),
  _PermDef('view_pms_dashboard', 'View PMS Dashboard', 'PMS'),
  _PermDef('view_my_tasks', 'View My Tasks', 'PMS'),
  _PermDef('view_all_tasks', 'View All Tasks', 'PMS'),
  _PermDef('create_tasks', 'Create Tasks', 'PMS'),
  _PermDef('edit_tasks', 'Edit Tasks', 'PMS'),
  _PermDef('edit_own_tasks', 'Edit Own Tasks', 'PMS'),
  _PermDef('delete_tasks', 'Delete Tasks', 'PMS'),
  _PermDef('view_projects', 'View Projects', 'PMS'),
  _PermDef('create_projects', 'Create Projects', 'PMS'),
  _PermDef('edit_projects', 'Edit Projects', 'PMS'),
  _PermDef('delete_projects', 'Delete Projects', 'PMS'),
  _PermDef('view_pms_reports', 'View Reports', 'PMS'),
  _PermDef('view_teams', 'View Teams', 'PMS'),
  _PermDef('create_teams', 'Create Teams', 'PMS'),
  _PermDef('edit_teams', 'Edit Teams', 'PMS'),
  _PermDef('delete_teams', 'Delete Teams', 'PMS'),
  _PermDef('manage_team_members', 'Manage Team Members', 'PMS'),
  _PermDef('view_team_dashboard', 'View Team Dashboard', 'PMS'),
  _PermDef('view_sprints', 'View Sprints', 'PMS'),
  _PermDef('manage_sprints', 'Manage Sprints', 'PMS'),
  _PermDef('assign_tasks', 'Assign Tasks', 'PMS'),
  _PermDef('approve_tasks', 'Approve Tasks', 'PMS'),
  _PermDef('log_time', 'Log Time', 'PMS'),
  _PermDef('view_time_logs', 'View Time Logs', 'PMS'),
  _PermDef('reassign_tasks', 'Re-assign claimed task', 'PMS'),
  _PermDef('view_team_kpis', 'View Team KPIs', 'PMS'),
  _PermDef('view_own_kpis', 'View Own KPIs', 'PMS'),
  _PermDef('manage_pms_settings', 'Manage PMS Settings', 'PMS'),
  _PermDef('export_pms_data', 'Export PMS Data', 'PMS'),
  _PermDef('view_kpi', 'View KPI', 'KPI'),
  _PermDef('create_kpi', 'Create KPI', 'KPI'),
  _PermDef('edit_kpi', 'Edit KPI', 'KPI'),
  _PermDef('delete_kpi', 'Delete KPI', 'KPI'),
  _PermDef('view_performance_reviews', 'View Performance Reviews', 'KPI'),
  _PermDef('create_performance_reviews', 'Create Performance Reviews', 'KPI'),
  _PermDef('approve_performance_reviews', 'Approve Performance Reviews', 'KPI'),
  _PermDef('view_general_settings', 'View General Settings', 'Settings'),
  _PermDef('edit_general_settings', 'Edit General Settings', 'Settings'),
  _PermDef('view_company_settings', 'View Company Settings', 'Settings'),
  _PermDef('edit_company_settings', 'Edit Company Settings', 'Settings'),
  _PermDef('view_payroll_settings', 'View Payroll Settings', 'Settings'),
  _PermDef('edit_payroll_settings', 'Edit Payroll Settings', 'Settings'),
  _PermDef('view_accounts_privacy_settings', 'View Accounts & Privacy', 'Settings'),
  _PermDef('edit_accounts_privacy_settings', 'Edit Accounts & Privacy', 'Settings'),
  _PermDef('view_hrm_settings', 'View HRM Settings', 'Settings'),
  _PermDef('edit_hrm_settings', 'Edit HRM Settings', 'Settings'),
  _PermDef('view_tasks_settings', 'View Tasks Settings', 'Settings'),
  _PermDef('edit_tasks_settings', 'Edit Tasks Settings', 'Settings'),
  _PermDef('view_kpi_settings', 'View KPI Settings', 'Settings'),
  _PermDef('edit_kpi_settings', 'Edit KPI Settings', 'Settings'),
  _PermDef('view_notifications_settings', 'View Notifications Settings', 'Settings'),
  _PermDef('edit_notifications_settings', 'Edit Notifications Settings', 'Settings'),
  _PermDef('view_email_settings', 'View Email Settings', 'Settings'),
  _PermDef('edit_email_settings', 'Edit Email Settings', 'Settings'),
  _PermDef('view_logs', 'View System Logs', 'System Logs'),
  _PermDef('manage_logs', 'Manage Logs (Retry)', 'System Logs'),
  _PermDef('overtime_view', 'View Overtime Tab', 'Overtime'),
  _PermDef('overtime_management', 'Manage Overtime (Edit/Calculate)', 'Overtime'),
  _PermDef('use_messaging', 'Use Messaging', 'Messaging'),
  _PermDef('create_groups', 'Create Group Chats', 'Messaging'),
  _PermDef('manage_own_groups', 'Manage Own Groups', 'Messaging'),
  _PermDef('delete_any_message', 'Delete Any Message (Admin)', 'Messaging'),
  _PermDef('bypass_privacy_mode', 'Bypass Privacy Mode', 'Messaging'),
  _PermDef('export_chat_history', 'Export Chat History', 'Messaging'),
  _PermDef('manage_recruitment', 'Manage Recruitment (Jobs & Candidates)', 'Recruitment'),
];

class AccessControlScreen extends ConsumerStatefulWidget {
  const AccessControlScreen({super.key});
  @override
  ConsumerState<AccessControlScreen> createState() => _AccessControlScreenState();
}

class _AccessControlScreenState extends ConsumerState<AccessControlScreen> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _roles = [];
  String? _selectedRoleId;
  List<String> _localPermissions = [];
  bool _hasUnsavedChanges = false;
  bool _isSaving = false;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() { super.initState(); _fetchRoles(); }

  Future<void> _fetchRoles() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final res = await ref.read(apiClientProvider).dio.get('/roles');
      final data = res.data;
      if (data is List) {
        setState(() {
          _roles = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() { _error = e.toString().replaceAll('Exception: ', ''); _isLoading = false; });
    }
  }

  Map<String, dynamic>? get _selectedRole {
    if (_selectedRoleId == null) return null;
    try { return _roles.firstWhere((r) => r['id']?.toString() == _selectedRoleId); } catch (_) { return null; }
  }

  void _selectRole(String roleId) {
    void doSelect() {
      final role = _roles.firstWhere((r) => r['id']?.toString() == roleId, orElse: () => {});
      final perms = (role['permissions'] as List?)?.map((e) => e.toString()).toList() ?? <String>[];
      setState(() { _selectedRoleId = roleId; _localPermissions = List<String>.from(perms); _hasUnsavedChanges = false; });
    }
    if (_hasUnsavedChanges) {
      showDialog(context: context, builder: (_) => AlertDialog(
        title: const Text('Unsaved Changes'),
        content: const Text('Discard unsaved permission changes?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(onPressed: () { Navigator.pop(context); doSelect(); }, child: const Text('Discard', style: TextStyle(color: Colors.red))),
        ],
      ));
    } else { doSelect(); }
    Navigator.of(context).pop();
  }

  void _togglePermission(String permId) {
    setState(() {
      if (_localPermissions.contains(permId)) { _localPermissions.remove(permId); } else { _localPermissions.add(permId); }
      _hasUnsavedChanges = true;
    });
  }

  void _toggleModule(String module, bool allSelected) {
    final ids = _allPermissions.where((p) => p.module == module).map((p) => p.id).toList();
    setState(() {
      if (allSelected) { _localPermissions.removeWhere((p) => ids.contains(p)); }
      else { for (final p in ids) { if (!_localPermissions.contains(p)) _localPermissions.add(p); } }
      _hasUnsavedChanges = true;
    });
  }

  Future<void> _savePermissions() async {
    if (_selectedRoleId == null) return;
    setState(() => _isSaving = true);
    try {
      await ref.read(apiClientProvider).dio.patch('/roles/$_selectedRoleId/permissions', data: {'permissions': _localPermissions});
      final idx = _roles.indexWhere((r) => r['id']?.toString() == _selectedRoleId);
      if (idx >= 0) setState(() { _roles[idx] = Map<String, dynamic>.from(_roles[idx])..['permissions'] = List<String>.from(_localPermissions); _hasUnsavedChanges = false; });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Permissions saved!'), backgroundColor: Colors.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red));
    } finally { setState(() => _isSaving = false); }
  }

  void _discardChanges() {
    final role = _selectedRole;
    if (role == null) return;
    final perms = (role['permissions'] as List?)?.map((e) => e.toString()).toList() ?? <String>[];
    setState(() { _localPermissions = List<String>.from(perms); _hasUnsavedChanges = false; });
  }

  Future<void> _showRoleModal({Map<String, dynamic>? role}) async {
    final nameCtrl = TextEditingController(text: role?['name']?.toString() ?? '');
    final descCtrl = TextEditingController(text: role?['description']?.toString() ?? '');
    bool saving = false;
    await showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setMS) {
        return Padding(
          padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(role == null ? 'Create Role' : 'Edit Role', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(controller: nameCtrl, decoration: InputDecoration(labelText: 'Role Name *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)))),
            const SizedBox(height: 12),
            TextField(controller: descCtrl, decoration: InputDecoration(labelText: 'Description', border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))), maxLines: 2),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))),
              const SizedBox(width: 12),
              Expanded(child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                onPressed: saving ? null : () async {
                  if (nameCtrl.text.trim().isEmpty) return;
                  setMS(() => saving = true);
                  try {
                    if (role == null) {
                      await ref.read(apiClientProvider).dio.post('/roles', data: {'name': nameCtrl.text.trim(), 'description': descCtrl.text.trim()});
                    } else {
                      await ref.read(apiClientProvider).dio.patch('/roles/${role['id']}', data: {'name': nameCtrl.text.trim(), 'description': descCtrl.text.trim()});
                    }
                    if (ctx.mounted) Navigator.pop(ctx);
                    await _fetchRoles();
                  } catch (e) {
                    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
                  } finally { setMS(() => saving = false); }
                },
                child: saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Save', style: TextStyle(color: Colors.white)),
              )),
            ]),
          ]),
        );
      }),
    );
  }

  Future<void> _deleteRole(Map<String, dynamic> role) async {
    final confirmed = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('Delete Role'),
      content: Text('Delete "${role['name']}"?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
      ],
    ));
    if (confirmed != true) return;
    try {
      await ref.read(apiClientProvider).dio.delete('/roles/${role['id']}');
      if (_selectedRoleId == role['id']?.toString()) setState(() { _selectedRoleId = null; _localPermissions = []; _hasUnsavedChanges = false; });
      await _fetchRoles();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Role deleted'), backgroundColor: Colors.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e'), backgroundColor: Colors.red));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        title: Text('Access Control', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _fetchRoles, tooltip: 'Refresh')],
      ),
      drawer: _buildDrawer(isDark),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : _error != null ? _buildError() : _buildBody(isDark),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showRoleModal(),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text('New Role', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildError() => Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
    const Icon(Icons.error_outline, color: AppColors.error, size: 48),
    const SizedBox(height: 12), Text(_error!, textAlign: TextAlign.center),
    const SizedBox(height: 16), ElevatedButton.icon(icon: const Icon(Icons.refresh), label: const Text('Retry'), onPressed: _fetchRoles),
  ]));

  Widget _buildDrawer(bool isDark) => Drawer(child: SafeArea(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 8), child: Row(children: [
      const Icon(Icons.shield_outlined, color: AppColors.primary), const SizedBox(width: 8),
      Text('Roles', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold)),
    ])),
    const Divider(),
    Expanded(child: _roles.isEmpty ? const Center(child: Text('No roles yet')) : ListView.builder(
      itemCount: _roles.length,
      itemBuilder: (ctx, i) {
        final role = _roles[i];
        final name = role['name']?.toString() ?? 'Role';
        final desc = role['description']?.toString() ?? '';
        final permsCount = (role['permissions'] as List?)?.length ?? 0;
        final isSelected = role['id']?.toString() == _selectedRoleId;
        return ListTile(
          selected: isSelected,
          selectedTileColor: AppColors.primary.withValues(alpha: 0.1),
          leading: CircleAvatar(
            backgroundColor: isSelected ? AppColors.primary : AppColors.primary.withValues(alpha: 0.15),
            child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'R', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: isSelected ? Colors.white : AppColors.primary)),
          ),
          title: Text(name, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          subtitle: Text(desc.isNotEmpty ? '$desc • $permsCount perms' : '$permsCount permissions', style: GoogleFonts.inter(fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(icon: const Icon(Icons.edit_outlined, size: 18), onPressed: () { Navigator.pop(context); _showRoleModal(role: role); }),
            IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () { Navigator.pop(context); _deleteRole(role); }),
          ]),
          onTap: () => _selectRole(role['id']?.toString() ?? ''),
        );
      },
    )),
    const Divider(),
    Padding(padding: const EdgeInsets.all(12), child: SizedBox(width: double.infinity, child: OutlinedButton.icon(
      icon: const Icon(Icons.add), label: const Text('Create Role'),
      onPressed: () { Navigator.pop(context); _showRoleModal(); },
    ))),
  ])));

  Widget _buildBody(bool isDark) {
    final role = _selectedRole;
    if (role == null) return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.shield_outlined, size: 64, color: isDark ? Colors.white24 : Colors.black26),
      const SizedBox(height: 16),
      Text('Select a role to manage permissions', style: GoogleFonts.inter(fontSize: 16, color: isDark ? Colors.white54 : Colors.black54)),
      const SizedBox(height: 24),
      ElevatedButton.icon(
        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
        icon: const Icon(Icons.menu, color: Colors.white),
        label: Text('Open Roles', style: GoogleFonts.inter(color: Colors.white)),
        onPressed: () => _scaffoldKey.currentState?.openDrawer(),
      ),
    ]));

    final Map<String, List<_PermDef>> grouped = {};
    for (final p in _allPermissions) { grouped.putIfAbsent(p.module, () => []).add(p); }

    return Column(children: [
      // Role header
      Container(
        width: double.infinity, color: AppColors.primary.withValues(alpha: 0.08),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Row(children: [
          GestureDetector(
            onTap: () => _scaffoldKey.currentState?.openDrawer(),
            child: CircleAvatar(backgroundColor: AppColors.primary, radius: 22,
              child: Text((role['name']?.toString() ?? 'R').isNotEmpty ? (role['name']?.toString() ?? 'R')[0].toUpperCase() : 'R',
                style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 18)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (_hasUnsavedChanges) Container(margin: const EdgeInsets.only(right: 6), width: 8, height: 8, decoration: const BoxDecoration(color: Colors.amber, shape: BoxShape.circle)),
              Text(role['name']?.toString() ?? '', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
            ]),
            if ((role['description']?.toString() ?? '').isNotEmpty)
              Text(role['description']!.toString(), style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white60 : Colors.black54)),
          ])),
          IconButton(icon: const Icon(Icons.menu), onPressed: () => _scaffoldKey.currentState?.openDrawer(), tooltip: 'Switch role'),
        ]),
      ),

      // Unsaved changes banner
      if (_hasUnsavedChanges) Container(
        width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: Colors.amber.shade100,
        child: Row(children: [
          const Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 18), const SizedBox(width: 8),
          Expanded(child: Text('Unsaved changes', style: GoogleFonts.inter(fontSize: 13, color: Colors.amber.shade900))),
          TextButton(onPressed: _discardChanges, child: const Text('Discard')),
          const SizedBox(width: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8)),
            onPressed: _isSaving ? null : _savePermissions,
            child: _isSaving ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text('Save', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
          ),
        ]),
      ),

      // Permission matrix
      Expanded(child: ListView(
        padding: EdgeInsets.only(bottom: 100 + MediaQuery.of(context).padding.bottom),
        children: grouped.entries.map((entry) {
          final module = entry.key; final perms = entry.value;
          final moduleIds = perms.map((p) => p.id).toList();
          final selectedCount = moduleIds.where((id) => _localPermissions.contains(id)).length;
          final allSelected = selectedCount == moduleIds.length;
          final someSelected = selectedCount > 0 && !allSelected;
          return Card(
            margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: ExpansionTile(
              tilePadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              title: Row(children: [
                Checkbox(value: allSelected ? true : (someSelected ? null : false), tristate: true, activeColor: AppColors.primary, onChanged: (_) => _toggleModule(module, allSelected)),
                Expanded(child: Text(module, style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.primary))),
              ]),
              subtitle: Padding(
                padding: const EdgeInsets.only(left: 48),
                child: Text('$selectedCount / ${moduleIds.length}', style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white54 : Colors.black45)),
              ),
              children: perms.map((perm) => CheckboxListTile(
                value: _localPermissions.contains(perm.id), activeColor: AppColors.primary,
                title: Text(perm.label, style: GoogleFonts.inter(fontSize: 13)),
                dense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                onChanged: (_) => _togglePermission(perm.id),
              )).toList(),
            ),
          );
        }).toList(),
      )),

      // Bottom save bar
      if (_hasUnsavedChanges) Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 16 + MediaQuery.of(context).padding.bottom),
        decoration: BoxDecoration(color: Theme.of(context).scaffoldBackgroundColor,
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, -2))]),
        child: Row(children: [
          Expanded(child: OutlinedButton(onPressed: _discardChanges, child: const Text('Discard'))),
          const SizedBox(width: 12),
          Expanded(child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: _isSaving ? null : _savePermissions,
            child: _isSaving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text('Save Changes', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
          )),
        ]),
      ),
    ]);
  }
}
