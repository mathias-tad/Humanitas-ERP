import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/config/api.config';
import { ACTIVE_BRANCH_KEY, ACTIVE_COMPANY_KEY, getAuthHeaders } from '@/context/AuthContext';
import { useInfiniteList } from '@/components/platform/InfiniteList';

// ── Types (mirror the tenant API, featureslist §1) ─────────────────────────────────────
export type ProductType = 'storable' | 'consumable' | 'service';

/** MoR EIMS line tax codes (AGENTS.md rule 28) and their rate in %. */
export const EIMS_TAX_CODES = { VAT15: 15, VAT0: 0, VATEX: 0, TOT2: 2, TOT10: 10 } as const;
export type EimsTaxCode = keyof typeof EIMS_TAX_CODES;
export const EIMS_TAX_CODE_LABELS: Record<EimsTaxCode, string> = {
  VAT15: 'VAT 15%', VAT0: 'VAT 0% (zero-rated)', VATEX: 'VAT exempt', TOT2: 'Turnover tax 2%', TOT10: 'Turnover tax 10%',
};
export type EimsIssue = 'item_code' | 'description' | 'unit' | 'tax_code';
export const EIMS_ISSUE_TEXT: Record<EimsIssue, string> = {
  item_code: 'Item code is missing or invalid',
  description: 'Name is over 100 characters: add a shorter invoice description',
  unit: 'The unit has no MoR unit code: set one under Units of Measure',
  tax_code: 'Tax code is missing',
};

export interface ProductBarcode {
  id?: string;
  barcode: string;
  barcode_type?: 'ean13' | 'ean8' | 'upca' | 'code128' | 'qr' | 'other';
  packaging?: string | null;
  quantity?: number | string;
  is_primary?: boolean;
}

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  product_type: ProductType;
  category_id: string | null;
  category_name: string | null;
  uom_id: string;
  uom_name: string;
  uom_symbol: string | null;
  purchase_uom_id: string;
  purchase_uom_name: string;
  sales_price: string;
  cost_price: string;
  tax_rate: string | null;
  tax_code: EimsTaxCode;
  item_code: string;
  harmonization_code: string | null;
  excise_rate: string | null;
  category_excise_rate: string | null;
  effective_excise_rate: string;
  invoice_description: string | null;
  nature_of_supply: 'goods' | 'service';
  uom_mor_code: string | null;
  eims_ready: boolean;
  eims_issues: EimsIssue[];
  can_be_sold: boolean;
  can_be_purchased: boolean;
  image_url: string | null;
  is_active: boolean;
  archived_at: string | null;
  company_id: string | null;
  barcodes: ProductBarcode[];
  /** Variants (featureslist §1): set on a variant, which takes its shared details from the parent. */
  parent_id: string | null;
  parent_name: string | null;
  parent_sales_price: string | null;
  /** The product is a parent: its variants are sold and scanned, not it. */
  has_variants: boolean;
  variant_count: number;
  /** "Red, M" */
  variant_label: string | null;
  /** Added to the parent's sales price. */
  price_extra: string;
  auto_archived: 'config' | 'parent' | null;
  variant_values: { attribute_id: string; attribute_name: string; value_id: string; value_name: string; html_color: string | null }[];
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name?: string;
  sku?: string | null;
  description?: string | null;
  product_type?: ProductType;
  category_id?: string | null;
  uom_id?: string;
  purchase_uom_id?: string;
  sales_price?: number;
  cost_price?: number;
  tax_code?: EimsTaxCode;
  item_code?: string;
  harmonization_code?: string | null;
  excise_rate?: number | null;
  invoice_description?: string | null;
  can_be_sold?: boolean;
  can_be_purchased?: boolean;
  image_url?: string | null;
  company_id?: string | null;
  barcodes?: ProductBarcode[];
  /** Variants only. */
  price_extra?: number;
}

export interface ProductCategory {
  id: string;
  parent_id: string | null;
  name: string;
  code: string | null;
  description: string | null;
  excise_rate: string;
  is_active: boolean;
  company_id: string | null;
  full_path: string;
  depth: number;
  product_count: number;
}

export interface Uom {
  id: string;
  name: string;
  symbol: string | null;
  mor_code: string | null;
  ratio: string | number;
  is_reference: boolean;
  rounding: string | number;
  is_active: boolean;
}

export interface UomCategory {
  id: string;
  name: string;
  is_active: boolean;
  units: Uom[];
}

export interface ProductFilters {
  q?: string;
  category_id?: string;
  product_type?: ProductType;
  status?: 'active' | 'archived' | 'all';
  eims?: 'ready' | 'not_ready';
  /** catalog (default): products and parents | sellable: products and variants (for sale lines) | all */
  kind?: 'catalog' | 'sellable' | 'all';
  parent_id?: string;
  sort?: 'name' | 'sku' | 'item_code' | 'sales_price' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────────────
/** Query keys carry the active company/branch so scopes never share cache (AGENTS.md rule 17). */
export function scopeKey(): [string | null, string | null] {
  try {
    return [localStorage.getItem(ACTIVE_COMPANY_KEY), localStorage.getItem(ACTIVE_BRANCH_KEY)];
  } catch {
    return [null, null];
  }
}

export function toQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const productKeys = {
  all: ['products'] as const,
  list: (f: ProductFilters) => ['products', 'list', ...scopeKey(), f] as const,
  detail: (id: string) => ['products', 'detail', ...scopeKey(), id] as const,
  categories: (archived: boolean) => ['products', 'categories', ...scopeKey(), archived] as const,
  uoms: () => ['products', 'uoms'] as const,
  morUnits: () => ['products', 'mor-units'] as const,
};

// ── Products ──────────────────────────────────────────────────────────────────────────
export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => api.get<Paged<Product>>(`/products${toQueryString({ ...filters })}`),
    placeholderData: (prev) => prev,
  });
}

