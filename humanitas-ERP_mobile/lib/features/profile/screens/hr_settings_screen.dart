import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';

class HrSettingsScreen extends ConsumerStatefulWidget {
  const HrSettingsScreen({super.key});
  @override
  ConsumerState<HrSettingsScreen> createState() => _HrSettingsScreenState();
}

class _HrSettingsScreenState extends ConsumerState<HrSettingsScreen> {
  int _selectedTab = 0;
  final List<Map<String, dynamic>> _tabs = [
    {'label': 'HR Policies', 'icon': Icons.people_outline},
    {'label': 'Categories', 'icon': Icons.category_outlined},
    {'label': 'Acting', 'icon': Icons.swap_horiz_outlined},
    {'label': 'Payroll & Tax', 'icon': Icons.calculate_outlined},
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: Text('HR & Statutory Settings', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
      ),
      body: Column(children: [
        Container(
          color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(children: List.generate(_tabs.length, (i) {
              final isActive = i == _selectedTab;
              return GestureDetector(
                onTap: () => setState(() => _selectedTab = i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: isActive ? const LinearGradient(colors: [AppColors.primary, Color(0xFFB8860B)]) : null,
                    color: isActive ? null : (isDark ? Colors.white10 : Colors.grey.shade100),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: isActive ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.3), blurRadius: 6)] : [],
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(_tabs[i]['icon'] as IconData, size: 15, color: isActive ? Colors.white : (isDark ? Colors.white70 : Colors.black54)),
                    const SizedBox(width: 5),
                    Text(_tabs[i]['label'] as String, style: GoogleFonts.inter(fontSize: 13, fontWeight: isActive ? FontWeight.w600 : FontWeight.w400, color: isActive ? Colors.white : (isDark ? Colors.white70 : Colors.black54))),
                  ]),
                ),
              );
            })),
          ),
        ),
        const Divider(height: 1),
        Expanded(child: IndexedStack(index: _selectedTab, children: [
          _HRTab(ref: ref),
          _CategoriesTab(),
          _ActingTab(),
          _PayrollTab(ref: ref),
        ])),
      ]),
    );
  }
}

Widget _sectionHeader(String text) => Padding(
  padding: const EdgeInsets.fromLTRB(0, 16, 0, 8),
  child: Text(text, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary)),
);

InputDecoration _inputDec(String label, {String? hint}) => InputDecoration(
  labelText: label, hintText: hint,
  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
);

Widget _saveButton(String label, bool saving, VoidCallback onPressed) => SizedBox(
  width: double.infinity,
  child: ElevatedButton(
    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(vertical: 14)),
    onPressed: saving ? null : onPressed,
    child: saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(label, style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
  ),
);

// ── HR Management Tab ────────────────────────────────────────────────────────
class _HRTab extends StatefulWidget {
  final WidgetRef ref;
  const _HRTab({required this.ref});
  @override State<_HRTab> createState() => _HRTabState();
}
class _HRTabState extends State<_HRTab> {
  bool _loading = true, _saving = false;
  final _startCtrl = TextEditingController(text: '09:00'), _endCtrl = TextEditingController(text: '17:00');
  final _lateToleranceCtrl = TextEditingController(text: '15'), _otThresholdCtrl = TextEditingController(text: '2');
  final _earlyPunchInCtrl = TextEditingController(text: '30'), _waitForAbsentCtrl = TextEditingController(text: '0');
  final _probationDaysCtrl = TextEditingController(text: '90'), _leaveCalcDayCtrl = TextEditingController(text: '1'), _leaveIncreaseCtrl = TextEditingController(text: '1');
  bool _markLateInsteadOfAbsent = false;
  int _workHours = 192;
  String _daysInMonthMode = 'FIXED_30';
  List<String> _workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  List<Map<String, dynamic>> _leaveTypes = [];
  static const List<String> _allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  List<String> _allowedAttendanceMethods = ['biometric', 'qr_code'];
  String _biometricVerificationMode = 'optional';

