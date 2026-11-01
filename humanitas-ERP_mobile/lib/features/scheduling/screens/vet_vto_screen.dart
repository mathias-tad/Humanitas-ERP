import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../models/wfm_opportunity_model.dart';
import '../providers/wfm_provider.dart';

class VetVtoScreen extends ConsumerStatefulWidget {
  const VetVtoScreen({super.key});

  @override
  ConsumerState<VetVtoScreen> createState() => _VetVtoScreenState();
}

class _VetVtoScreenState extends ConsumerState<VetVtoScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _typeFilter = 'all';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _handleClaim(WfmOpportunityModel opp) async {
    bool usePto = false;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            'Claim ${opp.type} Slot',
            style: GoogleFonts.inter(fontWeight: FontWeight.w700),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                opp.title,
                style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 15),
              ),
              const SizedBox(height: 6),
              Text(
                'Date: ${opp.date} • ${opp.hours} Hours',
                style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade600),
              ),
              if (opp.type == 'VET') ...[
                const SizedBox(height: 4),
                Text(
                  'Rate Multiplier: ${opp.otRateMultiplier}x (${opp.otCategory})',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ],
              if (opp.type == 'VTO') ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Checkbox(
                      value: usePto,
                      onChanged: (val) {
                        setDialogState(() {
                          usePto = val ?? false;
                        });
                      },
                    ),
                    Expanded(
                      child: Text(
                        'Fund with Paid Leave (PTO)',
                        style: GoogleFonts.inter(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: opp.type == 'VET' ? Colors.blue.shade700 : Colors.teal.shade700,
                foregroundColor: Colors.white,
              ),
              child: const Text('Confirm Claim'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      try {
        final repo = ref.read(wfmRepositoryProvider);
        final res = await repo.claimOpportunity(opp.id, usePtoBalance: usePto);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(res['message']?.toString() ?? 'Claim processed successfully!'),
              backgroundColor: Colors.green.shade700,
            ),
          );
          ref.invalidate(wfmOpportunitiesProvider);
          ref.invalidate(myWfmClaimsProvider);
        }
      } catch (err) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(err.toString().replaceAll('Exception:', '')),
              backgroundColor: Colors.red.shade700,
            ),
          );
        }
      }
    }
  }

  Future<void> _handleCancelClaim(String claimId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Claim'),
        content: const Text('Are you sure you want to cancel this claim request?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('No')),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final repo = ref.read(wfmRepositoryProvider);
        await repo.cancelClaim(claimId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Claim cancelled successfully')),
          );
          ref.invalidate(wfmOpportunitiesProvider);
          ref.invalidate(myWfmClaimsProvider);
        }
      } catch (err) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(err.toString().replaceAll('Exception:', ''))),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        title: Text(
          'VET & VTO Opportunities',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Open Opportunities'),
            Tab(text: 'My Claims'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Open Opportunities
          Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    _FilterChip(
                      label: 'All',
                      selected: _typeFilter == 'all',
                      onSelected: () => setState(() => _typeFilter = 'all'),
                    ),
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: 'VET (Extra Shifts)',
                      selected: _typeFilter == 'VET',
                      onSelected: () => setState(() => _typeFilter = 'VET'),
                    ),
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: 'VTO (Time Off)',
                      selected: _typeFilter == 'VTO',
                      onSelected: () => setState(() => _typeFilter = 'VTO'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Consumer(
                  builder: (context, ref, _) {
                    final oppsAsync = ref.watch(wfmOpportunitiesProvider(_typeFilter));
                    return oppsAsync.when(
                      loading: () => const Center(child: CircularProgressIndicator()),
                      error: (err, _) => Center(child: Text('Error: $err')),
                      data: (opps) {
                        if (opps.isEmpty) {
                          return Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.event_available, size: 48, color: Colors.grey.shade400),
                                  const SizedBox(height: 12),
                                  Text(
                                    'No open opportunities',
                                    style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 16),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Check back later for extra shifts or voluntary time-off broadcasts.',
                                    textAlign: TextAlign.center,
                                    style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade600),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }

                        return RefreshIndicator(
                          onRefresh: () async => ref.refresh(wfmOpportunitiesProvider(_typeFilter)),
                          child: ListView.separated(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            itemCount: opps.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (context, idx) {
                              final opp = opps[idx];
                              final isVet = opp.type == 'VET';

                              return Card(
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: BorderSide(
                                    color: isDark ? Colors.white12 : Colors.black12,
                                  ),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: isVet
                                                  ? Colors.blue.withOpacity(0.12)
                                                  : Colors.teal.withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              isVet ? 'VET • Extra Overtime' : 'VTO • Voluntary Off',
                                              style: GoogleFonts.inter(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                                color: isVet ? Colors.blue.shade700 : Colors.teal.shade700,
                                              ),
                                            ),
                                          ),
                                          if (opp.urgency == 'critical')
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: Colors.red.withOpacity(0.15),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                '🔥 CRITICAL',
                                                style: GoogleFonts.inter(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w800,
                                                  color: Colors.red.shade700,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        opp.title,
                                        style: GoogleFonts.inter(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 16,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Icon(Icons.calendar_today, size: 13, color: Colors.grey.shade600),
                                          const SizedBox(width: 4),
                                          Text(
                                            opp.date,
                                            style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade600),
                                          ),
                                          if (opp.startTime != null && opp.endTime != null) ...[
                                            const SizedBox(width: 8),
                                            Text(
                                              '• ${opp.startTime!.substring(0, 5)} - ${opp.endTime!.substring(0, 5)}',
                                              style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade600),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  '${opp.hours}h Duration',
                                                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                                                ),
                                                Text(
                                                  isVet ? '${opp.otRateMultiplier}x OT Rate' : 'Excused Absence',
                                                  style: GoogleFonts.inter(
                                                    fontSize: 12,
                                                    color: isVet ? AppColors.primary : Colors.teal.shade700,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Text(
                                            '${opp.slotsRemaining} of ${opp.slotsAvailable} open',
                                            style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade600),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      SizedBox(
                                        width: double.infinity,
                                        child: opp.hasClaimed
                                            ? OutlinedButton(
                                                onPressed: null,
                                                child: Text('Claimed (${opp.myClaimStatus})'),
                                              )
                                            : opp.slotsRemaining <= 0
                                                ? OutlinedButton(
                                                    onPressed: null,
                                                    child: const Text('Filled'),
                                                  )
                                                : ElevatedButton(
                                                    onPressed: () => _handleClaim(opp),
                                                    style: ElevatedButton.styleFrom(
                                                      backgroundColor: isVet
                                                          ? Colors.blue.shade700
                                                          : Colors.teal.shade700,
                                                      foregroundColor: Colors.white,
                                                    ),
                                                    child: Text(isVet ? 'Claim Shift' : 'Claim Time Off'),
                                                  ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),

          // Tab 2: My Claims
          Consumer(
            builder: (context, ref, _) {
              final claimsAsync = ref.watch(myWfmClaimsProvider);
              return claimsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, _) => Center(child: Text('Error: $err')),
                data: (claims) {
                  if (claims.isEmpty) {
                    return Center(
                      child: Text(
                        'No claims submitted yet',
                        style: GoogleFonts.inter(fontSize: 14, color: Colors.grey.shade600),
                      ),
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: () async => ref.refresh(myWfmClaimsProvider),
                    child: ListView.separated(
                      padding: const EdgeInsets.all(14),
                      itemCount: claims.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, idx) {
                        final c = claims[idx];
                        return Card(
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: isDark ? Colors.white12 : Colors.black12,
                            ),
                          ),
                          child: ListTile(
                            title: Text(
                              c.opportunityTitle ?? '${c.claimType} Opportunity',
                              style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              'Date: ${c.opportunityDate ?? ''} • ${c.hours ?? 0}h',
                              style: GoogleFonts.inter(fontSize: 12),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Chip(
                                  label: Text(
                                    c.status.toUpperCase(),
                                    style: GoogleFonts.inter(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: c.status == 'approved'
                                          ? Colors.green.shade800
                                          : c.status == 'rejected'
                                              ? Colors.red.shade800
                                              : Colors.amber.shade800,
                                    ),
                                  ),
                                  backgroundColor: c.status == 'approved'
                                      ? Colors.green.withOpacity(0.15)
                                      : c.status == 'rejected'
                                          ? Colors.red.withOpacity(0.15)
                                          : Colors.amber.withOpacity(0.15),
                                ),
                                if (c.status != 'cancelled' && c.status != 'rejected')
                                  IconButton(
                                    icon: const Icon(Icons.cancel_outlined, size: 20, color: Colors.red),
                                    onPressed: () => _handleCancelClaim(c.id),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onSelected;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onSelected,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? AppColors.primary : Colors.grey.shade400,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? Colors.white : null,
          ),
        ),
      ),
    );
  }
}
