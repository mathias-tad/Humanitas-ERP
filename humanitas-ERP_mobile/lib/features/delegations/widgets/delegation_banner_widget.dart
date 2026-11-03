import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../providers/delegation_provider.dart';
import '../screens/delegations_screen.dart';

class DelegationBannerWidget extends ConsumerWidget {
  const DelegationBannerWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeDelegationsAsync = ref.watch(activeDelegationsProvider);
    final authState = ref.watch(authProvider);
    final currentUserId = authState.user?.id;

    return activeDelegationsAsync.when(
      data: (delegations) {
        final activeReceived = delegations.where((d) => d.delegateeId == currentUserId && d.isActive).toList();
        if (activeReceived.isEmpty) return const SizedBox.shrink();

        final primary = activeReceived.first;
        final delegatorName = primary.delegatorName ?? 'Colleague';
        final isActing = primary.isActingAssignment;

        final bgColor = isActing ? Colors.indigo.shade50 : Colors.amber.shade50;
        final borderColor = isActing ? Colors.indigo.shade300 : Colors.amber.shade300;
        final iconColor = isActing ? Colors.indigo.shade800 : Colors.amber.shade800;
        final textColor = isActing ? Colors.indigo.shade900 : Colors.amber.shade900;

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: bgColor,
            border: Border(
              bottom: BorderSide(color: borderColor, width: 1),
            ),
          ),
          child: Row(
            children: [
              Icon(isActing ? Icons.work_history : Icons.shield, color: iconColor, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 12, color: textColor),
                    children: [
                      TextSpan(
                        text: isActing ? 'Acting Assignment: ' : 'Acting on Behalf Of: ',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: isActing
                            ? '${primary.actingPositionTitle ?? "Covering Role"} for $delegatorName'
                            : '$delegatorName (${primary.scope})',
                      ),
                    ],
                  ),
                ),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const DelegationsScreen()),
                  );
                },
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'Manage',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: textColor,
                  ),
                ),
              ),
            ],
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
