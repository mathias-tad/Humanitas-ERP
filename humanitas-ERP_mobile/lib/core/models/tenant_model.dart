class TenantModel {
  final String id;
  final String name;
  final String slug;
  final String? logoUrl;

  TenantModel({
    required this.id,
    required this.name,
    required this.slug,
    this.logoUrl,
  });

  factory TenantModel.fromJson(Map<String, dynamic> json) {
    return TenantModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      logoUrl: json['logo_url'] ?? json['logoUrl'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'slug': slug,
      'logo_url': logoUrl,
    };
  }
}
