class CompanyModel {
  final String id;
  final String name;
  final String? legalName;
  final String? industry;
  final String? city;
  final String? country;
  final String? phone;
  final String? email;
  final bool isDefault;
  final bool isActive;

  const CompanyModel({
    required this.id,
    required this.name,
    this.legalName,
    this.industry,
    this.city,
    this.country,
    this.phone,
    this.email,
    required this.isDefault,
    required this.isActive,
  });

  factory CompanyModel.fromJson(Map<String, dynamic> json) => CompanyModel(
    id: json['id'] as String,
    name: json['name'] as String,
    legalName: json['legal_name'] as String?,
    industry: json['industry'] as String?,
    city: json['city'] as String?,
    country: json['country'] as String?,
    phone: json['phone'] as String?,
    email: json['email'] as String?,
    isDefault: json['is_default'] as bool? ?? false,
    isActive: json['is_active'] as bool? ?? true,
  );
}
