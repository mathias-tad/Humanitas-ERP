import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';
import { scopeKey, toQueryString, searchProducts, type Paged, type Product } from '@/hooks/useProducts';
import { useInfiniteList } from '@/components/platform/InfiniteList';

// ── Types (mirror the tenant API, featureslist §2) ───────────────────────────────────
export type LocationUsage = 'internal' | 'view' | 'supplier' | 'customer' | 'inventory' | 'transit' | 'production' | 'scrap';

export const LOCATION_USAGE_LABELS: Record<LocationUsage, string> = {
  internal: 'Internal', view: 'View', supplier: 'Supplier', customer: 'Customer',
  inventory: 'Inventory', transit: 'Transit', production: 'Production', scrap: 'Scrap',
};

export type TransferType = 'receipt' | 'delivery' | 'internal' | 'return_in' | 'return_out';
export const TRANSFER_TYPES: TransferType[] = ['receipt', 'delivery', 'internal', 'return_in', 'return_out'];
export const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  receipt: 'Receipt', delivery: 'Delivery', internal: 'Internal move', return_in: 'Return in', return_out: 'Return out',
};

export type TransferState = 'draft' | 'waiting' | 'ready' | 'in_progress' | 'done' | 'cancelled';
export const TRANSFER_STATES: TransferState[] = ['draft', 'waiting', 'ready', 'in_progress', 'done', 'cancelled'];
export const TRANSFER_STATE_LABELS: Record<TransferState, string> = {
  draft: 'Draft', waiting: 'Waiting', ready: 'Ready', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled',
};

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  manager_name: string | null;
  location_count: number;
  product_count: number;
  is_active: boolean;
  archived_at: string | null;
  company_id: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseInput {
  code?: string;
  name?: string;
  short_name?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  create_default_locations?: boolean;
  is_active?: boolean;
  company_id?: string | null;
  branch_id?: string | null;
}

export interface WarehouseFilters {
  search?: string;
  include_archived?: boolean;
  page?: number;
  limit?: number;
}

