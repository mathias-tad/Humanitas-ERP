import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';

class DirectChatRequestsScreen extends ConsumerStatefulWidget {
  final List<dynamic>? initialRequests;
  final List<dynamic>? initialActiveGrants;
  final bool? initialAllowOverride;

  const DirectChatRequestsScreen({
    super.key,
    this.initialRequests,
    this.initialActiveGrants,
    this.initialAllowOverride,
  });

  @override
  ConsumerState<DirectChatRequestsScreen> createState() => _DirectChatRequestsScreenState();
}

class _DirectChatRequestsScreenState extends ConsumerState<DirectChatRequestsScreen> {
  bool _isLoading = false;
  List<dynamic> _requests = [];
  List<dynamic> _activeGrants = [];
  bool _allowOverride = false;
  bool _isTogglingOverride = false;
  final Map<String, String> _selectedDurations = {};

  @override
  void initState() {
    super.initState();
    if (widget.initialRequests != null ||
        widget.initialActiveGrants != null ||
        widget.initialAllowOverride != null) {
      _requests = widget.initialRequests ?? [];
      _activeGrants = widget.initialActiveGrants ?? [];
      _allowOverride = widget.initialAllowOverride ?? false;
      _isLoading = false;
    } else {
      _loadData();
    }
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get('/messaging/access-requests/incoming');
      final meRes = await dio.get('/users/me');
      final grantsRes = await dio.get('/messaging/access-grants/active');

      if (mounted) {
        setState(() {
          _requests = res.data is List ? res.data : [];
          _allowOverride = meRes.data['allow_direct_chat_override'] ?? false;
          _activeGrants = grantsRes.data is List ? grantsRes.data : [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _respond(String grantId, String action) async {
    try {
      final duration = _selectedDurations[grantId] ?? '24h';
      final dio = ref.read(apiClientProvider).dio;
      await dio.post(
        '/messaging/access-requests/$grantId/respond',
        data: {
          'action': action,
          'duration': action == 'approve' ? duration : null,
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(action == 'approve' ? 'Access granted ($duration)' : 'Request declined')),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update request: $e')),
        );
      }
    }
  }

  Future<void> _toggleOverride(bool val) async {
    setState(() => _isTogglingOverride = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.patch('/messaging/self-override', data: {'allowOverride': val});
      if (mounted) {
        setState(() {
          _allowOverride = val;
          _isTogglingOverride = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              val
                  ? 'Direct chat unlocked for all employees'
                  : 'Role restrictions restored',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isTogglingOverride = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update override: $e')),
        );
      }
    }
  }

  Future<void> _revokeGrant(String grantId) async {
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.delete('/messaging/access-grants/revoke/$grantId');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Direct chat permission revoked')),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to revoke permission: $e')),
        );
      }
    }
  }

  String _formatExpiration(String? iso) {
    if (iso == null || iso.isEmpty) return 'Permanent Access';
    try {
      final date = DateTime.parse(iso).toLocal();
      final now = DateTime.now();
      final diff = date.difference(now);
      if (diff.isNegative) return 'Expired';
      if (diff.inDays > 0) return 'Expires in ${diff.inDays}d ${diff.inHours % 24}h';
      if (diff.inHours > 0) return 'Expires in ${diff.inHours}h ${diff.inMinutes % 60}m';
      return 'Expires in ${diff.inMinutes}m';
    } catch (_) {
      return 'Expires: $iso';
    }
  }

