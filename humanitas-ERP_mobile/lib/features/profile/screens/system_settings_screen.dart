import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/providers/providers.dart';

class SystemSettingsScreen extends ConsumerStatefulWidget {
  const SystemSettingsScreen({super.key});
  @override
  ConsumerState<SystemSettingsScreen> createState() => _SystemSettingsScreenState();
}

class _SystemSettingsScreenState extends ConsumerState<SystemSettingsScreen> {
  int _selectedTab = 0;
  final List<Map<String, dynamic>> _tabs = [
    {'label': 'Appearance', 'icon': Icons.palette_outlined},
    {'label': 'General', 'icon': Icons.settings_outlined},
    {'label': 'Company', 'icon': Icons.business_outlined},
    {'label': 'Account', 'icon': Icons.person_outline},
    {'label': 'HR', 'icon': Icons.people_outline},
    {'label': 'Categories', 'icon': Icons.category_outlined},
    {'label': 'Acting', 'icon': Icons.swap_horiz_outlined},
    {'label': 'Payroll', 'icon': Icons.calculate_outlined},
    {'label': 'Notifications', 'icon': Icons.notifications_outlined},
    {'label': 'Email', 'icon': Icons.email_outlined},
    {'label': 'Integrations', 'icon': Icons.extension_outlined},
    {'label': 'Holidays', 'icon': Icons.calendar_month_outlined},
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(title: Text('System Settings', style: GoogleFonts.inter(fontWeight: FontWeight.w600))),
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
          _AppearanceTab(ref: ref),
          _GeneralTab(ref: ref),
          _CompanyTab(ref: ref),
          _AccountTab(ref: ref),
          _HRTab(ref: ref),
          _CategoriesTab(),
          _ActingTab(),
          _PayrollTab(ref: ref),
          _NotificationsTab(ref: ref),
          _EmailTab(ref: ref),
          _IntegrationsTab(ref: ref),
          _HolidaysTab(ref: ref),
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

// ── Appearance Tab ───────────────────────────────────────────────────────────
class _AppearanceTab extends StatefulWidget {
  final WidgetRef ref;
  const _AppearanceTab({required this.ref});
  @override State<_AppearanceTab> createState() => _AppearanceTabState();
}
class _AppearanceTabState extends State<_AppearanceTab> {
  bool _loading = true, _saving = false;
  String _primaryColor = 'oklch(0.75 0.18 75)', _radius = '0.5rem';
  static const List<Map<String, dynamic>> _presets = [
    {'name': 'Gold', 'value': 'oklch(0.75 0.18 75)', 'color': Color(0xFFDAA520)},
    {'name': 'Zinc', 'value': 'oklch(0.21 0.034 264.665)', 'color': Color(0xFF3F3F46)},
    {'name': 'Red', 'value': 'oklch(0.637 0.237 25.331)', 'color': Color(0xFFDC2626)},
    {'name': 'Blue', 'value': 'oklch(0.546 0.245 262.881)', 'color': Color(0xFF2563EB)},
    {'name': 'Green', 'value': 'oklch(0.627 0.194 149.214)', 'color': Color(0xFF16A34A)},
    {'name': 'Orange', 'value': 'oklch(0.705 0.213 47.604)', 'color': Color(0xFFEA580C)},
  ];
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/settings/theme');
      final d = res.data as Map<String, dynamic>? ?? {};
      setState(() { _primaryColor = d['primary_color']?.toString() ?? _primaryColor; _radius = d['radius']?.toString() ?? _radius; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }
  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(apiClientProvider).dio.patch('/settings/theme', data: {'primary_color': _primaryColor, 'radius': _radius});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Appearance saved!'), backgroundColor: Colors.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    } finally { setState(() => _saving = false); }
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('Primary Color'),
      Wrap(spacing: 12, runSpacing: 12, children: _presets.map((p) {
        final isActive = _primaryColor == p['value'];
        return GestureDetector(
          onTap: () => setState(() => _primaryColor = p['value'] as String),
          child: Container(width: 44, height: 44, decoration: BoxDecoration(shape: BoxShape.circle, color: p['color'] as Color,
            border: Border.all(color: isActive ? AppColors.primary : Colors.transparent, width: 3),
            boxShadow: isActive ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.4), blurRadius: 8)] : [])),
        );
      }).toList()),
      const SizedBox(height: 16),
      _sectionHeader('Border Radius'),
      DropdownButtonFormField<String>(value: _radius, decoration: _inputDec('Border Radius'),
        items: const [
          DropdownMenuItem(value: '0', child: Text('None')),
          DropdownMenuItem(value: '0.3rem', child: Text('Small')),
          DropdownMenuItem(value: '0.5rem', child: Text('Medium')),
          DropdownMenuItem(value: '0.75rem', child: Text('Large')),
          DropdownMenuItem(value: '1rem', child: Text('Extra Large')),
        ], onChanged: (v) => setState(() => _radius = v ?? _radius)),
      const SizedBox(height: 24), _saveButton('Save Appearance', _saving, _save),
    ]);
  }
}

