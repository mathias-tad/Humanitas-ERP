import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/payslip_model.dart';
import '../providers/finance_provider.dart';

class PayslipDetailScreen extends ConsumerWidget {
  final String payslipId;
  const PayslipDetailScreen({super.key, required this.payslipId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(_payslipDetailProvider(payslipId));
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currency = NumberFormat.currency(symbol: 'ETB ', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Payslip Detail'),
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      ),
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(
                e.toString().replaceAll('Exception: ', ''),
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                onPressed: () => ref.invalidate(_payslipDetailProvider(payslipId)),
              ),
            ],
          ),
        ),
        data: (slip) => SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Header ──────────────────────────────────────────────
              _HeaderCard(slip: slip, isDark: isDark),
              const SizedBox(height: 16),

              // ── Employee Info ────────────────────────────────────────
              if (slip.fullName != null)
                _SectionCard(
                  title: 'Employee Information',
                  icon: Icons.person_outline,
                  isDark: isDark,
                  children: [
                    _InfoRow('Name', slip.fullName ?? ''),
                    if (slip.department != null) _InfoRow('Department', slip.department!),
                    if (slip.position != null) _InfoRow('Position', slip.position!),
                    if (slip.tin != null && slip.tin!.isNotEmpty) _InfoRow('TIN', slip.tin!),
                  ],
                ),
              if (slip.fullName != null) const SizedBox(height: 16),

              // ── Earnings ─────────────────────────────────────────────
              _SectionCard(
                title: 'Earnings',
                icon: Icons.trending_up_rounded,
                isDark: isDark,
                children: [
                  if (slip.basicSalary != null)
                    _InfoRow('Basic Salary', currency.format(slip.basicSalary)),
                  if (slip.overtimePay != null && slip.overtimePay! > 0)
                    _InfoRow('Overtime Pay', currency.format(slip.overtimePay)),
                  ...slip.allowances.map((a) => _InfoRow(
                        a['name']?.toString() ?? a['income_type_name']?.toString() ?? 'Allowance',
                        currency.format(double.tryParse(a['amount']?.toString() ?? '0') ?? 0),
                      )),
                  ...slip.incomeBreakdown
                      .where((b) => (b['type']?.toString() ?? '') != 'deduction')
                      .map((b) => _InfoRow(
                            b['name']?.toString() ?? 'Income',
                            currency.format(double.tryParse(b['amount']?.toString() ?? '0') ?? 0),
                          )),
                  const Divider(height: 16),
                  _InfoRow('Gross Salary', currency.format(slip.grossSalary),
                      bold: true, color: AppColors.success),
                ],
              ),
              const SizedBox(height: 16),

              // ── Deductions ────────────────────────────────────────────
              _SectionCard(
                title: 'Deductions',
                icon: Icons.trending_down_rounded,
                isDark: isDark,
                children: [
                  if (slip.taxDeduction != null && slip.taxDeduction! > 0)
                    _InfoRow('Income Tax', currency.format(slip.taxDeduction)),
                  if (slip.pensionDeduction != null && slip.pensionDeduction! > 0)
                    _InfoRow('Employee Pension', currency.format(slip.pensionDeduction)),
                  if (slip.employerPension != null && slip.employerPension! > 0)
                    _InfoRow('Employer Pension', currency.format(slip.employerPension)),
                  if (slip.loanDeduction != null && slip.loanDeduction! > 0)
                    _InfoRow('Loan Repayment', currency.format(slip.loanDeduction)),
                  ...slip.incomeBreakdown
                      .where((b) => (b['type']?.toString() ?? '') == 'deduction')
                      .map((b) => _InfoRow(
                            b['name']?.toString() ?? 'Deduction',
                            currency.format(double.tryParse(b['amount']?.toString() ?? '0') ?? 0),
                          )),
                  const Divider(height: 16),
                  _InfoRow('Total Deductions', currency.format(slip.totalDeductions),
                      bold: true, color: AppColors.error),
                ],
              ),
              const SizedBox(height: 16),

              // ── Net Pay Summary ───────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'NET PAY',
                          style: GoogleFonts.inter(
                            color: Colors.black54,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          slip.periodLabel,
                          style: GoogleFonts.inter(
                            color: Colors.black87,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      currency.format(slip.netSalary),
                      style: GoogleFonts.inter(
                        color: Colors.black87,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Provider for payslip detail ───────────────────────────────────────────────
final _payslipDetailProvider =
    FutureProvider.family<PayslipModel, String>((ref, id) async {
  return ref.watch(payrollRepositoryProvider).getPayslipDetail(id);
});

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _HeaderCard extends StatelessWidget {
  final PayslipModel slip;
  final bool isDark;
  const _HeaderCard({required this.slip, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.receipt_long_outlined, color: AppColors.primary, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    slip.periodLabel,
                    style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      slip.status.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.success,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool isDark;
  final List<Widget> children;
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.isDark,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final Color? color;
  const _InfoRow(this.label, this.value, {this.bold = false, this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[600]),
            ),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: bold ? FontWeight.bold : FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
