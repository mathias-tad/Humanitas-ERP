import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/finance_provider.dart';

class RequestLoanScreen extends ConsumerStatefulWidget {
  const RequestLoanScreen({super.key});

  @override
  ConsumerState<RequestLoanScreen> createState() => _RequestLoanScreenState();
}

class _RequestLoanScreenState extends ConsumerState<RequestLoanScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _isLoading = false;

  int _termMonths = 6;
  int _startMonth = DateTime.now().month;
  int _startYear = DateTime.now().year;

  final List<int> _termOptions = [3, 6, 9, 12, 18, 24, 36];
  final List<String> _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  double get _monthlyPayment {
    final amt = double.tryParse(_amountController.text) ?? 0;
    return _termMonths > 0 ? amt / _termMonths : 0;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _isLoading = true);
    try {
      await ref.read(loanRepositoryProvider).requestLoan(
            totalAmount: double.parse(_amountController.text.trim()),
            termMonths: _termMonths,
            startMonth: _startMonth,
            startYear: _startYear,
            description: _descriptionController.text.trim(),
          );
      // Refresh list
      ref.read(loansProvider.notifier).fetch();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Loan request submitted successfully!'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ));
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
        ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(symbol: 'ETB ', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(title: const Text('Request a Loan')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Amount ─────────────────────────────────────────────────
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Loan Amount (ETB)',
                  prefixIcon: Icon(Icons.attach_money_rounded),
                ),
                onChanged: (_) => setState(() {}),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Required';
                  final n = double.tryParse(v.trim());
                  if (n == null || n <= 0) return 'Enter a valid positive amount';
                  return null;
                },
              ),
              const SizedBox(height: 18),

              // ── Term ───────────────────────────────────────────────────
              DropdownButtonFormField<int>(
                initialValue: _termMonths,
                decoration: const InputDecoration(
                  labelText: 'Repayment Term',
                  prefixIcon: Icon(Icons.calendar_month_outlined),
                ),
                items: _termOptions
                    .map((t) => DropdownMenuItem(value: t, child: Text('$t months')))
                    .toList(),
                onChanged: (v) => setState(() => _termMonths = v ?? 6),
              ),
              const SizedBox(height: 18),

              // ── Start Month ────────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: DropdownButtonFormField<int>(
                      initialValue: _startMonth,
                      decoration: const InputDecoration(
                        labelText: 'Start Month',
                        prefixIcon: Icon(Icons.date_range_outlined),
                      ),
                      items: List.generate(
                        12,
                        (i) => DropdownMenuItem(value: i + 1, child: Text(_monthNames[i])),
                      ),
                      onChanged: (v) => setState(() => _startMonth = v ?? 1),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      initialValue: _startYear,
                      decoration: const InputDecoration(labelText: 'Year'),
                      items: List.generate(
                        3,
                        (i) {
                          final y = DateTime.now().year + i;
                          return DropdownMenuItem(value: y, child: Text('$y'));
                        },
                      ),
                      onChanged: (v) => setState(() => _startYear = v ?? DateTime.now().year),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // ── Description ────────────────────────────────────────────
              TextFormField(
                controller: _descriptionController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Purpose / Description (optional)',
                  prefixIcon: Icon(Icons.notes_outlined),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 24),

              // ── Summary Card ────────────────────────────────────────────
              if (_amountController.text.isNotEmpty && double.tryParse(_amountController.text) != null)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Total Amount', style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[600])),
                          Text(
                            currency.format(double.tryParse(_amountController.text) ?? 0),
                            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Term', style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[600])),
                          Text('$_termMonths months', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const Divider(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Monthly Deduction',
                              style: GoogleFonts.inter(
                                  fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary)),
                          Text(currency.format(_monthlyPayment),
                              style: GoogleFonts.inter(
                                  fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary)),
                        ],
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 24),

              ElevatedButton.icon(
                icon: _isLoading ? const SizedBox.shrink() : const Icon(Icons.send_rounded),
                label: _isLoading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Submit Loan Request'),
                onPressed: _isLoading ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
