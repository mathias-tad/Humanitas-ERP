class AnnouncementModel {
  final String id;
  final String title;
  final String content;
  final String? authorId;
  final String? authorName;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  AnnouncementModel({
    required this.id,
    required this.title,
    required this.content,
    this.authorId,
    this.authorName,
    this.createdAt,
    this.updatedAt,
  });

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    return AnnouncementModel(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? '',
      content: json['content'] ?? json['body'] ?? '',
      authorId: json['author_id']?.toString() ?? json['created_by']?.toString(),
      authorName: json['author_name'] ?? json['author']?['full_name'],
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString())
          : null,
    );
  }
}
