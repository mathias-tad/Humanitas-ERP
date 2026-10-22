class UserModel {
  final String id;
  final String displayName;
  final String email;
  final String? position;
  final String? department;
  final String role;
  final bool isActive;
  final String? avatarUrl;
  final String? phone;
  final String? employeeId;
  final String? hireDate;
  final String? companyId;
  final String? branchId;

  const UserModel({
    required this.id,
    required this.displayName,
    required this.email,
    this.position,
    this.department,
    required this.role,
    required this.isActive,
    this.avatarUrl,
    this.phone,
    this.employeeId,
    this.hireDate,
    this.companyId,
    this.branchId,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      displayName: json['display_name']?.toString() ??
          json['displayName']?.toString() ??
          '${json['first_name'] ?? ''} ${json['last_name'] ?? ''}'.trim(),
      email: json['email']?.toString() ?? '',
      position: json['position']?.toString(),
      department: json['department']?.toString(),
      role: json['role']?.toString() ?? 'employee',
      isActive: json['is_active'] == true || json['isActive'] == true || json['status'] == 'active',
      avatarUrl: json['avatar_url']?.toString() ?? json['avatarUrl']?.toString(),
      phone: json['phone']?.toString(),
      employeeId: json['employee_id']?.toString() ?? json['employeeId']?.toString(),
      hireDate: json['hire_date']?.toString() ?? json['hireDate']?.toString(),
      companyId: json['company_id']?.toString() ?? json['companyId']?.toString(),
      branchId: json['branch_id']?.toString() ?? json['branchId']?.toString(),
    );
  }
}