// ── General Tab ──────────────────────────────────────────────────────────────
class _GeneralTab extends StatefulWidget {
  final WidgetRef ref;
  const _GeneralTab({required this.ref});
  @override State<_GeneralTab> createState() => _GeneralTabState();
}
class _GeneralTabState extends State<_GeneralTab> {
  bool _loading = true, _saving = false;
  String _language = 'en', _timezone = 'UTC', _dateFormat = 'YYYY-MM-DD', _currency = 'USD';
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/settings/general');
      final d = res.data as Map<String, dynamic>? ?? {};
      setState(() { _language = d['language']?.toString() ?? _language; _timezone = d['timezone']?.toString() ?? _timezone; _dateFormat = d['date_format']?.toString() ?? _dateFormat; _currency = d['currency']?.toString() ?? _currency; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }
  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(apiClientProvider).dio.patch('/settings/general', data: {'language': _language, 'timezone': _timezone, 'date_format': _dateFormat, 'currency': _currency});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('General settings saved!'), backgroundColor: Colors.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    } finally { setState(() => _saving = false); }
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final timezones = ['UTC','UTC+1','UTC+2','UTC+3','UTC+4','UTC+5','UTC+6','UTC+7','UTC+8','UTC+9','UTC+10','UTC+11','UTC+12','UTC-1','UTC-2','UTC-3','UTC-4','UTC-5','UTC-6','UTC-7','UTC-8','UTC-9','UTC-10','UTC-11','UTC-12','Africa/Nairobi','Africa/Addis_Ababa','Africa/Lagos','Europe/London','America/New_York','America/Los_Angeles','Asia/Kolkata'];
    final tzValue = timezones.contains(_timezone) ? _timezone : 'UTC';
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('System Preferences'),
      DropdownButtonFormField<String>(value: _language, decoration: _inputDec('Language'),
        items: const [DropdownMenuItem(value: 'en', child: Text('English')), DropdownMenuItem(value: 'es', child: Text('Spanish')), DropdownMenuItem(value: 'fr', child: Text('French')), DropdownMenuItem(value: 'am', child: Text('Amharic'))],
        onChanged: (v) => setState(() => _language = v ?? _language)),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(value: tzValue, decoration: _inputDec('Timezone'), isExpanded: true,
        items: timezones.map((tz) => DropdownMenuItem(value: tz, child: Text(tz))).toList(),
        onChanged: (v) => setState(() => _timezone = v ?? _timezone)),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(value: _dateFormat, decoration: _inputDec('Date Format'),
        items: const [DropdownMenuItem(value: 'MM/DD/YYYY', child: Text('MM/DD/YYYY')), DropdownMenuItem(value: 'DD/MM/YYYY', child: Text('DD/MM/YYYY')), DropdownMenuItem(value: 'YYYY-MM-DD', child: Text('YYYY-MM-DD'))],
        onChanged: (v) => setState(() => _dateFormat = v ?? _dateFormat)),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(value: _currency, decoration: _inputDec('Currency'),
        items: const [DropdownMenuItem(value: 'USD', child: Text('USD - US Dollar')), DropdownMenuItem(value: 'EUR', child: Text('EUR - Euro')), DropdownMenuItem(value: 'GBP', child: Text('GBP - British Pound')), DropdownMenuItem(value: 'ETB', child: Text('ETB - Ethiopian Birr')), DropdownMenuItem(value: 'KES', child: Text('KES - Kenyan Shilling')), DropdownMenuItem(value: 'NGN', child: Text('NGN - Nigerian Naira'))],
        onChanged: (v) => setState(() => _currency = v ?? _currency)),
      const SizedBox(height: 24), _saveButton('Save Preferences', _saving, _save),
    ]);
  }
}

