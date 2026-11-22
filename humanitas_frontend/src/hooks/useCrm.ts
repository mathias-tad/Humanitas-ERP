import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';
import { useInfiniteList } from '@/components/platform/InfiniteList';
import { scopeKey, toQueryString } from '@/hooks/useProducts';

// ── Types (mirror the tenant API, featureslist §4.1) ───────────────────────────────────
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type DealStatus = 'open' | 'won' | 'lost';
export type ActivityType = 'call' | 'meeting' | 'email' | 'visit' | 'todo';
export type RelatedType = 'lead' | 'opportunity' | 'contact';

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted', lost: 'Lost',
};
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = { call: 'Call', meeting: 'Meeting', email: 'Email', visit: 'Visit', todo: 'To-do' };

export interface Lead {
  id: string;
  code: string;
  title: string;
  person_name: string | null;
  company_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  city: string | null;
  source_id: string | null;
  source_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  status: LeadStatus;
  status_changed_at: string;
  need: string | null;
  budget: string | null;
  timeline: string | null;
  decision_maker: string | null;
  expected_revenue: string | null;
  lost_reason_id: string | null;
  lost_reason_name: string | null;
  lost_note: string | null;
  converted_contact_id: string | null;
  converted_contact_name: string | null;
  converted_opportunity_id: string | null;
  converted_opportunity_name: string | null;
  tags: string[];
  notes: string | null;
  company_id: string | null;
  branch_id?: string | null;
  is_active: boolean;
  next_activity_at: string | null;
  last_contact_at: string | null;
  last_contact_channel: string | null;
  contact_count: number;
  created_at: string;
}

export interface Deal {
  id: string;
  code: string;
  name: string;
  contact_id: string | null;
  contact_name: string | null;
  person_id: string | null;
  person_name: string | null;
  pipeline_id: string;
  pipeline_name: string;
  stage_id: string;
  stage_name: string;
  stage_probability: number;
  stage_is_won: boolean;
  stage_is_lost: boolean;
  rotting_days: number | null;
  owner_id: string | null;
  owner_name: string | null;
  expected_revenue: string;
  currency: string;
  probability: number | null;
  effective_probability: number;
  weighted_revenue: number;
  expected_close_date: string | null;
  status: DealStatus;
  closed_at: string | null;
  lost_reason_id: string | null;
  lost_reason_name: string | null;
  lost_note: string | null;
  lead_id: string | null;
  lead_code: string | null;
  lead_title: string | null;
  source_id: string | null;
  source_name: string | null;
  tags: string[];
  notes: string | null;
  company_id: string | null;
  branch_id?: string | null;
  is_active: boolean;
  days_in_stage: number;
  is_stuck: boolean;
  next_activity_at: string | null;
  last_contact_at: string | null;
  last_contact_channel: string | null;
  contact_count: number;
  created_at: string;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  probability: number;
  rotting_days: number | null;
  is_won: boolean;
  is_lost: boolean;
  sort_order: number;
  is_active: boolean;
  open_count?: number;
}

export interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
  company_id: string | null;
  branch_id?: string | null;
  is_active: boolean;
  stages: Stage[];
}

export interface BoardStage extends Stage {
  count: number;
  revenue: number;
  weighted: number;
  deals: Deal[];
}

export interface Board {
  pipeline: Pipeline;
  stages: BoardStage[];
}

export interface Activity {
  id: string;
  activity_type: ActivityType;
  subject: string;
  notes: string | null;
  due_at: string;
  duration_minutes: number | null;
  assigned_to: string;
  assigned_to_name: string | null;
  related_type: RelatedType | null;
  related_id: string | null;
  related_name: string | null;
  done_at: string | null;
  outcome: string | null;
  is_active: boolean;
}

