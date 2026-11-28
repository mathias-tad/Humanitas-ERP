import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';
import { scopeKey, toQueryString, type Paged } from '@/hooks/useProducts';
import { useInfiniteList } from '@/components/platform/InfiniteList';

// ── Types (mirror /inventory/counts, featureslist §2) ───────────────────────────────────
export type CountState = 'draft' | 'counting' | 'review' | 'posted' | 'cancelled';
export type CountType = 'cycle' | 'full' | 'blind' | 'spot';

export const COUNT_STATE_LABELS: Record<CountState, string> = {
  draft: 'Planned', counting: 'Counting', review: 'In review', posted: 'Posted', cancelled: 'Cancelled',
};
export const COUNT_TYPE_LABELS: Record<CountType, string> = {
  cycle: 'Cycle count', full: 'Full count', blind: 'Blind count', spot: 'Spot check',
};

export interface CountTotals {
  lines: number;
  counted: number;
  uncounted: number;
  with_variance?: number;
  accuracy?: number | null;
  net_quantity?: number;
  variance_value_gain?: number;
  variance_value_loss?: number;
  variance_value?: number;
}

export interface Stocktake {
  id: string;
  name: string;
  count_type: CountType;
  state: CountState;
  warehouse_id: string;
  warehouse_name: string | null;
  location_id: string | null;
  location_code: string | null;
  category_id: string | null;
  category_name?: string | null;
  product_ids: string[];
  is_blind: boolean;
  scheduled_date: string | null;
  responsible_name: string | null;
  notes: string | null;
  started_at: string | null;
  submitted_at: string | null;
  posted_at: string | null;
  created_at: string;
  line_count?: number;
  counted_count?: number;
  expected_hidden?: boolean;
  totals?: CountTotals;
}

export interface CountLine {
  id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  lot_id: string | null;
  lot_name: string | null;
  expiry_date?: string | null;
  location_id: string;
  location_code: string | null;
  expected_qty?: string;
  counted_qty: string | null;
  variance?: number;
  variance_value?: number;
  unit_cost?: string;
  is_unexpected: boolean;
  counted_by_name?: string | null;
  counted_at: string | null;
  notes: string | null;
  adjustment_move_id: string | null;
}

export type LineFilter = 'all' | 'uncounted' | 'counted' | 'variance' | 'unexpected';

export interface StocktakeInput {
  warehouse_id: string;
  location_id?: string;
  count_type?: CountType;
  is_blind?: boolean;
  category_id?: string;
  scheduled_date?: string;
  notes?: string;
}

export type ScanResult =
  | { kind: 'location'; location: { id: string; code: string; name: string } }
  | { kind: 'line'; line: CountLine };

// ── Pure helpers (tested) ─────────────────────────────────────────────────────────────
/** "12 of 40 counted (30%)" */
export function countProgress(t: Pick<CountTotals, 'lines' | 'counted'> | undefined): { label: string; percent: number } {
  if (!t || !t.lines) return { label: 'Nothing to count yet', percent: 0 };
  const percent = Math.round((t.counted / t.lines) * 100);
  return { label: `${t.counted} of ${t.lines} counted (${percent}%)`, percent };
}

/** A counted line's difference as shown: "+2", "−3", "0", or "" when not counted / hidden. */
export function varianceLabel(line: Pick<CountLine, 'counted_qty' | 'variance'>): string {
  if (line.counted_qty == null || line.variance == null) return '';
  const v = Number(line.variance);
  if (v === 0) return '0';
  return v > 0 ? `+${trim(v)}` : `−${trim(-v)}`;
}

const trim = (n: number) => String(Math.round(n * 10_000) / 10_000);

/** What the next step of a count is called, for its main button. */
export function nextStep(state: CountState): 'start' | 'submit' | 'post' | null {
  if (state === 'draft') return 'start';
  if (state === 'counting') return 'submit';
  if (state === 'review') return 'post';
  return null;
}

// ── Queries ───────────────────────────────────────────────────────────────────────────
const keys = {
  all: ['inventory', 'counts'] as const,
  one: (id: string) => ['inventory', 'counts', 'one', ...scopeKey(), id] as const,
};

export function useInfiniteStocktakes(filters: { state?: CountState; search?: string; warehouse_id?: string }) {
  return useInfiniteList<Stocktake>(['inventory', 'counts', 'list', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<Stocktake>>(`/inventory/counts${toQueryString({ ...filters, page, limit })}`),
  );
}

export function useStocktake(id: string | undefined) {
  return useQuery({ queryKey: keys.one(id ?? ''), queryFn: () => api.get<Stocktake>(`/inventory/counts/${id}`), enabled: !!id });
}

export function useInfiniteCountLines(id: string | undefined, filters: { filter?: LineFilter; search?: string; location_id?: string }) {
  return useInfiniteList<CountLine>(['inventory', 'counts', 'lines', ...scopeKey(), id ?? '', filters], (page, limit) =>
    api.get<Paged<CountLine>>(`/inventory/counts/${id}/lines${toQueryString({ ...filters, filter: filters.filter === 'all' ? undefined : filters.filter, page, limit })}`),
  );
}

function useInvalidateCounts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.all });
    qc.invalidateQueries({ queryKey: ['inventory', 'stock'] });
    qc.invalidateQueries({ queryKey: ['inventory', 'movements'] });
  };
}

export function useCreateStocktake() {
  const invalidate = useInvalidateCounts();
  return useMutation({ mutationFn: (input: StocktakeInput) => api.post<Stocktake>('/inventory/counts', input), onSuccess: invalidate });
}

export function useStocktakeAction() {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start' | 'submit' | 'post' | 'cancel' }) => api.post<Stocktake>(`/inventory/counts/${id}/${action}`, {}),
    onSuccess: invalidate,
  });
}

export function useSetCountLine() {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: ({ id, lineId, counted_qty, notes }: { id: string; lineId: string; counted_qty?: number | null; notes?: string }) =>
      api.patch<CountLine>(`/inventory/counts/${id}/lines/${lineId}`, { ...(counted_qty !== undefined ? { counted_qty } : {}), ...(notes !== undefined ? { notes } : {}) }),
    onSuccess: invalidate,
  });
}

export function useAddCountLine() {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; product_id: string; location_id: string; lot_id?: string; counted_qty: number; add?: boolean }) =>
      api.post<CountLine>(`/inventory/counts/${id}/lines`, body),
    onSuccess: invalidate,
  });
}

export function useCountScan() {
  const invalidate = useInvalidateCounts();
  return useMutation({
    mutationFn: ({ id, code, location_id }: { id: string; code: string; location_id?: string }) =>
      api.post<ScanResult>(`/inventory/counts/${id}/scan`, { code, ...(location_id ? { location_id } : {}) }),
    onSuccess: invalidate,
  });
}

export async function downloadCountSheet(id: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/inventory/counts/${id}/sheet.csv`, { headers: getAuthHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^A-Za-z0-9-]+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
