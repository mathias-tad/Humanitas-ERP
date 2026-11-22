/**
 * After sign-in, go back to the page the user was trying to open (a shared link, a bookmark, a
 * page whose session expired) instead of always the dashboard. Only same-site paths are
 * accepted, so a crafted link can never send someone to another website.
 */
export const RETURN_TO_KEY = 'humanitas.returnTo';
const DEFAULT_AFTER_LOGIN = '/dashboard';
const NOT_A_TARGET = /^\/(login|signup|setup|setup-account)(\/|\?|#|$)/;

/** The path if it is a safe place to return to, else null. */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const p = raw.trim();
  if (!p.startsWith('/') || p.startsWith('//') || p.startsWith('/\\')) return null;
  if (/[\r\n\t]/.test(p) || /^\/[^/?#]*:/.test(p)) return null;
  if (NOT_A_TARGET.test(p)) return null;
  return p;
}

/** "/login?next=/products%3Fq%3Dteff" for the page being opened ("/login" for the dashboard). */
export function loginPathFor(loc: { pathname: string; search?: string; hash?: string }): string {
  const target = safeReturnPath(`${loc.pathname}${loc.search ?? ''}${loc.hash ?? ''}`);
  if (!target || target === '/' || target === DEFAULT_AFTER_LOGIN) return '/login';
  return `/login?next=${encodeURIComponent(target)}`;
}

export function rememberReturnTo(path: string): void {
  const p = safeReturnPath(path);
  if (!p) return;
  try {
    sessionStorage.setItem(RETURN_TO_KEY, p);
  } catch {
    // storage unavailable: the ?next= in the URL still works
  }
}

/**
 * Where to go after signing in: ?next= first, then a path remembered before a full-page
 * redirect, else the dashboard. `consume` clears the remembered path.
 */
export function returnTarget(search: string, consume = false): string {
  const fromQuery = safeReturnPath(new URLSearchParams(search).get('next'));
  let stored: string | null = null;
  try {
    stored = safeReturnPath(sessionStorage.getItem(RETURN_TO_KEY));
    if (consume) sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    stored = null;
  }
  return fromQuery ?? stored ?? DEFAULT_AFTER_LOGIN;
}

/** Full-page redirect to sign-in that keeps the current page (for code outside React). */
export function redirectToLogin(): void {
  const { pathname, search, hash } = window.location;
  if (pathname.startsWith('/login')) return;
  rememberReturnTo(`${pathname}${search}${hash}`);
  window.location.href = loginPathFor({ pathname, search, hash });
}
