import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';
import '../../ai/screens/ai_chat_screen.dart';

class DirectChatAccessDialog extends ConsumerStatefulWidget {
  final String targetUserId;
  final String targetUserName;
  final String targetUserRole;
  final String? triagePrompt;
  final Map<String, dynamic>? pendingRequest;

  const DirectChatAccessDialog({
    super.key,
    required this.targetUserId,
    required this.targetUserName,
    required this.targetUserRole,
    this.triagePrompt,
    this.pendingRequest,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String targetUserId,
    required String targetUserName,
    required String targetUserRole,
    String? triagePrompt,
    Map<String, dynamic>? pendingRequest,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => DirectChatAccessDialog(
        targetUserId: targetUserId,
        targetUserName: targetUserName,
        targetUserRole: targetUserRole,
        triagePrompt: triagePrompt,
        pendingRequest: pendingRequest,
      ),
    );
  }

  @override
  ConsumerState<DirectChatAccessDialog> createState() => _DirectChatAccessDialogState();
}

class _DirectChatAccessDialogState extends ConsumerState<DirectChatAccessDialog> {
  final _reasonController = TextEditingController();
  bool _isSubmitting = false;
  Map<String, dynamic>? _currentPending;

  @override
  void initState() {
    super.initState();
    _currentPending = widget.pendingRequest;
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submitRequest() async {
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a reason for direct chat access')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final response = await dio.post(
        '/messaging/access-requests',
        data: {
          'targetUserId': widget.targetUserId,
          'reason': reason,
        },
      );

      if (mounted) {
        setState(() {
          _currentPending = response.data['grant'] ?? {'status': 'pending', 'reason': reason};
          _isSubmitting = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Access request sent to ${widget.targetUserName}')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit request: $e')),
        );
      }
    }
  }

  void _openAiTriage() {
    Navigator.of(context).pop();
    final roleName = widget.targetUserRole.replaceAll('_', ' ');
    final prompt = 'I need assistance regarding $roleName policies or guidelines before reaching out to ${widget.targetUserName}. What does company documentation state?';
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AiChatScreen(initialPrompt: prompt),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.shield_outlined, color: AppColors.primary, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Protected Direct Chat',
                          style: GoogleFonts.inter(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        Text(
                          '${widget.targetUserName} (${widget.targetUserRole.replaceAll('_', ' ')})',
                          style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Triage guidance box
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.info_outline, size: 16, color: AppColors.primary),
                        const SizedBox(width: 6),
                        Text(
                          'Department Policy',
                          style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      widget.triagePrompt ??
                          'Direct messaging to this role is restricted. Please consult the AI Assistant for immediate policy answers.',
                      style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white70 : Colors.black87),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Option 1: AI Help First
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black87,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.auto_awesome, size: 18),
                label: Text(
                  'Ask AI Assistant First',
                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                onPressed: _openAiTriage,
              ),
              const SizedBox(height: 16),

              const Divider(),
              const SizedBox(height: 12),

              // Option 2: Request Direct Chat Access
              if (_currentPending != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.hourglass_top_rounded, size: 16, color: Colors.blue),
                          const SizedBox(width: 6),
                          Text(
                            'Request Pending Review',
                            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.blue),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Your request is awaiting review by ${widget.targetUserName}. You will be able to message them once approved.',
                        style: GoogleFonts.inter(fontSize: 11, color: isDark ? Colors.white70 : Colors.black87),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                Text(
                  'Still need direct contact?',
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _reasonController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'Briefly explain your inquiry or urgency...',
                    hintStyle: GoogleFonts.inter(fontSize: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.all(10),
                  ),
                  style: GoogleFonts.inter(fontSize: 12),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: AppColors.primary.withValues(alpha: 0.6)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _isSubmitting
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send_rounded, size: 16, color: AppColors.primary),
                  label: Text(
                    _isSubmitting ? 'Submitting...' : 'Request Direct Chat Access',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
                  ),
                  onPressed: _isSubmitting ? null : _submitRequest,
                ),
              ],

              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text('Close', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
