/**
 * The module map (AGENTS.md rule 30), the same list as the server's
 * src/common/modules/module-manifest.ts (moduleManifest.test.ts fails when they differ).
 * A subscribed module brings the modules it depends on (Inventory brings Products), and a module
 * only builds on its dependencies; modules plug into each other through module slots
 * (lib/moduleSlots.tsx), never by the base module importing the one built on it.
 */
export interface ModuleManifestEntry {
  key: string;
  label: string;
  depends: string[];
}

export const MODULE_MANIFEST: ModuleManifestEntry[] = [
  { key: 'hrms', label: 'Human Capital (HRMS)', depends: [] },
  { key: 'pms', label: 'Projects & Tasks', depends: [] },
  { key: 'products', label: 'Products & Catalog', depends: [] },
  { key: 'contacts', label: 'Contacts', depends: [] },
  { key: 'crm', label: 'CRM', depends: ['contacts'] },
  { key: 'inventory', label: 'Inventory & Warehouses', depends: ['products'] },
  { key: 'sales', label: 'Sales', depends: ['products', 'contacts'] },
  { key: 'purchasing', label: 'Purchasing', depends: ['products', 'contacts'] },
  { key: 'pos', label: 'Point of Sale', depends: ['products', 'contacts'] },
  { key: 'accounting', label: 'Accounting', depends: ['contacts'] },
  { key: 'ecommerce', label: 'Online Store', depends: ['products', 'contacts'] },
  { key: 'delivery', label: 'Delivery', depends: ['contacts'] },
];

const BY_KEY = new Map(MODULE_MANIFEST.map((m) => [m.key, m]));

export function dependenciesOf(key: string): string[] {
  const out = new Set<string>();
  const walk = (k: string) => {
    for (const d of BY_KEY.get(k)?.depends ?? []) {
      if (out.has(d)) continue;
      out.add(d);
      walk(d);
    }
  };
  walk(key);
  return [...out];
}

export function dependentsOf(key: string): string[] {
  return MODULE_MANIFEST.filter((m) => m.key !== key && dependenciesOf(m.key).includes(key)).map((m) => m.key);
}

/** Base modules and the modules that bring them along (a base is on when any of them is on). */
export const MODULE_FAMILIES: Record<string, string[]> = Object.fromEntries(
  MODULE_MANIFEST.map((m) => [m.key, dependentsOf(m.key)] as const).filter(([, users]) => users.length > 0),
);
