import { useEffect, useState } from 'react';
import { api } from './api';

/** Mirrors the admin API's module catalog (GET /modules/catalog) — featureslist §28. */
export interface CatalogModule {
  key: string;
  name: string;
  category: string;
  description: string;
  depends: string[];
  aliases?: string[];
  status: 'available' | 'coming_soon';
}

export interface ModuleCatalog {
  modules: CatalogModule[];
  bridges: { key: string; requires: string[]; description: string }[];
}

/** Legacy HR feature flags removed together with HRMS (kept from the previous behaviour). */
const HRMS_LEGACY = ['hrms', 'hr', 'attendance', 'leave', 'payroll', 'recruitment'];

export function useModuleCatalog(): { catalog: ModuleCatalog | null; error: string | null } {
  const [catalog, setCatalog] = useState<ModuleCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get<ModuleCatalog>('/modules/catalog')
      .then((c) => alive && setCatalog(c))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load module catalog'));
    return () => {
      alive = false;
    };
  }, []);
  return { catalog, error };
}

function byKey(catalog: ModuleCatalog | null) {
  return new Map((catalog?.modules ?? []).map((m) => [m.key, m]));
}

/** Names of enabled modules that need `key` (directly or transitively). */
export function requiredBy(features: string[], key: string, catalog: ModuleCatalog | null): string[] {
  const modules = byKey(catalog);
  const enabled = new Set(features);
  const out: string[] = [];
  const visit = (k: string) => {
    for (const m of modules.values()) {
      if (m.depends.includes(k) && enabled.has(m.key) && !out.includes(m.name)) {
        out.push(m.name);
        visit(m.key);
      }
    }
  };
  visit(key);
  return out;
}

/**
 * Toggle a module in a feature list, following the catalog's rules:
 * enabling adds its required modules; disabling is refused while an enabled module needs it.
 * The admin API applies the same rules again when saving.
 */
export function toggleModule(
  features: string[],
  key: string,
  enable: boolean,
  catalog: ModuleCatalog | null,
): { features: string[]; error?: string } {
  const modules = byKey(catalog);
  const set = new Set(features);
  if (enable) {
    const add = (k: string) => {
      set.add(k);
      const m = modules.get(k);
      for (const a of m?.aliases ?? []) set.add(a);
      for (const d of m?.depends ?? []) if (!set.has(d)) add(d);
    };
    add(key);
    return { features: Array.from(set) };
  }
  const blockers = requiredBy(features, key, catalog);
  if (blockers.length) {
    const name = modules.get(key)?.name ?? key;
    return { features, error: `${name} is required by ${blockers.join(', ')}. Turn those off first.` };
  }
  const remove = key === 'hrms' ? HRMS_LEGACY : [key, ...(modules.get(key)?.aliases ?? [])];
  return { features: features.filter((f) => !remove.includes(f)) };
}
