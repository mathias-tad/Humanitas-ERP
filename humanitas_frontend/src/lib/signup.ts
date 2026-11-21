/**
 * Website "Start free trial" sign-up: talks to the platform admin API (public endpoints,
 * no sign-in) and holds the module-selection rules the page uses.
 */

export const ADMIN_API_URL: string =
  (import.meta.env.VITE_ADMIN_API_URL as string | undefined) || 'https://api-admin.humanitas-erp.ziontech.tech/api/v1';

export type ModuleStatus = 'available' | 'coming_soon';

export interface SignupModule {
  key: string;
  name: string;
  category: string;
  description: string;
  depends: string[];
  status: ModuleStatus;
}

export interface SignupOptions {
  enabled: boolean;
  trial_days: number;
  platform_name: string;
  support_email: string | null;
  modules: SignupModule[];
}

export interface SignupRequest {
  company_name: string;
  slug: string;
  contact_email: string;
  contact_phone?: string;
  country?: string;
  timezone?: string;
  modules: string[];
  website?: string;
}

export interface SignupResult {
  company_name: string;
  slug: string;
  contact_email: string;
  trial_ends_at: string | null;
  modules: string[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  people: 'People',
  operations: 'Operations',
  commercial: 'Sales & commerce',
  finance: 'Finance',
  communications: 'Communications',
  logistics: 'Logistics',
};

/** Suggests an organization ID from a company name ("Abebe & Sons PLC" -> "abebe-sons-plc"). */
export function suggestSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/** Quick check before asking the server (the server also checks reserved and taken IDs). */
export function slugFormatProblem(slug: string): string | null {
  if (!slug) return 'Enter an organization ID.';
  if (slug.length < 3) return 'At least 3 characters.';
  if (slug.length > 40) return 'At most 40 characters.';
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Use only lowercase letters, numbers and hyphens.';
  if (slug.startsWith('-') || slug.endsWith('-') || slug.includes('--')) return 'Hyphens go between letters or numbers.';
  if (/^\d+$/.test(slug)) return 'Include at least one letter.';
  return null;
}

/** The chosen modules plus everything they need (transitively). */
export function withDependencies(chosen: Iterable<string>, modules: SignupModule[]): Set<string> {
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const out = new Set<string>();
  const add = (key: string) => {
    if (out.has(key)) return;
    out.add(key);
    for (const d of byKey.get(key)?.depends ?? []) add(d);
  };
  for (const k of chosen) add(k);
  return out;
}

/** Chosen modules that need `key` (so it cannot be unticked while they are on). */
export function neededBy(key: string, chosen: Iterable<string>, modules: SignupModule[]): string[] {
  const out: string[] = [];
  for (const k of chosen) {
    if (k !== key && withDependencies([k], modules).has(key)) out.push(k);
  }
  return out;
}

/** Ready modules first, then coming soon; grouped by category in catalog order. */
export function groupModules(modules: SignupModule[]): { category: string; label: string; modules: SignupModule[] }[] {
  const groups = new Map<string, SignupModule[]>();
  for (const m of modules) {
    if (!groups.has(m.category)) groups.set(m.category, []);
    groups.get(m.category)!.push(m);
  }
  return [...groups.entries()].map(([category, list]) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    modules: [...list].sort((a, b) => Number(a.status !== 'available') - Number(b.status !== 'available')),
  }));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error('Could not reach the sign-up service. Check your internet connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.message;
    throw new Error(Array.isArray(msg) ? msg.join(' ') : msg || `Sign-up failed (${res.status}).`);
  }
  return body as T;
}

export const signupApi = {
  options: () => request<SignupOptions>('/public/signup/options'),
  slugAvailable: (slug: string) =>
    request<{ available: boolean; reason?: string }>(`/public/signup/slug-available?slug=${encodeURIComponent(slug)}`),
  signup: (data: SignupRequest) => request<SignupResult>('/public/signup', { method: 'POST', body: JSON.stringify(data) }),
};
