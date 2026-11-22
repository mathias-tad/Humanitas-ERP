import { describe, expect, it, vi } from 'vitest';
import { featureItems, pageItems, routeExists, scoreItem, searchItems, type PaletteItem } from './commandSearch';

const item = (label: string, group: PaletteItem['group'] = 'Pages', hint = '', keywords = ''): PaletteItem => ({ id: label, group, label, hint, keywords, run: () => {} });

describe('Ctrl+K search', () => {
  it('needs every word, and ranks label matches first', () => {
    expect(scoreItem(item('Units of Measure'), 'units')).toBeGreaterThan(scoreItem(item('Products', 'Pages', 'units and prices'), 'units'));
    expect(scoreItem(item('Units of Measure'), 'units xyz')).toBe(0);
    expect(scoreItem(item('Leave requests'), 'leave req')).toBeGreaterThan(0);
    expect(scoreItem(item('Café'), 'cafe')).toBeGreaterThan(0);
    const res = searchItems([item('Attributes & Variants'), item('New product', 'Features & buttons', 'All Products'), item('Archive', 'Features & buttons')], 'product');
    expect(res.map((g) => g.group)).toEqual(['Features & buttons']);
    expect(searchItems([item('a')], '')).toEqual([]);
  });

  it('knows which pages exist', () => {
    const routes = ['/products', '/products/:id', '/leave/requests', '*'];
    expect(routeExists(routes, '/products')).toBe(true);
    expect(routeExists(routes, '/products/abc?x=1')).toBe(true);
    expect(routeExists(routes, '/products/pricelists/x')).toBe(false);
    expect(routeExists(routes, '/sales')).toBe(false);
  });

  it('lists subscribed, permitted, built menu pages once', () => {
    const go = vi.fn();
    const config = {
      products: [{ title: 'Catalog', items: [{ title: 'All Products', url: '/products' }, { title: 'Price Lists', url: '/products/pricelists' }, { title: 'Units', url: '/products/uoms', permissions: ['view_uoms'] }] }],
      sales: [{ title: 'Sales', items: [{ title: 'Orders', url: '/sales' }] }],
      hrms: [{ title: 'Home', items: [{ title: 'Dashboard', url: '/products' }] }],
    };
    const items = pageItems(config, (k) => k.toUpperCase(), {
      isModuleSubscribed: (k) => k !== 'sales', hasAnyPermission: (p) => !p.includes('view_uoms'), routes: ['/products', '/products/uoms', '/sales'],
    }, go);
    expect(items.map((i) => i.label)).toEqual(['All Products']);
    expect(items[0].hint).toBe('PRODUCTS › Catalog');
    items[0].run();
    expect(go).toHaveBeenCalledWith('/products');
  });

  it('turns knowledge entries into features and buttons of subscribed modules', () => {
    const items = featureItems(
      [
        { module_key: 'products', feature: 'All Products', route: '/products', purpose: 'Catalog', actions: ['create_product'], buttons: [{ label: 'New product', location: 'Top-right' }] },
        { module_key: 'pos', feature: 'POS', route: '/pos', purpose: '', actions: [], buttons: [] },
        { module_key: 'platform', feature: 'Help', route: '/products', purpose: '', actions: [], buttons: [{ label: 'New product', location: 'again' }] },
      ],
      { isModuleSubscribed: (k) => k === 'products', isKnownModule: (k) => k !== 'platform', routes: ['/products', '/pos'] },
      () => {},
    );
    expect(items.map((i) => i.label)).toEqual(['All Products', 'New product', 'Help']);
    expect(items[1].hint).toBe('All Products · Top-right');
  });
});
