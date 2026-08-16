import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/loan_model.dart';
import '../providers/finance_provider.dart';
import 'request_loan_screen.dart';

class LoansScreen extends ConsumerWidget {
  const LoansScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loansAsync = ref.watch(loansProvider);
    final configAsync = ref.watch(loanConfigProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currency = NumberFormat.currency(symbol: 'ETB ', decimalDigits: 2);

    final selfServiceEnabled = configAsync.asData?.value['allow_employee_loans'] == true ||
        configAsync.asData?.value['self_service_enabled'] == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Loans'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(loansProvider.notifier).fetch(),
          ),
        ],
      ),
      floatingActionButton: selfServiceEnabled
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black87,
              icon: const Icon(Icons.add_rounded),
              label: Text('Request Loan', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const RequestLoanScreen()),
              ),
            )
          : null,
      body: loansAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(e.toString().replaceAll('Exception: ', ''),
                  textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 14)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                onPressed: () => ref.read(loansProvider.notifier).fetch(),
              ),
            ],
          ),
        ),
        data: (loans) {
          if (loans.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.account_balance_outlined, size: 72,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                  const SizedBox(height: 16),
                  Text('No loans found', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text(selfServiceEnabled
                          ? 'Tap the button below to request a loan.'
                          : 'Contact HR to request a loan.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(loansProvider.notifier).fetch(),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              itemCount: loans.length,
              itemBuilder: (context, i) => _LoanCard(loan: loans[i], isDark: isDark, currency: currency),
            ),
          );
        },
      ),
    );
  }
}

class _LoanCard extends StatelessWidget {
  final LoanModel loan;
  final bool isDark;
  final NumberFormat currency;
  const _LoanCard({required this.loan, required this.isDark, required this.currency});

  Color get _statusColor {
    switch (loan.status) {
      case 'active': return AppColors.success;
      case 'completed': return AppColors.teal;
      case 'rejected': return AppColors.error;
      case 'frozen': return AppColors.warning;
      default: return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = loan.totalAmount > 0
        ? (loan.totalAmount - loan.remainingBalance) / loan.totalAmount
        : 0.0;

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header row ───────────────────────────────────────────
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.account_balance_outlined, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        loan.loanType ?? 'Personal Loan',
                        style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'Starts ${loan.startPeriodLabel} • ${loan.termMonths} months',
                        style: GoogleFonts.inter(
                            fontSize: 12,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    loan.status.toUpperCase(),
                    style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: _statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // ── Amounts ────────────────────────────────────────────────
            Row(
              children: [
                _AmountItem(label: 'Total', value: currency.format(loan.totalAmount)),
                _AmountItem(label: 'Monthly', value: currency.format(loan.monthlyDeduction), highlight: true),
                _AmountItem(label: 'Remaining', value: currency.format(loan.remainingBalance)),
              ],
            ),
            const SizedBox(height: 12),

            // ── Progress bar ──────────────────────────────────────────
            if (loan.isActive || loan.isCompleted) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Repayment Progress',
                      style: GoogleFonts.inter(
                          fontSize: 12,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
                  Text('${(progress * 100).toStringAsFixed(0)}%',
                      style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress.clamp(0.0, 1.0),
                  backgroundColor: isDark ? AppColors.borderDark : AppColors.borderLight,
                  valueColor: const AlwaysStoppedAnimation<Color>(AppColors.success),
                  minHeight: 8,
                ),
              ),
            ],

            // ── Description ───────────────────────────────────────────
            if (loan.description != null && loan.description!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                loan.description!,
                style: GoogleFonts.inter(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
              ),
            ],

            // ── Approval history ──────────────────────────────────────
            if (loan.approvalHistory.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Divider(height: 1),
              const SizedBox(height: 8),
              Text('Approval Trail',
                  style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
              const SizedBox(height: 4),
              ...loan.approvalHistory.take(3).map((h) => Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      children: [
                        Icon(
                          h['status'] == 'approved' ? Icons.check_circle : Icons.cancel,
                          size: 14,
                          color: h['status'] == 'approved' ? AppColors.success : AppColors.error,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${h['approver_name'] ?? 'Approver'} — ${h['status'] ?? ''}',
                          style: GoogleFonts.inter(fontSize: 12),
                        ),
                      ],
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }
}

class _AmountItem extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;
  const _AmountItem({required this.label, required this.value, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[500])),
          const SizedBox(height: 2),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: highlight ? AppColors.primary : null,
            ),
          ),
        ],
      ),
    );
  }
}
