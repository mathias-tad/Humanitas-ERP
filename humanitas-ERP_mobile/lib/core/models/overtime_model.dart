import 'package:intl/intl.dart';

class OvertimeModel {
  final String id;
  final String date;
  final double hours;
  final double rateMultiplier;
  final String status; // pending | approved | rejected
  final String? reason;
  final String? approvedBy;
  final String? createdAt;

  OvertimeModel({
    required this.id,
    required this.date,
    required this.hours,
    this.rateMultiplier = 1.5,
    required this.status,
    this.reason,
    this.approvedBy,
    this.createdAt,
  });

  String get formattedDate {
    if (date.isEmpty) return '';
    try {
      final dt = DateTime.parse(date);
      return DateFormat('MMM d, yyyy').format(dt);
    } catch (_) {
      return date;
    }
  }

  factory OvertimeModel.fromJson(Map<String, dynamic> json) {
    return OvertimeModel(
      id: json['id']?.toString() ?? '',
      date: json['date']?.toString() ?? json['overtime_date']?.toString() ?? '',
      hours: _toDouble(json['hours'] ?? json['overtime_hours']),
      rateMultiplier: _toDouble(json['rate_multiplier'] ?? json['rate'] ?? 1.5),
      status: (json['status']?.toString() ?? 'pending').toLowerCase(),
      reason: json['reason']?.toString(),
      approvedBy: json['approved_by']?.toString(),
      createdAt: json['created_at']?.toString(),
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}