// ── Company Tab ──────────────────────────────────────────────────────────────
class _CompanyTab extends StatefulWidget {
  final WidgetRef ref;
  const _CompanyTab({required this.ref});
  @override State<_CompanyTab> createState() => _CompanyTabState();
}
class _CompanyTabState extends State<_CompanyTab> {
  bool _loading = true, _saving = false;
  final _nameCtrl = TextEditingController(), _addressCtrl = TextEditingController(), _phoneCtrl = TextEditingController(), _emailCtrl = TextEditingController(), _taxCtrl = TextEditingController();
  List<Map<String, dynamic>> _departments = [];
  @override void initState() { super.initState(); _load(); }
  @override void dispose() { for (final c in [_nameCtrl, _addressCtrl, _phoneCtrl, _emailCtrl, _taxCtrl]) c.dispose(); super.dispose(); }
  Future<void> _load() async {
    try {
      final api = widget.ref.read(apiClientProvider).dio;
      final r1 = await api.get('/settings/company'); final d = r1.data as Map<String, dynamic>? ?? {};
      _nameCtrl.text = d['company_name']?.toString() ?? ''; _addressCtrl.text = d['company_address']?.toString() ?? '';
      _phoneCtrl.text = d['company_phone']?.toString() ?? ''; _emailCtrl.text = d['company_email']?.toString() ?? ''; _taxCtrl.text = d['tax_id']?.toString() ?? '';
      final r2 = await api.get('/settings/departments'); final depts = r2.data;
      setState(() { if (depts is List) _departments = depts.map((e) => Map<String, dynamic>.from(e as Map)).toList(); _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }
  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(apiClientProvider).dio.patch('/settings/company', data: {'company_name': _nameCtrl.text, 'company_address': _addressCtrl.text, 'company_phone': _phoneCtrl.text, 'company_email': _emailCtrl.text, 'tax_id': _taxCtrl.text});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Company info saved!'), backgroundColor: Colors.green));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
    finally { setState(() => _saving = false); }
  }
  Future<void> _reloadDepts() async {
    final res = await widget.ref.read(apiClientProvider).dio.get('/settings/departments');
    if (res.data is List && mounted) setState(() => _departments = (res.data as List).map((e) => Map<String, dynamic>.from(e as Map)).toList());
  }
  Future<void> _showDeptModal({Map<String, dynamic>? dept}) async {
    final nameC = TextEditingController(text: dept?['name']?.toString() ?? '');
    final descC = TextEditingController(text: dept?['description']?.toString() ?? '');
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        bool isSavingDept = false;
        return StatefulBuilder(
          builder: (ctx, setMS) => Padding(
            padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(dept == null ? 'Add Department' : 'Edit Department', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                TextField(controller: nameC, decoration: _inputDec('Department Name *')),
                const SizedBox(height: 10),
                TextField(controller: descC, decoration: _inputDec('Description'), maxLines: 2),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        onPressed: isSavingDept ? null : () async {
                          if (nameC.text.trim().isEmpty) return;
                          setMS(() => isSavingDept = true);
                          try {
                            final api = widget.ref.read(apiClientProvider).dio;
                            if (dept == null) {
                              await api.post('/settings/departments', data: {'name': nameC.text.trim(), 'description': descC.text.trim()});
                            } else {
                              await api.patch('/settings/departments/${dept['id']}', data: {'name': nameC.text.trim(), 'description': descC.text.trim()});
                            }
                            if (ctx.mounted) Navigator.pop(ctx);
                            await _reloadDepts();
                          } catch (e) {
                            if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
                          } finally {
                            setMS(() => isSavingDept = false);
                          }
                        },
                        child: isSavingDept
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Save', style: TextStyle(color: Colors.white)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
  Future<void> _deleteDept(String id) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(title: const Text('Delete Department'), content: const Text('Are you sure?'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red)))]));
    if (ok != true) return;
    try { await widget.ref.read(apiClientProvider).dio.delete('/settings/departments/$id'); await _reloadDepts(); } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('Company Information'),
      TextField(controller: _nameCtrl, decoration: _inputDec('Company Name')), const SizedBox(height: 10),
      TextField(controller: _addressCtrl, decoration: _inputDec('Company Address')), const SizedBox(height: 10),
      TextField(controller: _phoneCtrl, decoration: _inputDec('Company Phone'), keyboardType: TextInputType.phone), const SizedBox(height: 10),
      TextField(controller: _emailCtrl, decoration: _inputDec('Company Email'), keyboardType: TextInputType.emailAddress), const SizedBox(height: 10),
      TextField(controller: _taxCtrl, decoration: _inputDec('Tax ID / Registration Number')),
      const SizedBox(height: 20), _saveButton('Save Company Info', _saving, _save),
      _sectionHeader('Departments'),
      ..._departments.map((d) => Card(margin: const EdgeInsets.only(bottom: 8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: ListTile(leading: const Icon(Icons.apartment_outlined, color: AppColors.primary),
          title: Text(d['name']?.toString() ?? '', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          subtitle: (d['description']?.toString() ?? '').isNotEmpty ? Text(d['description']!.toString()) : null,
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(icon: const Icon(Icons.edit_outlined, size: 18), onPressed: () => _showDeptModal(dept: d)),
            IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _deleteDept(d['id']?.toString() ?? '')),
          ])))),
      const SizedBox(height: 8),
      OutlinedButton.icon(icon: const Icon(Icons.add), label: const Text('Add Department'), onPressed: () => _showDeptModal()),
      const SizedBox(height: 20),
    ]);
  }
}

