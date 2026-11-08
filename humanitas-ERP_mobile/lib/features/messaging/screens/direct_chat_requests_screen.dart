import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';

class DirectChatRequestsScreen extends ConsumerStatefulWidget {
  const DirectChatRequestsScreen({super.key});

  @override
  ConsumerState<DirectChatRequestsScreen> createState() => _DirectChatRequestsScreenState();
}

class _DirectChatRequestsScreenState extends ConsumerState<DirectChatRequestsScreen> {
  bool _isLoading = false;
  List<dynamic> _requests = [];
  bool _allowOverride = false;
  bool _isTogglingOverride = false;
  final Map<String, String> _selectedDurations = {};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get('/messaging/access-requests/incoming');
      final meRes = await dio.get('/users/me');

      if (mounted) {
        setState(() {
          _requests = res.data is List ? res.data : [];
          _allowOverride = meRes.data['allow_direct_chat_override'] ?? false;
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

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(action == 'approve' ? 'Access granted ($duration)' : 'Request declined')),
      );
      _loadData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update request: $e')),
      );
    }
  }

  Future<void> _toggleOverride(bool val) async {
    setState(() => _isTogglingOverride = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.patch('/messaging/self-override', data: {'allowOverride': val});
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
    } catch (e) {
      setState(() => _isTogglingOverride = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update override: $e')),
      );
    }
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
                // Self-Override card
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
                const SizedBox(height: 20),

                Text(
                  'Pending Access Requests (${pending.length})',
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),

                if (pending.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.shield_outlined, size: 48, color: Colors.grey.withValues(alpha: 0.5)),
                          const SizedBox(height: 12),
                          Text(
                            'No pending requests',
                            style: GoogleFonts.inter(fontSize: 14, color: Colors.grey),
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
