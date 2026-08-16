import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/leave_provider.dart';

class ApplyLeaveScreen extends ConsumerStatefulWidget {
  const ApplyLeaveScreen({super.key});

  @override
  ConsumerState<ApplyLeaveScreen> createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends ConsumerState<ApplyLeaveScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedTypeId;
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_formKey.currentState?.validate() ?? false) {
      if (_selectedTypeId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select a leave type')),
        );
        return;
      }
      if (_startDate == null || _endDate == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select start and end dates')),
        );
        return;
      }

      setState(() => _isLoading = true);
      try {
        final repo = ref.read(leaveRepositoryProvider);
        await repo.applyLeave(
          leaveTypeId: _selectedTypeId!,
          startDate: DateFormat('yyyy-MM-dd').format(_startDate!),
          endDate: DateFormat('yyyy-MM-dd').format(_endDate!),
          reason: _reasonController.text.trim(),
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Leave application submitted successfully! 🎉'),
              backgroundColor: AppColors.success,
            ),
          );
          ref.invalidate(myLeaveRequestsProvider);
          ref.invalidate(myLeaveBalancesProvider);
          Navigator.of(context).pop(true);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to submit: $e'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final typesAsync = ref.watch(leaveTypesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Apply for Leave')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Leave Type Selector
              typesAsync.when(
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => Text('Error loading leave types: $e'),
                data: (types) {
                  return DropdownButtonFormField<String>(
                    initialValue: _selectedTypeId,
                    decoration: const InputDecoration(
                      labelText: 'Leave Type',
                      prefixIcon: Icon(Icons.category_outlined),
                    ),
                    items: types
                        .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                        .toList(),
                    onChanged: (val) => setState(() => _selectedTypeId = val),
                    validator: (val) => val == null ? 'Required' : null,
                  );
                },
              ),
              const SizedBox(height: 16),

              // Date Range Selection
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_today_outlined, size: 18),
                      label: Text(_startDate == null
                          ? 'Start Date'
                          : DateFormat('MMM dd, yyyy').format(_startDate!)),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now(),
                          firstDate: DateTime.now().subtract(const Duration(days: 30)),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (picked != null) setState(() => _startDate = picked);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_today_outlined, size: 18),
                      label: Text(_endDate == null
                          ? 'End Date'
                          : DateFormat('MMM dd, yyyy').format(_endDate!)),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _startDate ?? DateTime.now(),
                          firstDate: _startDate ?? DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (picked != null) setState(() => _endDate = picked);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Reason
              TextFormField(
                controller: _reasonController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Reason for Leave',
                  hintText: 'Provide details about your leave request...',
                  alignLabelWithHint: true,
                ),
                validator: (val) => val == null || val.trim().isEmpty ? 'Please enter a reason' : null,
              ),
              const SizedBox(height: 28),

              ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: const Color(0xFF1A1200),
                ),
                child: _isLoading
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Submit Application'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
