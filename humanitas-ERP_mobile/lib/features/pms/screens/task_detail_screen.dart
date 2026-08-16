import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/task_model.dart';
import '../providers/pms_provider.dart';
import 'log_time_screen.dart';

class TaskDetailScreen extends ConsumerStatefulWidget {
  final String taskId;
  const TaskDetailScreen({super.key, required this.taskId});

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen> {
  bool _isUpdating = false;

  final Map<String, String> _statusLabels = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'in_review': 'In Review',
    'done': 'Done',
  };

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

  Future<void> _updateStatus(String newStatus) async {
    setState(() => _isUpdating = true);
    try {
      await ref.read(pmsRepositoryProvider).updateTask(widget.taskId, {'status': newStatus});
      ref.read(pmsTasksProvider.notifier).fetch();
      ref.invalidate(_taskDetailProvider(widget.taskId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Status updated to ${newStatus.replaceAll('_', ' ').toUpperCase()}'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final taskAsync = ref.watch(_taskDetailProvider(widget.taskId));
    final historyAsync = ref.watch(_taskHistoryProvider(widget.taskId));
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Task Detail'),
      ),
      body: taskAsync.when(
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
                onPressed: () => ref.invalidate(_taskDetailProvider(widget.taskId)),
              ),
            ],
          ),
        ),
        data: (task) => SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Header Card ──────────────────────────────────────────
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _priorityColor(task.priority).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              task.priority.toUpperCase(),
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: _priorityColor(task.priority),
                              ),
                            ),
                          ),
                          const Spacer(),
                          if (task.projectName != null)
                            Chip(
                              label: Text(task.projectName!, style: GoogleFonts.inter(fontSize: 11)),
                              backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        task.title,
                        style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      if (task.description != null && task.description!.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          task.description!,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // ── Status Update Bar ────────────────────────────────────
              Card(
                elevation: 1,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Task Status', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 10),
                      if (_isUpdating)
                        const Center(child: CircularProgressIndicator())
                      else
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _statusLabels.entries.map((entry) {
                            final selected = task.status == entry.key;
                            return ChoiceChip(
                              label: Text(entry.value),
                              selected: selected,
                              selectedColor: AppColors.primary,
                              labelStyle: GoogleFonts.inter(
                                color: selected ? Colors.black87 : null,
                                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                              ),
                              onSelected: (val) {
                                if (val && !selected) _updateStatus(entry.key);
                              },
                            );
                          }).toList(),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // ── Meta Info Grid ───────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: _InfoTile(
                      icon: Icons.calendar_today_outlined,
                      label: 'Due Date',
                      value: task.formattedDueDate,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _InfoTile(
                      icon: Icons.person_outline,
                      label: 'Assignee',
                      value: task.assigneeName ?? 'Unassigned',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _InfoTile(
                      icon: Icons.hourglass_top_outlined,
                      label: 'Estimated',
                      value: '${task.estimatedHours} hrs',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _InfoTile(
                      icon: Icons.timer_outlined,
                      label: 'Logged',
                      value: '${task.loggedHours} hrs',
                      highlight: true,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ── Log Time Action Button ───────────────────────────────
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.add_alarm_rounded),
                  label: const Text('Log Worked Hours'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.teal, foregroundColor: Colors.white),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => LogTimeScreen(taskId: task.id, taskTitle: task.title),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // ── History / Changelog Timeline ─────────────────────────
              Text('Activity History', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),

              historyAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text('Could not load history', style: GoogleFonts.inter(color: Colors.grey)),
                data: (history) {
                  if (history.isEmpty) {
                    return Text('No changes recorded yet', style: GoogleFonts.inter(fontSize: 13, color: Colors.grey));
                  }
                  return ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: history.length,
                    itemBuilder: (context, i) {
                      final item = history[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.history_rounded, size: 18, color: AppColors.primary),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item['action']?.toString() ?? item['description']?.toString() ?? 'Task updated',
                                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
                                  ),
                                  if (item['created_at'] != null)
                                    Text(
                                      item['created_at'].toString(),
                                      style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

final _taskDetailProvider = FutureProvider.family<TaskModel, String>((ref, id) async {
  return ref.watch(pmsRepositoryProvider).getTaskDetail(id);
});

final _taskHistoryProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, id) async {
  return ref.watch(pmsRepositoryProvider).getTaskHistory(id);
});

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool highlight;

  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: highlight ? AppColors.primary : Colors.grey[500]),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[500])),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: highlight ? AppColors.primary : null,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
