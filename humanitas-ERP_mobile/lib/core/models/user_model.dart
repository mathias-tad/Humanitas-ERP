class UserModel {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? fullName;
  final String role;
  final String? tenantId;
  final String? tenantSlug;
  final String? avatarUrl;
  final String? position;
  final String? department;
  final String? phoneNumber;

  UserModel({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    this.fullName,
    required this.role,
    this.tenantId,
    this.tenantSlug,
    this.avatarUrl,
    this.position,
    this.department,
    this.phoneNumber,
  });

  String get displayName {
    if (fullName != null && fullName!.isNotEmpty) return fullName!;
    if (firstName != null && lastName != null && firstName!.isNotEmpty && lastName!.isNotEmpty) {
      return '$firstName $lastName';
    }
    if (firstName != null && firstName!.isNotEmpty) return firstName!;
    if (email.isNotEmpty && email.contains('@')) return email.split('@').first;
    return 'User';
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    String? fn = json['first_name'] ?? json['firstName'];
    String? ln = json['last_name'] ?? json['lastName'];
    final full = json['full_name'] ?? json['fullName'] ?? json['name'];

    // Auto-split full_name into first_name and last_name if first_name was null
    if ((fn == null || fn.isEmpty) && full != null && full.isNotEmpty) {
      final parts = full.trim().split(' ');
      fn = parts.first;
      if (parts.length > 1) {
        ln = parts.sublist(1).join(' ');
      }
    }

    String? deptStr;
    if (json['department'] != null) {
      if (json['department'] is Map) {
        deptStr = json['department']['name']?.toString() ?? json['department']['title']?.toString();
      } else {
        deptStr = json['department'].toString();
      }
    }

    return UserModel(
      id: json['id']?.toString() ?? json['sub']?.toString() ?? json['_id']?.toString() ?? '',
      email: json['email'] ?? '',
      firstName: fn,
      lastName: ln,
      fullName: full,
      role: json['role'] ?? 'employee',
      tenantId: json['tenantId']?.toString() ?? json['tenant_id']?.toString(),
      tenantSlug: json['tenantSlug'] ?? json['tenant_slug'],
      avatarUrl: json['avatar_url'] ?? json['avatarUrl'] ?? json['avatar'],
      position: json['position'] ?? json['job_title'] ?? json['jobTitle'] ?? json['title'],
      department: deptStr,
      phoneNumber: json['phone_number'] ?? json['phoneNumber'] ?? json['phone'] ?? json['mobile'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'full_name': fullName,
      'role': role,
      'tenant_id': tenantId,
      'tenant_slug': tenantSlug,
      'avatar_url': avatarUrl,
      'position': position,
      'department': department,
      'phone_number': phoneNumber,
    };
  }
}
