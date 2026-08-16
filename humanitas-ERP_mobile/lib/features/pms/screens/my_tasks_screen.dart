import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/task_model.dart';
import '../providers/pms_provider.dart';
import 'task_detail_screen.dart';
import 'log_time_screen.dart';

class MyTasksScreen extends ConsumerStatefulWidget {
  const MyTasksScreen({super.key});

  @override
  ConsumerState<MyTasksScreen> createState() => _MyTasksScreenState();
}

class _MyTasksScreenState extends ConsumerState<MyTasksScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  final List<String> _statuses = ['all', 'todo', 'in_progress', 'done'];
  final List<String> _tabTitles = ['All', 'To Do', 'In Progress', 'Done'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabTitles.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(pmsTasksProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Tasks'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(pmsTasksProvider.notifier).fetch(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: isDark ? AppColors.navInactive : AppColors.textSecondaryLight,
          tabs: _tabTitles.map((t) => Tab(text: t)).toList(),
        ),
      ),
      body: Column(
        children: [
          // ── Search bar ──────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search tasks...',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onChanged: (q) => setState(() => _searchQuery = q.trim().toLowerCase()),
            ),
          ),

          // ── Tab View Content ─────────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: _statuses.map((statusFilter) {
                return tasksAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.error, size: 48),
                        const SizedBox(height: 12),
                        Text(e.toString().replaceAll('Exception: ', ''),
                            textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 14)),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                          onPressed: () => ref.read(pmsTasksProvider.notifier).fetch(),
                        ),
                      ],
                    ),
                  ),
                  data: (allTasks) {
                    var filtered = allTasks;
                    if (statusFilter != 'all') {
                      filtered = filtered.where((t) => t.status == statusFilter).toList();
                    }
                    if (_searchQuery.isNotEmpty) {
                      filtered = filtered
                          .where((t) =>
                              t.title.toLowerCase().contains(_searchQuery) ||
                              (t.description?.toLowerCase().contains(_searchQuery) ?? false))
                          .toList();
                    }

                    if (filtered.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.task_outlined, size: 64, color: Colors.grey[400]),
                            const SizedBox(height: 12),
                            Text('No tasks found',
                                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      );
                    }

                    return RefreshIndicator(
                      onRefresh: () => ref.read(pmsTasksProvider.notifier).fetch(),
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        itemBuilder: (context, i) => _TaskCard(task: filtered[i], isDark: isDark),
                      ),
                    );
                  },
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  final TaskModel task;
  final bool isDark;
  const _TaskCard({required this.task, required this.isDark});

  Color _priorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'urgent':
      case 'high':
        return AppColors.error;
      case 'medium':
        return AppColors.warning;
      default:
        return AppColors.success;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'done':
        return AppColors.success;
      case 'in_progress':
        return AppColors.teal;
      case 'in_review':
        return AppColors.warning;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: task.id)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header Row ───────────────────────────────────────────
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _priorityColor(task.priority).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      task.priority.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _priorityColor(task.priority),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(task.status).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      task.status.replaceAll('_', ' ').toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _statusColor(task.status),
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (task.projectName != null)
                    Text(
                      task.projectName!,
                      style: GoogleFonts.inter(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600),
                    ),
                ],
              ),
              const SizedBox(height: 10),

              // ── Title ────────────────────────────────────────────────
              Text(
                task.title,
                style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),

              // ── Footer info ──────────────────────────────────────────
              Row(
                children: [
                  Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Text(
                    task.formattedDueDate,
                    style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600]),
                  ),
                  const Spacer(),
                  Icon(Icons.timer_outlined, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Text(
                    '${task.loggedHours}/${task.estimatedHours}h',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.add_alarm_rounded, size: 18, color: AppColors.teal),
                    constraints: const BoxConstraints(),
                    padding: EdgeInsets.zero,
                    tooltip: 'Log time',
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => LogTimeScreen(taskId: task.id, taskTitle: task.title),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
