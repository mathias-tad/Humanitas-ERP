import 'package:flutter/material.dart';

import '../../../core/constants/app_colors.dart';
import '../models/product_models.dart';

/// Shown when the company has no Products module or the user lacks the view permission.
class ProductsAccessDenied extends StatelessWidget {
  final String title;
  final String message;

  const ProductsAccessDenied({super.key, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline_rounded, size: 48, color: AppColors.textSecondaryLight),
              const SizedBox(height: 12),
              const Text('Access denied', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}

/// Error message with a retry button.
class ProductsErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;

  const ProductsErrorView({super.key, required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 40, color: AppColors.error),
            const SizedBox(height: 12),
            Text(error.toString(), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}

/// "Ready for e-invoicing" or what MoR would reject (AGENTS.md rule 28).
class EimsReadinessBanner extends StatelessWidget {
  final Product product;

  const EimsReadinessBanner({super.key, required this.product});

  @override
  Widget build(BuildContext context) {
    if (product.eimsReady) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Icon(Icons.verified_rounded, color: AppColors.success, size: 18),
            SizedBox(width: 8),
            Text('Ready for e-invoicing', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 18),
              SizedBox(width: 8),
              Text('Not ready for e-invoicing', style: TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 6),
          for (final issue in product.eimsIssues) Text('• ${kEimsIssueText[issue] ?? issue}'),
        ],
      ),
    );
  }
}

/// Section title used in Products screens.
class ProductsSectionTitle extends StatelessWidget {
  final String text;
  final IconData? icon;

  const ProductsSectionTitle(this.text, {super.key, this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 8),
      child: Row(
        children: [
          if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
          Text(text, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

void showProductsSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), backgroundColor: error ? AppColors.error : null),
  );
}
