class ProjectModel {
  final String id;
  final String name;
  final String? description;
  final String status;
  final String? startDate;
  final String? endDate;

  ProjectModel({
    required this.id,
    required this.name,
    this.description,
    required this.status,
    this.startDate,
    this.endDate,
  });

  factory ProjectModel.fromJson(Map<String, dynamic> json) {
    return ProjectModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Untitled Project',
      description: json['description']?.toString(),
      status: json['status']?.toString() ?? 'active',
      startDate: json['start_date']?.toString(),
      endDate: json['end_date']?.toString(),
    );
  }
}