export interface ListItem {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Forecast {
  months: { month: string; count: number; revenue: number; weighted: number }[];
  open_count: number;
  open_revenue: number;
  open_weighted: number;
  overdue_count: number;
  stuck_count: number;
  won_this_month: { count: number; revenue: number };
}

interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export type LeadCounts = Partial<Record<LeadStatus, number>>;

// ── Pure helpers ──────────────────────────────────────────────────────────────────────
const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatMoney = (v: number | string | null | undefined) => money.format(Number(v ?? 0) || 0);

/** "Nov 2026"; "No close date" for the bucket without one. */
export function monthLabel(month: string): string {
  if (month === 'none') return 'No close date';
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Whether an open deal is past its expected close date (dates are YYYY-MM-DD). */
export function isOverdue(d: Pick<Deal, 'status' | 'expected_close_date'>, today = new Date().toISOString().slice(0, 10)): boolean {
  return d.status === 'open' && !!d.expected_close_date && String(d.expected_close_date).slice(0, 10) < today;
}

export type DealHealth = 'won' | 'lost' | 'late' | 'attention' | 'on_track';

/**
 * A deal card's colour: won, lost, late (a step past due or past the close date), needs attention
 * (no next step planned, or stuck in its stage too long) or on track.
 */
export function dealHealth(
  d: Pick<Deal, 'status' | 'expected_close_date' | 'next_activity_at' | 'is_stuck'>,
  now = new Date(),
): DealHealth {
  if (d.status === 'won') return 'won';
  if (d.status === 'lost') return 'lost';
  if ((d.next_activity_at && new Date(d.next_activity_at) < now) || isOverdue(d, now.toISOString().slice(0, 10))) return 'late';
  if (!d.next_activity_at || d.is_stuck) return 'attention';
  return 'on_track';
}

export const DEAL_HEALTH: Record<DealHealth, { label: string; card: string; dot: string }> = {
  on_track: { label: 'On track', card: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  attention: { label: 'Needs a next step', card: 'border-l-amber-500', dot: 'bg-amber-500' },
  late: { label: 'Late', card: 'border-l-red-500', dot: 'bg-red-500' },
  won: { label: 'Won', card: 'border-l-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', dot: 'bg-emerald-600' },
  lost: { label: 'Lost', card: 'border-l-slate-400 bg-muted opacity-80', dot: 'bg-slate-400' },
};

/** Where an activity falls for the person looking at it. */
export function activityState(a: Pick<Activity, 'due_at' | 'done_at'>, now = new Date()): 'done' | 'overdue' | 'today' | 'upcoming' {
  if (a.done_at) return 'done';
  const due = new Date(a.due_at);
  const sameDay = due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate();
  if (sameDay) return due < now ? 'overdue' : 'today';
  return due < now ? 'overdue' : 'upcoming';
}

/** Lead status moves a person can make by hand (converted and lost have their own actions). */
export const MANUAL_LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified'];

/** "Sara · Abebe Trading" for a lead's who. */
export function leadWho(l: Pick<Lead, 'person_name' | 'company_name'>): string {
  return [l.person_name, l.company_name].filter(Boolean).join(' · ') || '—';
}

/** A local date-time input value (YYYY-MM-DDTHH:mm) for a Date. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The browser's time zone for "today" and "overdue" (Africa/Addis_Ababa when unknown). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Addis_Ababa';
  } catch {
    return 'Africa/Addis_Ababa';
  }
}

// ── Leads ─────────────────────────────────────────────────────────────────────────────
export interface LeadFilters {
  q?: string;
  status?: LeadStatus | 'open';
  owner_id?: string;
  source_id?: string;
  archived?: 'active' | 'archived';
}

export function useInfiniteLeads(filters: LeadFilters) {
  return useInfiniteList<Lead>(['crm', 'leads', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<Lead>>(`/crm/leads${toQueryString({ ...filters, page, limit })}`),
  );
}

/** Counts per status for the tabs (same filters, any status). */
export function useLeadCounts(filters: Omit<LeadFilters, 'status'>) {
  return useQuery({
    queryKey: ['crm', 'lead-counts', ...scopeKey(), filters],
    queryFn: () => api.get<Paged<Lead> & { counts: LeadCounts }>(`/crm/leads${toQueryString({ ...filters, limit: 1 })}`).then((r) => r.counts ?? {}),
  });
}

export function searchLeads(q: string) {
  return api.get<Paged<Lead>>(`/crm/leads${toQueryString({ q, status: 'open', limit: 20 })}`).then((r) => r.data);
}

export function useLead(id: string | undefined) {
  return useQuery({ queryKey: ['crm', 'lead', id], queryFn: () => api.get<Lead>(`/crm/leads/${id}`), enabled: !!id });
}

function useCrmInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['crm'] });
    qc.invalidateQueries({ queryKey: ['timeline'] });
  };
}

export type LeadInput = Partial<Omit<Lead, 'budget' | 'expected_revenue'>> & { budget?: number | null; expected_revenue?: number | null };

export function useSaveLead() {
  const invalidate = useCrmInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: LeadInput }) =>
      id ? api.patch<Lead>(`/crm/leads/${id}`, input) : api.post<Lead>('/crm/leads', input),
    onSuccess: invalidate,
  });
}

export function useLeadAction() {
  const invalidate = useCrmInvalidate();
  return useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: 'lose' | 'convert' | 'restore' | 'archive'; body?: unknown }) =>
      action === 'archive' ? api.delete<Lead>(`/crm/leads/${id}`) : api.post<Lead>(`/crm/leads/${id}/${action}`, body ?? {}),
    onSuccess: invalidate,
  });
}

// ── Opportunities ─────────────────────────────────────────────────────────────────────
export interface DealFilters {
  q?: string;
  pipeline_id?: string;
  status?: DealStatus;
  owner_id?: string;
  contact_id?: string;
  attention?: 'overdue' | 'no_activity' | 'stuck';
  archived?: 'active' | 'archived';
}

export function useBoard(f: { pipeline_id?: string; owner_id?: string; q?: string }) {
  return useQuery({
    queryKey: ['crm', 'board', ...scopeKey(), f],
    queryFn: () => api.get<Board>(`/crm/opportunities/board${toQueryString(f)}`),
    placeholderData: (prev) => prev,
  });
}

