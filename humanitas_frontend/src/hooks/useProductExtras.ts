import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';
import { productKeys, scopeKey, toQueryString, type ProductType } from '@/hooks/useProducts';

// ── Product Settings ──────────────────────────────────────────────────────────────────
export interface ProductSettings {
  sku_mode: 'manual' | 'auto';
  sku_prefix: string;
  sku_padding: number;
  sku_next: number | string;
  barcode_mode: 'manual' | 'ean13';
  barcode_prefix: string;
  barcode_next: number | string;
  default_product_type: ProductType;
  default_tax_code: string;
  default_uom_id: string | null;
  default_uom_name?: string | null;
  default_category_id: string | null;
  default_category_name?: string | null;
  require_category: boolean;
  require_barcode: boolean;
  warn_below_cost: boolean;
  next_sku_preview: string | null;
  next_barcode_preview: string | null;
}

export function useProductSettings(enabled = true) {
  return useQuery({ queryKey: ['product-settings'], queryFn: () => api.get<ProductSettings>('/product-settings'), enabled });
}

export function useSaveProductSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProductSettings>) => api.patch<ProductSettings>('/product-settings', input),
    onSuccess: (data) => qc.setQueryData(['product-settings'], data),
  });
}

// ── GS1 helpers (mirror the API's product-structure.ts) ───────────────────────────────
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

/** GTIN-8, 12, 13 or 14 with a correct check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code.slice(-1));
}

/** In-store EAN-13 preview: prefix + number padded to 12 digits + check digit; null when it does not fit. */
export function ean13Preview(prefix: string, n: number): string | null {
  if (!/^\d{2,10}$/.test(prefix) || !(n >= 1)) return null;
  const body = prefix + String(Math.floor(n)).padStart(12 - prefix.length, '0');
  if (body.length !== 12) return null;
  return body + gs1CheckDigit(body);
}

export function skuPreview(prefix: string, padding: number, n: number): string {
  return `${prefix}${String(Math.max(1, Math.floor(n || 1))).padStart(Math.min(12, Math.max(1, padding || 1)), '0')}`;
}

// ── Product Reports ───────────────────────────────────────────────────────────────────
export type CatalogIssue = 'no_barcode' | 'no_price' | 'no_cost' | 'below_cost' | 'no_category' | 'no_image' | 'not_eims_ready';

export const ISSUE_HELP: Record<CatalogIssue, string> = {
  no_barcode: 'Goods with no barcode or packaging GTIN: they cannot be scanned at the till.',
  no_price: 'Sellable products at 0: they would ring up free.',
  no_cost: 'Goods with no cost: margins and stock value are unknown.',
  below_cost: 'Sales price lower than cost: every sale loses money.',
  no_category: 'Not in a category: harder to find, report and price by category.',
  no_image: 'No picture for the POS, the online store and the app.',
  not_eims_ready: 'MoR would reject them on an e-invoice (unit code or description).',
};

export interface ProductReport {
  totals: { products: number; variants: number; sellable: number; archived: number; added_30d: number; changed_30d: number; kits: number; combos: number };
  by_type: { key: ProductType; count: number }[];
  by_category: { id: string | null; name: string; count: number; avg_price: string | null }[];
  issues: { key: CatalogIssue; label: string; count: number }[];
  completeness: number;
  margins: {
    avg_margin: string | null;
    median_margin: string | null;
    priced_and_costed: number;
    bands: { key: string; label: string; count: number }[];
    lowest: { id: string; name: string; sku: string | null; sales_price: string; cost_price: string; margin: string }[];
  };
  pricing: { price_lists: number; price_rules: number; customers_on_lists: number; pictures: number; attachments: number; packagings: number };
}

export function useProductReport(categoryId?: string) {
  return useQuery({
    queryKey: ['product-reports', ...scopeKey(), categoryId ?? null],
    queryFn: () => api.get<ProductReport>(`/product-reports/summary${toQueryString({ category_id: categoryId })}`),
  });
}

async function downloadCsv(path: string, filename: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: getAuthHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadGapsCsv(q: { issue?: CatalogIssue; category_id?: string }) {
  return downloadCsv(`/product-reports/issues.csv${toQueryString(q)}`, `catalog-gaps-${new Date().toISOString().slice(0, 10)}.csv`);
}

// ── Pictures and attachments ──────────────────────────────────────────────────────────
export interface ProductMedia {
  id: string;
  product_id: string;
  kind: 'image' | 'attachment';
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  title: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
export const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv,image/jpeg,image/png,image/webp';

/**
 * Where a stored picture or file is shown: under the web app's own address (/uploads/…), which its
 * server passes on to the API, so a picture opened in a new tab shows our domain. Pass apiBase to get
 * the API's address instead (links that leave the web app).
 */
export function mediaUrl(path: string | null | undefined, apiBase?: string): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!apiBase) return path.startsWith('/') ? path : `/${path}`;
  let origin = '';
  try {
    origin = new URL(apiBase, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').origin;
  } catch {
    origin = '';
  }
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function fileSizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const mediaKey = (productId: string) => ['product-media', productId] as const;

export function useProductMedia(productId: string) {
  return useQuery({ queryKey: mediaKey(productId), queryFn: () => api.get<ProductMedia[]>(`/products/${productId}/media`) });
}

function useMediaInvalidate(productId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: mediaKey(productId) });
    // The main picture is the product's image in lists.
    qc.invalidateQueries({ queryKey: productKeys.all });
  };
}

