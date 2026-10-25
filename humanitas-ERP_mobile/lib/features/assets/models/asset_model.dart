class AssetCategoryModel {
  final String id;
  final String name;
  final String? code;
  final String? description;

  const AssetCategoryModel({
    required this.id,
    required this.name,
    this.code,
    this.description,
  });

  factory AssetCategoryModel.fromJson(Map<String, dynamic> json) {
    return AssetCategoryModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString(),
      description: json['description']?.toString(),
    );
  }
}

class CompanyAssetModel {
  final String id;
  final String name;
  final String? model;
  final String? serialNumber;
  final String assetTag;
  final String? categoryId;
  final String? categoryName;
  final String status; // available, assigned, maintenance, repair, retired, lost
  final String currentCondition;
  final double purchaseCost;
  final String? purchaseDate;
  final String? warrantyExpiry;
  final String? location;
  final String? notes;
  final String? currentAssignedUserId;
  final String? firstName;
  final String? lastName;
  final String? assignedUserDepartment;
  final String? assignmentId;
  final String? assignedDate;
  final String? expectedReturnDate;
  final String? acknowledgedAt;

  const CompanyAssetModel({
    required this.id,
    required this.name,
    this.model,
    this.serialNumber,
    required this.assetTag,
    this.categoryId,
    this.categoryName,
    required this.status,
    required this.currentCondition,
    this.purchaseCost = 0.0,
    this.purchaseDate,
    this.warrantyExpiry,
    this.location,
    this.notes,
    this.currentAssignedUserId,
    this.firstName,
    this.lastName,
    this.assignedUserDepartment,
    this.assignmentId,
    this.assignedDate,
    this.expectedReturnDate,
    this.acknowledgedAt,
  });

  String get assignedUserName => [firstName, lastName].where((s) => s != null && s.isNotEmpty).join(' ');

  factory CompanyAssetModel.fromJson(Map<String, dynamic> json) {
    return CompanyAssetModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      model: json['model']?.toString(),
      serialNumber: json['serial_number']?.toString(),
      assetTag: json['asset_tag']?.toString() ?? '',
      categoryId: json['category_id']?.toString(),
      categoryName: json['category_name']?.toString(),
      status: json['status']?.toString() ?? 'available',
      currentCondition: json['current_condition']?.toString() ?? 'good',
      purchaseCost: double.tryParse(json['purchase_cost']?.toString() ?? '0') ?? 0.0,
      purchaseDate: json['purchase_date']?.toString(),
      warrantyExpiry: json['warranty_expiry']?.toString(),
      location: json['location']?.toString(),
      notes: json['notes']?.toString(),
      currentAssignedUserId: json['current_assigned_user_id']?.toString(),
      firstName: json['first_name']?.toString(),
      lastName: json['last_name']?.toString(),
      assignedUserDepartment: json['assigned_user_department']?.toString(),
      assignmentId: json['assignment_id']?.toString(),
      assignedDate: json['assigned_date']?.toString(),
      expectedReturnDate: json['expected_return_date']?.toString(),
      acknowledgedAt: json['acknowledged_at']?.toString(),
    );
  }
}

class AssetAnalyticsModel {
  final int totalAssets;
  final int availableCount;
  final int assignedCount;
  final int maintenanceCount;
  final int retiredCount;
  final double totalValuation;

  const AssetAnalyticsModel({
    required this.totalAssets,
    required this.availableCount,
    required this.assignedCount,
    required this.maintenanceCount,
    required this.retiredCount,
    required this.totalValuation,
  });

  factory AssetAnalyticsModel.fromJson(Map<String, dynamic> json) {
    return AssetAnalyticsModel(
      totalAssets: int.tryParse(json['total_assets']?.toString() ?? '0') ?? 0,
      availableCount: int.tryParse(json['available_count']?.toString() ?? '0') ?? 0,
      assignedCount: int.tryParse(json['assigned_count']?.toString() ?? '0') ?? 0,
      maintenanceCount: int.tryParse(json['maintenance_count']?.toString() ?? '0') ?? 0,
      retiredCount: int.tryParse(json['retired_count']?.toString() ?? '0') ?? 0,
      totalValuation: double.tryParse(json['total_valuation']?.toString() ?? '0') ?? 0.0,
    );
  }
}