/** A storage location; the tree view adds `children` (GET /inventory/locations/tree). */
export interface LocationRow {
  id: string;
  warehouse_id: string | null;
  parent_id: string | null;
  code: string;
  name: string;
  usage: LocationUsage | string;
  barcode: string | null;
  removal_strategy: string;
  is_active: boolean;
  archived_at: string | null;
  warehouse_name?: string | null;
  parent_code?: string | null;
  product_count?: number;
  company_id?: string | null;
  branch_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type LocationTreeNode = LocationRow & { children?: LocationTreeNode[] };

export interface LocationInput {
  warehouse_id?: string | null;
  parent_id?: string | null;
  code?: string;
  name?: string;
  usage?: LocationUsage;
  barcode?: string | null;
  removal_strategy?: 'fifo' | 'fefo' | 'lifo' | 'closest';
  company_id?: string | null;
  branch_id?: string | null;
}

export interface LocationFilters {
  warehouse_id?: string;
  usage?: LocationUsage;
  search?: string;
  include_archived?: boolean;
}

/** One row of the live stock view (inventory_stock_on_hand). */
export interface StockRow {
  id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  lot_id: string | null;
  lot_name: string | null;
  expiry_date: string | null;
  location_id: string;
  location_code: string;
  usage: string;
  warehouse_id: string | null;
  warehouse_name: string | null;
  quantity: string;
  reserved_quantity: string;
  free_quantity: string;
  /** Cost and value are absent without view_stock_valuation. */
  unit_cost?: string;
  stock_value?: string;
  company_id: string | null;
  branch_id: string | null;
}

export interface StockFilters {
  product_id?: string;
  warehouse_id?: string;
  location_id?: string;
  lot_id?: string;
  search?: string;
  in_stock_only?: boolean;
  below_reorder?: boolean;
  page?: number;
  limit?: number;
}

export interface StockSummaryRow {
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity: string;
  reserved_quantity: string;
  free_quantity: string;
  stock_value?: string;
}

export interface ProductStockConfig {
  tracking?: string;
  costing_method?: string;
  standard_cost?: string | number | null;
  reorder_point?: string | number | null;
  reorder_max?: string | number | null;
  shelf_life_days?: string | number | null;
  expiry_warn_days?: string | number | null;
  allow_negative?: boolean;
  [key: string]: unknown;
}

export interface ProductStockDetail {
  data: StockRow[];
  totals: { quantity: string | number; reserved: string | number; free: string | number; value?: string | number };
  config: ProductStockConfig | null;
}

export interface AdjustStockInput {
  product_id: string;
  lot_id?: string | null;
  location_id: string;
  quantity: number;
  unit_cost?: number;
  reason: string;
  notes?: string | null;
}

/** A row of the movement ledger (inventory_movement_history view). */
export interface StockMovement {
  id: string;
  reference: string | null;
  move_type: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  lot_id: string | null;
  lot_name: string | null;
  from_location_id: string | null;
  from_location_code: string | null;
  to_location_id: string | null;
  to_location_code: string | null;
  quantity: string;
  unit_cost?: string;
  total_cost?: string;
  state: string;
  source: string;
  reason?: string | null;
  done_at: string | null;
  company_id: string | null;
  branch_id: string | null;
}

export interface MovementFilters {
  product_id?: string;
  warehouse_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface TransferMoveInput {
  product_id: string;
  lot_id?: string | null;
  from_location_id?: string | null;
  to_location_id?: string | null;
  quantity: number;
  unit_cost?: number;
}

export interface TransferMoveRow {
  id: string;
  product_name: string;
  sku?: string | null;
  lot_name: string | null;
  from_location_code: string | null;
  to_location_code: string | null;
  quantity: string;
  /** Absent without view_stock_valuation. */
  unit_cost?: string;
  state: string;
}

export interface TransferRow {
  id: string;
  name: string;
  transfer_type: TransferType;
  state: TransferState;
  origin: string | null;
  partner_name: string | null;
  reason: string | null;
  notes: string | null;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  scheduled_date: string | null;
  move_count: number;
  company_id: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferDetail extends TransferRow {
  moves: TransferMoveRow[];
}

export interface TransferInput {
  transfer_type: TransferType;
  origin?: string | null;
  partner_name?: string | null;
  from_warehouse_id?: string | null;
  to_warehouse_id?: string | null;
  scheduled_date?: string | null;
  responsible_user_id?: string | null;
  reason?: string | null;
  notes?: string | null;
  moves?: TransferMoveInput[];
  company_id?: string | null;
  branch_id?: string | null;
}

export interface TransferUpdateInput {
  origin?: string | null;
  partner_name?: string | null;
  from_warehouse_id?: string | null;
  to_warehouse_id?: string | null;
  scheduled_date?: string | null;
  responsible_user_id?: string | null;
  reason?: string | null;
  notes?: string | null;
}

export interface TransferFilters {
  transfer_type?: TransferType;
  state?: TransferState;
  warehouse_id?: string;
  product_id?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** The filters every transfer endpoint accepts, minus the paging the list view carries. */
export type TransferQuery = Omit<TransferFilters, 'page' | 'limit'>;

// ── Helpers ───────────────────────────────────────────────────────────────────────────
/** The query params a stock endpoint takes (the paged list keys stay out). */
export function stockFiltersToQuery(f: StockFilters): Omit<StockFilters, 'page' | 'limit'> {
  const { page: _page, limit: _limit, ...rest } = f;
  return rest;
}

export function transferFiltersToQuery(f: TransferFilters): TransferQuery {
  const { page: _page, limit: _limit, ...rest } = f;
  return rest;
}

export const inventoryKeys = {
  all: ['inventory'] as const,
  warehouses: (f: WarehouseFilters) => ['inventory', 'warehouses', ...scopeKey(), f] as const,
  warehouse: (id: string) => ['inventory', 'warehouse', ...scopeKey(), id] as const,
  locations: (f: LocationFilters) => ['inventory', 'locations', ...scopeKey(), f] as const,
  locationTree: (warehouseId?: string) => ['inventory', 'location-tree', ...scopeKey(), warehouseId ?? 'all'] as const,
  location: (id: string) => ['inventory', 'location', ...scopeKey(), id] as const,
  stock: (f: StockFilters) => ['inventory', 'stock', ...scopeKey(), f] as const,
  stockSummary: (f: Pick<StockFilters, 'search' | 'warehouse_id'>) => ['inventory', 'stock-summary', ...scopeKey(), f] as const,
  stockForProduct: (productId: string) => ['inventory', 'stock-product', ...scopeKey(), productId] as const,
  movements: (f: MovementFilters) => ['inventory', 'movements', ...scopeKey(), f] as const,
  transfers: (f: TransferFilters) => ['inventory', 'transfers', ...scopeKey(), f] as const,
  transfer: (id: string) => ['inventory', 'transfer', ...scopeKey(), id] as const,
};

// ── Warehouses ────────────────────────────────────────────────────────────────────────
export function useWarehouses(filters: WarehouseFilters = {}) {
  return useQuery({
    queryKey: inventoryKeys.warehouses(filters),
    queryFn: () => api.get<Paged<Warehouse>>(`/inventory/warehouses${toQueryString({ ...filters })}`),
    placeholderData: (prev) => prev,
  });
}

/** Warehouse pickers (stock filters, transfers, forms) load as you scroll. */
export function useInfiniteInventoryWarehouses(filters: Omit<WarehouseFilters, 'page' | 'limit'> = {}) {
  return useInfiniteList<Warehouse>(['inventory', 'warehouses', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<Warehouse>>(`/inventory/warehouses${toQueryString({ ...filters, page, limit })}`),
  );
}

export function useWarehouse(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.warehouse(id ?? ''),
    queryFn: () => api.get<Warehouse>(`/inventory/warehouses/${id}`),
    enabled: !!id,
  });
}

// ── Locations ─────────────────────────────────────────────────────────────────────────
export function useLocations(filters: LocationFilters = {}) {
  return useQuery({
    queryKey: inventoryKeys.locations(filters),
    queryFn: async () => (await api.get<{ data: LocationRow[] }>(`/inventory/locations${toQueryString({ ...filters })}`)).data,
    placeholderData: (prev) => prev,
  });
}

export function useLocation(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.location(id ?? ''),
    queryFn: () => api.get<LocationRow>(`/inventory/locations/${id}`),
    enabled: !!id,
  });
}

/** The Warehouse → Zone → Aisle → Bin tree, with `children` on every node. */
export function useLocationsTree(warehouseId?: string) {
  return useQuery({
    queryKey: inventoryKeys.locationTree(warehouseId),
    queryFn: async () => (await api.get<{ data: LocationTreeNode[] }>(`/inventory/locations/tree${toQueryString({ warehouse_id: warehouseId })}`)).data,
  });
}

/** Plain location rows for pickers (the transfer move lines, the adjustment form). */
export function locationOptions(warehouseId?: string | null): Promise<LocationRow[]> {
  return api
    .get<{ data: LocationRow[] }>(`/inventory/locations${toQueryString({ warehouse_id: warehouseId ?? undefined })}`)
    .then((r) => r.data);
}

// ── Stock ─────────────────────────────────────────────────────────────────────────────
export function useInfiniteInventoryStock(filters: Omit<StockFilters, 'page' | 'limit'> = {}) {
  return useInfiniteList<StockRow>(['inventory', 'stock', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<StockRow>>(`/inventory/stock${toQueryString({ ...filters, page, limit })}`),
  );
}

/** Per-product totals; the value column needs the valuation permission (AGENTS.md rule 27). */
export function useStockSummary(filters: Pick<StockFilters, 'search' | 'warehouse_id'> = {}) {
  return useQuery({
    queryKey: inventoryKeys.stockSummary(filters),
    queryFn: async () => (await api.get<{ data: StockSummaryRow[] }>(`/inventory/stock/summary${toQueryString(filters)}`)).data,
  });
}

export function useStockForProduct(productId: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.stockForProduct(productId ?? ''),
    queryFn: () => api.get<ProductStockDetail>(`/inventory/stock/product/${productId}`),
    enabled: !!productId,
  });
}

