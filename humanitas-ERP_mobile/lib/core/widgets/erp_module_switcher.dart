import 'package:flutter/material.dart';

class ERPModuleItem {
  final String key;
  final String label;
  final String description;
  final IconData icon;
  final Color color;
  final String route;

  const ERPModuleItem({
    required this.key,
    required this.label,
    required this.description,
    required this.icon,
    required this.color,
    required this.route,
  });
}

const List<ERPModuleItem> kERPModules = [
  ERPModuleItem(
    key: 'hrms',
    label: 'Human Capital (HRMS)',
    description: 'Attendance, Leaves, Shifts & Payroll',
    icon: Icons.people_alt_outlined,
    color: Color(0xFF2563EB),
    route: '/home',
  ),
  ERPModuleItem(
    key: 'pms',
    label: 'Projects & Tasks',
    description: 'My Tasks, Kanban & Time Logs',
    icon: Icons.assignment_outlined,
    color: Color(0xFF4F46E5),
    route: '/pms',
  ),
  ERPModuleItem(
    key: 'products',
    label: 'Products & QR',
    description: 'Scan QR Codes, Catalog & Prices',
    icon: Icons.inventory_2_outlined,
    color: Color(0xFF059669),
    route: '/products',
  ),
  ERPModuleItem(
    key: 'inventory',
    label: 'Inventory & Stock',
    description: 'Warehouse Scans, Stocktakes & Transfers',
    icon: Icons.all_inbox_outlined,
    color: Color(0xFFD97706),
    route: '/inventory',
  ),
  ERPModuleItem(
    key: 'purchasing',
    label: 'Purchasing & POs',
    description: 'Purchase Orders & Goods Receipts',
    icon: Icons.shopping_cart_outlined,
    color: Color(0xFF7C3AED),
    route: '/purchasing',
  ),
  ERPModuleItem(
    key: 'sales',
    label: 'Sales & Orders',
    description: 'Customers, Quotes & Orders',
    icon: Icons.trending_up,
    color: Color(0xFF0D9488),
    route: '/sales',
  ),
  ERPModuleItem(
    key: 'pos',
    label: 'Mobile POS',
    description: 'Rapid Barcode & QR Checkout',
    icon: Icons.point_of_sale_outlined,
    color: Color(0xFFE11D48),
    route: '/pos',
  ),
  ERPModuleItem(
    key: 'accounting',
    label: 'Accounting',
    description: 'Financial Reports & Ledger',
    icon: Icons.calculate_outlined,
    color: Color(0xFF0891B2),
    route: '/accounting',
  ),
  ERPModuleItem(
    key: 'ai',
    label: 'AI Assistant',
    description: 'AI Voice/Text Help & Document Prep',
    icon: Icons.auto_awesome,
    color: Color(0xFF8B5CF6),
    route: '/ai',
  ),
];

class ERPModuleSwitcherModal extends StatelessWidget {
  final String activeKey;
  final Function(ERPModuleItem) onSelect;

  const ERPModuleSwitcherModal({
    Key? key,
    required this.activeKey,
    required this.onSelect,
  }) : super(key: key);

  static void show(
    BuildContext context, {
    required String activeKey,
    required Function(ERPModuleItem) onSelect,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => ERPModuleSwitcherModal(
        activeKey: activeKey,
        onSelect: onSelect,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: theme.primaryColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.apps, color: theme.primaryColor, size: 20),
                ),
                const SizedBox(width: 10),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Humanitas ERP Modules',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Switch active workspace',
                      style: TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.55,
              ),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: kERPModules.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (ctx, idx) {
                  final mod = kERPModules[idx];
                  final isActive = mod.key == activeKey;

                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: mod.color.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(mod.icon, color: mod.color, size: 22),
                    ),
                    title: Text(
                      mod.label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                      ),
                    ),
                    subtitle: Text(
                      mod.description,
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: isActive
                        ? Icon(Icons.check_circle, color: theme.primaryColor, size: 20)
                        : null,
                    onTap: () {
                      Navigator.pop(context);
                      onSelect(mod);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
