import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../models/user_model.dart';
import '../providers/users_provider.dart';
import 'user_detail_screen.dart';

class UsersScreen extends ConsumerStatefulWidget {
  const UsersScreen({super.key});

  @override
  ConsumerState<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends ConsumerState<UsersScreen> {
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<UserModel> _filtered(List<UserModel> users) {
    if (_searchQuery.isEmpty) return users;
    final q = _searchQuery.toLowerCase();
    return users.where((u) =>
        u.displayName.toLowerCase().contains(q) ||
        u.email.toLowerCase().contains(q) ||
        (u.position ?? '').toLowerCase().contains(q) ||
        (u.department ?? '').toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final asyncUsers = ref.watch(usersProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        title: Text('Team & Users', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(usersProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Search bar ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search by name, position, department…',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18),
                        onPressed: () { _searchCtrl.clear(); setState(() => _searchQuery = ''); })
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

          // ── List ────────────────────────────────────────────────────
          Expanded(
            child: asyncUsers.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _buildError(e),
              data: (users) {
                final filtered = _filtered(users);
                if (filtered.isEmpty) {
                  return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.people_outline, size: 60, color: isDark ? Colors.white24 : Colors.black26),
                    const SizedBox(height: 12),
                    Text(_searchQuery.isNotEmpty ? 'No results for "$_searchQuery"' : 'No employees found',
                        style: GoogleFonts.inter(fontSize: 15, color: isDark ? Colors.white54 : Colors.black45)),
                  ]));
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(usersProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (ctx, i) => _UserCard(
                      user: filtered[i],
                      isDark: isDark,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => UserDetailScreen(user: filtered[i])),
                      ),
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

  Widget _buildError(Object e) => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.error_outline, color: AppColors.error, size: 48),
      const SizedBox(height: 12),
      Text(e.toString().replaceAll('Exception: ', ''), textAlign: TextAlign.center),
      const SizedBox(height: 16),
      ElevatedButton.icon(
        icon: const Icon(Icons.refresh),
        label: const Text('Retry'),
        onPressed: () => ref.invalidate(usersProvider),
      ),
    ]),
  );
}

// ── User card ──────────────────────────────────────────────────────────────

class _UserCard extends StatelessWidget {
  final UserModel user;
  final bool isDark;
  final VoidCallback onTap;

  const _UserCard({required this.user, required this.isDark, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final initials = user.displayName.trim().split(' ').take(2)
        .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '').join();
    final roleBadgeColor = _roleColor(user.role);

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            // Avatar
            CircleAvatar(
              radius: 24,
              backgroundColor: AppColors.primary.withValues(alpha: 0.15),
              child: Text(initials,
                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 15)),
            ),
            const SizedBox(width: 12),

            // Info
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(user.displayName,
                  style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14,
                      color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight)),
              if ((user.position ?? '').isNotEmpty || (user.department ?? '').isNotEmpty)
                Text(
                  [user.position, user.department].where((s) => s != null && s.isNotEmpty).join(' · '),
                  style: GoogleFonts.inter(fontSize: 12,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              const SizedBox(height: 6),
              Row(children: [
                // Active/Inactive badge
                _Badge(
                  label: user.isActive ? 'Active' : 'Inactive',
                  color: user.isActive ? AppColors.success : AppColors.error,
                ),
                const SizedBox(width: 6),
                // Role badge
                _Badge(label: user.role, color: roleBadgeColor),
              ]),
            ])),

            const Icon(Icons.chevron_right, color: AppColors.primary, size: 20),
          ]),
        ),
      ),
    );
  }

  Color _roleColor(String role) {
    switch (role.toLowerCase()) {
      case 'admin': return const Color(0xFF7C3AED);
      case 'hr_manager':
      case 'hr': return AppColors.info;
      case 'manager': return AppColors.teal;
      default: return Colors.grey;
    }
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;

  const _Badge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
    );
  }
}