// ── Account & Security Tab ───────────────────────────────────────────────────
class _AccountTab extends StatefulWidget {
  final WidgetRef ref;
  const _AccountTab({required this.ref});
  @override State<_AccountTab> createState() => _AccountTabState();
}
class _AccountTabState extends State<_AccountTab> {
  bool _loading = true, _savingProfile = false, _savingPwd = false;
  final _fullNameCtrl = TextEditingController(), _emailCtrl = TextEditingController(), _phoneCtrl = TextEditingController(), _birthCtrl = TextEditingController();
  final _addressCtrl = TextEditingController(), _cityCtrl = TextEditingController(), _stateCtrl = TextEditingController(), _countryCtrl = TextEditingController(), _postalCtrl = TextEditingController();
  String _gender = '', _maritalStatus = '';
  final _nationalityCtrl = TextEditingController(), _nationalIdCtrl = TextEditingController(), _emergNameCtrl = TextEditingController(), _emergPhoneCtrl = TextEditingController(), _emergRelCtrl = TextEditingController();
  final _curPwdCtrl = TextEditingController(), _newPwdCtrl = TextEditingController(), _confPwdCtrl = TextEditingController();

  @override void initState() { super.initState(); _load(); }
  @override void dispose() { for (final c in [_fullNameCtrl, _emailCtrl, _phoneCtrl, _birthCtrl, _addressCtrl, _cityCtrl, _stateCtrl, _countryCtrl, _postalCtrl, _nationalityCtrl, _nationalIdCtrl, _emergNameCtrl, _emergPhoneCtrl, _emergRelCtrl, _curPwdCtrl, _newPwdCtrl, _confPwdCtrl]) c.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/users/me');
      final d = res.data as Map<String, dynamic>? ?? {};
      setState(() {
        _fullNameCtrl.text = d['full_name']?.toString() ?? '';
        _emailCtrl.text = d['email']?.toString() ?? '';
        _phoneCtrl.text = d['phone']?.toString() ?? '';
        _birthCtrl.text = (d['birth_date']?.toString() ?? '').split('T').first;
        _addressCtrl.text = d['address']?.toString() ?? '';
        _cityCtrl.text = d['city']?.toString() ?? '';
        _stateCtrl.text = d['state']?.toString() ?? '';
        _countryCtrl.text = d['country']?.toString() ?? '';
        _postalCtrl.text = d['postal_code']?.toString() ?? '';
        _gender = d['gender']?.toString() ?? '';
        _maritalStatus = d['marital_status']?.toString() ?? '';
        _nationalityCtrl.text = d['nationality']?.toString() ?? '';
        _nationalIdCtrl.text = d['national_id']?.toString() ?? '';
        _emergNameCtrl.text = d['emergency_contact_name']?.toString() ?? '';
        _emergPhoneCtrl.text = d['emergency_contact_phone']?.toString() ?? '';
        _emergRelCtrl.text = d['emergency_contact_relationship']?.toString() ?? '';
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _saveProfile() async {
    setState(() => _savingProfile = true);
    try {
      await widget.ref.read(apiClientProvider).dio.patch('/users/me', data: {
        'full_name': _fullNameCtrl.text, 'phone': _phoneCtrl.text, 'birth_date': _birthCtrl.text,
        'address': _addressCtrl.text, 'city': _cityCtrl.text, 'state': _stateCtrl.text,
        'country': _countryCtrl.text, 'postal_code': _postalCtrl.text, 'gender': _gender,
        'marital_status': _maritalStatus, 'nationality': _nationalityCtrl.text, 'national_id': _nationalIdCtrl.text,
        'emergency_contact_name': _emergNameCtrl.text, 'emergency_contact_phone': _emergPhoneCtrl.text,
        'emergency_contact_relationship': _emergRelCtrl.text,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile saved!'), backgroundColor: Colors.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    } finally { setState(() => _savingProfile = false); }
  }

  Future<void> _savePassword() async {
    if (_newPwdCtrl.text != _confPwdCtrl.text) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Passwords do not match'), backgroundColor: Colors.red));
      return;
    }
    setState(() => _savingPwd = true);
    try {
      await widget.ref.read(apiClientProvider).dio.post('/auth/change-password', data: {'current_password': _curPwdCtrl.text, 'new_password': _newPwdCtrl.text});
      _curPwdCtrl.clear(); _newPwdCtrl.clear(); _confPwdCtrl.clear();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password changed!'), backgroundColor: Colors.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    } finally { setState(() => _savingPwd = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    const genders = ['', 'Male', 'Female', 'Other', 'Prefer not to say'];
    const maritalOptions = ['', 'Single', 'Married', 'Divorced', 'Widowed'];
    final genderVal = genders.contains(_gender) ? _gender : '';
    final maritalVal = maritalOptions.contains(_maritalStatus) ? _maritalStatus : '';
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('Personal Information'),
      TextField(controller: _fullNameCtrl, decoration: _inputDec('Full Name')), const SizedBox(height: 10),
      TextField(controller: _emailCtrl, decoration: _inputDec('Email (read-only)'), readOnly: true, style: const TextStyle(color: Colors.grey)), const SizedBox(height: 10),
      TextField(controller: _phoneCtrl, decoration: _inputDec('Phone'), keyboardType: TextInputType.phone), const SizedBox(height: 10),
      TextField(controller: _birthCtrl, decoration: _inputDec('Birth Date (YYYY-MM-DD)'), keyboardType: TextInputType.datetime),
      _sectionHeader('Address'),
      TextField(controller: _addressCtrl, decoration: _inputDec('Address')), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _cityCtrl, decoration: _inputDec('City'))),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _stateCtrl, decoration: _inputDec('State'))),
      ]), const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _countryCtrl, decoration: _inputDec('Country'))),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _postalCtrl, decoration: _inputDec('Postal Code'))),
      ]),
      _sectionHeader('Personal Details'),
      DropdownButtonFormField<String>(value: genderVal, decoration: _inputDec('Gender'),
        items: genders.map((g) => DropdownMenuItem(value: g, child: Text(g.isEmpty ? 'Not specified' : g))).toList(),
        onChanged: (v) => setState(() => _gender = v ?? '')), const SizedBox(height: 10),
      DropdownButtonFormField<String>(value: maritalVal, decoration: _inputDec('Marital Status'),
        items: maritalOptions.map((s) => DropdownMenuItem(value: s, child: Text(s.isEmpty ? 'Not specified' : s))).toList(),
        onChanged: (v) => setState(() => _maritalStatus = v ?? '')), const SizedBox(height: 10),
      TextField(controller: _nationalityCtrl, decoration: _inputDec('Nationality')), const SizedBox(height: 10),
      TextField(controller: _nationalIdCtrl, decoration: _inputDec('National ID')),
      _sectionHeader('Emergency Contact'),
      TextField(controller: _emergNameCtrl, decoration: _inputDec('Contact Name')), const SizedBox(height: 10),
      TextField(controller: _emergPhoneCtrl, decoration: _inputDec('Contact Phone'), keyboardType: TextInputType.phone), const SizedBox(height: 10),
      TextField(controller: _emergRelCtrl, decoration: _inputDec('Relationship')),
      const SizedBox(height: 20),
      _saveButton('Save Profile', _savingProfile, _saveProfile),
      _sectionHeader('Change Password'),
      TextField(controller: _curPwdCtrl, decoration: _inputDec('Current Password'), obscureText: true), const SizedBox(height: 10),
      TextField(controller: _newPwdCtrl, decoration: _inputDec('New Password'), obscureText: true), const SizedBox(height: 10),
      TextField(controller: _confPwdCtrl, decoration: _inputDec('Confirm New Password'), obscureText: true),
      const SizedBox(height: 16),
      _saveButton('Change Password', _savingPwd, _savePassword),
      const SizedBox(height: 20),
    ]);
  }
}

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

