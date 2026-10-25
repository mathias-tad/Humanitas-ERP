import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/project_model.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/pms_agile_model.dart';
import '../providers/pms_provider.dart';

class ProjectTimelineScreen extends ConsumerStatefulWidget {
  final String? initialProjectId;

  const ProjectTimelineScreen({super.key, this.initialProjectId});

  @override
  ConsumerState<ProjectTimelineScreen> createState() => _ProjectTimelineScreenState();
}

class _ProjectTimelineScreenState extends ConsumerState<ProjectTimelineScreen>
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
      'manage_tasks',
      'view_all_projects',
    ]);
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasAccess()) {
      return Scaffold(
        appBar: AppBar(title: const Text('Project Timeline & Calendar')),
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
                  'You do not have permission to view project timelines.',
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
        title: const Text('Project Timeline & Calendar'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(icon: Icon(Icons.view_timeline_outlined), text: 'Gantt Timeline'),
            Tab(icon: Icon(Icons.calendar_month_outlined), text: 'Calendar'),
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
              child: Text('No projects found', style: GoogleFonts.inter(color: Colors.grey)),
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
                                      child: const Icon(Icons.lock, size: 12, color: Colors.amber),
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
                    _GanttTimelineView(projectId: activeProject.id),
                    _CalendarEventsView(projectId: activeProject.id),
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

class _GanttTimelineView extends ConsumerWidget {
  final String projectId;

  const _GanttTimelineView({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ganttAsync = ref.watch(pmsGanttProvider(projectId));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(pmsGanttProvider(projectId));
      },
      child: ganttAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('Error loading Gantt tasks: $err', style: GoogleFonts.inter()),
        ),
        data: (tasks) {
          if (tasks.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.view_timeline_outlined, size: 48, color: Colors.grey),
                  const SizedBox(height: 12),
                  Text(
                    'No tasks scheduled with dates',
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
              final isDone = task.status.toLowerCase() == 'done';

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey.withValues(alpha: 0.15)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (task.isMilestone)
                            Container(
                              width: 20,
                              height: 20,
                              margin: const EdgeInsets.only(right: 8),
                              decoration: BoxDecoration(
                                color: Colors.purple[600],
                                borderRadius: BorderRadius.circular(4),
                              ),
                              alignment: Alignment.center,
                              child: const Text('M', style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold)),
                            )
                          else
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(right: 8),
                              decoration: BoxDecoration(
                                color: isDone ? AppColors.success : AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                          Expanded(
                            child: Text(
                              task.title,
                              style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isDone
                                  ? AppColors.success.withValues(alpha: 0.1)
                                  : Colors.blue.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              task.status,
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: isDone ? AppColors.success : Colors.blue[800],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Dates & Story Points
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${task.startDate}  →  ${task.dueDate}',
                            style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600]),
                          ),
                          if (task.storyPoints != null)
                            Text(
                              '${task.storyPoints} pts',
                              style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.grey[700]),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Progress Bar
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: (task.progress / 100).clamp(0.0, 1.0),
                          backgroundColor: Colors.grey[200],
                          valueColor: AlwaysStoppedAnimation<Color>(
                            task.isMilestone ? Colors.purple : (isDone ? AppColors.success : AppColors.primary),
                          ),
                          minHeight: 6,
                        ),
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

class _CalendarEventsView extends ConsumerWidget {
  final String projectId;

  const _CalendarEventsView({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final calendarAsync = ref.watch(pmsCalendarProvider(projectId));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(pmsCalendarProvider(projectId));
      },
      child: calendarAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Text('Error loading calendar events: $err', style: GoogleFonts.inter()),
        ),
        data: (events) {
          if (events.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 48, color: Colors.grey),
                  const SizedBox(height: 12),
                  Text(
                    'No scheduled deadlines or sprint dates',
                    style: GoogleFonts.inter(fontSize: 14, color: Colors.grey[600]),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: events.length,
            itemBuilder: (context, idx) {
              final ev = events[idx];
              final isMilestone = ev.isMilestone || ev.type == 'milestone';
              final isSprint = ev.type == 'sprint';

              Color accentColor = Colors.blue;
              IconData icon = Icons.task_alt;
              if (isMilestone) {
                accentColor = Colors.purple;
                icon = Icons.flag;
              } else if (isSprint) {
                accentColor = Colors.amber[800]!;
                icon = Icons.directions_run;
              }

              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: BorderSide(color: accentColor.withValues(alpha: 0.2)),
                ),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: accentColor.withValues(alpha: 0.15),
                    child: Icon(icon, color: accentColor, size: 20),
                  ),
                  title: Text(
                    ev.title,
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    'Date: ${ev.start}${ev.end != null ? ' - ${ev.end}' : ''}',
                    style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600]),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      ev.type.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: accentColor,
                      ),
                    ),
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
