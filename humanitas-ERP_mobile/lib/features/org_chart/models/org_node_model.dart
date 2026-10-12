class OrgNodeModel {
  final String id;
  final String fullName;
  final String email;
  final String? phone;
  final String role;
  final String? department;
  final String? position;
  final String? avatarUrl;
  final String? managerId;
  final String? managerName;
  final int directReportsCount;
  final int teamCount;
  final List<OrgNodeModel> children;

  OrgNodeModel({
    required this.id,
    required this.fullName,
    required this.email,
    this.phone,
    required this.role,
    this.department,
    this.position,
    this.avatarUrl,
    this.managerId,
    this.managerName,
    required this.directReportsCount,
    required this.teamCount,
    this.children = const [],
  });

  factory OrgNodeModel.fromJson(Map<String, dynamic> json) {
    return OrgNodeModel(
      id: json['id'] as String,
      fullName: json['full_name'] as String? ?? 'Unknown',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      role: json['role'] as String? ?? 'employee',
      department: json['department'] as String?,
      position: json['position'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      managerId: json['manager_id'] as String?,
      managerName: json['manager_name'] as String?,
      directReportsCount: (json['direct_reports_count'] as num?)?.toInt() ?? 0,
      teamCount: (json['team_count'] as num?)?.toInt() ?? 0,
      children: (json['children'] as List<dynamic>?)
              ?.map((e) => OrgNodeModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