// ── Notifications Tab ────────────────────────────────────────────────────────
class _NotificationsTab extends StatefulWidget {
  final WidgetRef ref;
  const _NotificationsTab({required this.ref});
  @override State<_NotificationsTab> createState() => _NotificationsTabState();
}
class _NotificationsTabState extends State<_NotificationsTab> {
  bool _loading = true, _saving = false;
  String _emailNotif = 'all', _smsNotif = 'important', _pushNotif = 'all';
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/settings/notifications');
      final d = res.data as Map<String, dynamic>? ?? {};
      setState(() { _emailNotif = d['email_notifications']?.toString() ?? 'all'; _smsNotif = d['sms_notifications']?.toString() ?? 'important'; _pushNotif = d['push_notifications']?.toString() ?? 'all'; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }
  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(apiClientProvider).dio.patch('/settings/notifications', data: {'email_notifications': _emailNotif, 'sms_notifications': _smsNotif, 'push_notifications': _pushNotif});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Notification settings saved!'), backgroundColor: Colors.green));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
    finally { setState(() => _saving = false); }
  }
  Widget _notifRow(String label, String desc, String value, void Function(String) onChanged) {
    const opts = [DropdownMenuItem(value: 'all', child: Text('All')), DropdownMenuItem(value: 'important', child: Text('Important Only')), DropdownMenuItem(value: 'none', child: Text('None'))];
    return Card(margin: const EdgeInsets.only(bottom: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          const SizedBox(height: 2), Text(desc, style: GoogleFonts.inter(fontSize: 12, color: Colors.grey)),
        ])),
        const SizedBox(width: 12),
        DropdownButton<String>(value: value, items: opts, underline: const SizedBox(), onChanged: (v) { if (v != null) onChanged(v); }),
      ])));
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('Notification Channels'),
      _notifRow('Email Notifications', 'Receive updates via email', _emailNotif, (v) => setState(() => _emailNotif = v)),
      _notifRow('SMS Notifications', 'Receive updates via SMS', _smsNotif, (v) => setState(() => _smsNotif = v)),
      _notifRow('Push Notifications', 'Receive push notifications', _pushNotif, (v) => setState(() => _pushNotif = v)),
      const SizedBox(height: 8), _saveButton('Save Notification Settings', _saving, _save),
    ]);
  }
}

