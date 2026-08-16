import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/per_diem_model.dart';
import '../providers/finance_provider.dart';

class PerDiemScreen extends ConsumerWidget {
  const PerDiemScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final claimsAsync = ref.watch(perDiemProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currency = NumberFormat.currency(symbol: 'ETB ', decimalDigits: 2);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Per Diem Claims'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(perDiemProvider.notifier).fetch(),
          ),
        ],
      ),
      body: claimsAsync.when(
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
                onPressed: () => ref.read(perDiemProvider.notifier).fetch(),
              ),
            ],
          ),
        ),
        data: (claims) {
          if (claims.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.card_travel_outlined,
                    size: 72,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                  const SizedBox(height: 16),
                  Text('No per diem claims',
                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text(
                    'Per diem claims assigned to you by HR will appear here.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(perDiemProvider.notifier).fetch(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: claims.length,
              itemBuilder: (context, i) {
                return _PerDiemClaimCard(claim: claims[i], isDark: isDark, currency: currency);
              },
            ),
          );
        },
      ),
    );
  }
}

class _PerDiemClaimCard extends ConsumerStatefulWidget {
  final PerDiemModel claim;
  final bool isDark;
  final NumberFormat currency;

  const _PerDiemClaimCard({
    required this.claim,
    required this.isDark,
    required this.currency,
  });

  @override
  ConsumerState<_PerDiemClaimCard> createState() => _PerDiemClaimCardState();
}

class _PerDiemClaimCardState extends ConsumerState<_PerDiemClaimCard> {
  bool _isLoading = false;

  Color get _statusColor {
    switch (widget.claim.status) {
      case 'APPROVED':
        return AppColors.success;
      case 'REJECTED':
        return AppColors.error;
      case 'PENDING_REVIEW':
        return AppColors.warning;
      default:
        return AppColors.primary;
    }
  }

  Future<void> _submitChoice(String choice) async {
    setState(() => _isLoading = true);
    try {
      await ref.read(perDiemRepositoryProvider).submitChoice(widget.claim.id, choice);
      ref.read(perDiemProvider.notifier).fetch();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Choice submitted: ${choice == 'WITH_RECEIPT' ? 'With Receipt' : 'Without Receipt'}'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _uploadReceipt() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (image == null) return;

    final bytes = await image.readAsBytes();
    final amountController = TextEditingController();

    if (!mounted) return;
    final double? receiptAmount = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter Receipt Amount'),
        content: TextField(
          controller: amountController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
            labelText: 'Receipt Amount (ETB)',
            prefixIcon: Icon(Icons.attach_money),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final val = double.tryParse(amountController.text.trim());
              Navigator.pop(ctx, val);
            },
            child: const Text('Upload'),
          ),
        ],
      ),
    );

    setState(() => _isLoading = true);
    try {
      await ref.read(perDiemRepositoryProvider).uploadReceipt(
            claimId: widget.claim.id,
            bytes: bytes,
            filename: image.name,
            mime: image.mimeType ?? 'image/jpeg',
            receiptAmount: receiptAmount,
          );
      ref.read(perDiemProvider.notifier).fetch();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Receipt uploaded successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final claim = widget.claim;

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.flight_takeoff_rounded, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        claim.periodLabel,
                        style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        claim.choice != null ? 'Choice: ${claim.choice}' : 'Awaiting choice',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: widget.isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                        ),
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
                    claim.status,
                    style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: _statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            if (claim.calculatedAmount != null || claim.approvedAmount != null || claim.receiptAmount != null) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (claim.calculatedAmount != null)
                    _ItemText('Calculated', widget.currency.format(claim.calculatedAmount)),
                  if (claim.receiptAmount != null)
                    _ItemText('Receipt', widget.currency.format(claim.receiptAmount)),
                  if (claim.approvedAmount != null)
                    _ItemText('Approved', widget.currency.format(claim.approvedAmount), isBold: true),
                ],
              ),
              const SizedBox(height: 12),
            ],

            if (_isLoading)
              const Center(child: Padding(padding: EdgeInsets.all(8.0), child: CircularProgressIndicator()))
            else ...[
              // Action buttons based on status
              if (claim.isPendingChoice) ...[
                Text('Submit your per diem option:',
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.money_off_rounded, size: 18),
                        label: const Text('No Receipt'),
                        onPressed: () => _submitChoice('WITHOUT_RECEIPT'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.receipt_long, size: 18),
                        label: const Text('With Receipt'),
                        onPressed: () => _submitChoice('WITH_RECEIPT'),
                      ),
                    ),
                  ],
                ),
              ],

              if (claim.choice == 'WITH_RECEIPT' && (!claim.hasReceipt || claim.isPendingReview || claim.isPendingChoice)) ...[
                const SizedBox(height: 6),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.teal, foregroundColor: Colors.white),
                    icon: const Icon(Icons.upload_file),
                    label: Text(claim.hasReceipt ? 'Re-upload Receipt' : 'Upload Receipt Photo'),
                    onPressed: _uploadReceipt,
                  ),
                ),
              ],
            ],

            if (claim.rejectionReason != null && claim.rejectionReason!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'Reason: ${claim.rejectionReason}',
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.error),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ItemText extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;

  const _ItemText(this.label, this.value, {this.isBold = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[500])),
        const SizedBox(height: 2),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: isBold ? AppColors.success : null,
          ),
        ),
      ],
    );
  }
}
