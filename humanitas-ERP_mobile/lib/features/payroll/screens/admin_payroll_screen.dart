import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';

class AdminPayrollScreen extends ConsumerStatefulWidget {
  final List<Map<String, dynamic>>? initialRuns;
  const AdminPayrollScreen({super.key, this.initialRuns});

  @override
  ConsumerState<AdminPayrollScreen> createState() => _AdminPayrollScreenState();
}

class _AdminPayrollScreenState extends ConsumerState<AdminPayrollScreen> {
  int _selectedMonth = DateTime.now().month;
  int _selectedYear = DateTime.now().year;

  bool _isLoading = false;
  bool _isRunning = false;
  String? _error;
  List<Map<String, dynamic>> _runs = [];

  @override
  void initState() {
    super.initState();
    if (widget.initialRuns != null) {
      _runs = widget.initialRuns!;
      _isLoading = false;
    } else {
      _fetchRuns();
    }
  }

  Future<void> _fetchRuns() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final res = await ref.read(apiClientProvider).dio.get(
        '/payroll/runs',
        queryParameters: {'month': _selectedMonth, 'year': _selectedYear},
      );
      final data = res.data;
      setState(() {
        _runs = data is List
            ? data.map((e) => Map<String, dynamic>.from(e as Map)).toList()
            : [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  Future<void> _runPayroll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Run Payroll', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: Text(
          'Process payroll for ${_monthName(_selectedMonth)} $_selectedYear?\n\nThis action cannot be undone.',
          style: GoogleFonts.inter(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            onPressed: () => Navigator.pop(context, true),
            child: Text('Run Payroll', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isRunning = true);
    try {
      await ref.read(apiClientProvider).dio.post(
        '/payroll/run',
        data: {'month': _selectedMonth, 'year': _selectedYear},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payroll for ${_monthName(_selectedMonth)} $_selectedYear processed!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
      await _fetchRuns();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceAll('Exception: ', '')}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isRunning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        title: Text('Payroll Management', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded),
            tooltip: 'Filter',
            onPressed: () => _showFilterSheet(context),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: _fetchRuns,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchRuns,
              child: CustomScrollView(
                slivers: [
                  // Period header
                  SliverToBoxAdapter(
                    child: Container(
                      color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      child: Row(children: [
                        const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Text('${_monthName(_selectedMonth)} $_selectedYear',
                            style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.primary)),
                        const Spacer(),
                        GestureDetector(
                          onTap: () => _showFilterSheet(context),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text('Change', style: GoogleFonts.inter(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
                          ),
                        ),
                      ]),
                    ),
                  ),

                  // Stats
                  SliverToBoxAdapter(child: _buildStats(isDark)),

                  if (_error != null)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Card(
                          color: AppColors.error.withValues(alpha: 0.08),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(children: [
                              const Icon(Icons.error_outline, color: AppColors.error),
                              const SizedBox(width: 10),
                              Expanded(child: Text(_error!, style: GoogleFonts.inter(color: AppColors.error))),
                              TextButton(onPressed: _fetchRuns, child: const Text('Retry')),
                            ]),
                          ),
                        ),
                      ),
                    ),

                  // Run payroll button
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.success,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: _isRunning
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.play_arrow_rounded, color: Colors.white),
                        label: Text('Run Payroll for ${_monthName(_selectedMonth)} $_selectedYear',
                            style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
                        onPressed: _isRunning ? null : _runPayroll,
                      ),
                    ),
                  ),

                  // List header
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                      child: Text('Payroll Runs', style: GoogleFonts.inter(
                          fontSize: 14, fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight)),
                    ),
                  ),

                  // Payroll runs list
                  if (_runs.isEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(Icons.receipt_long_outlined, size: 56, color: isDark ? Colors.white24 : Colors.black26),
                          const SizedBox(height: 12),
                          Text('No payroll run yet for this period',
                              style: GoogleFonts.inter(fontSize: 14, color: isDark ? Colors.white54 : Colors.black45)),
                        ]),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, i) => _PayrollRunCard(run: _runs[i], isDark: isDark),
                          childCount: _runs.length,
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _buildStats(bool isDark) {
    final totalEmp = _runs.length;
    final processed = _runs.where((r) => r['status']?.toString().toLowerCase() == 'processed').length;
    final pending = _runs.where((r) => r['status']?.toString().toLowerCase() == 'pending').length;
    final totalGross = _runs.fold<double>(0, (acc, r) {
      final g = r['gross_pay'] ?? r['grossPay'] ?? 0;
      return acc + (double.tryParse(g.toString()) ?? 0);
    });

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(children: [
        Row(children: [
          _StatCard(label: 'Employees', value: '$totalEmp', icon: Icons.people_alt_rounded, color: AppColors.primary, isDark: isDark),
          const SizedBox(width: 10),
          _StatCard(label: 'Processed', value: '$processed', icon: Icons.check_circle_outline, color: AppColors.success, isDark: isDark),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          _StatCard(label: 'Pending', value: '$pending', icon: Icons.pending_outlined, color: AppColors.warning, isDark: isDark),
          const SizedBox(width: 10),
          _StatCard(label: 'Total Gross', value: '\$${totalGross.toStringAsFixed(0)}', icon: Icons.attach_money_rounded, color: AppColors.teal, isDark: isDark),
        ]),
      ]),
    );
  }

  void _showFilterSheet(BuildContext context) {
    int tempMonth = _selectedMonth;
    int tempYear = _selectedYear;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setMS) => Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Filter Period', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: DropdownButtonFormField<int>(
                value: tempMonth,
                decoration: InputDecoration(labelText: 'Month', border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                items: List.generate(12, (i) => DropdownMenuItem(value: i + 1, child: Text(_monthName(i + 1)))),
                onChanged: (v) => setMS(() => tempMonth = v!),
              )),
              const SizedBox(width: 12),
              Expanded(child: DropdownButtonFormField<int>(
                value: tempYear,
                decoration: InputDecoration(labelText: 'Year', border: OutlineInputBorder(borderRadius: BorderRadius.circular(10))),
                items: List.generate(5, (i) => DateTime.now().year - i)
                    .map((y) => DropdownMenuItem(value: y, child: Text('$y'))).toList(),
                onChanged: (v) => setMS(() => tempYear = v!),
              )),
            ]),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () {
                  setState(() { _selectedMonth = tempMonth; _selectedYear = tempYear; });
                  Navigator.pop(ctx);
                  _fetchRuns();
                },
                child: Text('Apply', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  String _monthName(int m) {
    const names = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return names[m - 1];
  }
}