  @override void initState() { super.initState(); _load(); }
  @override void dispose() { for (final c in [_startCtrl, _endCtrl, _lateToleranceCtrl, _otThresholdCtrl, _earlyPunchInCtrl, _waitForAbsentCtrl, _probationDaysCtrl, _leaveCalcDayCtrl, _leaveIncreaseCtrl]) c.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/settings/hr');
      final d = res.data as Map<String, dynamic>? ?? {};
      setState(() {
        _startCtrl.text = d['standard_start_time']?.toString() ?? '09:00';
        _endCtrl.text = d['standard_end_time']?.toString() ?? '17:00';
        _lateToleranceCtrl.text = (d['late_tolerance_minutes'] ?? 15).toString();
        _otThresholdCtrl.text = (d['overtime_threshold_hours'] ?? 2).toString();
        _earlyPunchInCtrl.text = (d['early_punch_in_minutes'] ?? 30).toString();
        _waitForAbsentCtrl.text = (d['wait_for_absent_minutes'] ?? 0).toString();
        _markLateInsteadOfAbsent = d['mark_late_instead_of_absent'] as bool? ?? false;
        _workHours = (d['work_hours_per_month'] as num?)?.toInt() ?? 192;
        _daysInMonthMode = d['days_in_month_mode']?.toString() ?? 'FIXED_30';
        _probationDaysCtrl.text = (d['probation_period_days'] ?? 90).toString();
        _leaveCalcDayCtrl.text = (d['leave_calculation_day'] ?? 1).toString();
        _leaveIncreaseCtrl.text = (d['leave_increase_per_year'] ?? 1).toString();
        if (d['work_days'] is List) _workDays = (d['work_days'] as List).map((e) => e.toString()).toList();
        if (d['leave_types'] is List) _leaveTypes = (d['leave_types'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        if (d['allowed_attendance_methods'] is List) {
          _allowedAttendanceMethods = (d['allowed_attendance_methods'] as List).map((e) => e.toString()).toList();
        }
        _biometricVerificationMode = d['biometric_verification_mode']?.toString() ?? 'optional';
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(apiClientProvider).dio.patch('/settings/hr', data: {
        'standard_start_time': _startCtrl.text, 'standard_end_time': _endCtrl.text,
        'late_tolerance_minutes': int.tryParse(_lateToleranceCtrl.text) ?? 15,
        'overtime_threshold_hours': int.tryParse(_otThresholdCtrl.text) ?? 2,
        'early_punch_in_minutes': int.tryParse(_earlyPunchInCtrl.text) ?? 30,
        'wait_for_absent_minutes': int.tryParse(_waitForAbsentCtrl.text) ?? 0,
        'mark_late_instead_of_absent': _markLateInsteadOfAbsent,
        'work_hours_per_month': _workHours, 'work_days': _workDays,
        'days_in_month_mode': _daysInMonthMode, 'leave_types': _leaveTypes,
        'probation_period_days': int.tryParse(_probationDaysCtrl.text) ?? 90,
        'leave_calculation_day': int.tryParse(_leaveCalcDayCtrl.text) ?? 1,
        'leave_increase_per_year': int.tryParse(_leaveIncreaseCtrl.text) ?? 1,
        'allowed_attendance_methods': _allowedAttendanceMethods,
        'biometric_verification_mode': _biometricVerificationMode,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('HR settings saved!'), backgroundColor: Colors.green));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
    finally { setState(() => _saving = false); }
  }

  void _showLeaveModal({Map<String, dynamic>? leave}) {
    final nameC = TextEditingController(text: leave?['name']?.toString() ?? '');
    final daysC = TextEditingController(text: ((leave?['days_per_year'] as num?)?.toInt() ?? 0).toString());
    bool isPaid = leave?['is_paid'] as bool? ?? true;
    showModalBottomSheet(context: context, isScrollControlled: true, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setMS) => Padding(padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(leave == null ? 'Add Leave Type' : 'Edit Leave Type', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(controller: nameC, decoration: _inputDec('Leave Type Name *')),
          const SizedBox(height: 10),
          TextField(controller: daysC, decoration: _inputDec('Days Per Year'), keyboardType: TextInputType.number),
          const SizedBox(height: 10),
          SwitchListTile(title: const Text('Paid Leave'), value: isPaid, onChanged: (v) => setMS(() => isPaid = v), activeColor: AppColors.primary),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))),
            const SizedBox(width: 12),
            Expanded(child: ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: () {
                if (nameC.text.trim().isEmpty) return;
                final days = int.tryParse(daysC.text) ?? 0;
                setState(() {
                  if (leave == null) {
                    _leaveTypes.add({'id': DateTime.now().millisecondsSinceEpoch.toString(), 'name': nameC.text.trim(), 'days_per_year': days, 'is_paid': isPaid});
                  } else {
                    final idx = _leaveTypes.indexWhere((l) => l['id'] == leave['id']);
                    if (idx >= 0) _leaveTypes[idx] = {...leave, 'name': nameC.text.trim(), 'days_per_year': days, 'is_paid': isPaid};
                  }
                });
                Navigator.pop(ctx);
              },
              child: const Text('Save', style: TextStyle(color: Colors.white)))),
          ]),
        ]))),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('Attendance Settings'),
      Row(children: [
        Expanded(child: TextField(controller: _startCtrl, decoration: _inputDec('Start Time (HH:mm)'))),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _endCtrl, decoration: _inputDec('End Time (HH:mm)'))),
      ]), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _lateToleranceCtrl, decoration: _inputDec('Late Tolerance (min)'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _otThresholdCtrl, decoration: _inputDec('OT Threshold (hrs)'), keyboardType: TextInputType.number)),
      ]), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _earlyPunchInCtrl, decoration: _inputDec('Early Punch-in (min)'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _waitForAbsentCtrl, decoration: _inputDec('Wait for Absent (min)'), keyboardType: TextInputType.number)),
      ]), const SizedBox(height: 10),
      SwitchListTile(title: const Text('Mark Late Instead of Absent'), value: _markLateInsteadOfAbsent, onChanged: (v) => setState(() => _markLateInsteadOfAbsent = v), activeColor: AppColors.primary),
      _sectionHeader('Work Days'),
      Wrap(spacing: 8, runSpacing: 8, children: _allDays.map((d) {
        final selected = _workDays.contains(d);
        return FilterChip(label: Text(d.substring(0, 3)), selected: selected, selectedColor: AppColors.primary.withValues(alpha: 0.2), checkmarkColor: AppColors.primary,
          onSelected: (v) => setState(() { if (v) { _workDays.add(d); } else { _workDays.remove(d); } }));
      }).toList()),
      _sectionHeader('Days in Month Mode'),
      RadioListTile<String>(title: const Text('Fixed 30'), value: 'FIXED_30', groupValue: _daysInMonthMode, onChanged: (v) => setState(() => _daysInMonthMode = v!), activeColor: AppColors.primary),
      RadioListTile<String>(title: const Text('Actual'), value: 'ACTUAL', groupValue: _daysInMonthMode, onChanged: (v) => setState(() => _daysInMonthMode = v!), activeColor: AppColors.primary),
      _sectionHeader('Leave Accrual'),
      TextField(controller: _probationDaysCtrl, decoration: _inputDec('Probation Period (days)'), keyboardType: TextInputType.number), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _leaveCalcDayCtrl, decoration: _inputDec('Leave Calc Day (1-28)'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _leaveIncreaseCtrl, decoration: _inputDec('Leave +/year'), keyboardType: TextInputType.number)),
      ]),
      _sectionHeader('Leave Types'),
      ..._leaveTypes.map((lt) => Card(margin: const EdgeInsets.only(bottom: 8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: ListTile(
          title: Text(lt['name']?.toString() ?? '', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          subtitle: Text('${lt['days_per_year']} days/year • ${(lt['is_paid'] as bool? ?? true) ? 'Paid' : 'Unpaid'}'),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(icon: const Icon(Icons.edit_outlined, size: 18), onPressed: () => _showLeaveModal(leave: lt)),
            IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => setState(() => _leaveTypes.removeWhere((l) => l['id'] == lt['id']))),
          ]),
        ))),
      OutlinedButton.icon(icon: const Icon(Icons.add), label: const Text('Add Leave Type'), onPressed: () => _showLeaveModal()),
      _sectionHeader('Attendance Methods'),
      CheckboxListTile(
        title: const Text('Allow Biometric (Fingerprint/Face/Palm)'),
        value: _allowedAttendanceMethods.contains('biometric'),
        activeColor: AppColors.primary,
        onChanged: (v) => setState(() {
          if (v == true) {
            if (!_allowedAttendanceMethods.contains('biometric')) _allowedAttendanceMethods.add('biometric');
          } else {
            _allowedAttendanceMethods.remove('biometric');
          }
        }),
      ),
      CheckboxListTile(
        title: const Text('Allow QR Code Scan'),
        value: _allowedAttendanceMethods.contains('qr_code'),
        activeColor: AppColors.primary,
        onChanged: (v) => setState(() {
          if (v == true) {
            if (!_allowedAttendanceMethods.contains('qr_code')) _allowedAttendanceMethods.add('qr_code');
          } else {
            _allowedAttendanceMethods.remove('qr_code');
          }
        }),
      ),
      _sectionHeader('Biometric Verification Mode'),
      DropdownButtonFormField<String>(
        value: ['optional', 'strict_finger_face', 'strict_all'].contains(_biometricVerificationMode)
            ? _biometricVerificationMode
            : 'optional',
        decoration: _inputDec('Verification Mode'),
        items: const [
          DropdownMenuItem(value: 'optional', child: Text('Optional (Any method)')),
          DropdownMenuItem(value: 'strict_finger_face', child: Text('Strict: Finger or Face only')),
          DropdownMenuItem(value: 'strict_all', child: Text('Strict: All biometrics required')),
        ],
        onChanged: (v) => setState(() => _biometricVerificationMode = v ?? 'optional'),
      ),
      const SizedBox(height: 20), _saveButton('Save HR Settings', _saving, _save),
      const SizedBox(height: 20),
    ]);
  }
}

