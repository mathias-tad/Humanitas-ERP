import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/project_model.dart';
import '../../../core/models/task_model.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/pms_agile_model.dart';
import '../providers/pms_provider.dart';

class AgileBacklogScreen extends ConsumerStatefulWidget {
  final String? initialProjectId;

  const AgileBacklogScreen({super.key, this.initialProjectId});

  @override
  ConsumerState<AgileBacklogScreen> createState() => _AgileBacklogScreenState();
}

class _AgileBacklogScreenState extends ConsumerState<AgileBacklogScreen>
    with SingleTickerProviderStateMixin {
  String? _selectedProjectId;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _selectedProjectId = widget.initialProjectId;
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  bool _hasAccess() {
    final auth = ref.read(authProvider);
    final role = auth.user?.role.toLowerCase() ?? '';
    if (role == 'owner' || role == 'admin' || role == 'administrator') return true;
    return auth.hasAnyPermission([
      'view_projects',
      'manage_sprints',
      'manage_tasks',
      'view_all_projects',
    ]);
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasAccess()) {
      return Scaffold(
        appBar: AppBar(title: const Text('Agile Sprints & Backlog')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline, size: 56, color: AppColors.error),
                const SizedBox(height: 16),
                Text(
                  'Access Restricted',
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'You do not have permission to view agile sprints and backlog.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final projectsAsync = ref.watch(pmsProjectsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Agile Sprints & Backlog'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(icon: Icon(Icons.directions_run_outlined), text: 'Sprints'),
            Tab(icon: Icon(Icons.list_alt_outlined), text: 'Backlog'),
          ],
        ),
      ),
      body: projectsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('Failed to load projects: $err', style: GoogleFonts.inter()),
        ),
        data: (projects) {
          if (projects.isEmpty) {
            return Center(
              child: Text('No projects available', style: GoogleFonts.inter(color: Colors.grey)),
            );
          }

          final activeProject = projects.firstWhere(
            (p) => p.id == _selectedProjectId,
            orElse: () => projects.first,
          );
          _selectedProjectId ??= activeProject.id;

          return Column(
            children: [
              // ── Project Selector Header ──────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor,
                  border: Border(bottom: BorderSide(color: Colors.grey.withValues(alpha: 0.2))),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.folder_special_outlined, size: 20, color: AppColors.primary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: activeProject.id,
                          isExpanded: true,
                          items: projects.map((p) {
                            return DropdownMenuItem<String>(
                              value: p.id,
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      p.name,
                                      style: GoogleFonts.inter(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (p.isPrivate) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.amber.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.lock, size: 10, color: Colors.amber),
                                          const SizedBox(width: 3),
                                          Text(
                                            'Private',
                                            style: GoogleFonts.inter(
                                              fontSize: 10,
                                              color: Colors.amber[800],
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) setState(() => _selectedProjectId = val);
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Tab Views ────────────────────────────────────────────────
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _SprintsView(projectId: activeProject.id),
                    _BacklogView(
                      projectId: activeProject.id,
                      sprintsAsync: ref.watch(pmsSprintsProvider(activeProject.id)),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SprintsView extends ConsumerWidget {
  final String projectId;

  const _SprintsView({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sprintsAsync = ref.watch(pmsSprintsProvider(projectId));
    final velocityAsync = ref.watch(pmsVelocityProvider(projectId));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(pmsSprintsProvider(projectId));
        ref.invalidate(pmsVelocityProvider(projectId));
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Velocity Card ──────────────────────────────────────────────
          velocityAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (vel) {
              return Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: AppColors.primary.withValues(alpha: 0.2)),
                ),
                color: AppColors.primary.withValues(alpha: 0.05),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Sprint Velocity',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: Colors.grey[700],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${vel.averageVelocity.toStringAsFixed(1)} pts / sprint',
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                      const Icon(Icons.trending_up, color: AppColors.primary, size: 28),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),

          // ── Sprints List ────────────────────────────────────────────────
          sprintsAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (err, _) => Center(
              child: Text('Error loading sprints: $err', style: GoogleFonts.inter()),
            ),
            data: (sprints) {
              if (sprints.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.all(32),
                  child: Center(
                    child: Column(
                      children: [
                        const Icon(Icons.directions_run_outlined, size: 40, color: Colors.grey),
                        const SizedBox(height: 8),
                        Text(
                          'No sprints created for this project',
                          style: GoogleFonts.inter(color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return Column(
                children: sprints.map((sprint) {
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.grey.withValues(alpha: 0.2)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  sprint.name,
                                  style: GoogleFonts.inter(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              _buildSprintStatusBadge(sprint.status),
                            ],
                          ),
                          if (sprint.goal != null && sprint.goal!.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              sprint.goal!,
                              style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Points: ${sprint.completedPoints} / ${sprint.totalPoints}',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (sprint.totalPoints > 0)
                                Text(
                                  '${((sprint.completedPoints / sprint.totalPoints) * 100).toInt()}%',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.success,
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          LinearProgressIndicator(
                            value: sprint.totalPoints > 0
                                ? (sprint.completedPoints / sprint.totalPoints).clamp(0.0, 1.0)
                                : 0.0,
                            backgroundColor: Colors.grey[200],
                            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSprintStatusBadge(String status) {
    Color bg;
    Color fg;
    String label = status.toUpperCase();

    switch (status.toLowerCase()) {
      case 'active':
        bg = AppColors.success.withValues(alpha: 0.15);
        fg = AppColors.success;
        break;
      case 'completed':
        bg = Colors.blue.withValues(alpha: 0.15);
        fg = Colors.blue;
        break;
      default:
        bg = Colors.grey.withValues(alpha: 0.15);
        fg = Colors.grey[700]!;
        label = 'PLANNED';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        label,
        style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }
}

class _BacklogView extends ConsumerWidget {
  final String projectId;
  final AsyncValue<List<SprintModel>> sprintsAsync;

  const _BacklogView({
    required this.projectId,
    required this.sprintsAsync,
  });

  void _showAssignSprintSheet(BuildContext context, WidgetRef ref, TaskModel task) {
    final sprints = sprintsAsync.value ?? [];

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Assign Task to Sprint',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  task.title,
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[600]),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 16),
                ListTile(
                  leading: const Icon(Icons.inbox_outlined, color: Colors.grey),
                  title: Text('Keep in Product Backlog', style: GoogleFonts.inter(fontSize: 14)),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await ref.read(pmsRepositoryProvider).assignTaskToSprint(task.id, null);
                    ref.invalidate(pmsBacklogProvider(projectId));
                    ref.invalidate(pmsSprintsProvider(projectId));
                  },
                ),
                ...sprints.map((sprint) {
                  return ListTile(
                    leading: const Icon(Icons.directions_run, color: AppColors.primary),
                    title: Text(sprint.name, style: GoogleFonts.inter(fontSize: 14)),
                    subtitle: Text('Status: ${sprint.status}', style: GoogleFonts.inter(fontSize: 11)),
                    onTap: () async {
                      Navigator.pop(ctx);
                      await ref.read(pmsRepositoryProvider).assignTaskToSprint(task.id, sprint.id);
                      ref.invalidate(pmsBacklogProvider(projectId));
                      ref.invalidate(pmsSprintsProvider(projectId));
                    },
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final backlogAsync = ref.watch(pmsBacklogProvider(projectId));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(pmsBacklogProvider(projectId));
      },
      child: backlogAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('Error loading backlog: $err', style: GoogleFonts.inter()),
        ),
        data: (tasks) {
          if (tasks.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.checklist, size: 48, color: Colors.grey),
                  const SizedBox(height: 12),
                  Text(
                    'Product backlog is empty',
                    style: GoogleFonts.inter(fontSize: 14, color: Colors.grey[600]),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: tasks.length,
            itemBuilder: (context, idx) {
              final task = tasks[idx];
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(color: Colors.grey.withValues(alpha: 0.15)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      // Order Indicator
                      Container(
                        width: 26,
                        height: 26,
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${idx + 1}',
                          style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[700]),
                        ),
                      ),
                      const SizedBox(width: 10),

                      // Milestone or regular task icon
                      if (task.isMilestone)
                        Container(
                          width: 18,
                          height: 18,
                          margin: const EdgeInsets.only(right: 8),
                          decoration: BoxDecoration(
                            color: Colors.purple[600],
                            borderRadius: BorderRadius.circular(3),
                          ),
                          alignment: Alignment.center,
                          child: const Text('M', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
                        ),

                      // Title & Badges
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              task.title,
                              style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                if (task.storyPoints != null) ...[
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      '${task.storyPoints} pts',
                                      style: GoogleFonts.inter(fontSize: 10, color: Colors.blue[800], fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                ],
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    task.priority.toUpperCase(),
                                    style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.grey[800]),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      // Sprint Assign Button
                      IconButton(
                        icon: const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
                        onPressed: () => _showAssignSprintSheet(context, ref, task),
                        tooltip: 'Assign to sprint',
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
