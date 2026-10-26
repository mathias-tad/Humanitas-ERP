import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../providers/ai_settings_provider.dart';

class AiSettingsScreen extends ConsumerWidget {
  final Map<String, dynamic>? initialSettings;

  const AiSettingsScreen({super.key, this.initialSettings});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    final bool isOwnerOrAdmin = user?.role == 'owner' ||
        user?.role == 'admin' ||
        user?.role == 'administrator';
    final bool hasPermission = isOwnerOrAdmin ||
        (user != null &&
            authState.hasAnyPermission([
              'manage_ai_settings',
              'view_ai_settings',
            ]));

    if (!hasPermission) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'AI Settings',
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 64, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                'Access Denied',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimaryLight,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You do not have permission to view AI settings.',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.textSecondaryLight,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final settingsAsync = initialSettings != null
        ? AsyncValue.data(initialSettings!)
        : ref.watch(aiSettingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'AI Settings',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(aiSettingsProvider),
          ),
        ],
      ),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    size: 48, color: AppColors.error),
                const SizedBox(height: 12),
                Text(
                  'Error loading AI settings:\n$err',
                  style: GoogleFonts.inter(color: AppColors.error, fontSize: 14),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => ref.invalidate(aiSettingsProvider),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (settings) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(aiSettingsProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildSectionHeader('Provider Configuration'),
              const SizedBox(height: 12),
              _buildSettingCard(
                icon: Icons.auto_awesome,
                iconColor: AppColors.primary,
                label: 'AI Provider',
                value: settings['provider'] as String? ?? '—',
              ),
              const SizedBox(height: 10),
              _buildSettingCard(
                icon: Icons.memory,
                iconColor: Colors.indigo,
                label: 'Max Tokens',
                value:
                    (settings['maxTokens'] ?? settings['max_tokens'])?.toString() ??
                        '—',
              ),
              const SizedBox(height: 10),
              _buildSettingCard(
                icon: Icons.thermostat_outlined,
                iconColor: Colors.orange,
                label: 'Response Temperature',
                value: settings['temperature']?.toString() ?? '—',
              ),
              const SizedBox(height: 20),
              _buildSectionHeader('Capabilities'),
              const SizedBox(height: 12),
              _buildToggleCard(
                icon: Icons.play_circle_outline,
                iconColor: AppColors.success,
                label: 'Action Execution',
                description:
                    'Whether the AI can execute system actions on behalf of users.',
                value: settings['actionExecutionEnabled'] as bool? ??
                    settings['action_execution_enabled'] as bool? ??
                    false,
              ),
              const SizedBox(height: 10),
              _buildToggleCard(
                icon: Icons.description_outlined,
                iconColor: Colors.teal,
                label: 'Document Generation',
                description:
                    'Whether the AI can generate documents (PDF/DOCX).',
                value: settings['documentGenerationEnabled'] as bool? ??
                    settings['document_generation_enabled'] as bool? ??
                    false,
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline,
                        color: Colors.amber.shade800, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Settings are read-only on mobile. Use the web admin panel to modify AI configuration.',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: GoogleFonts.inter(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.textSecondaryLight,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildSettingCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.textSecondaryLight,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimaryLight,
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

  Widget _buildToggleCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String description,
    required bool value,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimaryLight,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Switch(
              value: value,
              onChanged: null, // read-only on mobile
              activeColor: AppColors.primary,
            ),
          ],
        ),
      ),
    );
  }
}
