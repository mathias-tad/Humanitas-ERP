import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/delegation_model.dart';
import '../providers/delegation_provider.dart';

class DelegationsScreen extends ConsumerStatefulWidget {
  const DelegationsScreen({super.key});

  @override
  ConsumerState<DelegationsScreen> createState() => _DelegationsScreenState();
}

class _DelegationsScreenState extends ConsumerState<DelegationsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Form state
  String _selectedScope = 'ALL';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  DateTime _endDate = DateTime.now().add(const Duration(days: 7));
  final _reasonController = TextEditingController();
  final _delegateeIdController = TextEditingController();

  // Acting Assignment state
  bool _isActingAssignment = false;
  final _actingPositionController = TextEditingController();
  String _actingAllowanceType = 'percentage';
  final _actingAllowancePercentageController = TextEditingController(text: '15');
  final _actingAllowanceAmountController = TextEditingController(text: '0');
  final _actingNotesController = TextEditingController();

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _reasonController.dispose();
    _delegateeIdController.dispose();
    _actingPositionController.dispose();
    _actingAllowancePercentageController.dispose();
    _actingAllowanceAmountController.dispose();
    _actingNotesController.dispose();
    super.dispose();
  }

  Future<void> _handleCreateDelegation() async {
    final delegateeId = _delegateeIdController.text.trim();
    if (delegateeId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter delegatee user ID or select colleague')),
      );
      return;
    }

    if (_endDate.isBefore(_startDate)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('End date must be after start date')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final repository = ref.read(delegationRepositoryProvider);
      final payload = <String, dynamic>{
        'delegatee_id': delegateeId,
        'scope': _selectedScope,
        'start_date': _startDate.toIso8601String(),
        'end_date': _endDate.toIso8601String(),
        'reason': _reasonController.text.trim(),
        'is_acting_assignment': _isActingAssignment,
        if (_isActingAssignment) ...{
          'acting_position_title': _actingPositionController.text.trim(),
          'acting_allowance_type': _actingAllowanceType,
          if (_actingAllowanceType == 'percentage')
            'acting_allowance_percentage':
                double.tryParse(_actingAllowancePercentageController.text.trim()) ?? 0.0
          else
            'acting_allowance_amount':
                double.tryParse(_actingAllowanceAmountController.text.trim()) ?? 0.0,
          'acting_notes': _actingNotesController.text.trim(),
        },
      };

      await repository.createDelegation(payload);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isActingAssignment
                ? 'Acting assignment & delegation registered successfully'
                : 'Position authority delegated successfully',
          ),
        ),
      );

      ref.invalidate(myDelegationsProvider);
      ref.invalidate(activeDelegationsProvider);
      ref.invalidate(delegationAuditLogsProvider);

      _tabController.animateTo(1);
      _delegateeIdController.clear();
      _reasonController.clear();
      _actingPositionController.clear();
      _actingNotesController.clear();
      setState(() => _isActingAssignment = false);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _handleRevoke(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Revoke Delegation'),
        content: const Text('Are you sure you want to revoke this delegation immediately?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Revoke', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final repository = ref.read(delegationRepositoryProvider);
      await repository.revokeDelegation(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Delegation revoked successfully')),
      );
      ref.invalidate(myDelegationsProvider);
      ref.invalidate(activeDelegationsProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Authority Delegation & Acting'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Delegate', icon: Icon(Icons.person_add_alt_1, size: 20)),
            Tab(text: 'My Delegations', icon: Icon(Icons.history, size: 20)),
            Tab(text: 'Audit Trail', icon: Icon(Icons.receipt_long, size: 20)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildDelegateTab(),
          _buildMyDelegationsTab(),
          _buildAuditTrailTab(),
        ],
      ),
    );
  }

  Widget _buildDelegateTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: Colors.amber.shade50,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.amber.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.shield_outlined, color: Colors.amber.shade800),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Universal Authority Delegation transfers permissions and position duties temporarily. In HR-subscribed organizations, configure acting assignments to grant financial allowances.',
                      style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _delegateeIdController,
            decoration: const InputDecoration(
              labelText: 'Delegatee User ID *',
              hintText: 'Enter user UUID or colleague ID',
              prefixIcon: Icon(Icons.person_outline),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _selectedScope,
            decoration: const InputDecoration(
              labelText: 'Authority Scope *',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.security),
            ),
            items: const [
              DropdownMenuItem(value: 'ALL', child: Text('ALL — Full Position Authority')),
              DropdownMenuItem(value: 'APPROVALS', child: Text('APPROVALS — Leave, Expense, Overtime')),
              DropdownMenuItem(value: 'ATTENDANCE', child: Text('ATTENDANCE — Shifts & Timecard')),
              DropdownMenuItem(value: 'PMS', child: Text('PMS — Tasks & Projects')),
            ],
            onChanged: (val) {
              if (val != null) setState(() => _selectedScope = val);
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Start Date', style: TextStyle(fontSize: 12)),
                  subtitle: Text(
                    '${_startDate.year}-${_startDate.month.toString().padLeft(2, '0')}-${_startDate.day.toString().padLeft(2, '0')}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  trailing: const Icon(Icons.calendar_today, size: 18),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _startDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setState(() => _startDate = picked);
                  },
                ),
              ),
              Expanded(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('End Date', style: TextStyle(fontSize: 12)),
                  subtitle: Text(
                    '${_endDate.year}-${_endDate.month.toString().padLeft(2, '0')}-${_endDate.day.toString().padLeft(2, '0')}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  trailing: const Icon(Icons.calendar_today, size: 18),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _endDate,
                      firstDate: _startDate,
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setState(() => _endDate = picked);
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // HR Acting Assignment Card
          Card(
            color: Colors.indigo.shade50,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.indigo.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.badge_outlined, color: Colors.indigo.shade800, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'Acting Assignment & Allowance',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: Colors.indigo.shade900,
                            ),
                          ),
                        ],
                      ),
                      Switch(
                        value: _isActingAssignment,
                        activeColor: Colors.indigo,
                        onChanged: (val) => setState(() => _isActingAssignment = val),
                      ),
                    ],
                  ),
                  if (_isActingAssignment) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: _actingPositionController,
                      decoration: const InputDecoration(
                        labelText: 'Acting Position Title',
                        hintText: 'e.g. Acting Department Head',
                        border: OutlineInputBorder(),
                        isDense: true,
                        prefixIcon: Icon(Icons.work_outline, size: 18),
                      ),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _actingAllowanceType,
                      decoration: const InputDecoration(
                        labelText: 'Allowance Calculation Mode',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: const [
                        DropdownMenuItem(value: 'percentage', child: Text('Percentage of Delegator Salary (%)')),
                        DropdownMenuItem(value: 'fixed_amount', child: Text('Fixed Monthly Allowance (ETB)')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _actingAllowanceType = val);
                      },
                    ),
                    const SizedBox(height: 10),
                    if (_actingAllowanceType == 'percentage')
                      TextField(
                        controller: _actingAllowancePercentageController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Allowance Percentage (%)',
                          hintText: 'e.g. 15',
                          border: OutlineInputBorder(),
                          isDense: true,
                          prefixIcon: Icon(Icons.percent, size: 18),
                        ),
                      )
                    else
                      TextField(
                        controller: _actingAllowanceAmountController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Fixed Monthly Amount (ETB)',
                          hintText: 'e.g. 5000',
                          border: OutlineInputBorder(),
                          isDense: true,
                          prefixIcon: Icon(Icons.payments_outlined, size: 18),
                        ),
                      ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _actingNotesController,
                      decoration: const InputDecoration(
                        labelText: 'Acting Memo / Reference',
                        hintText: 'e.g. HR-MEMO-2026-08',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _reasonController,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Reason for Delegation',
              hintText: 'e.g. Annual Vacation, Conference, Medical Leave',
              prefixIcon: Icon(Icons.notes),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _isSubmitting ? null : _handleCreateDelegation,
            icon: _isSubmitting
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check_circle_outline),
            label: Text(
              _isActingAssignment ? 'Confirm & Appoint Acting Role' : 'Confirm & Delegate Authority',
            ),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMyDelegationsTab() {
    final myDelegationsAsync = ref.watch(myDelegationsProvider);

    return myDelegationsAsync.when(
      data: (data) {
        final granted = data['granted'] ?? [];
        final received = data['received'] ?? [];

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Delegations I Have Granted',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            if (granted.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('No delegations granted yet.', style: TextStyle(color: Colors.grey)),
              )
            else
              ...granted.map((d) => _buildDelegationCard(d, isGrantedByMe: true)),
            const Divider(height: 32),
            const Text(
              'Delegations Granted to Me',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            if (received.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('No delegations received.', style: TextStyle(color: Colors.grey)),
              )
            else
              ...received.map((d) => _buildDelegationCard(d, isGrantedByMe: false)),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error loading delegations: $e')),
    );
  }

  Widget _buildDelegationCard(UserDelegationModel d, {required bool isGrantedByMe}) {
    final title = isGrantedByMe
        ? (d.delegateeName ?? d.delegateeEmail ?? 'Colleague')
        : (d.delegatorName ?? d.delegatorEmail ?? 'Colleague');

    final prefix = isGrantedByMe ? 'To: ' : 'From: ';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '$prefix$title',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: d.isActive ? Colors.green.shade100 : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    d.status.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: d.isActive ? Colors.green.shade900 : Colors.grey.shade700,
                    ),
                  ),
                ),
              ],
            ),
            if (d.isActingAssignment) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.indigo.shade100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'ACTING',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.indigo.shade900,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    d.actingPositionTitle ?? 'Covering Role',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.indigo.shade900,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    d.actingAllowanceType == 'fixed_amount'
                        ? '(${d.actingAllowanceAmount} ETB)'
                        : '(${d.actingAllowancePercentage}% Allowance)',
                    style: const TextStyle(fontSize: 11, color: Colors.indigo),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 6),
            Text('Scope: ${d.scope}', style: const TextStyle(fontSize: 12)),
            Text(
              'Window: ${d.startDate.toLocal().toString().substring(0, 16)} to ${d.endDate.toLocal().toString().substring(0, 16)}',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
            if (d.reason != null && d.reason!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('Reason: ${d.reason}', style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic)),
              ),
            if (isGrantedByMe && d.isActive)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => _handleRevoke(d.id),
                  icon: const Icon(Icons.cancel_outlined, size: 16, color: Colors.red),
                  label: const Text('Revoke Authority', style: TextStyle(color: Colors.red, fontSize: 12)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAuditTrailTab() {
    final auditLogsAsync = ref.watch(delegationAuditLogsProvider);

    return auditLogsAsync.when(
      data: (logs) {
        if (logs.isEmpty) {
          return const Center(
            child: Text('No delegated actions recorded yet.', style: TextStyle(color: Colors.grey)),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: logs.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (ctx, idx) {
            final log = logs[idx];
            return ListTile(
              leading: const CircleAvatar(
                child: Icon(Icons.security, size: 18),
              ),
              title: Text(log.action, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text(
                'By ${log.performedByName ?? log.performedBy} on behalf of ${log.onBehalfOfName ?? log.onBehalfOf}\n${log.createdAt.toLocal().toString().substring(0, 16)}',
                style: const TextStyle(fontSize: 11),
              ),
              trailing: log.endpoint != null
                  ? Text(log.endpoint!, style: const TextStyle(fontSize: 10, color: Colors.grey))
                  : null,
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error loading audit trail: $e')),
    );
  }
}