// ── Stat card ──────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool isDark;

  const _StatCard({required this.label, required this.value, required this.icon, required this.color, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
            Text(label, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
          ]),
        ]),
      ),
    );
  }
}

// ── Payroll run card ───────────────────────────────────────────────────────

class _PayrollRunCard extends StatelessWidget {
  final Map<String, dynamic> run;
  final bool isDark;

  const _PayrollRunCard({required this.run, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final name = run['employee_name']?.toString() ?? run['employeeName']?.toString() ?? 'Employee';
    final gross = run['gross_pay']?.toString() ?? run['grossPay']?.toString() ?? '0';
    final net = run['net_pay']?.toString() ?? run['netPay']?.toString() ?? '0';
    final status = run['status']?.toString() ?? 'pending';
    final statusColor = status.toLowerCase() == 'processed' ? AppColors.success : AppColors.warning;
    final initials = name.trim().split(' ').take(2).map((w) => w.isNotEmpty ? w[0].toUpperCase() : '').join();

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.primary.withValues(alpha: 0.12),
            child: Text(initials, style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 12)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14,
                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight)),
            const SizedBox(height: 2),
            Text('Gross: \$$gross  ·  Net: \$$net',
                style: GoogleFonts.inter(fontSize: 12, color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: statusColor.withValues(alpha: 0.3)),
            ),
            child: Text(status[0].toUpperCase() + status.substring(1),
                style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
          ),
        ]),
      ),
    );
  }
}
