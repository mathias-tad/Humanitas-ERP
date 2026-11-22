/**
 * Ctrl+K search (featureslist §11): pages from the menus, features and buttons from the AI
 * knowledge base, records from the entity registry and quick commands, ranked together.
 * Pure helpers; the palette component wires them to the app.
 */

export type PaletteGroup = 'Pages' | 'Features & buttons' | 'Records' | 'Commands';
export const GROUP_ORDER: PaletteGroup[] = ['Pages', 'Features & buttons', 'Records', 'Commands'];

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** 0 = no match; every word typed must appear in the label, hint or keywords. */
export function scoreItem(item: Pick<PaletteItem, 'label' | 'hint' | 'keywords'>, query: string): number {
  const q = norm(query).trim();
  if (!q) return 0;
  const words = q.split(/\s+/).filter(Boolean);
  const label = norm(item.label);
  const rest = norm(`${item.hint ?? ''} ${item.keywords ?? ''}`);
  let score = label === q ? 20 : label.startsWith(q) ? 10 : 0;
  for (const w of words) {
    if (label.split(/[^a-z0-9]+/).some((t) => t.startsWith(w))) score += 6;
    else if (label.includes(w)) score += 4;
    else if (rest.includes(w)) score += 1;
    else return 0;
  }
  return score;
}

/** Best matches, at most `perGroup` per group, groups in GROUP_ORDER. */
export function searchItems(items: PaletteItem[], query: string, perGroup = 8): { group: PaletteGroup; items: PaletteItem[] }[] {
  const scored = items
    .map((item) => ({ item, s: scoreItem(item, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.item.label.localeCompare(b.item.label));
  return GROUP_ORDER.map((group) => ({
    group,
    items: scored.filter((x) => x.item.group === group).slice(0, perGroup).map((x) => x.item),
  })).filter((g) => g.items.length);
}

/** Whether a URL is a page the router actually has (so the search never offers a page that is not built yet). */
export function routeExists(routes: string[], url: string): boolean {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return routes.some((r) => {
    if (r === '*' || !r.startsWith('/')) return false;
    const re = new RegExp(`^${r.replace(/\/+$/, '').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\/:[^/]+/g, '/[^/]+').replace(/\*/g, '.*')}$`);
    return re.test(path);
  });
}

/** "create_product" -> "create product" */
export function humanizeAction(a: string): string {
  return a.replace(/[_-]+/g, ' ').trim();
}

export interface NavLikeItem {
  title: string;
  url: string;
  permissions?: string[];
}

/** Menu and sub-menu pages of subscribed modules the user may open, one per URL. */
export function pageItems(
  config: Record<string, { title: string; items: NavLikeItem[] }[]>,
  moduleLabel: (key: string) => string,
  checks: { isModuleSubscribed: (k: string) => boolean; hasAnyPermission: (p: string[]) => boolean; routes: string[] },
  go: (url: string) => void,
): PaletteItem[] {
  const seen = new Set<string>();
  const out: PaletteItem[] = [];
  for (const [moduleKey, sections] of Object.entries(config)) {
    if (!checks.isModuleSubscribed(moduleKey)) continue;
    for (const section of sections) {
      for (const it of section.items) {
        if (seen.has(it.url)) continue;
        if (it.permissions?.length && !checks.hasAnyPermission(it.permissions)) continue;
        if (!routeExists(checks.routes, it.url)) continue;
        seen.add(it.url);
        out.push({
          id: `page:${it.url}`,
          group: 'Pages',
          label: it.title,
          hint: `${moduleLabel(moduleKey)} › ${section.title}`,
          keywords: it.url.replace(/[/-]+/g, ' '),
          run: () => go(it.url),
        });
      }
    }
  }
  return out;
}

export interface IndexEntry {
  module_key: string;
  feature: string;
  route: string;
  purpose: string;
  actions: string[];
  buttons: { label: string; location: string }[];
}

/** Features (pages described in the knowledge base) and their buttons. */
export function featureItems(
  entries: IndexEntry[],
  checks: { isModuleSubscribed: (k: string) => boolean; isKnownModule: (k: string) => boolean; routes: string[] },
  go: (url: string) => void,
): PaletteItem[] {
  const out: PaletteItem[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (checks.isKnownModule(e.module_key) && !checks.isModuleSubscribed(e.module_key)) continue;
    if (!routeExists(checks.routes, e.route)) continue;
    const actions = e.actions.map(humanizeAction).join(' ');
    out.push({
      id: `feature:${e.module_key}:${e.feature}`,
      group: 'Features & buttons',
      label: e.feature,
      hint: e.purpose,
      keywords: `${actions} ${e.buttons.map((b) => b.label).join(' ')}`,
      run: () => go(e.route),
    });
    for (const b of e.buttons) {
      const key = `${e.route}|${b.label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `button:${key}`,
        group: 'Features & buttons',
        label: b.label,
        hint: `${e.feature} · ${b.location}`,
        keywords: actions,
        run: () => go(e.route),
      });
    }
  }
  return out;
}