// ── Categories & Acting Info Tabs ───────────────────────────────────────────
class _CategoriesTab extends StatelessWidget {
  @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(32), child: Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
    const Icon(Icons.category_outlined, size: 48, color: AppColors.primary), const SizedBox(height: 16),
    Text('Employee Categories', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold)), const SizedBox(height: 12),
    Text('Employee categories and their payroll rules are managed from the web portal under Settings → Employee Categories.', style: GoogleFonts.inter(color: Colors.grey), textAlign: TextAlign.center),
  ])))));
}

class _ActingTab extends StatelessWidget {
  @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(32), child: Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
    const Icon(Icons.swap_horiz_outlined, size: 48, color: AppColors.primary), const SizedBox(height: 16),
    Text('Acting Assignments', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold)), const SizedBox(height: 12),
    Text('Acting assignments allow employees to temporarily assume another role. This feature is available on the web portal under Settings → Acting Assignments.', style: GoogleFonts.inter(color: Colors.grey), textAlign: TextAlign.center),
  ])))));
}
// ── Payroll Tab ──────────────────────────────────────────────────────────────
class _PayrollTab extends StatefulWidget {
  final WidgetRef ref;
  const _PayrollTab({required this.ref});
  @override State<_PayrollTab> createState() => _PayrollTabState();
}
class _PayrollTabState extends State<_PayrollTab> {
  bool _loading = true, _saving = false;
  String _currency = 'USD', _payPeriod = 'monthly';
  final _empPensionCtrl = TextEditingController(), _emplPensionCtrl = TextEditingController();
  final _maxDeductCtrl = TextEditingController(), _latePenaltyCtrl = TextEditingController();
  final _payrollRunDayCtrl = TextEditingController(), _otRateNormalCtrl = TextEditingController();
  final _otRateNightCtrl = TextEditingController(), _otRateHolidayCtrl = TextEditingController();
  final _otRateDayoffCtrl = TextEditingController(), _monthlyHoursCtrl = TextEditingController();
  final _minOtDurationCtrl = TextEditingController();
  bool _autoPayroll = false, _otRequiresApproval = false, _allowLoans = false;

