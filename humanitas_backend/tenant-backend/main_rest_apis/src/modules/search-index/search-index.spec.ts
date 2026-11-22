import { toSearchIndex } from './search-index.controller';

const row = (over: Record<string, unknown> = {}) => ({
  module_key: 'products', feature_name: 'All Products', route_path: '/products', page_purpose: 'The catalog',
  available_actions: ['create_product'], button_locations: [{ label: 'New product', location: 'Top-right' }],
  required_permissions: ['view_products'], ...over,
});

describe('search index', () => {
  it('lists only entries the user has a permission for', () => {
    const rows = [row(), row({ feature_name: 'Payroll', required_permissions: ['run_payroll'] }), row({ feature_name: 'Help', required_permissions: [] })];
    expect(toSearchIndex(rows, ['view_products']).map((e) => e.feature)).toEqual(['All Products', 'Help']);
    expect(toSearchIndex(rows, ['*'])).toHaveLength(3);
  });

  it('keeps buttons and actions, also from JSON text', () => {
    const [e] = toSearchIndex([row({ button_locations: JSON.stringify([{ label: 'Scan', location: 'Beside search' }, { nope: 1 }]) })], ['*']);
    expect(e).toMatchObject({ route: '/products', actions: ['create_product'], buttons: [{ label: 'Scan', location: 'Beside search' }] });
  });
});
