import 'package:intl/intl.dart';

class PayslipModel {
  final String id;
  final double grossSalary;
  final double netSalary;
  final double totalDeductions;
  final int month;
  final int year;
  final String status;
  final String? completedAt;
  final String? runAt;

  // Detail-only fields (null on list view)
  final double? basicSalary;
  final double? taxDeduction;
  final double? pensionDeduction;
  final double? employerPension;
  final double? loanDeduction;
  final double? overtimePay;
  final String? fullName;
  final String? department;
  final String? position;
  final String? tin;
  final double? contractSalary;
  final List<Map<String, dynamic>> allowances;
  final List<Map<String, dynamic>> incomeBreakdown;

  PayslipModel({
    required this.id,
    required this.grossSalary,
    required this.netSalary,
    required this.totalDeductions,
    required this.month,
    required this.year,
    required this.status,
    this.completedAt,
    this.runAt,
    this.basicSalary,
    this.taxDeduction,
    this.pensionDeduction,
    this.employerPension,
    this.loanDeduction,
    this.overtimePay,
    this.fullName,
    this.department,
    this.position,
    this.tin,
    this.contractSalary,
    this.allowances = const [],
    this.incomeBreakdown = const [],
  });

  String get periodLabel {
    try {
      final dt = DateTime(year, month);
      return DateFormat('MMMM yyyy').format(dt);
    } catch (_) {
      return '$month / $year';
    }
  }

  factory PayslipModel.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> parseJsonList(dynamic raw) {
      if (raw == null) return [];
      if (raw is List) return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      return [];
    }

    return PayslipModel(
      id: json['id']?.toString() ?? '',
      grossSalary: _toDouble(json['gross_salary']),
      netSalary: _toDouble(json['net_salary']),
      totalDeductions: _toDouble(json['total_deductions']),
      month: _toInt(json['month']),
      year: _toInt(json['year']),
      status: json['status']?.toString() ?? 'completed',
      completedAt: json['completed_at']?.toString(),
      runAt: json['run_at']?.toString(),
      basicSalary: json.containsKey('basic_salary') ? _toDouble(json['basic_salary']) : null,
      taxDeduction: json.containsKey('tax_deduction') ? _toDouble(json['tax_deduction']) : null,
      pensionDeduction: json.containsKey('pension_deduction') ? _toDouble(json['pension_deduction']) : null,
      employerPension: json.containsKey('employer_pension') ? _toDouble(json['employer_pension']) : null,
      loanDeduction: json.containsKey('loan_deduction') ? _toDouble(json['loan_deduction']) : null,
      overtimePay: json.containsKey('overtime_pay') ? _toDouble(json['overtime_pay']) : null,
      fullName: json['full_name']?.toString(),
      department: json['department']?.toString(),
      position: json['position']?.toString(),
      tin: json['tin']?.toString(),
      contractSalary: json.containsKey('contract_salary') ? _toDouble(json['contract_salary']) : null,
      allowances: parseJsonList(json['allowances']),
      incomeBreakdown: parseJsonList(json['income_breakdown']),
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }

  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    return int.tryParse(v.toString()) ?? 0;
  }
}
