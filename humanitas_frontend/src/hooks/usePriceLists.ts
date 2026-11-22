import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';
import { registerEntity } from '@/components/platform/entityRegistry';
import { scopeKey, toQueryString, type Paged, type Product } from '@/hooks/useProducts';

/** Price lists (featureslist §1); mirrors the tenant API. */
export type RuleScope = 'product' | 'category' | 'all';
export type RuleCompute = 'fixed' | 'discount' | 'markup';

export interface PriceRule {
  id: string;
  applies_to: RuleScope;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_has_variants: boolean | null;
  category_id: string | null;
  category_name: string | null;
  min_quantity: string;
  compute: RuleCompute;
  fixed_price: string | null;
  percent: string | null;
  date_start: string | null;
  date_end: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface PriceList {
  id: string;
  name: string;
  code: string | null;
  currency: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  company_id: string | null;
  rule_count: number;
  items?: PriceRule[];
}

export interface PriceListInput {
  name?: string;
  code?: string | null;
  currency?: string;
  description?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  company_id?: string | null;
}

export interface PriceRuleInput {
  applies_to: RuleScope;
  product_id?: string | null;
  category_id?: string | null;
  min_quantity?: number;
  compute: RuleCompute;
  fixed_price?: number | null;
  percent?: number | null;
  date_start?: string | null;
  date_end?: string | null;
}

export interface PriceCell { price: number; rule_id: string | null; source: 'rule' | 'base'; base_price: number }
export interface ListRef { id: string; name: string; currency: string; is_default: boolean }

export const priceListKeys = {
  all: ['products', 'price-lists'] as const,
  list: (archived: boolean) => ['products', 'price-lists', ...scopeKey(), archived] as const,
  detail: (id: string) => ['products', 'price-lists', ...scopeKey(), 'detail', id] as const,
  forProduct: (id: string, qty: number) => ['products', 'price-lists', ...scopeKey(), 'for-product', id, qty] as const,
  compare: (q: string, qty: number) => ['products', 'price-lists', ...scopeKey(), 'compare', q, qty] as const,
};

/** "Teff 1 kg", "All of Grains", "Every product". */
export function ruleTarget(r: Pick<PriceRule, 'applies_to' | 'product_name' | 'category_name' | 'product_has_variants'>): string {
  if (r.applies_to === 'product') return `${r.product_name ?? 'Product'}${r.product_has_variants ? ' (all variants)' : ''}`;
  if (r.applies_to === 'category') return `All of ${r.category_name ?? 'category'}`;
  return 'Every product';
}

/** "95.00", "10% off the sales price", "cost + 25%". */
export function rulePriceText(r: Pick<PriceRule, 'compute' | 'fixed_price' | 'percent'>, currency = 'ETB'): string {
  const pct = Number(r.percent ?? 0);
  if (r.compute === 'fixed') return `${Number(r.fixed_price ?? 0).toFixed(2)} ${currency}`;
  if (r.compute === 'discount') return `${pct}% off the sales price`;
  return `cost ${pct >= 0 ? '+' : '−'} ${Math.abs(pct)}%`;
}

/** The form's checks (the API checks again). */
export function ruleInputProblem(r: PriceRuleInput, currency: string): string | null {
  if (r.applies_to === 'product' && !r.product_id) return 'Choose a product';
  if (r.applies_to === 'category' && !r.category_id) return 'Choose a category';
  if (r.compute === 'fixed') {
    if (r.fixed_price === null || r.fixed_price === undefined || Number.isNaN(r.fixed_price) || r.fixed_price < 0) return 'Enter a price of 0 or more';
  } else {
    if (r.percent === null || r.percent === undefined || Number.isNaN(r.percent)) return 'Enter a percentage';
    if (r.compute === 'discount' && (r.percent < 0 || r.percent > 100)) return 'A discount is between 0 and 100%';
    if (currency !== 'ETB') return `In a ${currency} list, use fixed prices`;
  }
  if ((r.min_quantity ?? 0) < 0 || Number.isNaN(r.min_quantity ?? 0)) return 'Minimum quantity is 0 or more';
  if (r.date_start && r.date_end && r.date_end < r.date_start) return 'The end date is before the start date';
  return null;
}

export function usePriceLists(includeArchived = false) {
  return useQuery({
    queryKey: priceListKeys.list(includeArchived),
    queryFn: () => api.get<PriceList[]>(`/price-lists${includeArchived ? '?include_archived=true' : ''}`),
  });
}

export function usePriceList(id: string | undefined) {
  return useQuery({ queryKey: priceListKeys.detail(id ?? ''), queryFn: () => api.get<PriceList>(`/price-lists/${id}`), enabled: !!id });
}

export function useProductPrices(productId: string | undefined, quantity: number) {
  return useQuery({
    queryKey: priceListKeys.forProduct(productId ?? '', quantity),
    queryFn: () =>
      api.get<{ lists: ListRef[]; rows: { product_id: string; name: string; base_price: number; prices: Record<string, PriceCell> }[] }>(
        `/price-lists/for-product/${productId}${toQueryString({ quantity })}`,
      ),
    enabled: !!productId,
  });
}

export function usePriceCompare(q: string, quantity: number) {
  return useQuery({
    queryKey: priceListKeys.compare(q, quantity),
    queryFn: () =>
      api.get<{ lists: ListRef[]; rows: { product_id: string; name: string; sku: string | null; item_code: string | null; base_price: number; prices: Record<string, number> }[] }>(
        `/price-lists/compare${toQueryString({ q: q || undefined, quantity, limit: 200 })}`,
      ),
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: priceListKeys.all });
}

export function useSavePriceList() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PriceListInput }) =>
      id ? api.patch<PriceList>(`/price-lists/${id}`, input) : api.post<PriceList>('/price-lists', input),
    onSuccess: invalidate,
  });
}

