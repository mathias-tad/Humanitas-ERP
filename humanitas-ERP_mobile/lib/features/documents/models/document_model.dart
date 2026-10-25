class EmployeeDocumentModel {
  final String id;
  final String userId;
  final String? firstName;
  final String? lastName;
  final String? email;
  final String? department;
  final String? position;
  final String title;
  final String category;
  final String documentType;
  final String fileUrl;
  final String fileName;
  final int fileSize;
  final String mimeType;
  final DateTime? issueDate;
  final DateTime? expiryDate;
  final String verificationStatus;
  final String? verifiedBy;
  final DateTime? verifiedAt;
  final String signatureStatus;
  final String? notes;
  final bool isConfidential;
  final String expiryStatus;
  final int? daysUntilExpiry;

  const EmployeeDocumentModel({
    required this.id,
    required this.userId,
    this.firstName,
    this.lastName,
    this.email,
    this.department,
    this.position,
    required this.title,
    required this.category,
    required this.documentType,
    required this.fileUrl,
    required this.fileName,
    this.fileSize = 0,
    this.mimeType = 'application/pdf',
    this.issueDate,
    this.expiryDate,
    this.verificationStatus = 'pending',
    this.verifiedBy,
    this.verifiedAt,
    this.signatureStatus = 'not_required',
    this.notes,
    this.isConfidential = false,
    this.expiryStatus = 'no_expiry',
    this.daysUntilExpiry,
  });

  String get employeeFullName {
    final fn = firstName?.trim() ?? '';
    final ln = lastName?.trim() ?? '';
    final full = '$fn $ln'.trim();
    return full.isNotEmpty ? full : (email ?? 'Employee');
  }

  factory EmployeeDocumentModel.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic d) {
      if (d == null) return null;
      try {
        return DateTime.parse(d.toString());
      } catch (_) {
        return null;
      }
    }

    return EmployeeDocumentModel(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      firstName: json['first_name']?.toString(),
      lastName: json['last_name']?.toString(),
      email: json['email']?.toString(),
      department: json['department']?.toString(),
      position: json['position']?.toString(),
      title: json['title']?.toString() ?? 'Document',
      category: json['category']?.toString() ?? 'other',
      documentType: json['document_type']?.toString() ?? 'general',
      fileUrl: json['file_url']?.toString() ?? '',
      fileName: json['file_name']?.toString() ?? 'file.pdf',
      fileSize: json['file_size'] != null ? int.tryParse(json['file_size'].toString()) ?? 0 : 0,
      mimeType: json['mime_type']?.toString() ?? 'application/pdf',
      issueDate: parseDate(json['issue_date']),
      expiryDate: parseDate(json['expiry_date']),
      verificationStatus: json['verification_status']?.toString() ?? 'pending',
      verifiedBy: json['verified_by']?.toString(),
      verifiedAt: parseDate(json['verified_at']),
      signatureStatus: json['signature_status']?.toString() ?? 'not_required',
      notes: json['notes']?.toString(),
      isConfidential: json['is_confidential'] == true,
      expiryStatus: json['expiry_status']?.toString() ?? 'no_expiry',
      daysUntilExpiry: json['days_until_expiry'] != null ? int.tryParse(json['days_until_expiry'].toString()) : null,
    );
  }
}

class ExpiringDocumentsSummaryModel {
  final int expiredCount;
  final int expiring30Days;
  final int expiring60Days;
  final int expiring90Days;
  final int totalActiveTracked;
  final List<EmployeeDocumentModel> upcomingExpiringDocuments;

  const ExpiringDocumentsSummaryModel({
    required this.expiredCount,
    required this.expiring30Days,
    required this.expiring60Days,
    required this.expiring90Days,
    required this.totalActiveTracked,
    required this.upcomingExpiringDocuments,
  });

  factory ExpiringDocumentsSummaryModel.fromJson(Map<String, dynamic> json) {
    final list = (json['upcomingExpiringDocuments'] as List<dynamic>?)
            ?.map((e) => EmployeeDocumentModel.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return ExpiringDocumentsSummaryModel(
      expiredCount: int.tryParse(json['expiredCount']?.toString() ?? '0') ?? 0,
      expiring30Days: int.tryParse(json['expiring30Days']?.toString() ?? '0') ?? 0,
      expiring60Days: int.tryParse(json['expiring60Days']?.toString() ?? '0') ?? 0,
      expiring90Days: int.tryParse(json['expiring90Days']?.toString() ?? '0') ?? 0,
      totalActiveTracked: int.tryParse(json['totalActiveTracked']?.toString() ?? '0') ?? 0,
      upcomingExpiringDocuments: list,
    );
  }
}
