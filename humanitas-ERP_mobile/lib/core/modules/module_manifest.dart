/// The module map (AGENTS.md rule 30), the same list as the server's
/// src/common/modules/module-manifest.ts (module_manifest_test.dart fails when they differ).
/// A subscribed module brings the modules it depends on: Inventory brings Products, CRM brings Contacts.
class ModuleManifestEntry {
  final String key;
  final String label;
  final List<String> depends;

  const ModuleManifestEntry(this.key, this.label, this.depends);
}

const moduleManifest = <ModuleManifestEntry>[
  ModuleManifestEntry('hrms', 'Human Capital (HRMS)', []),
  ModuleManifestEntry('pms', 'Projects & Tasks', []),
  ModuleManifestEntry('products', 'Products & Catalog', []),
  ModuleManifestEntry('contacts', 'Contacts', []),
  ModuleManifestEntry('crm', 'CRM', ['contacts']),
  ModuleManifestEntry('inventory', 'Inventory & Warehouses', ['products']),
  ModuleManifestEntry('sales', 'Sales', ['products', 'contacts']),
  ModuleManifestEntry('purchasing', 'Purchasing', ['products', 'contacts']),
  ModuleManifestEntry('pos', 'Point of Sale', ['products', 'contacts']),
  ModuleManifestEntry('accounting', 'Accounting', ['contacts']),
  ModuleManifestEntry('ecommerce', 'Online Store', ['products', 'contacts']),
  ModuleManifestEntry('delivery', 'Delivery', ['contacts']),
];

/// Every module [key] needs, directly or through another module.
List<String> dependenciesOf(String key) {
  final out = <String>[];
  void walk(String k) {
    for (final m in moduleManifest.where((e) => e.key == k)) {
      for (final d in m.depends) {
        if (out.contains(d)) continue;
        out.add(d);
        walk(d);
      }
    }
  }

  walk(key);
  return out;
}

/// Every module that needs [key] (a base is on when any of them is on).
List<String> dependentsOf(String key) =>
    moduleManifest.where((m) => m.key != key && dependenciesOf(m.key).contains(key)).map((m) => m.key).toList();
