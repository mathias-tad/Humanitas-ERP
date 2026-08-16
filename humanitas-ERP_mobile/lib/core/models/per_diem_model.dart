import 'package:intl/intl.dart';

class PerDiemModel {
  final String id;
  final int month;
  final int year;
  final String status; // PENDING_CHOICE | PENDING_REVIEW | APPROVED | REJECTED
  final String? choice; // WITH_RECEIPT | WITHOUT_RECEIPT | null
  final double? receiptAmount;
  final double? approvedAmount;
  final double? calculatedAmount;
  final String? receiptUrl;
  final String? rejectionReason;
  final bool hasReceipt;
  final String? createdAt;

  PerDiemModel({
    required this.id,
    required this.month,
    required this.year,
    required this.status,
    this.choice,
    this.receiptAmount,
    this.approvedAmount,
    this.calculatedAmount,
    this.receiptUrl,
    this.rejectionReason,
    this.hasReceipt = false,
    this.createdAt,
  });

  String get periodLabel {
    try {
      return DateFormat('MMMM yyyy').format(DateTime(year, month));
    } catch (_) {
      return '$month / $year';
    }
  }

  bool get isPendingChoice => status == 'PENDING_CHOICE';
  bool get isPendingReview => status == 'PENDING_REVIEW';
  bool get isApproved => status == 'APPROVED';
  bool get isRejected => status == 'REJECTED';

  factory PerDiemModel.fromJson(Map<String, dynamic> json) {
    return PerDiemModel(
      id: json['id']?.toString() ?? '',
      month: _toInt(json['month']),
      year: _toInt(json['year']),
      status: json['status']?.toString() ?? 'PENDING_CHOICE',
      choice: json['choice']?.toString(),
      receiptAmount: _toDoubleOpt(json['receipt_amount']),
      approvedAmount: _toDoubleOpt(json['approved_amount']),
      calculatedAmount: _toDoubleOpt(json['calculated_amount']),
      receiptUrl: json['receipt_url']?.toString(),
      rejectionReason: json['rejection_reason']?.toString(),
      hasReceipt: json['has_receipt'] == true,
      createdAt: json['created_at']?.toString(),
    );
  }

  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    return int.tryParse(v.toString()) ?? 0;
  }

  static double? _toDoubleOpt(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString());
  }
}