export function useInfiniteDeals(filters: DealFilters) {
  return useInfiniteList<Deal>(['crm', 'deals', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<Deal>>(`/crm/opportunities${toQueryString({ ...filters, page, limit })}`),
  );
}

export function searchDeals(q: string) {
  return api.get<Paged<Deal>>(`/crm/opportunities${toQueryString({ q, status: 'open', limit: 20 })}`).then((r) => r.data);
}

export function useDeal(id: string | undefined) {
  return useQuery({ queryKey: ['crm', 'deal', id], queryFn: () => api.get<Deal>(`/crm/opportunities/${id}`), enabled: !!id });
}

export function useForecast(f: { pipeline_id?: string; owner_id?: string }) {
  return useQuery({ queryKey: ['crm', 'forecast', ...scopeKey(), f], queryFn: () => api.get<Forecast>(`/crm/opportunities/forecast${toQueryString(f)}`) });
}

export type DealInput = Partial<Omit<Deal, 'expected_revenue'>> & { expected_revenue?: number };

export function useSaveDeal() {
  const invalidate = useCrmInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DealInput }) =>
      id ? api.patch<Deal>(`/crm/opportunities/${id}`, input) : api.post<Deal>('/crm/opportunities', input),
    onSuccess: invalidate,
  });
}

export function useDealAction() {
  const invalidate = useCrmInvalidate();
  return useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: 'stage' | 'won' | 'lose' | 'reopen' | 'restore' | 'archive'; body?: unknown }) =>
      action === 'archive' ? api.delete<Deal>(`/crm/opportunities/${id}`) : api.post<Deal>(`/crm/opportunities/${id}/${action}`, body ?? {}),
    onSuccess: invalidate,
  });
}

// ── Activities ────────────────────────────────────────────────────────────────────────
export interface ActivityFilters {
  assigned_to?: string;
  when?: 'overdue' | 'today' | 'upcoming' | 'open' | 'done';
  related_type?: RelatedType;
  related_id?: string;
}

export function useInfiniteActivities(filters: ActivityFilters) {
  const tz = browserTimeZone();
  return useInfiniteList<Activity>(['crm', 'activities', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<Activity>>(`/crm/activities${toQueryString({ ...filters, tz, page, limit })}`),
  );
}

export function useActivitySummary() {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['crm', 'activity-summary', ...scopeKey()],
    queryFn: () => api.get<{ overdue: number; today: number; upcoming: number }>(`/crm/activities/summary${toQueryString({ tz })}`),
  });
}

export interface ActivityInput {
  activity_type: ActivityType;
  subject: string;
  notes?: string | null;
  due_at: string;
  duration_minutes?: number | null;
  assigned_to?: string;
  related_type?: RelatedType | null;
  related_id?: string | null;
}

export function useSaveActivity() {
  const invalidate = useCrmInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<ActivityInput> }) =>
      id ? api.patch<Activity>(`/crm/activities/${id}`, input) : api.post<Activity>('/crm/activities', input),
    onSuccess: invalidate,
  });
}

export function useCompleteActivity() {
  const invalidate = useCrmInvalidate();
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome?: string }) => api.post<Activity>(`/crm/activities/${id}/done`, { outcome: outcome?.trim() || null }),
    onSuccess: invalidate,
  });
}

export function useRemoveActivity() {
  const invalidate = useCrmInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete(`/crm/activities/${id}`), onSuccess: invalidate });
}

// ── Set-up ────────────────────────────────────────────────────────────────────────────
export function usePipelines(includeArchived = false) {
  return useQuery({
    queryKey: ['crm', 'pipelines', ...scopeKey(), includeArchived],
    queryFn: () => api.get<Pipeline[]>(`/crm/setup/pipelines${includeArchived ? '?include_archived=true' : ''}`),
    staleTime: 60 * 1000,
  });
}

export function useCrmList(kind: 'sources' | 'lost-reasons', includeArchived = false) {
  return useQuery({
    queryKey: ['crm', kind, includeArchived],
    queryFn: () => api.get<ListItem[]>(`/crm/setup/${kind}${includeArchived ? '?include_archived=true' : ''}`),
    staleTime: 60 * 1000,
  });
}

export function useSetupAction() {
  const invalidate = useCrmInvalidate();
  return useMutation({
    mutationFn: ({ method, path, body }: { method: 'post' | 'patch' | 'delete'; path: string; body?: unknown }) =>
      method === 'delete' ? api.delete(`/crm/setup/${path}`) : api[method](`/crm/setup/${path}`, body ?? {}),
    onSuccess: invalidate,
  });
}

// ── CSV exports ───────────────────────────────────────────────────────────────────────
export async function downloadCrmCsv(kind: 'leads' | 'opportunities', filters: Record<string, string | undefined>) {
  const res = await fetch(`${API_BASE_URL}/crm/${kind}/export.csv${toQueryString(filters)}`, { headers: getAuthHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