// ── Email Settings Tab ───────────────────────────────────────────────────────
class _EmailTab extends StatefulWidget {
  final WidgetRef ref;
  const _EmailTab({required this.ref});
  @override State<_EmailTab> createState() => _EmailTabState();
}
class _EmailTabState extends State<_EmailTab> {
  bool _loading = true, _saving = false, _testSending = false;
  final _smtpHostCtrl = TextEditingController(), _smtpPortCtrl = TextEditingController();
  final _smtpUserCtrl = TextEditingController(), _smtpPassCtrl = TextEditingController();
  final _senderNameCtrl = TextEditingController(), _senderEmailCtrl = TextEditingController();
  bool _useTls = true;
  @override void initState() { super.initState(); _load(); }
  @override void dispose() { for (final c in [_smtpHostCtrl, _smtpPortCtrl, _smtpUserCtrl, _smtpPassCtrl, _senderNameCtrl, _senderEmailCtrl]) c.dispose(); super.dispose(); }
  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/settings/email');
      final d = res.data as Map<String, dynamic>? ?? {};
      setState(() {
        _smtpHostCtrl.text = d['smtp_host']?.toString() ?? '';
        _smtpPortCtrl.text = (d['smtp_port'] ?? 587).toString();
        _smtpUserCtrl.text = d['smtp_username']?.toString() ?? '';
        _smtpPassCtrl.text = d['smtp_password']?.toString() ?? '';
        _useTls = d['use_tls'] as bool? ?? true;
        _senderNameCtrl.text = d['sender_name']?.toString() ?? '';
        _senderEmailCtrl.text = d['sender_email']?.toString() ?? '';
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }
  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(apiClientProvider).dio.put('/settings/email', data: {'smtp_host': _smtpHostCtrl.text, 'smtp_port': int.tryParse(_smtpPortCtrl.text) ?? 587, 'smtp_username': _smtpUserCtrl.text, 'smtp_password': _smtpPassCtrl.text, 'use_tls': _useTls, 'sender_name': _senderNameCtrl.text, 'sender_email': _senderEmailCtrl.text});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Email settings saved!'), backgroundColor: Colors.green));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
    finally { setState(() => _saving = false); }
  }
  Future<void> _testEmail() async {
    setState(() => _testSending = true);
    try {
      await widget.ref.read(apiClientProvider).dio.post('/settings/email/test');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Test email sent!'), backgroundColor: Colors.green));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
    finally { setState(() => _testSending = false); }
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('SMTP Configuration'),
      TextField(controller: _smtpHostCtrl, decoration: _inputDec('SMTP Host')), const SizedBox(height: 10),
      TextField(controller: _smtpPortCtrl, decoration: _inputDec('SMTP Port'), keyboardType: TextInputType.number), const SizedBox(height: 10),
      TextField(controller: _smtpUserCtrl, decoration: _inputDec('SMTP Username')), const SizedBox(height: 10),
      TextField(controller: _smtpPassCtrl, decoration: _inputDec('SMTP Password'), obscureText: true), const SizedBox(height: 10),
      SwitchListTile(title: const Text('Use TLS/SSL'), value: _useTls, onChanged: (v) => setState(() => _useTls = v), activeColor: AppColors.primary),
      _sectionHeader('Sender Details'),
      TextField(controller: _senderNameCtrl, decoration: _inputDec('Sender Name')), const SizedBox(height: 10),
      TextField(controller: _senderEmailCtrl, decoration: _inputDec('Sender Email'), keyboardType: TextInputType.emailAddress),
      const SizedBox(height: 20),
      Row(children: [
        Expanded(child: OutlinedButton.icon(icon: _testSending ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send_outlined), label: const Text('Send Test Email'), onPressed: _testSending ? null : _testEmail)),
        const SizedBox(width: 12),
        Expanded(child: _saveButton('Save Config', _saving, _save)),
      ]),
      const SizedBox(height: 20),
    ]);
  }
}

