class LeaveTypeModel {
  final String id;
  final String name;
  final String? description;
  final int defaultDays;

  LeaveTypeModel({
    required this.id,
    required this.name,
    this.description,
    this.defaultDays = 0,
  });

  factory LeaveTypeModel.fromJson(Map<String, dynamic> json) {
    return LeaveTypeModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      defaultDays: json['default_days'] ?? json['max_days'] ?? 0,
    );
  }
}
