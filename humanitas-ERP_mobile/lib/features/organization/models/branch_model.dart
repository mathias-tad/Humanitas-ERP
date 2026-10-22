class BranchModel {
  final String id;
  final String companyId;
  final String? companyName;
  final String name;
  final String? code;
  final String? city;
  final String? country;
  final String? phone;
  final String? email;
  final bool isDefault;
  final bool isActive;

  const BranchModel({
    required this.id,
    required this.companyId,
    this.companyName,
    required this.name,
    this.code,
    this.city,
    this.country,
    this.phone,
    this.email,
    required this.isDefault,
    required this.isActive,
  });

  factory BranchModel.fromJson(Map<String, dynamic> json) => BranchModel(
    id: json['id'] as String,
    companyId: json['company_id'] as String? ?? '',
    companyName: json['company_name'] as String?,
    name: json['name'] as String,
    code: json['code'] as String?,
    city: json['city'] as String?,
    country: json['country'] as String?,
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    isDefault: json['is_default'] as bool? ?? false,
    isActive: json['is_active'] as bool? ?? true,
  );
}
