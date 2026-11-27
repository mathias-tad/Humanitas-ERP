import { registerSlot } from '@/lib/moduleSlots';
import { ProductStockTab } from './ProductStockTab';

/**
 * Where Inventory plugs into the modules it builds on (rule 30): a Stock tab on the product form.
 * Shown only when the tenant has Inventory and the person may see stock; not on a product with
 * variants (its variants hold the stock).
 */
registerSlot('product.tabs', {
  id: 'inventory.stock',
  module: 'inventory',
  permission: 'view_stock',
  label: 'Stock',
  order: 40,
  when: (p) => !p.isParent && p.productType !== 'service',
  Component: ProductStockTab,
});
