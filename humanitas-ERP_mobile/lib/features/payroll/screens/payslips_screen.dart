import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/finance_provider.dart';
import 'payslip_detail_screen.dart';

class PayslipsScreen extends ConsumerWidget {
  const PayslipsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final payslipsAsync = ref.watch(payslipsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currency = NumberFormat.currency(symbol: 'ETB ', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Payslips'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(payslipsProvider.notifier).fetch(),
          ),
        ],
      ),
      body: payslipsAsync.when(
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
                onPressed: () => ref.read(payslipsProvider.notifier).fetch(),
              ),
            ],
          ),
        ),
        data: (payslips) {
          if (payslips.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.receipt_long_outlined,
                      size: 72, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                  const SizedBox(height: 16),
                  Text('No payslips yet',
                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text('Your payslips will appear here after payroll is processed.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(payslipsProvider.notifier).fetch(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: payslips.length,
              itemBuilder: (context, i) {
                final slip = payslips[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => PayslipDetailScreen(payslipId: slip.id),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.receipt_long_outlined,
                                color: AppColors.primary, size: 24),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  slip.periodLabel,
                                  style: GoogleFonts.inter(
                                      fontSize: 15, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Text(
                                      'Gross: ${currency.format(slip.grossSalary)}',
                                      style: GoogleFonts.inter(
                                          fontSize: 12,
                                          color: isDark
                                              ? AppColors.textSecondaryDark
                                              : AppColors.textSecondaryLight),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                currency.format(slip.netSalary),
                                style: GoogleFonts.inter(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.success,
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Icon(Icons.chevron_right, size: 18, color: Colors.grey),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
