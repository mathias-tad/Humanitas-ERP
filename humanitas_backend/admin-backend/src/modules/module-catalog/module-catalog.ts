/**
 * Module catalog — the single source of truth for which modules exist, what each one
 * requires, and which bridge (integration) modules switch on automatically
 * (featureslist §28, AGENTS.md rule 23).
 *
 * Keys are stored in tenants.enabled_features and checked by the tenant API's
 * ModuleSubscriptionGuard (@RequireModule('<key>')).
 */
import { BadRequestException } from '@nestjs/common';

export type ModuleCategory =
  | 'people'
  | 'operations'
  | 'commercial'
  | 'finance'
  | 'communications'
  | 'logistics';

export type ModuleStatus = 'available' | 'coming_soon';

export interface ModuleDefinition {
  key: string;
  name: string;
  category: ModuleCategory;
  description: string;
  /** Hard dependencies: enabling this module enables them too; they cannot be removed while it is on. */
  depends: string[];
  /** Legacy feature keys granted together with this module. */
  aliases?: string[];
  status: ModuleStatus;
}

export interface BridgeDefinition {
  key: string;
  /** All of these modules must be enabled; the bridge then switches on automatically. */
  requires: string[];
  description: string;
}

export const MODULES: ModuleDefinition[] = [
  { key: 'hrms', name: 'Human Capital (HRMS & Payroll)', category: 'people', status: 'available', depends: [], aliases: ['hr'],
    description: 'Employees, attendance, biometric sync, shifts, leave, payroll and recruitment.' },
  { key: 'pms', name: 'Projects & Tasks (PMS)', category: 'people', status: 'available', depends: [],
    description: 'Projects, Kanban boards, time tracking and KPI scorecards.' },
  { key: 'products', name: 'Products & Catalog', category: 'operations', status: 'available', depends: [],
    description: 'Products, variants, units of measure, price lists, barcodes and QR labels.' },
  { key: 'inventory', name: 'Inventory & Warehouses', category: 'operations', status: 'coming_soon', depends: ['products'],
    description: 'Multi-warehouse stock, lots/serials, transfers, counts and FIFO/AVCO valuation.' },
  { key: 'purchasing', name: 'Purchasing & Vendors', category: 'operations', status: 'coming_soon', depends: ['products'],
    description: 'RFQs, purchase orders, goods receipts, vendor bills and 3-way matching. Includes Contacts (customers, vendors and their people).' },
  { key: 'manufacturing', name: 'Manufacturing (MRP), Quality & Maintenance', category: 'operations', status: 'coming_soon',
    depends: ['products', 'inventory'],
    description: 'Bills of materials, production planning, shop floor, quality control and plant maintenance.' },
  { key: 'sales', name: 'Sales & Invoicing', category: 'commercial', status: 'coming_soon', depends: ['products'],
    description: 'Quotations, sales orders, deliveries, invoices and e-invoicing. Includes Contacts (customers, vendors and their people).' },
  { key: 'crm', name: 'CRM', category: 'commercial', status: 'coming_soon', depends: [],
    description: 'Leads, pipelines, interaction timeline, cadences and AI lead scoring. Includes Contacts (customers, vendors and their people).' },
  { key: 'pos', name: 'Point of Sale (POS)', category: 'commercial', status: 'coming_soon', depends: ['products'],
    description: 'Offline-first checkout, barcode scanning, cash sessions and receipts. Includes Contacts (customers, vendors and their people).' },
  { key: 'ecommerce', name: 'Online Store', category: 'commercial', status: 'coming_soon', depends: ['products', 'sales'],
    description: 'Storefront, online payments and one order queue for every channel. Includes Contacts (customers, vendors and their people).' },
  { key: 'accounting', name: 'Accounting & Financials', category: 'finance', status: 'coming_soon', depends: [],
    description: 'Double-entry ledger, receivables/payables, bank, fixed assets and financial reports. Includes Contacts (customers, vendors and their people).' },
  { key: 'voip', name: 'VoIP & Contact Center', category: 'communications', status: 'coming_soon', depends: [],
    description: 'SIP trunks (Ethio Telecom, Safaricom, Twilio…), softphone, IVR, queues and AI voice agent.' },
  { key: 'delivery', name: 'Delivery & Last Mile', category: 'logistics', status: 'coming_soon', depends: [],
    description: 'Dispatch, routes, driver app, proof of delivery and live customer tracking. Includes Contacts (customers, vendors and their people).' },
  { key: 'fleet', name: 'Fleet & GPS Telematics', category: 'logistics', status: 'coming_soon', depends: [],
    description: 'Vehicles, maintenance, fuel, GPS trackers, geofences and driver behaviour.' },
];

