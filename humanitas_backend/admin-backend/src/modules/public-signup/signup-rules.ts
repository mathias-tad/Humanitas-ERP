/**
 * Rules for the public "Start free trial" sign-up: which organization IDs (slugs) are allowed,
 * and a simple in-memory rate limit so one visitor cannot create many tenants.
 */

/** Organization IDs that clash with platform hosts, routes or the brand. */
export const RESERVED_SLUGS = new Set([
  'admin', 'administrator', 'api', 'app', 'apps', 'assets', 'auth', 'billing', 'blog', 'cdn', 'dashboard',
  'demo', 'dev', 'docs', 'ftp', 'help', 'humanitas', 'humanitas-erp', 'login', 'logout', 'mail', 'master',
  'portal', 'postgres', 'public', 'root', 'setup', 'signup', 'smtp', 'staging', 'static', 'status', 'support',
  'system', 'tenant', 'tenants', 'test', 'www', 'ziontech',
]);

/** Why a organization ID cannot be used, or null when it can. */
export function slugProblem(slug: unknown): string | null {
  if (typeof slug !== 'string' || !slug.trim()) return 'Enter a organization ID.';
  const s = slug.trim();
  if (s.length < 3) return 'The organization ID needs at least 3 characters.';
  if (s.length > 40) return 'The organization ID can have at most 40 characters.';
  if (!/^[a-z0-9-]+$/.test(s)) return 'Use only lowercase letters, numbers and hyphens.';
  if (s.startsWith('-') || s.endsWith('-') || s.includes('--')) return 'Hyphens go between letters or numbers.';
  if (/^\d+$/.test(s)) return 'The organization ID needs at least one letter.';
  if (RESERVED_SLUGS.has(s)) return 'This organization ID is reserved. Choose another.';
  return null;
}

/** Suggests a organization ID from a company name ("Abebe & Sons PLC" -> "abebe-sons-plc"). */
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

/** Allows at most `limit` hits per key in any `windowMs` window. */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Records a hit and returns true when it is within the limit. */
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [k, list] of this.hits) {
      if (!list.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    }
  }
}

/** The visitor's address: the first X-Forwarded-For entry (set by nginx), else the socket address. */
export function clientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const fwd = req.headers?.['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.headers?.['x-real-ip']?.toString() || req.ip || 'unknown';
}