  @override void initState() { super.initState(); _load(); }
  @override void dispose() {
    for (final c in [_empPensionCtrl, _emplPensionCtrl, _maxDeductCtrl, _latePenaltyCtrl, _payrollRunDayCtrl, _otRateNormalCtrl, _otRateNightCtrl, _otRateHolidayCtrl, _otRateDayoffCtrl, _monthlyHoursCtrl, _minOtDurationCtrl]) c.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/settings/payroll');
      final d = res.data as Map<String, dynamic>? ?? {};
      setState(() {
        _currency = d['currency']?.toString() ?? 'USD';
        _payPeriod = d['pay_period']?.toString() ?? 'monthly';
        _empPensionCtrl.text = (d['employee_pension_rate'] ?? '').toString();
        _emplPensionCtrl.text = (d['employer_pension_rate'] ?? '').toString();
        _maxDeductCtrl.text = (d['max_deduction_percent'] ?? '').toString();
        _latePenaltyCtrl.text = (d['late_penalty_per_minute'] ?? '').toString();
        _payrollRunDayCtrl.text = (d['payroll_run_day'] ?? 1).toString();
        _autoPayroll = d['auto_payroll_enabled'] as bool? ?? false;
        _otRateNormalCtrl.text = (d['ot_rate_normal'] ?? '1.5').toString();
        _otRateNightCtrl.text = (d['ot_rate_night'] ?? '1.75').toString();
        _otRateHolidayCtrl.text = (d['ot_rate_holiday'] ?? '2.0').toString();
        _otRateDayoffCtrl.text = (d['ot_rate_dayoff'] ?? '2.0').toString();
        _monthlyHoursCtrl.text = (d['monthly_working_hours'] ?? 192).toString();
        _minOtDurationCtrl.text = (d['minimum_ot_duration'] ?? 30).toString();
        _otRequiresApproval = d['ot_requires_approval'] as bool? ?? false;
        _allowLoans = d['allow_employee_loans'] as bool? ?? false;
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(apiClientProvider).dio.patch('/settings/payroll', data: {
        'currency': _currency, 'pay_period': _payPeriod,
        'employee_pension_rate': double.tryParse(_empPensionCtrl.text) ?? 0,
        'employer_pension_rate': double.tryParse(_emplPensionCtrl.text) ?? 0,
        'max_deduction_percent': double.tryParse(_maxDeductCtrl.text) ?? 0,
        'late_penalty_per_minute': double.tryParse(_latePenaltyCtrl.text) ?? 0,
        'payroll_run_day': int.tryParse(_payrollRunDayCtrl.text) ?? 1,
        'auto_payroll_enabled': _autoPayroll,
        'ot_rate_normal': double.tryParse(_otRateNormalCtrl.text) ?? 1.5,
        'ot_rate_night': double.tryParse(_otRateNightCtrl.text) ?? 1.75,
        'ot_rate_holiday': double.tryParse(_otRateHolidayCtrl.text) ?? 2.0,
        'ot_rate_dayoff': double.tryParse(_otRateDayoffCtrl.text) ?? 2.0,
        'monthly_working_hours': int.tryParse(_monthlyHoursCtrl.text) ?? 192,
        'minimum_ot_duration': int.tryParse(_minOtDurationCtrl.text) ?? 30,
        'ot_requires_approval': _otRequiresApproval,
        'allow_employee_loans': _allowLoans,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payroll settings saved!'), backgroundColor: Colors.green));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
    finally { setState(() => _saving = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final currencies = ['USD', 'EUR', 'GBP', 'ETB', 'KES', 'NGN'];
    final currencyVal = currencies.contains(_currency) ? _currency : 'USD';
    final payPeriods = ['monthly', 'bi-weekly', 'weekly'];
    final payPeriodVal = payPeriods.contains(_payPeriod) ? _payPeriod : 'monthly';
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('Payroll Settings'),
      DropdownButtonFormField<String>(value: currencyVal, decoration: _inputDec('Currency'),
        items: currencies.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
        onChanged: (v) => setState(() => _currency = v ?? _currency)), const SizedBox(height: 10),
      DropdownButtonFormField<String>(value: payPeriodVal, decoration: _inputDec('Pay Period'),
        items: payPeriods.map((p) => DropdownMenuItem(value: p, child: Text(p[0].toUpperCase() + p.substring(1)))).toList(),
        onChanged: (v) => setState(() => _payPeriod = v ?? _payPeriod)), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _empPensionCtrl, decoration: _inputDec('Employee Pension %'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _emplPensionCtrl, decoration: _inputDec('Employer Pension %'), keyboardType: TextInputType.number)),
      ]), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _maxDeductCtrl, decoration: _inputDec('Max Deduction %'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _latePenaltyCtrl, decoration: _inputDec('Late Penalty/min'), keyboardType: TextInputType.number)),
      ]), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _payrollRunDayCtrl, decoration: _inputDec('Payroll Run Day'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: SwitchListTile(title: const Text('Auto Payroll'), value: _autoPayroll, onChanged: (v) => setState(() => _autoPayroll = v), activeColor: AppColors.primary)),
      ]),
      _sectionHeader('Overtime Rates'),
      Row(children: [
        Expanded(child: TextField(controller: _otRateNormalCtrl, decoration: _inputDec('Normal OT'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _otRateNightCtrl, decoration: _inputDec('Night OT'), keyboardType: TextInputType.number)),
      ]), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _otRateHolidayCtrl, decoration: _inputDec('Holiday OT'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _otRateDayoffCtrl, decoration: _inputDec('Day-off OT'), keyboardType: TextInputType.number)),
      ]), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _monthlyHoursCtrl, decoration: _inputDec('Monthly Hrs'), keyboardType: TextInputType.number)),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _minOtDurationCtrl, decoration: _inputDec('Min OT (min)'), keyboardType: TextInputType.number)),
      ]), const SizedBox(height: 10),
      SwitchListTile(title: const Text('OT Requires Approval'), value: _otRequiresApproval, onChanged: (v) => setState(() => _otRequiresApproval = v), activeColor: AppColors.primary),
      SwitchListTile(title: const Text('Allow Employee Loans'), value: _allowLoans, onChanged: (v) => setState(() => _allowLoans = v), activeColor: AppColors.primary),
      const SizedBox(height: 16), _saveButton('Save Payroll Settings', _saving, _save),
      const SizedBox(height: 20),
    ]);
  }
}


