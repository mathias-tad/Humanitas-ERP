import 'package:intl/intl.dart';

class TaskModel {
  final String id;
  final String title;
  final String? description;
  final String status; // todo | in_progress | in_review | done | cancelled
  final String priority; // low | medium | high | urgent
  final String? dueDate;
  final double estimatedHours;
  final double loggedHours;
  final String? projectId;
  final String? projectName;
  final String? assigneeId;
  final String? assigneeName;
  final String? createdAt;
  final int? storyPoints;
  final int? backlogOrder;
  final bool isMilestone;

  TaskModel({
    required this.id,
    required this.title,
    this.description,
    required this.status,
    required this.priority,
    this.dueDate,
    this.estimatedHours = 0.0,
    this.loggedHours = 0.0,
    this.projectId,
    this.projectName,
    this.assigneeId,
    this.assigneeName,
    this.createdAt,
    this.storyPoints,
    this.backlogOrder,
    this.isMilestone = false,
  });

  String get formattedDueDate {
    if (dueDate == null || dueDate!.isEmpty) return 'No due date';
    try {
      final dt = DateTime.parse(dueDate!);
      return DateFormat('MMM d, yyyy').format(dt);
    } catch (_) {
      return dueDate!;
    }
  }

  bool get isDone => status == 'done';
  bool get isInProgress => status == 'in_progress';
  bool get isTodo => status == 'todo';

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? json['name']?.toString() ?? 'Untitled Task',
      description: json['description']?.toString(),
      status: (json['status']?.toString() ?? 'todo').toLowerCase(),
      priority: (json['priority']?.toString() ?? 'medium').toLowerCase(),
      dueDate: json['due_date']?.toString() ?? json['dueDate']?.toString(),
      estimatedHours: _toDouble(json['estimated_hours'] ?? json['estimatedHours']),
      loggedHours: _toDouble(json['logged_hours'] ?? json['loggedHours'] ?? json['total_logged_hours']),
      projectId: json['project_id']?.toString() ?? json['projectId']?.toString(),
      projectName: json['project_name']?.toString() ?? json['project']?['name']?.toString(),
      assigneeId: json['assignee_id']?.toString() ?? json['assigneeId']?.toString(),
      assigneeName: json['assignee_name']?.toString() ?? json['assignee']?['full_name']?.toString(),
      createdAt: json['created_at']?.toString(),
      storyPoints: json['story_points'] != null ? int.tryParse(json['story_points'].toString()) : null,
      backlogOrder: json['backlog_order'] != null ? int.tryParse(json['backlog_order'].toString()) : null,
      isMilestone: json['is_milestone'] == true || json['is_milestone'] == 1,
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}
