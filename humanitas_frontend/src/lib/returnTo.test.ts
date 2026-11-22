import { afterEach, describe, expect, it } from 'vitest';
import { RETURN_TO_KEY, loginPathFor, rememberReturnTo, returnTarget, safeReturnPath } from './returnTo';

describe('return to the opened page after sign-in', () => {
  afterEach(() => sessionStorage.clear());

  it('keeps the page, its query and hash in the login link', () => {
    expect(loginPathFor({ pathname: '/products', search: '?q=teff', hash: '#x' })).toBe('/login?next=%2Fproducts%3Fq%3Dteff%23x');
    expect(loginPathFor({ pathname: '/dashboard' })).toBe('/login');
    expect(loginPathFor({ pathname: '/' })).toBe('/login');
  });

  it('only accepts paths on this site', () => {
    expect(safeReturnPath('/leave/requests?id=5')).toBe('/leave/requests?id=5');
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/javascript:x', '/login', '/login?next=/x', '/setup-account', '', null]) {
      expect(safeReturnPath(bad as string | null)).toBeNull();
    }
  });

  it('goes to ?next=, else the remembered page, else the dashboard', () => {
    expect(returnTarget('?next=%2Fproducts%3Fq%3Dteff')).toBe('/products?q=teff');
    expect(returnTarget('?next=https%3A%2F%2Fevil.example')).toBe('/dashboard');
    rememberReturnTo('/pms/tasks/42');
    expect(returnTarget('', true)).toBe('/pms/tasks/42');
    expect(sessionStorage.getItem(RETURN_TO_KEY)).toBeNull();
    expect(returnTarget('')).toBe('/dashboard');
  });
});
