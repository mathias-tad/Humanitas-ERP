/**
 * The catalog of app actions the AI assistant can perform for a user: every authenticated API
 * endpoint, described well enough for the model to pick one and fill in its inputs. Actions run
 * through the normal API as the user, so permissions, module access, validation, approvals and
 * history work exactly as when the user clicks the button. Pure helpers here; discovery is in
 * app-action-catalog.service.ts.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ActionField {
  name: string;
  required: boolean;
  /** e.g. "string", "number", "boolean", "uuid", "email", "date", "array", "object", "one of: a | b" */
  type: string;
}

export interface AppAction {
  /** "POST /products/:id/variants" */
  id: string;
  method: HttpMethod;
  path: string;
  module: string | null;
  /** The user needs any one of these (empty: any signed-in user). */
  permissions: string[];
  summary: string;
  pathParams: string[];
  body: ActionField[];
  query: ActionField[];
}

/** Never offered to the AI: sign-in, the AI itself, public pages, device and integration plumbing. */
export const BLOCKED_PATH_PREFIXES = [
  'auth', 'ai', 'public', 'iclock', 'health', 'setup', 'developer-api', 'webhooks', 'internal', 'mcp',
];

export function isBlockedPath(path: string): boolean {
  const first = path.replace(/^\/+/, '').split('/')[0]?.toLowerCase() ?? '';
  return BLOCKED_PATH_PREFIXES.includes(first);
}

export function joinPath(...parts: (string | undefined)[]): string {
  const p = parts
    .filter((x): x is string => !!x && x !== '/')
    .map((x) => x.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `/${p}`;
}

export function pathParamsOf(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
}

/** "saveVariants" -> "save variants"; "ProductAttributesController" -> "product attributes". */
export function humanize(name: string): string {
  return name
    .replace(/Controller$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
}

const VERB_WORDS: Record<HttpMethod, string[]> = {
  GET: ['get', 'list', 'show', 'view', 'find', 'see', 'read', 'check', 'search', 'report'],
  POST: ['create', 'add', 'new', 'make', 'submit', 'start', 'send', 'post', 'run', 'generate', 'approve', 'reject', 'restore'],
  PUT: ['set', 'update', 'change', 'replace', 'save', 'edit'],
  PATCH: ['update', 'change', 'edit', 'rename', 'set', 'modify'],
  DELETE: ['delete', 'remove', 'archive', 'cancel', 'deactivate'],
};

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
}

/** Naive plural/singular folding so "products" matches "product" and "categories" "category". */
function stem(w: string): string {
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('ses') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

/** How well an action matches a request like "create a product called Teff" (0 = not at all). */
export function scoreAction(action: AppAction, query: string): number {
  const q = words(query).map(stem);
  if (!q.length) return 0;
  const hay = new Set(
    words(`${action.path.replace(/:[a-z_]+/gi, '')} ${action.summary} ${action.module ?? ''}`).map(stem),
  );
  const verbs = new Set(VERB_WORDS[action.method]);
  let score = 0;
  for (const w of q) {
    if (hay.has(w)) score += 3;
    else if ([...hay].some((h) => h.length > 3 && (h.startsWith(w) || w.startsWith(h)))) score += 1;
    if (verbs.has(w)) score += 2;
  }
  // Prefer plain resources over deep sub-resources when equally matched.
  return score > 0 ? score - action.path.split('/').length * 0.1 : 0;
}

export function canUse(action: AppAction, permissions: string[]): boolean {
  if (permissions.includes('*')) return true;
  return !action.permissions.length || action.permissions.some((p) => permissions.includes(p));
}

export function searchActions(catalog: AppAction[], query: string, permissions: string[], limit = 8): AppAction[] {
  return catalog
    .filter((a) => canUse(a, permissions))
    .map((a) => ({ a, s: scoreAction(a, query) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || x.a.id.localeCompare(y.a.id))
    .slice(0, limit)
    .map((x) => x.a);
}

/** Compact text the model reads: id, what it does, and its inputs. */
export function describeAction(a: AppAction): string {
  const f = (list: ActionField[]) => list.map((x) => `${x.name}${x.required ? '' : '?'}: ${x.type}`).join(', ');
  const parts = [`- ${a.id} — ${a.summary}`];
  if (a.pathParams.length) parts.push(`  path: ${a.pathParams.join(', ')}`);
  if (a.query.length) parts.push(`  query: ${f(a.query)}`);
  if (a.body.length) parts.push(`  body: ${f(a.body)}`);
  if (a.permissions.length) parts.push(`  permission: ${a.permissions.join(' or ')}`);
  return parts.join('\n');
}

/** Fills ":id" segments; refuses missing values and anything that could leave the path. */
export function buildUrl(a: AppAction, pathValues: Record<string, unknown> = {}, query: Record<string, unknown> = {}): string {
  let path = a.path;
  for (const p of a.pathParams) {
    const v = pathValues[p];
    if (v === undefined || v === null || String(v).trim() === '') throw new Error(`Missing path value "${p}"`);
    path = path.replace(`:${p}`, encodeURIComponent(String(v).trim()));
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
    else qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export const WRITE_METHODS: HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** "yes", "ok go ahead", "confirm", "እሺ"... but not "no", "don't" or "wait". */
export function isConfirmation(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (!m || m.length > 80) return false;
  if (/\b(no|not|don'?t|do not|stop|cancel|wait|never)\b|አይ|አትፈጽም/.test(m)) return false;
  return /^(yes|y|yeah|yep|yup|ok|okay|sure|confirm(ed)?|i confirm|go ahead|do it|proceed|approve(d)?|correct|right|please do|አዎ|እሺ|ይቻላል|ቀጥል)\b/.test(m)
    || /^(አዎ|እሺ|ይቻላል|ቀጥል)/.test(m);
}

export function isCancellation(message: string): boolean {
  const m = message.trim().toLowerCase();
  return m.length <= 80 && (/^(no|nope|cancel|stop|don'?t|do not|never ?mind)\b/.test(m) || /^(አይ|ተው)/.test(m));
}