export function useArchivePriceList() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete<PriceList>(`/price-lists/${id}`), onSuccess: invalidate });
}

export function useSaveRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ listId, ruleId, input }: { listId: string; ruleId?: string; input: PriceRuleInput }) =>
      ruleId ? api.patch<PriceRule>(`/price-lists/${listId}/rules/${ruleId}`, input) : api.post<PriceRule>(`/price-lists/${listId}/rules`, input),
    onSuccess: invalidate,
  });
}

/** One rule per product for several products at once (POST /price-lists/:id/rules/bulk). */
export function useAddRulesForProducts() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ listId, productIds, rule }: { listId: string; productIds: string[]; rule: Omit<PriceRuleInput, 'applies_to' | 'product_id' | 'category_id'> }) =>
      api.post<{ added: number }>(`/price-lists/${listId}/rules/bulk`, { ...rule, product_ids: productIds }),
    onSuccess: invalidate,
  });
}

export function useArchiveRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ listId, ruleId }: { listId: string; ruleId: string }) => api.delete<PriceRule>(`/price-lists/${listId}/rules/${ruleId}`),
    onSuccess: invalidate,
  });
}

export async function downloadComparisonCsv(q: string, quantity: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/price-lists/compare.csv${toQueryString({ q: q || undefined, quantity, limit: 500 })}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `price-lists-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Picker for price rules: any product, including a product with variants (a rule on it covers
 * all its variants). No form, so the Ctrl+K search does not list it twice.
 */
registerEntity<Product>({
  type: 'price_rule_product',
  label: 'product',
  module: 'products',
  permissions: { view: 'view_products', create: 'create_products' },
  search: (q) => api.get<Paged<Product>>(`/products${toQueryString({ q, limit: 20, kind: 'all' })}`).then((r) => r.data),
  toOption: (p) => ({
    id: p.id,
    label: p.has_variants ? `${p.name} (all variants)` : p.name,
    description: [p.sku, `${Number(p.sales_price).toFixed(2)}`].filter(Boolean).join(' · '),
  }),
});
