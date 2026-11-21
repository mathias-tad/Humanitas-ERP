/**
 * Which menu item is active: the most specific link that matches the current page wins.
 * Before, "All Products" (/products) stayed highlighted on /products/uoms because every page under
 * /products "starts with" it.
 */
type NavSectionLike = { items: { url: string }[] };

/** True when the page is the link itself or a page below it ("/products/123" for "/products"). */
export function matchesNavUrl(pathname: string, url: string): boolean {
  if (!url) return false;
  if (url === '/') return pathname === '/';
  const base = url.endsWith('/') ? url.slice(0, -1) : url;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Active only if no other menu link matches the page more specifically. */
export function isNavItemActive(pathname: string, url: string, allUrls: readonly string[]): boolean {
  if (url === '/dashboard') return pathname === '/dashboard';
  if (!matchesNavUrl(pathname, url)) return false;
  return !allUrls.some((other) => other !== url && other.length > url.length && matchesNavUrl(pathname, other));
}

const cache = new WeakMap<object, string[]>();

/** Every link in a menu config (one list of sections, or sections per module). */
export function navUrlsOf(config: NavSectionLike[] | Record<string, NavSectionLike[]>): string[] {
  const hit = cache.get(config);
  if (hit) return hit;
  const sections = Array.isArray(config) ? config : Object.values(config).flat();
  const urls = sections.flatMap((s) => s.items.map((i) => i.url));
  cache.set(config, urls);
  return urls;
}
