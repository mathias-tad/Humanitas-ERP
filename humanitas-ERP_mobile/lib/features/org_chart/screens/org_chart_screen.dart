import 'package:flutter/material.dart';
import '../models/org_node_model.dart';
import '../repositories/org_chart_repository.dart';

class OrgChartScreen extends StatefulWidget {
  final OrgChartRepository repository;

  const OrgChartScreen({
    super.key,
    required this.repository,
  });

  @override
  State<OrgChartScreen> createState() => _OrgChartScreenState();
}

class _OrgChartScreenState extends State<OrgChartScreen> {
  bool _isLoading = true;
  String? _error;
  List<OrgNodeModel> _rootNodes = [];
  int _totalEmployees = 0;
  List<String> _departments = [];
  String _selectedDepartment = 'all';
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadOrgChart();
  }

  Future<void> _loadOrgChart() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await widget.repository.getOrgChart(
        department: _selectedDepartment == 'all' ? null : _selectedDepartment,
      );

      if (mounted) {
        setState(() {
          _rootNodes = (data['rootNodes'] as List<OrgNodeModel>?) ?? [];
          _totalEmployees = (data['totalEmployees'] as int?) ?? 0;
          _departments = (data['departments'] as List<String>?) ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  void _showEmployeeDetails(OrgNodeModel node) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _EmployeeDetailSheet(
        node: node,
        repository: widget.repository,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Org Chart',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            if (!_isLoading && _totalEmployees > 0)
              Text(
                '$_totalEmployees Team Members',
                style: TextStyle(
                  fontSize: 12,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadOrgChart,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search employee, role, or team...',
                hintStyle: const TextStyle(fontSize: 13),
                prefixIcon: const Icon(Icons.search, size: 20),
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: theme.dividerColor),
                ),
                filled: true,
                fillColor: theme.cardColor,
              ),
              onChanged: (val) {
                setState(() {
                  _searchQuery = val.trim().toLowerCase();
                });
              },
            ),
          ),

          // Department Filter Chips
          if (_departments.isNotEmpty)
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _departments.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final dept = index == 0 ? 'all' : _departments[index - 1];
                  final isSelected = _selectedDepartment == dept;

                  return ChoiceChip(
                    label: Text(dept == 'all' ? 'All Departments' : dept),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() {
                          _selectedDepartment = dept;
                        });
                        _loadOrgChart();
                      }
                    },
                  );
                },
              ),
            ),

          const SizedBox(height: 8),

          // Main Tree View
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.error_outline, size: 48, color: Colors.red),
                              const SizedBox(height: 12),
                              Text(
                                'Failed to load organization hierarchy',
                                style: theme.textTheme.titleMedium,
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadOrgChart,
                                child: const Text('Try Again'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _rootNodes.isEmpty
                        ? const Center(
                            child: Text('No personnel found in hierarchy'),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadOrgChart,
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _rootNodes.length,
                              itemBuilder: (context, index) {
                                return _buildOrgTreeTile(
                                  node: _rootNodes[index],
                                  depth: 0,
                                  theme: theme,
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrgTreeTile({
    required OrgNodeModel node,
    required int depth,
    required ThemeData theme,
  }) {
    final matchesSearch = _searchQuery.isEmpty ||
        node.fullName.toLowerCase().contains(_searchQuery) ||
        (node.position != null && node.position!.toLowerCase().contains(_searchQuery)) ||
        (node.department != null && node.department!.toLowerCase().contains(_searchQuery));

    final hasChildren = node.children.isNotEmpty;

    final cardContent = Card(
      elevation: depth == 0 ? 2 : 1,
      margin: EdgeInsets.only(
        left: depth * 16.0,
        right: 0,
        top: 4,
        bottom: 4,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: matchesSearch && _searchQuery.isNotEmpty
            ? BorderSide(color: theme.colorScheme.primary, width: 2)
            : BorderSide(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showEmployeeDetails(node),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Avatar
              CircleAvatar(
                radius: 20,
                backgroundColor: theme.colorScheme.primaryContainer,
                child: Text(
                  node.fullName.isNotEmpty
                      ? node.fullName.trim().split(' ').map((e) => e[0]).take(2).join().toUpperCase()
                      : '?',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
              const SizedBox(width: 12),

              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      node.fullName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    Text(
                      node.position ?? 'Employee',
                      style: TextStyle(
                        fontSize: 12,
                        color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                      ),
                    ),
                    if (node.department != null)
                      Container(
                        margin: const EdgeInsets.only(top: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          node.department!,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: theme.colorScheme.onSecondaryContainer,
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              // Direct report count badge
              if (node.directReportsCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.people_outline, size: 14, color: theme.colorScheme.primary),
                      const SizedBox(width: 4),
                      Text(
                        '${node.directReportsCount}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );

    if (!hasChildren) {
      return cardContent;
    }

    // Expandable node with children
    return ExpansionTile(
      key: PageStorageKey('node_${node.id}'),
      initiallyExpanded: depth < 1,
      tilePadding: EdgeInsets.zero,
      childrenPadding: EdgeInsets.zero,
      title: cardContent,
      children: node.children
          .map((child) => _buildOrgTreeTile(
                node: child,
                depth: depth + 1,
                theme: theme,
              ))
          .toList(),
    );
  }
}

class _EmployeeDetailSheet extends StatefulWidget {
  final OrgNodeModel node;
  final OrgChartRepository repository;

  const _EmployeeDetailSheet({
    required this.node,
    required this.repository,
  });

  @override
  State<_EmployeeDetailSheet> createState() => _EmployeeDetailSheetState();
}

class _EmployeeDetailSheetState extends State<_EmployeeDetailSheet> {
  bool _loading = true;
  List<OrgNodeModel> _ancestors = [];
  List<OrgNodeModel> _directReports = [];

  @override
  void initState() {
    super.initState();
    _fetchChain();
  }

  Future<void> _fetchChain() async {
    try {
      final res = await widget.repository.getReportingChain(widget.node.id);
      if (mounted) {
        setState(() {
          _ancestors = (res['ancestors'] as List<OrgNodeModel>?) ?? [];
          _directReports = (res['directReports'] as List<OrgNodeModel>?) ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(24),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: theme.dividerColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Profile info
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: theme.colorScheme.primaryContainer,
                  child: Text(
                    widget.node.fullName.isNotEmpty
                        ? widget.node.fullName.trim().split(' ').map((e) => e[0]).take(2).join().toUpperCase()
                        : '?',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: theme.colorScheme.onPrimaryContainer,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.node.fullName,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        widget.node.position ?? 'Employee',
                        style: TextStyle(
                          fontSize: 13,
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                      ),
                      if (widget.node.department != null)
                        Text(
                          widget.node.department!,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: theme.colorScheme.primary,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 12),

            // Contact details
            ListTile(
              dense: true,
              leading: const Icon(Icons.email_outlined),
              title: Text(widget.node.email),
              contentPadding: EdgeInsets.zero,
            ),
            if (widget.node.phone != null && widget.node.phone!.isNotEmpty)
              ListTile(
                dense: true,
                leading: const Icon(Icons.phone_outlined),
                title: Text(widget.node.phone!),
                contentPadding: EdgeInsets.zero,
              ),

            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 12),

            // Management Line
            const Text(
              'Management Line',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),

            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator()))
            else if (_ancestors.isEmpty)
              const Text(
                'Top-level leader (No manager assigned)',
                style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
              )
            else
              Column(
                children: [
                  ..._ancestors.map(
                    (anc) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Icon(Icons.arrow_upward, size: 16, color: theme.colorScheme.primary),
                          const SizedBox(width: 8),
                          Text(anc.fullName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                          const SizedBox(width: 6),
                          Text('(${anc.position ?? 'Manager'})', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.person, size: 16, color: Colors.green),
                        const SizedBox(width: 8),
                        Text('${widget.node.fullName} (Current)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),

            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 12),

            // Direct Reports
            Text(
              'Direct Reports (${_directReports.length})',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),

            if (!_loading && _directReports.isEmpty)
              const Text(
                'No direct reports.',
                style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
              )
            else
              ..._directReports.map(
                (rep) => ListTile(
                  dense: true,
                  leading: const Icon(Icons.subdirectory_arrow_right, size: 18),
                  title: Text(rep.fullName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  subtitle: Text(rep.position ?? 'Staff', style: const TextStyle(fontSize: 11)),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