export async function uploadProductMedia(productId: string, file: File, kind: 'image' | 'attachment', title?: string): Promise<ProductMedia> {
  if (file.size > MAX_MEDIA_BYTES) throw new Error(`${file.name} is larger than 5 MB`);
  const form = new FormData();
  // Fields first: the server reads them with the file.
  form.append('kind', kind);
  if (title?.trim()) form.append('title', title.trim());
  form.append('file', file);
  const headers = { ...getAuthHeaders() } as Record<string, string>;
  delete headers['Content-Type'];
  const res = await fetch(`${API_BASE_URL}/products/${productId}/media`, { method: 'POST', credentials: 'include', headers, body: form });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Upload failed (${res.status})`);
  return res.json();
}

export function useUploadProductMedia(productId: string) {
  const invalidate = useMediaInvalidate(productId);
  return useMutation({
    mutationFn: ({ files, kind }: { files: File[]; kind: 'image' | 'attachment' }) =>
      // One at a time keeps the order and the first picture becomes the main one.
      files.reduce<Promise<ProductMedia[]>>(async (acc, f) => [...(await acc), await uploadProductMedia(productId, f, kind)], Promise.resolve([])),
    onSettled: invalidate,
  });
}

export function useUpdateProductMedia(productId: string) {
  const invalidate = useMediaInvalidate(productId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { title?: string | null; is_primary?: boolean } }) =>
      api.patch<ProductMedia>(`/products/${productId}/media/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useRemoveProductMedia(productId: string) {
  const invalidate = useMediaInvalidate(productId);
  return useMutation({ mutationFn: (id: string) => api.delete(`/products/${productId}/media/${id}`), onSuccess: invalidate });
}

export function useReorderProductMedia(productId: string) {
  const invalidate = useMediaInvalidate(productId);
  return useMutation({
    mutationFn: (ids: string[]) => api.post<ProductMedia[]>(`/products/${productId}/media/order`, { media_ids: ids }),
    onSuccess: invalidate,
  });
}

/** Moves one item up or down in an id list. */
export function moveId(ids: string[], id: string, by: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// ── Packaging ─────────────────────────────────────────────────────────────────────────
export type PackagingLevel = 'unit' | 'inner' | 'case' | 'pallet' | 'other';
export const PACKAGING_LEVELS: { value: PackagingLevel; label: string }[] = [
  { value: 'unit', label: 'Unit' }, { value: 'inner', label: 'Inner pack' }, { value: 'case', label: 'Case / box' },
  { value: 'pallet', label: 'Pallet' }, { value: 'other', label: 'Other' },
];

export interface Packaging {
  id?: string;
  name: string;
  level: PackagingLevel;
  quantity: number | string;
  gtin: string | null;
  weight_kg?: number | string | null;
  length_cm?: number | string | null;
  width_cm?: number | string | null;
  height_cm?: number | string | null;
  can_sell: boolean;
  can_buy: boolean;
}

/** The first problem with a packaging list, or null (the API checks again). */
export function packagingListProblem(rows: Packaging[]): string | null {
  const names = new Set<string>();
  const gtins = new Set<string>();
  for (const r of rows) {
    const name = r.name.trim().toLowerCase();
    if (!name) return 'Every packaging needs a name';
    if (names.has(name)) return `"${r.name.trim()}" is listed twice`;
    names.add(name);
    if (!(Number(r.quantity) > 0)) return `Enter how many units are in "${r.name.trim()}"`;
    const g = (r.gtin ?? '').trim();
    if (g) {
      if (!isValidGtin(g)) return `${g} is not a valid GTIN (check digit or length)`;
      if (gtins.has(g)) return `The GTIN ${g} is listed twice`;
      gtins.add(g);
    }
  }
  return null;
}

export function packagingToInput(r: Packaging) {
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    name: r.name.trim(), level: r.level, quantity: Number(r.quantity), gtin: (r.gtin ?? '').trim() || null,
    weight_kg: num(r.weight_kg), length_cm: num(r.length_cm), width_cm: num(r.width_cm), height_cm: num(r.height_cm),
    can_sell: r.can_sell, can_buy: r.can_buy,
  };
}

export function usePackagings(productId: string) {
  return useQuery({ queryKey: ['product-packagings', productId], queryFn: () => api.get<Packaging[]>(`/products/${productId}/packagings`) });
}

export function useSavePackagings(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Packaging[]) => api.put<Packaging[]>(`/products/${productId}/packagings`, { packagings: rows.map(packagingToInput) }),
    onSuccess: (data) => {
      qc.setQueryData(['product-packagings', productId], data);
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

// ── Kits and combos ───────────────────────────────────────────────────────────────────
export type Composition = 'single' | 'kit' | 'combo';

export interface KitComponent {
  component_id: string;
  quantity: number | string;
  name?: string;
  sku?: string | null;
  sales_price?: string;
  cost_price?: string;
  is_active?: boolean;
  uom_symbol?: string | null;
}

export interface ComboChoice {
  component_id: string;
  quantity?: number | string;
  extra_price?: number | string;
  is_default?: boolean;
  name?: string;
  sales_price?: string;
  is_active?: boolean;
}

export interface ComboGroup {
  id?: string;
  name: string;
  min_choices: number;
  max_choices: number;
  choices: ComboChoice[];
}

export interface CompositionData {
  product_id: string;
  composition: Composition;
  components: KitComponent[];
  groups: ComboGroup[];
  components_price: number;
  components_cost: number;
  sales_price: number;
}

/** The first problem with a kit or combo draft, or null (the API checks again). */
export function compositionDraftProblem(productId: string, composition: Composition, components: KitComponent[], groups: ComboGroup[]): string | null {
  if (composition === 'single') return null;
  if (composition === 'kit') {
    if (!components.length) return 'Add the products that make up the kit';
    const seen = new Set<string>();
    for (const c of components) {
      if (c.component_id === productId) return 'A kit cannot contain itself';
      if (seen.has(c.component_id)) return `${c.name ?? 'A product'} is listed twice; change its quantity instead`;
      seen.add(c.component_id);
      if (!(Number(c.quantity) > 0)) return `Enter a quantity for ${c.name ?? 'every component'}`;
    }
    return null;
  }
  if (!groups.length) return 'Add at least one choice group (for example "Main", "Drink")';
  const names = new Set<string>();
  for (const g of groups) {
    const name = g.name.trim();
    if (!name) return 'Every group needs a name';
    if (names.has(name.toLowerCase())) return `"${name}" is listed twice`;
    names.add(name.toLowerCase());
    if (!g.choices.length) return `Add the choices for "${name}"`;
    if (g.min_choices < 0 || g.max_choices < 1 || g.min_choices > g.max_choices) return `In "${name}" the minimum must not be above the maximum`;
    if (g.max_choices > g.choices.length) return `"${name}" allows ${g.max_choices} choices but has ${g.choices.length}`;
    if (new Set(g.choices.map((c) => c.component_id)).size !== g.choices.length) return `A product is listed twice in "${name}"`;
    if (g.choices.some((c) => c.component_id === productId)) return 'A combo cannot offer itself';
    if (g.choices.filter((c) => c.is_default).length > g.max_choices) return `"${name}" has more default choices than it allows`;
  }
  return null;
}

/** Components' total price and cost for a kit draft, rounded to cents. */
export function kitTotals(components: KitComponent[]): { price: number; cost: number } {
  const sum = (f: 'sales_price' | 'cost_price') =>
    Math.round(components.reduce((t, c) => t + (Number(c[f]) || 0) * (Number(c.quantity) || 0), 0) * 100) / 100;
  return { price: sum('sales_price'), cost: sum('cost_price') };
}

export function useComposition(productId: string) {
  return useQuery({ queryKey: ['product-composition', productId], queryFn: () => api.get<CompositionData>(`/products/${productId}/composition`) });
}

export function useSaveComposition(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { composition: Composition; components: KitComponent[]; groups: ComboGroup[] }) =>
      api.put<CompositionData>(`/products/${productId}/composition`, {
        composition: input.composition,
        components: input.composition === 'kit' ? input.components.map((c) => ({ component_id: c.component_id, quantity: Number(c.quantity) })) : [],
        groups: input.composition === 'combo'
          ? input.groups.map((g) => ({
              name: g.name.trim(), min_choices: Number(g.min_choices), max_choices: Number(g.max_choices),
              choices: g.choices.map((c) => ({
                component_id: c.component_id, quantity: Number(c.quantity ?? 1) || 1, extra_price: Number(c.extra_price ?? 0) || 0, is_default: !!c.is_default,
              })),
            }))
          : [],
      }),
    onSuccess: (data) => {
      qc.setQueryData(['product-composition', productId], data);
      qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

// ── Customers on a price list ─────────────────────────────────────────────────────────
export interface PriceListCustomer {
  id: string;
  code: string | null;
  name: string;
  contact_type: 'company' | 'person';
  phone: string | null;
  email: string | null;
  city: string | null;
  added_at: string;
}

export function usePriceListCustomers(listId: string) {
  return useQuery({ queryKey: ['price-list-customers', listId], queryFn: () => api.get<PriceListCustomer[]>(`/price-lists/${listId}/customers`) });
}

export function useSetPriceListCustomers(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.put<PriceListCustomer[]>(`/price-lists/${listId}/customers`, { contact_ids: ids }),
    onSuccess: (data) => {
      qc.setQueryData(['price-list-customers', listId], data);
      // A customer may have moved from another list.
      qc.invalidateQueries({ queryKey: ['price-list-customers'] });
      qc.invalidateQueries({ queryKey: ['product-reports'] });
    },
  });
}