export const BRIDGES: BridgeDefinition[] = [
  { key: 'sales_inventory', requires: ['sales', 'inventory'], description: 'Stock reservation and deliveries from sales orders.' },
  { key: 'purchase_inventory', requires: ['purchasing', 'inventory'], description: 'Goods receipts into stock; replenishment RFQs.' },
  { key: 'pos_sales', requires: ['pos', 'sales'], description: 'POS orders and quotations share customers, prices and invoices.' },
  { key: 'pos_inventory', requires: ['pos', 'inventory'], description: 'POS sales move stock.' },
  { key: 'inventory_accounting', requires: ['inventory', 'accounting'], description: 'Stock valuation journal entries.' },
  { key: 'sales_accounting', requires: ['sales', 'accounting'], description: 'Invoices and payments post to the ledger.' },
  { key: 'purchase_accounting', requires: ['purchasing', 'accounting'], description: 'Vendor bills and payments post to the ledger.' },
  { key: 'pos_accounting', requires: ['pos', 'accounting'], description: 'POS sessions post to the ledger.' },
  { key: 'hrms_accounting', requires: ['hrms', 'accounting'], description: 'Payroll posts to the ledger.' },
  { key: 'manufacturing_accounting', requires: ['manufacturing', 'accounting'], description: 'Production costs and WIP valuation.' },
  { key: 'manufacturing_purchasing', requires: ['manufacturing', 'purchasing'], description: 'Material shortages create RFQs; subcontracting.' },
  { key: 'crm_sales', requires: ['crm', 'sales'], description: 'Quotes from opportunities.' },
  { key: 'crm_voip', requires: ['crm', 'voip'], description: 'Sales calls, recordings and AI lead auto-fill.' },
  { key: 'sales_voip', requires: ['sales', 'voip'], description: 'Phone orders and AI voice ordering.' },
  { key: 'pos_voip', requires: ['pos', 'voip'], description: 'Phone orders into the POS queue.' },
  { key: 'ecommerce_inventory', requires: ['ecommerce', 'inventory'], description: 'Live stock on the storefront.' },
  { key: 'sales_delivery', requires: ['sales', 'delivery'], description: 'Deliveries from sales orders.' },
  { key: 'pos_delivery', requires: ['pos', 'delivery'], description: 'Dispatch POS orders for delivery.' },
  { key: 'ecommerce_delivery', requires: ['ecommerce', 'delivery'], description: 'Delivery slots at online checkout.' },
  { key: 'delivery_fleet', requires: ['delivery', 'fleet'], description: 'Live vehicle position and ETA on deliveries.' },
  { key: 'hrms_fleet', requires: ['hrms', 'fleet'], description: 'Drivers, licences and vehicle assignments from HR.' },
];

const MODULE_BY_KEY = new Map(MODULES.map((m) => [m.key, m]));
const BRIDGE_KEYS = new Set(BRIDGES.map((b) => b.key));
/** Legacy keys that imply a module (e.g. a tenant created with only 'hr'). */
const ALIAS_TO_MODULE = new Map(MODULES.flatMap((m) => (m.aliases ?? []).map((a) => [a, m.key] as [string, string])));

export interface ModuleChange {
  key: string;
  reason: string;
}

export interface ResolvedModules {
  features: string[];
  added: ModuleChange[];
  bridges: string[];
}

export class ModuleDependencyError extends Error {
  readonly blocked: { key: string; requiredBy: string[] }[];

  constructor(message: string, blocked: { key: string; requiredBy: string[] }[]) {
    super(message);
    this.blocked = blocked;
  }
}

function moduleName(key: string): string {
  return MODULE_BY_KEY.get(key)?.name ?? key;
}

/** Every module that (directly or transitively) depends on `key`. */
export function dependentsOf(key: string): string[] {
  const out = new Set<string>();
  const visit = (k: string) => {
    for (const m of MODULES) {
      if (m.depends.includes(k) && !out.has(m.key)) {
        out.add(m.key);
        visit(m.key);
      }
    }
  };
  visit(key);
  return [...out];
}

/**
 * Turn a requested feature list into a consistent one:
 * - hard dependencies are added (transitively), with the reason;
 * - aliases are added (hrms ⇄ hr);
 * - bridges are derived, never taken from the request;
 * - with `previous`, removing a module that a remaining module needs is refused;
 * - unknown keys (legacy plan flags, AI tiers, platform modules) are kept unchanged.
 */
export function resolveModules(requested: string[], previous?: string[]): ResolvedModules {
  const clean = (list: string[]) =>
    Array.from(new Set(list.map((f) => String(f).toLowerCase().trim()).filter(Boolean)));
  const req = clean(requested).filter((f) => !BRIDGE_KEYS.has(f));
  const set = new Set(req);
  for (const [alias, mod] of ALIAS_TO_MODULE) if (set.has(alias)) set.add(mod);

  if (previous) {
    const prev = new Set(clean(previous));
    const blocked: { key: string; requiredBy: string[] }[] = [];
    for (const m of MODULES) {
      if (!prev.has(m.key) || set.has(m.key)) continue;
      const requiredBy = dependentsOf(m.key).filter((d) => set.has(d));
      if (requiredBy.length) blocked.push({ key: m.key, requiredBy });
    }
    if (blocked.length) {
      const text = blocked
        .map((b) => `${moduleName(b.key)} is required by ${b.requiredBy.map(moduleName).join(', ')}`)
        .join('; ');
      throw new ModuleDependencyError(`${text}. Disable those modules first.`, blocked);
    }
  }

  const added: ModuleChange[] = [];
  const addDeps = (key: string) => {
    for (const dep of MODULE_BY_KEY.get(key)?.depends ?? []) {
      if (!set.has(dep)) {
        set.add(dep);
        added.push({ key: dep, reason: `required by ${moduleName(key)}` });
      }
      addDeps(dep);
    }
  };
  for (const key of [...set]) addDeps(key);
  for (const m of MODULES) {
    if (!set.has(m.key)) continue;
    for (const a of m.aliases ?? []) set.add(a);
  }

  const bridges = BRIDGES.filter((b) => b.requires.every((r) => set.has(r))).map((b) => b.key);
  const features = [...req.filter((f) => set.has(f)), ...[...set].filter((f) => !req.includes(f)), ...bridges];
  return { features: Array.from(new Set(features)), added, bridges };
}

/** resolveModules for tenant create/update: dependency conflicts become HTTP 400 with a clear message. */
export function resolveTenantFeatures(requested: string[], previous?: string[]): string[] {
  try {
    return resolveModules(requested, previous).features;
  } catch (e) {
    if (e instanceof ModuleDependencyError) throw new BadRequestException(e.message);
    throw e;
  }
}

/** Catalog payload for the admin panel. */
export function catalog() {
  return { modules: MODULES, bridges: BRIDGES };
}