  void _showGrantEmployeeSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _GrantEmployeeModal(
        onGranted: () {
          Navigator.of(ctx).pop();
          _loadData();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pending = _requests.where((r) => r['status'] == 'pending').toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Chat Access & Permissions',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 17),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // 1. Global Self-Override Card (Expose to all employees)
                Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
                  ),
                  color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.lock_open_rounded, color: AppColors.primary, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Direct Chat Self-Override',
                                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold),
                              ),
                            ),
                            Switch(
                              value: _allowOverride,
                              onChanged: _isTogglingOverride ? null : _toggleOverride,
                              activeColor: AppColors.primary,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Allow all employees to message you directly without needing AI triage or prior approval.',
                          style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Specific Employee Whitelist Action Card
                Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: Colors.blue.withValues(alpha: 0.3)),
                  ),
                  color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.blue.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.person_add_alt_1_rounded, color: Colors.blue, size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Expose to Specific Employee',
                                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Proactively whitelist a colleague with a timed or permanent duration.',
                                style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: _showGrantEmployeeSheet,
                          child: const Text('Whitelist', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // 3. Currently Permitted / Whitelisted Employees
                Row(
                  children: [
                    const Icon(Icons.verified_user_rounded, size: 16, color: Colors.green),
                    const SizedBox(width: 6),
                    Text(
                      'Currently Whitelisted Employees (${_activeGrants.length})',
                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (_activeGrants.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.surfaceDark : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline_rounded, size: 18, color: Colors.grey),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'No specific colleagues currently whitelisted. Use the button above to grant proactive access.',
                            style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  ..._activeGrants.map((g) {
                    final grantId = g['id'].toString();
                    final emp = g['employee'] ?? {};
                    final name = emp['fullName'] ?? 'Employee';
                    final role = (emp['role'] ?? 'user').toString().replaceAll('_', ' ');
                    final expiresAt = g['expiresAt']?.toString();
                    final expirationText = _formatExpiration(expiresAt);
                    final isPermanent = expiresAt == null;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: Colors.blue.withValues(alpha: 0.15),
                              child: Text(
                                name.isNotEmpty ? name[0] : 'E',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 2),
                                  Row(
                                    children: [
                                      Text(role, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: isPermanent
                                              ? Colors.purple.withValues(alpha: 0.15)
                                              : Colors.green.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          expirationText,
                                          style: GoogleFonts.inter(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                            color: isPermanent ? Colors.purple : Colors.green,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.person_remove_rounded, color: Colors.red, size: 20),
                              tooltip: 'Revoke Access',
                              onPressed: () => _revokeGrant(grantId),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 24),

                // 4. Pending Access Requests
                Row(
                  children: [
                    const Icon(Icons.inbox_rounded, size: 16, color: Colors.orange),
                    const SizedBox(width: 6),
                    Text(
                      'Pending Access Requests (${pending.length})',
                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                if (pending.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 30),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.shield_outlined, size: 40, color: Colors.grey.withValues(alpha: 0.5)),
                          const SizedBox(height: 10),
                          Text(
                            'No pending requests',
                            style: GoogleFonts.inter(fontSize: 13, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ...pending.map((r) {
                    final grantId = r['id'].toString();
                    final requester = r['requester'] ?? {};
                    final name = requester['fullName'] ?? 'Employee';
                    final role = (requester['role'] ?? 'user').toString().replaceAll('_', ' ');
                    final reason = r['reason'] ?? '';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 18,
                                  backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                                  child: Text(name.isNotEmpty ? name[0] : 'U', style: const TextStyle(fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(name, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold)),
                                      Text(role, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: isDark ? Colors.black26 : Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text('"$reason"', style: GoogleFonts.inter(fontSize: 12, fontStyle: FontStyle.italic)),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Text('Duration: ', style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
                                DropdownButton<String>(
                                  value: _selectedDurations[grantId] ?? '24h',
                                  underline: const SizedBox(),
                                  style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white : Colors.black87),
                                  items: const [
                                    DropdownMenuItem(value: '1h', child: Text('1 Hour')),
                                    DropdownMenuItem(value: '24h', child: Text('24 Hours')),
                                    DropdownMenuItem(value: '7d', child: Text('7 Days')),
                                    DropdownMenuItem(value: '30d', child: Text('30 Days')),
                                    DropdownMenuItem(value: 'forever', child: Text('Forever')),
                                  ],
                                  onChanged: (val) {
                                    if (val != null) {
                                      setState(() => _selectedDurations[grantId] = val);
                                    }
                                  },
                                ),
                                const Spacer(),
                                TextButton(
                                  onPressed: () => _respond(grantId, 'reject'),
                                  child: const Text('Decline', style: TextStyle(color: Colors.red, fontSize: 12)),
                                ),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.green,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                  onPressed: () => _respond(grantId, 'approve'),
                                  child: const Text('Approve', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
    );
  }
}

class _GrantEmployeeModal extends ConsumerStatefulWidget {
  final VoidCallback onGranted;
  const _GrantEmployeeModal({required this.onGranted});

  @override
  ConsumerState<_GrantEmployeeModal> createState() => _GrantEmployeeModalState();
}

class _GrantEmployeeModalState extends ConsumerState<_GrantEmployeeModal> {
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _noteCtrl = TextEditingController();
  List<dynamic> _users = [];
  bool _isLoadingUsers = true;
  Map<String, dynamic>? _selectedUser;
  String _selectedDuration = '7d';
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _fetchUsers('');
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchUsers(String q) async {
    setState(() => _isLoadingUsers = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get('/messaging/users/search', queryParameters: {'q': q});
      if (mounted) {
        setState(() {
          _users = res.data is List ? res.data : [];
          _isLoadingUsers = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingUsers = false);
    }
  }

  Future<void> _submitGrant() async {
    if (_selectedUser == null) return;
    setState(() => _isSubmitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/messaging/access-grants/proactive', data: {
        'employeeId': _selectedUser!['id'],
        'duration': _selectedDuration,
        'note': _noteCtrl.text.trim().isNotEmpty ? _noteCtrl.text.trim() : null,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Direct chat granted to ${_selectedUser!['full_name']}')),
        );
        widget.onGranted();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to grant access: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomInset),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.person_add_alt_1_rounded, color: Colors.blue),
              const SizedBox(width: 8),
              Text(
                'Whitelist Specific Employee',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchCtrl,
            onChanged: _fetchUsers,
            decoration: InputDecoration(
              hintText: 'Search colleague name or email...',
              prefixIcon: const Icon(Icons.search_rounded),
              filled: true,
              fillColor: isDark ? Colors.black26 : Colors.grey.shade100,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            ),
          ),
          const SizedBox(height: 10),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 160),
            child: _isLoadingUsers
                ? const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
                : _users.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text('No colleagues found', style: GoogleFonts.inter(color: Colors.grey, fontSize: 12)),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _users.length,
                        itemBuilder: (ctx, idx) {
                          final u = _users[idx];
                          final isSelected = _selectedUser?['id'] == u['id'];
                          final name = u['full_name'] ?? 'Colleague';
                          final role = (u['role'] ?? 'user').toString().replaceAll('_', ' ');

                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: CircleAvatar(
                              radius: 16,
                              backgroundColor: isSelected ? Colors.blue : Colors.grey.shade300,
                              child: Text(
                                name.isNotEmpty ? name[0] : 'U',
                                style: TextStyle(
                                  color: isSelected ? Colors.white : Colors.black87,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            title: Text(name, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                            subtitle: Text(role, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
                            trailing: isSelected
                                ? const Icon(Icons.check_circle_rounded, color: Colors.blue, size: 20)
                                : null,
                            onTap: () => setState(() => _selectedUser = u),
                          );
                        },
                      ),
          ),
          const Divider(),
          Row(
            children: [
              Text('Access Duration: ', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500)),
              const Spacer(),
              DropdownButton<String>(
                value: _selectedDuration,
                underline: const SizedBox(),
                items: const [
                  DropdownMenuItem(value: '1h', child: Text('1 Hour')),
                  DropdownMenuItem(value: '24h', child: Text('24 Hours')),
                  DropdownMenuItem(value: '7d', child: Text('7 Days')),
                  DropdownMenuItem(value: '30d', child: Text('30 Days')),
                  DropdownMenuItem(value: 'forever', child: Text('Permanent (Forever)')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _selectedDuration = val);
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _noteCtrl,
            decoration: InputDecoration(
              labelText: 'Optional note / context',
              hintText: 'e.g., Working on quarterly review project',
              filled: true,
              fillColor: isDark ? Colors.black26 : Colors.grey.shade100,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: _isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check_rounded),
              label: Text(_isSubmitting ? 'Granting...' : 'Grant Direct Chat Access', style: const TextStyle(fontWeight: FontWeight.bold)),
              onPressed: _selectedUser == null || _isSubmitting ? null : _submitGrant,
            ),
          ),
        ],
      ),
    );
  }
}
