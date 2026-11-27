/**
 * The module map (AGENTS.md rule 30), the same idea as Odoo's `depends`:
 *
 *  - every business module lists the modules it builds on. A tenant subscribed to a module gets
 *    the modules it depends on too (Inventory brings Products; CRM brings Contacts), so a module
 *    never has to check whether its base is "installed";
 *  - a module only uses the modules it depends on: Inventory reads products, Products never knows
 *    Inventory exists. When two modules work together (a product's stock, a product that cannot be
 *    archived while it holds stock) the module that depends on the other plugs into it through
 *    the extension points (server: ModuleHooksService; web: module slots), never the other way.
 *
 * The web app has the same list in src/lib/moduleManifest.ts; moduleManifest.test.ts there fails
 * when the two differ.
 */
export interface ModuleManifestEntry {
  key: string;
  label: string;
  /** Modules this one builds on (direct dependencies only). */
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

/** Every module `key` needs, directly or through another module (not including itself). */
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

/** Every module that needs `key`, directly or through another module. */
export function dependentsOf(key: string): string[] {
  return MODULE_MANIFEST.filter((m) => m.key !== key && dependenciesOf(m.key).includes(key)).map((m) => m.key);
}

/** The subscribed modules plus everything they depend on. */
export function withDependencies(features: string[]): Set<string> {
  const out = new Set<string>();
  for (const f of features.map((x) => x.toLowerCase().trim())) {
    out.add(f);
    for (const d of dependenciesOf(f)) out.add(d);
  }
  return out;
}

/**
 * Base modules and the modules that bring them along: a base is open when any of them is on
 * (used by ModuleSubscriptionGuard for both the package features and tenant_modules).
 */
export const MODULE_FAMILIES: Record<string, string[]> = Object.fromEntries(
  MODULE_MANIFEST.map((m) => [m.key, dependentsOf(m.key)] as const).filter(([, users]) => users.length > 0),
);