/** The product list, loaded a page at a time as the user scrolls (rule 24 item 21). */
export function useInfiniteProducts(filters: Omit<ProductFilters, 'page' | 'limit'>) {
  return useInfiniteList<Product>(['products', 'list', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<Product>>(`/products${toQueryString({ ...filters, page, limit })}`),
  );
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: !!id,
  });
}

/** Product pickers (POS, Sales, Purchasing…) offer what can go on a line: variants, not their parents. */
export function searchProducts(q: string) {
  return api.get<Paged<Product>>(`/products${toQueryString({ q, limit: 20, kind: 'sellable' })}`).then((r) => r.data);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: productKeys.all });
}

export function useCreateProduct() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: ProductInput) => api.post<Product>('/products', input), onSuccess: invalidate });
}

export function useUpdateProduct() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductInput }) => api.patch<Product>(`/products/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useArchiveProduct() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete<Product>(`/products/${id}`), onSuccess: invalidate });
}

export function useRestoreProduct() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.post<Product>(`/products/${id}/restore`), onSuccess: invalidate });
}

/** Download the CSV export with the same headers as every API call. */
export async function downloadProductsCsv(filters: ProductFilters): Promise<void> {
  const { page: _p, limit: _l, ...rest } = filters;
  const res = await fetch(`${API_BASE_URL}/products/export.csv${toQueryString(rest)}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Categories ────────────────────────────────────────────────────────────────────────
export function useProductCategories(includeArchived = false) {
  return useQuery({
    queryKey: productKeys.categories(includeArchived),
    queryFn: () => api.get<ProductCategory[]>(`/product-categories${includeArchived ? '?include_archived=true' : ''}`),
  });
}

export function searchCategories(q: string) {
  const term = q.trim().toLowerCase();
  return api
    .get<ProductCategory[]>('/product-categories')
    .then((rows) => rows.filter((c) => !term || c.full_path.toLowerCase().includes(term)).slice(0, 20));
}

export interface CategoryInput {
  name?: string;
  parent_id?: string | null;
  code?: string | null;
  description?: string | null;
  excise_rate?: number;
  is_active?: boolean;
}

export function useCreateCategory() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: CategoryInput) => api.post<ProductCategory>('/product-categories', input), onSuccess: invalidate });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryInput }) => api.patch<ProductCategory>(`/product-categories/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useArchiveCategory() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete<ProductCategory>(`/product-categories/${id}`), onSuccess: invalidate });
}

// ── Units of measure ──────────────────────────────────────────────────────────────────
export function useUoms(includeInactive = false) {
  return useQuery({
    queryKey: [...productKeys.uoms(), includeInactive],
    queryFn: () => api.get<UomCategory[]>(`/uoms${includeInactive ? '?include_inactive=true' : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUomCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name: string; reference_unit: string; reference_symbol?: string; reference_mor_code?: string }) =>
      api.post<UomCategory>('/uoms/categories', input),
    onSuccess: invalidate,
  });
}

export function useCreateUom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { category_id: string; name: string; symbol?: string; ratio: number; rounding?: number; mor_code?: string }) =>
      api.post<Uom>('/uoms', input),
    onSuccess: invalidate,
  });
}

export function useUpdateUom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Pick<Uom, 'name' | 'symbol' | 'is_active' | 'mor_code'>> & { ratio?: number; rounding?: number } }) =>
      api.patch<Uom>(`/uoms/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useArchiveUom() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete<Uom>(`/uoms/${id}`), onSuccess: invalidate });
}

/** MoR unit codes (PCS, KLG, LTR, MTR, ROL…) for the unit form. */
export function useMorUnitCodes(enabled = true) {
  return useQuery({
    queryKey: productKeys.morUnits(),
    queryFn: () => api.get<{ code: string; name: string }[]>('/uoms/mor-codes'),
    staleTime: 30 * 60 * 1000,
    enabled,
  });
}

/** The API's message when no active product has the code (GET /products/lookup → 404). */
export const LOOKUP_NOT_FOUND = 'No product with this barcode or SKU';

/** Find an active product by barcode, item code or SKU; null when nothing matches. Other errors are thrown. */
export async function lookupProduct(code: string): Promise<Product | null> {
  try {
    return await api.get<Product>(`/products/lookup${toQueryString({ code: code.trim() })}`);
  } catch (e) {
    if (e instanceof Error && e.message === LOOKUP_NOT_FOUND) return null;
    throw e;
  }
}
