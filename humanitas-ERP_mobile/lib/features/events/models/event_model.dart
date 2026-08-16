class EventModel {
  final String id;
  final String title;
  final String? description;
  final String? location;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? createdBy;
  final DateTime? createdAt;

  EventModel({
    required this.id,
    required this.title,
    this.description,
    this.location,
    this.startDate,
    this.endDate,
    this.createdBy,
    this.createdAt,
  });

  factory EventModel.fromJson(Map<String, dynamic> json) {
    return EventModel(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? json['content'],
      location: json['location'],
      startDate: json['start_date'] != null
          ? DateTime.tryParse(json['start_date'].toString())
          : null,
      endDate: json['end_date'] != null
          ? DateTime.tryParse(json['end_date'].toString())
          : null,
      createdBy: json['created_by']?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
    );
  }
}