/** The paged movement ledger (AGENTS.md rule 24 item 21). */
export function useInfiniteStockMovements(filters: Omit<MovementFilters, 'page' | 'limit'> = {}) {
  return useInfiniteList<StockMovement>(['inventory', 'movements', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<StockMovement>>(`/inventory/stock/movements${toQueryString({ ...filters, page, limit })}`),
  );
}

// ── Transfers ─────────────────────────────────────────────────────────────────────────
export function useInfiniteInventoryTransfers(filters: Omit<TransferFilters, 'page' | 'limit'> = {}) {
  return useInfiniteList<TransferRow>(['inventory', 'transfers', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<TransferRow>>(`/inventory/transfers${toQueryString({ ...filters, page, limit })}`),
  );
}

export function useTransfer(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.transfer(id ?? ''),
    queryFn: () => api.get<TransferDetail>(`/inventory/transfers/${id}`),
    enabled: !!id,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: inventoryKeys.all });
}

export function useCreateWarehouse() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: WarehouseInput) => api.post<Warehouse>('/inventory/warehouses', input), onSuccess: invalidate });
}

export function useUpdateWarehouse() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WarehouseInput }) => api.patch<Warehouse>(`/inventory/warehouses/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useArchiveWarehouse() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete<Warehouse>(`/inventory/warehouses/${id}`), onSuccess: invalidate });
}

export function useRestoreWarehouse() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.post<Warehouse>(`/inventory/warehouses/${id}/restore`), onSuccess: invalidate });
}

export function useCreateLocation() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: LocationInput) => api.post<LocationRow>('/inventory/locations', input), onSuccess: invalidate });
}

export function useUpdateLocation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LocationInput }) => api.patch<LocationRow>(`/inventory/locations/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useArchiveLocation() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete<LocationRow>(`/inventory/locations/${id}`), onSuccess: invalidate });
}

