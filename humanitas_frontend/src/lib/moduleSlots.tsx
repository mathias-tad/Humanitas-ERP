import { useSyncExternalStore, type ComponentType } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useERPModules, type ModuleContextType } from '@/context/ModuleContext';

/**
 * Module slots (AGENTS.md rule 30): places in a base module's screens where the modules built on
 * it add their part, so the base module never imports them. Inventory adds a Stock tab to the
 * product form; Sales could add a Sales tab the same way:
 *
 *   registerSlot('product.tabs', { id: 'stock', module: 'inventory', permission: 'view_stock', label: 'Stock', Component: ProductStockTab });
 *   const tabs = useSlot('product.tabs');   // only the tenant's modules, only what the person may see
 */
export interface SlotProps {
  'product.tabs': { productId: string; isActive: boolean; isParent: boolean; productType: string };
}

export interface SlotEntry<S extends keyof SlotProps> {
  id: string;
  /** The module that adds it; hidden when the tenant does not have that module. */
  module: string;
  /** A bridge between independent modules: every one of these must be on too (featureslist §28). */
  requires?: string[];
  /** Hidden without this permission. */
  permission?: string;
  label: string;
  /** Lower comes first. */
  order?: number;
  /** Shown only when this returns true for the slot's props (e.g. not on a product with variants). */
  when?: (props: SlotProps[S]) => boolean;
  Component: ComponentType<SlotProps[S]>;
}

const registry = new Map<keyof SlotProps, SlotEntry<any>[]>();
const listeners = new Set<() => void>();
let version = 0;

export function registerSlot<S extends keyof SlotProps>(slot: S, entry: SlotEntry<S>): void {
  const list = (registry.get(slot) ?? []).filter((e) => e.id !== entry.id);
  list.push(entry);
  list.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  registry.set(slot, list);
  version += 1;
  listeners.forEach((l) => l());
}

/** Every entry registered for a slot, before module and permission checks (tests, the module map). */
export function slotEntries<S extends keyof SlotProps>(slot: S): SlotEntry<S>[] {
  return (registry.get(slot) ?? []) as SlotEntry<S>[];
}

/** The entries of a slot this tenant and this person get. */
export function useSlot<S extends keyof SlotProps>(slot: S, props?: SlotProps[S]): SlotEntry<S>[] {
  useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version);
  const { hasPermission } = useAuth();
  // Outside the module provider (isolated tests) nothing is added: a slot never breaks its screen.
  let modules: ModuleContextType | null = null;
  try {
    modules = useERPModules();
  } catch {
    modules = null;
  }
  return slotEntries(slot).filter((e) =>
    !!modules?.isModuleSubscribed(e.module) && (e.requires ?? []).every((m) => modules?.isModuleSubscribed(m)) && (!e.permission || hasPermission(e.permission)) && (!props || !e.when || e.when(props)));
}