// ── Integrations Tab ─────────────────────────────────────────────────────────
class _IntegrationsTab extends StatefulWidget {
  final WidgetRef ref;
  const _IntegrationsTab({required this.ref});
  @override State<_IntegrationsTab> createState() => _IntegrationsTabState();
}
class _IntegrationsTabState extends State<_IntegrationsTab> {
  bool _loading = true, _saving = false, _registering = false, _obscureKey = true;
  final _apiKeyCtrl = TextEditingController();
  @override void initState() { super.initState(); _load(); }
  @override void dispose() { _apiKeyCtrl.dispose(); super.dispose(); }
  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/settings/integrations');
      final d = res.data as Map<String, dynamic>? ?? {};
      setState(() { _apiKeyCtrl.text = d['krinai_api_key']?.toString() ?? ''; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }
  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.ref.read(apiClientProvider).dio.patch('/settings/integrations', data: {'krinai_api_key': _apiKeyCtrl.text});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Integration saved!'), backgroundColor: Colors.green));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
    finally { setState(() => _saving = false); }
  }
  Future<void> _registerWebhook() async {
    setState(() => _registering = true);
    try {
      await widget.ref.read(apiClientProvider).dio.post('/recruitment/register-webhook');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Webhook registered!'), backgroundColor: Colors.green));
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
    finally { setState(() => _registering = false); }
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('Krinai Recruitment Integration'),
      Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Krinai API Key', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text('Generate this key from the Krinai dashboard under Webhooks & API', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey)),
        const SizedBox(height: 12),
        TextField(controller: _apiKeyCtrl, obscureText: _obscureKey, decoration: _inputDec('API Key').copyWith(
          suffixIcon: IconButton(icon: Icon(_obscureKey ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _obscureKey = !_obscureKey)))),
      ]))),
      const SizedBox(height: 20),
      OutlinedButton.icon(
        icon: _registering ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.webhook_outlined),
        label: const Text('Register Webhook'),
        onPressed: _registering ? null : _registerWebhook,
      ),
      const SizedBox(height: 12),
      _saveButton('Save & Connect', _saving, _save),
      const SizedBox(height: 20),
    ]);
  }
}

