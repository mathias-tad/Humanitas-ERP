import 'package:flutter/material.dart';

enum ERPStatusType {
  active,
  approved,
  completed,
  paid,
  pending,
  inProgress,
  draft,
  inactive,
  rejected,
  cancelled,
  overdue,
  lowStock,
}

class ERPStatusBadge extends StatelessWidget {
  final String status;
  final String? label;
  final bool showDot;

  const ERPStatusBadge({
    Key? key,
    required this.status,
    this.label,
    this.showDot = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final norm = status.toLowerCase().replaceAll(RegExp(r'[\s-]'), '_');
    Color bg;
    Color fg;

    switch (norm) {
      case 'active':
      case 'approved':
      case 'completed':
      case 'paid':
        bg = isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5);
        fg = isDark ? const Color(0xFF34D399) : const Color(0xFF065F46);
        break;
      case 'pending':
      case 'in_progress':
      case 'partial':
      case 'open':
        bg = isDark ? const Color(0xFF78350F) : const Color(0xFFFEF3C7);
        fg = isDark ? const Color(0xFFFBBF24) : const Color(0xFF92400E);
        break;
      case 'rejected':
      case 'cancelled':
      case 'overdue':
      case 'unpaid':
      case 'low_stock':
        bg = isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFEE2E2);
        fg = isDark ? const Color(0xFFF87171) : const Color(0xFF991B1B);
        break;
      default:
        bg = isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9);
        fg = isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569);
    }

    final displayText = label ??
        status
            .replaceAll('_', ' ')
            .split(' ')
            .map((w) => w.isNotEmpty
                ? '${w[0].toUpperCase()}${w.substring(1)}'
                : '')
            .join(' ');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: fg,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 5),
          ],
          Text(
            displayText,
            style: TextStyle(
              color: fg,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