/** A manual +in / −out stock adjustment (POST /inventory/stock/adjust). */
export function useAdjustStock() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: AdjustStockInput) => api.post<ProductStockDetail>('/inventory/stock/adjust', input),
    onSuccess: invalidate,
  });
}

export function useCreateTransfer() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: TransferInput) => api.post<TransferRow>('/inventory/transfers', input), onSuccess: invalidate });
}

export function useUpdateTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransferUpdateInput }) =>
      api.patch<TransferRow>(`/inventory/transfers/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useAddTransferMove() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, move }: { id: string; move: TransferMoveInput }) =>
      api.post<TransferMoveRow>(`/inventory/transfers/${id}/moves`, move),
    onSuccess: invalidate,
  });
}

export function useValidateTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<TransferDetail>(`/inventory/transfers/${id}/validate`),
    onSuccess: invalidate,
  });
}

export function useStartTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<TransferDetail>(`/inventory/transfers/${id}/start`),
    onSuccess: invalidate,
  });
}

export function useCancelTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<TransferDetail>(`/inventory/transfers/${id}/cancel`),
    onSuccess: invalidate,
  });
}

export function useDeleteTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete<TransferRow>(`/inventory/transfers/${id}`),
    onSuccess: invalidate,
  });
}

/** Find a transfer by the scanned/typed code (its number, partner or origin reference). */
export async function lookupTransfer(code: string): Promise<TransferRow | null> {
  const term = code.trim();
  if (!term) return null;
  const { data } = await api.get<Paged<TransferRow>>(`/inventory/transfers${toQueryString({ search: term, limit: 10 })}`);
  return data.find((t) => t.name.toLowerCase() === term.toLowerCase()) ?? (data.length === 1 ? data[0] : null);
}

/** Sellable products for pickers (AGENTS.md rule 20): plain products and variants. */
export function searchInventoryProducts(q: string): Promise<Product[]> {
  return searchProducts(q);
}

// ── CSV exports ───────────────────────────────────────────────────────────────────────
/** Download the stock CSV with the same headers as every API call. */
export async function downloadStockCsv(filters: StockFilters = {}): Promise<void> {
  const { page: _p, limit: _l, ...rest } = filters;
  const res = await fetch(`${API_BASE_URL}/inventory/stock/export.csv${toQueryString(rest)}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download the transfers CSV with the same headers as every API call. */
export async function downloadTransfersCsv(filters: TransferFilters = {}): Promise<void> {
  const { page: _p, limit: _l, ...rest } = filters;
  const res = await fetch(`${API_BASE_URL}/inventory/transfers/export.csv${toQueryString(rest)}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transfers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
