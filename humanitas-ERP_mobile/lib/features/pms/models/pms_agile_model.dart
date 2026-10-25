class SprintModel {
  final String id;
  final String projectId;
  final String name;
  final String? goal;
  final String status; // 'planned' | 'active' | 'completed'
  final String? startDate;
  final String? endDate;
  final int totalPoints;
  final int completedPoints;

  const SprintModel({
    required this.id,
    required this.projectId,
    required this.name,
    this.goal,
    required this.status,
    this.startDate,
    this.endDate,
    this.totalPoints = 0,
    this.completedPoints = 0,
  });

  bool get isActive => status == 'active';
  bool get isCompleted => status == 'completed';

  factory SprintModel.fromJson(Map<String, dynamic> json) {
    return SprintModel(
      id: json['id']?.toString() ?? '',
      projectId: json['project_id']?.toString() ?? json['projectId']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Sprint',
      goal: json['goal']?.toString(),
      status: (json['status']?.toString() ?? 'planned').toLowerCase(),
      startDate: json['start_date']?.toString(),
      endDate: json['end_date']?.toString(),
      totalPoints: int.tryParse(json['total_points']?.toString() ?? json['totalPoints']?.toString() ?? '0') ?? 0,
      completedPoints: int.tryParse(json['completed_points']?.toString() ?? json['completedPoints']?.toString() ?? '0') ?? 0,
    );
  }
}

class SprintBurndownDay {
  final int day;
  final String date;
  final double idealPoints;
  final double remainingPoints;

  const SprintBurndownDay({
    required this.day,
    required this.date,
    required this.idealPoints,
    required this.remainingPoints,
  });

  factory SprintBurndownDay.fromJson(Map<String, dynamic> json) {
    return SprintBurndownDay(
      day: int.tryParse(json['day']?.toString() ?? '1') ?? 1,
      date: json['date']?.toString() ?? '',
      idealPoints: double.tryParse(json['ideal_points']?.toString() ?? json['idealPoints']?.toString() ?? '0') ?? 0.0,
      remainingPoints: double.tryParse(json['remaining_points']?.toString() ?? json['remainingPoints']?.toString() ?? '0') ?? 0.0,
    );
  }
}

class SprintBurndownModel {
  final String sprintId;
  final String sprintName;
  final double totalPoints;
  final List<SprintBurndownDay> days;

  const SprintBurndownModel({
    required this.sprintId,
    required this.sprintName,
    required this.totalPoints,
    required this.days,
  });

  factory SprintBurndownModel.fromJson(Map<String, dynamic> json) {
    final sprintMap = json['sprint'] as Map<String, dynamic>? ?? {};
    final daysList = json['days'] as List<dynamic>? ?? [];
    return SprintBurndownModel(
      sprintId: sprintMap['id']?.toString() ?? json['sprintId']?.toString() ?? '',
      sprintName: sprintMap['name']?.toString() ?? json['sprintName']?.toString() ?? 'Sprint',
      totalPoints: double.tryParse(json['total_points']?.toString() ?? json['totalPoints']?.toString() ?? '0') ?? 0.0,
      days: daysList
          .map((e) => SprintBurndownDay.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }
}

class SprintVelocityModel {
  final double averageVelocity;
  final List<Map<String, dynamic>> sprints;

  const SprintVelocityModel({
    required this.averageVelocity,
    required this.sprints,
  });

  factory SprintVelocityModel.fromJson(Map<String, dynamic> json) {
    final list = json['sprints'] as List<dynamic>? ?? [];
    return SprintVelocityModel(
      averageVelocity: double.tryParse(json['average_velocity']?.toString() ?? json['averageVelocity']?.toString() ?? '0') ?? 0.0,
      sprints: list.map((e) => Map<String, dynamic>.from(e as Map)).toList(),
    );
  }
}

class GanttTaskModel {
  final String id;
  final String title;
  final String status;
  final String priority;
  final String startDate;
  final String dueDate;
  final int progress;
  final bool isMilestone;
  final int? storyPoints;

  const GanttTaskModel({
    required this.id,
    required this.title,
    required this.status,
    required this.priority,
    required this.startDate,
    required this.dueDate,
    this.progress = 0,
    this.isMilestone = false,
    this.storyPoints,
  });

  factory GanttTaskModel.fromJson(Map<String, dynamic> json) {
    return GanttTaskModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Task',
      status: json['status']?.toString() ?? 'To Do',
      priority: json['priority']?.toString() ?? 'Medium',
      startDate: json['start_date']?.toString() ?? json['startDate']?.toString() ?? '',
      dueDate: json['due_date']?.toString() ?? json['dueDate']?.toString() ?? '',
      progress: int.tryParse(json['progress']?.toString() ?? '0') ?? 0,
      isMilestone: json['is_milestone'] == true || json['is_milestone'] == 1,
      storyPoints: json['story_points'] != null ? int.tryParse(json['story_points'].toString()) : null,
    );
  }
}

class ProjectCalendarEventModel {
  final String id;
  final String title;
  final String type; // 'sprint' | 'milestone' | 'task'
  final String start;
  final String? end;
  final String? priority;
  final bool isMilestone;
  final String? assigneeName;

  const ProjectCalendarEventModel({
    required this.id,
    required this.title,
    required this.type,
    required this.start,
    this.end,
    this.priority,
    this.isMilestone = false,
    this.assigneeName,
  });

  factory ProjectCalendarEventModel.fromJson(Map<String, dynamic> json) {
    return ProjectCalendarEventModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Event',
      type: json['type']?.toString() ?? 'task',
      start: json['start']?.toString() ?? '',
      end: json['end']?.toString(),
      priority: json['priority']?.toString(),
      isMilestone: json['is_milestone'] == true || json['is_milestone'] == 1 || json['type'] == 'milestone',
      assigneeName: json['assignee_name']?.toString() ?? json['assigneeName']?.toString(),
    );
  }
}

class TimeTrackingSummaryModel {
  final double totalHours;
  final double billableHours;
  final double nonBillableHours;
  final double billableRatio;
  final double totalBillableRevenue;
  final List<Map<String, dynamic>> members;

  const TimeTrackingSummaryModel({
    required this.totalHours,
    required this.billableHours,
    required this.nonBillableHours,
    required this.billableRatio,
    required this.totalBillableRevenue,
    required this.members,
  });

  factory TimeTrackingSummaryModel.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'] as Map<String, dynamic>? ?? {};
    final memberList = json['members'] as List<dynamic>? ?? [];
    return TimeTrackingSummaryModel(
      totalHours: double.tryParse(totals['total_hours']?.toString() ?? '0') ?? 0.0,
      billableHours: double.tryParse(totals['billable_hours']?.toString() ?? '0') ?? 0.0,
      nonBillableHours: double.tryParse(totals['non_billable_hours']?.toString() ?? '0') ?? 0.0,
      billableRatio: double.tryParse(totals['billable_ratio']?.toString() ?? '0') ?? 0.0,
      totalBillableRevenue: double.tryParse(totals['total_billable_revenue']?.toString() ?? '0') ?? 0.0,
      members: memberList.map((e) => Map<String, dynamic>.from(e as Map)).toList(),
    );
  }
}
