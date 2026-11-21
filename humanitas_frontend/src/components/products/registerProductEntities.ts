import { api } from '@/lib/api';
import { registerEntity } from '@/components/platform/entityRegistry';
import { searchCategories, searchProducts, type Product, type ProductCategory } from '@/hooks/useProducts';
import { ProductForm } from './ProductForm';
import { CategoryForm } from './CategoryForm';

/**
 * Products registers its record types once (featureslist §29); POS, Sales, Purchasing,
 * Inventory… then get product search, one-step create and "Create & edit…" for free.
 */
registerEntity<Product>({
  type: 'product',
  label: 'product',
  module: 'products',
  permissions: { view: 'view_products', create: 'create_products' },
  search: searchProducts,
  toOption: (p) => ({
    id: p.id,
    label: p.name,
    description: [p.sku, p.barcodes?.find((b) => b.is_primary)?.barcode, `${Number(p.sales_price).toFixed(2)}`].filter(Boolean).join(' · '),
  }),
  quickCreate: (name) => api.post<Product>('/products', { name }),
  Form: ProductForm,
});

registerEntity<ProductCategory>({
  type: 'product_category',
  label: 'category',
  module: 'products',
  permissions: { view: 'view_product_categories', create: 'create_product_categories' },
  search: searchCategories,
  toOption: (c) => ({ id: c.id, label: c.full_path ?? c.name, description: c.code ?? undefined }),
  quickCreate: (name) => api.post<ProductCategory>('/product-categories', { name }).then((c) => ({ ...c, full_path: c.full_path ?? c.name })),
  Form: CategoryForm,
});
