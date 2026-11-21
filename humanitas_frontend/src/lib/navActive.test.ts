import { describe, expect, it } from 'vitest';
import { isNavItemActive, matchesNavUrl, navUrlsOf } from './navActive';

const config = {
  products: [
    { items: [{ url: '/products' }, { url: '/products/categories' }, { url: '/products/uoms' }] },
    { items: [{ url: '/products/reports' }] },
  ],
  hrms: [{ items: [{ url: '/dashboard' }, { url: '/attendance' }] }],
};
const urls = navUrlsOf(config);

describe('menu active state', () => {
  it('lights only the most specific matching link', () => {
    expect(isNavItemActive('/products/uoms', '/products/uoms', urls)).toBe(true);
    expect(isNavItemActive('/products/uoms', '/products', urls)).toBe(false);
    expect(isNavItemActive('/products/categories', '/products/uoms', urls)).toBe(false);
  });

  it('keeps the parent active on its own page and on pages without their own link', () => {
    expect(isNavItemActive('/products', '/products', urls)).toBe(true);
    expect(isNavItemActive('/products/3f2a', '/products', urls)).toBe(true);
  });

  it('does not treat a longer word as a sub-page and keeps the dashboard exact', () => {
    expect(matchesNavUrl('/products-old', '/products')).toBe(false);
    expect(isNavItemActive('/dashboard/x', '/dashboard', urls)).toBe(false);
    expect(isNavItemActive('/dashboard', '/dashboard', urls)).toBe(true);
  });

  it('collects links from one list or from per-module configs', () => {
    expect(urls).toContain('/products/reports');
    expect(urls).toContain('/attendance');
    expect(navUrlsOf(config.products)).toHaveLength(4);
    expect(navUrlsOf(config)).toBe(urls);
  });
});
