/// Models for shift patterns and user roster assignments.
class ShiftPatternModel {
  final String id;
  final String name;

  /// e.g. 'fixed', 'rotating'
  final String rotationType;

  /// Number of weeks in the rotation cycle (null for fixed).
  final int? totalWeeks;
  final String? description;

  const ShiftPatternModel({
    required this.id,
    required this.name,
    required this.rotationType,
    this.totalWeeks,
    this.description,
  });

  factory ShiftPatternModel.fromJson(Map<String, dynamic> json) {
    return ShiftPatternModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Unnamed Pattern',
      rotationType: json['rotation_type']?.toString() ??
          json['rotationType']?.toString() ??
          'fixed',
      totalWeeks: json['total_weeks'] as int? ?? json['totalWeeks'] as int?,
      description: json['description']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'rotation_type': rotationType,
        'total_weeks': totalWeeks,
        'description': description,
      };
}

/// Represents a user enriched with their current shift assignment info.
class UserWithAssignmentModel {
  final String id;
  final String fullName;
  final String? email;
  final String? department;
  final String? position;
  final String? avatarUrl;

  /// ID of the currently assigned [ShiftPatternModel], or null = Standard.
  final String? patternId;
  final String? patternName;

  /// Which week in the rotation the user is currently on (1-based).
  final int currentWeekInRotation;

  /// Days that are off: 0 = Monday … 6 = Sunday.
  final List<int> dayOffDays;

  /// Whether day-offs advance by 1 day each week automatically.
  final bool autoRotateDayoff;

  const UserWithAssignmentModel({
    required this.id,
    required this.fullName,
    this.email,
    this.department,
    this.position,
    this.avatarUrl,
    this.patternId,
    this.patternName,
    this.currentWeekInRotation = 1,
    this.dayOffDays = const [],
    this.autoRotateDayoff = false,
  });

  factory UserWithAssignmentModel.fromJson(Map<String, dynamic> json) {
    // day_off_days may come as List<dynamic> of ints
    List<int> parseDayOffDays(dynamic raw) {
      if (raw == null) return [];
      if (raw is List) {
        return raw.map((e) => (e as num).toInt()).toList();
      }
      return [];
    }

    // Support nested 'user' object or flat structure
    final userMap = json['user'] as Map<String, dynamic>? ?? json;

    String resolveFullName() {
      final full = userMap['full_name'] ?? userMap['fullName'] ?? userMap['name'];
      if (full != null && full.toString().isNotEmpty) return full.toString();
      final first = userMap['first_name'] ?? userMap['firstName'] ?? '';
      final last = userMap['last_name'] ?? userMap['lastName'] ?? '';
      final combined = '$first $last'.trim();
      if (combined.isNotEmpty) return combined;
      return userMap['email']?.toString().split('@').first ?? 'Unknown';
    }

    String? resolveDept() {
      final d = userMap['department'];
      if (d == null) return null;
      if (d is Map) return d['name']?.toString() ?? d['title']?.toString();
      return d.toString();
    }

    return UserWithAssignmentModel(
      id: userMap['id']?.toString() ??
          json['user_id']?.toString() ??
          json['userId']?.toString() ??
          '',
      fullName: resolveFullName(),
      email: userMap['email']?.toString(),
      department: resolveDept(),
      position: userMap['position']?.toString() ??
          userMap['job_title']?.toString() ??
          userMap['jobTitle']?.toString(),
      avatarUrl: userMap['avatar_url']?.toString() ??
          userMap['avatarUrl']?.toString() ??
          userMap['avatar']?.toString(),
      patternId: json['pattern_id']?.toString() ?? json['patternId']?.toString(),
      patternName: json['pattern_name']?.toString() ??
          json['patternName']?.toString() ??
          (json['pattern'] as Map<String, dynamic>?)?['name']?.toString(),
      currentWeekInRotation:
          (json['current_week_in_rotation'] as int?) ??
              (json['currentWeekInRotation'] as int?) ??
              1,
      dayOffDays: parseDayOffDays(
          json['day_off_days'] ?? json['dayOffDays']),
      autoRotateDayoff: json['auto_rotate_dayoff'] == true ||
          json['autoRotateDayoff'] == true,
    );
  }
}