// ── Holidays Tab ─────────────────────────────────────────────────────────────
class _HolidaysTab extends StatefulWidget {
  final WidgetRef ref;
  const _HolidaysTab({required this.ref});
  @override State<_HolidaysTab> createState() => _HolidaysTabState();
}
class _HolidaysTabState extends State<_HolidaysTab> {
  bool _loading = true;
  List<Map<String, dynamic>> _holidays = [];
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final res = await widget.ref.read(apiClientProvider).dio.get('/holidays');
      if (res.data is List && mounted) setState(() { _holidays = (res.data as List).map((e) => Map<String, dynamic>.from(e as Map)).toList(); _loading = false; });
      else setState(() => _loading = false);
    } catch (_) { setState(() => _loading = false); }
  }
  Future<void> _showHolidayModal({Map<String, dynamic>? holiday}) async {
    final nameC = TextEditingController(text: holiday?['name']?.toString() ?? '');
    final dateC = TextEditingController(text: (holiday?['date']?.toString() ?? '').split('T').first);
    bool recurring = holiday?['recurring'] as bool? ?? false;
    String type = holiday?['type']?.toString() ?? 'public';
    await showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setMS) => Padding(
        padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(holiday == null ? 'Add Holiday' : 'Edit Holiday', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(controller: nameC, decoration: _inputDec('Holiday Name *')), const SizedBox(height: 10),
          TextField(controller: dateC, decoration: _inputDec('Date (YYYY-MM-DD)'), keyboardType: TextInputType.datetime), const SizedBox(height: 10),
          DropdownButtonFormField<String>(value: type, decoration: _inputDec('Type'),
            items: const [DropdownMenuItem(value: 'public', child: Text('Public')), DropdownMenuItem(value: 'company', child: Text('Company'))],
            onChanged: (v) => setMS(() => type = v ?? 'public')), const SizedBox(height: 10),
          SwitchListTile(title: const Text('Recurring'), value: recurring, onChanged: (v) => setMS(() => recurring = v), activeColor: AppColors.primary),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel'))),
            const SizedBox(width: 12),
            Expanded(child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: () async {
                if (nameC.text.trim().isEmpty || dateC.text.trim().isEmpty) return;
                try {
                  final api = widget.ref.read(apiClientProvider).dio;
                  final data = {'name': nameC.text.trim(), 'date': dateC.text.trim(), 'type': type, 'recurring': recurring};
                  if (holiday == null) { await api.post('/holidays', data: data); } 
                  else { await api.patch('/holidays/${holiday['id']}', data: data); }
                  if (ctx.mounted) Navigator.pop(ctx);
                  await _load();
                } catch (e) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
                }
              },
              child: const Text('Save', style: TextStyle(color: Colors.white)),
            )),
          ]),
        ]),
      )),
    );
  }
  Future<void> _deleteHoliday(String id) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(title: const Text('Delete Holiday'), content: const Text('Delete this holiday?'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red)))]));
    if (ok != true) return;
    try { await widget.ref.read(apiClientProvider).dio.delete('/holidays/$id'); await _load(); }
    catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)); }
  }
  Color _typeColor(String t) => t == 'public' ? Colors.blue : Colors.orange;
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return ListView(padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + bottomPadding), children: [
      _sectionHeader('Holidays (${_holidays.length})'),
      ..._holidays.map((h) => Card(margin: const EdgeInsets.only(bottom: 8), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: ListTile(
          leading: CircleAvatar(backgroundColor: _typeColor(h['type']?.toString() ?? 'public').withValues(alpha: 0.15),
            child: Icon(Icons.event_outlined, color: _typeColor(h['type']?.toString() ?? 'public'), size: 20)),
          title: Text(h['name']?.toString() ?? '', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          subtitle: Row(children: [
            Text((h['date']?.toString() ?? '').split('T').first, style: GoogleFonts.inter(fontSize: 12)),
            const SizedBox(width: 8),
            if (h['recurring'] == true) Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)), child: const Text('Recurring', style: TextStyle(fontSize: 10, color: Colors.green))),
            const SizedBox(width: 4),
            Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: _typeColor(h['type']?.toString() ?? 'public').withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
              child: Text(h['type']?.toString() ?? '', style: TextStyle(fontSize: 10, color: _typeColor(h['type']?.toString() ?? 'public')))),
          ]),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(icon: const Icon(Icons.edit_outlined, size: 18), onPressed: () => _showHolidayModal(holiday: h)),
            IconButton(icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red), onPressed: () => _deleteHoliday(h['id']?.toString() ?? '')),
          ]),
        ))),
      const SizedBox(height: 8),
      OutlinedButton.icon(icon: const Icon(Icons.add), label: const Text('Add Holiday'), onPressed: () => _showHolidayModal()),
      const SizedBox(height: 20),
    ]);
  }
}
