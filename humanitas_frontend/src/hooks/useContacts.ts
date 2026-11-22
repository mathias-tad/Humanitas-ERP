import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';
import { useInfiniteList } from '@/components/platform/InfiniteList';
import { scopeKey, toQueryString, type Paged } from '@/hooks/useProducts';

/** Contacts: companies and people for every module (featureslist §4.1, CRM 1.3); mirrors the tenant API. */
export type ContactType = 'company' | 'person';
export type ContactRole = 'customer' | 'vendor';
export type InteractionKind = 'note' | 'call' | 'meeting' | 'email' | 'visit';

export interface Contact {
  id: string;
  code: string;
  contact_type: ContactType;
  parent_id: string | null;
  parent_name: string | null;
  is_primary_contact: boolean;
  job_title: string | null;
  name: string;
  legal_name: string | null;
  tin: string | null;
  vat_number: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  country: string;
  region: string | null;
  city: string | null;
  subcity: string | null;
  woreda: string | null;
  street: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  tags: string[];
  is_customer: boolean;
  is_vendor: boolean;
  price_list_id: string | null;
  price_list_name: string | null;
  effective_price_list_id: string | null;
  credit_limit: string | null;
  payment_terms_days: number;
  account_manager_id: string | null;
  account_manager_name: string | null;
  notes: string | null;
  company_id: string | null;
  is_active: boolean;
  people_count: number;
  primary_contact: string | null;
  people?: Contact[];
  created_at: string;
  updated_at: string;
}

export interface PersonInput {
  name: string;
  job_title?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
}

export type ContactInput = Partial<Pick<Contact,
  'code' | 'contact_type' | 'parent_id' | 'is_primary_contact' | 'job_title' | 'name' | 'legal_name' | 'tin' | 'vat_number' | 'phone' | 'mobile' |
  'email' | 'website' | 'region' | 'city' | 'subcity' | 'woreda' | 'street' | 'category_id' | 'tags' | 'is_customer' | 'is_vendor' |
  'price_list_id' | 'payment_terms_days' | 'account_manager_id' | 'notes' | 'company_id'>> & {
  credit_limit?: number | null;
  people?: PersonInput[];
  allow_duplicate?: boolean;
};

export interface ContactCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  price_list_id: string | null;
  price_list_name: string | null;
  company_id: string | null;
  sort_order: number;
  is_active: boolean;
  contact_count: number;
}

export interface ContactFilters {
  q?: string;
  role?: ContactRole;
  contact_type?: ContactType;
  parent_id?: string;
  category_id?: string;
  status?: 'active' | 'archived' | 'all';
  sort?: 'name' | 'code' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}

export interface DuplicateContact {
  id: string;
  code: string;
  name: string;
  reason: string;
}

export const contactKeys = {
  all: ['contacts'] as const,
  detail: (id: string) => ['contacts', 'detail', ...scopeKey(), id] as const,
  categories: (archived: boolean) => ['contacts', 'categories', ...scopeKey(), archived] as const,
};

/** Ethiopian TIN: 10 digits (spaces and dashes are fine while typing). */
export function tinProblem(tin: string): string | null {
  const d = tin.replace(/[\s-]/g, '');
  if (!d) return null;
  return /^\d{10}$/.test(d) ? null : 'A TIN is 10 digits';
}

/** "Abebe Trading", or "Sara · Abebe Trading" for a person at a company. */
export function contactLabel(c: Pick<Contact, 'name' | 'parent_name'>): string {
  return c.parent_name ? `${c.name} · ${c.parent_name}` : c.name;
}

export function useInfiniteContacts(filters: ContactFilters) {
  return useInfiniteList<Contact>(['contacts', 'list', ...scopeKey(), filters], (page, limit) =>
    api.get<Paged<Contact>>(`/contacts${toQueryString({ ...filters, page, limit })}`),
  );
}

export function useContact(id: string | undefined) {
  return useQuery({ queryKey: contactKeys.detail(id ?? ''), queryFn: () => api.get<Contact>(`/contacts/${id}`), enabled: !!id });
}

export function searchContacts(q: string, extra: ContactFilters = {}) {
  return api.get<Paged<Contact>>(`/contacts${toQueryString({ q, limit: 20, ...extra })}`).then((r) => r.data);
}

export function findDuplicateContacts(input: { tin?: string; phone?: string; mobile?: string; email?: string; exclude_id?: string }) {
  return api.get<DuplicateContact[]>(`/contacts/duplicates${toQueryString(input)}`);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: contactKeys.all });
}

export function useSaveContact() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ContactInput }) =>
      id ? api.patch<Contact>(`/contacts/${id}`, input) : api.post<Contact>('/contacts', input),
    onSuccess: invalidate,
  });
}

export function useArchiveContact() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, restore }: { id: string; restore?: boolean }) =>
      restore ? api.post<Contact>(`/contacts/${id}/restore`) : api.delete<Contact>(`/contacts/${id}`),
    onSuccess: invalidate,
  });
}

export function useLogInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, input }: { contactId: string; input: { kind: InteractionKind; summary: string; direction?: 'inbound' | 'outbound'; person_id?: string } }) =>
      api.post(`/contacts/${contactId}/interactions`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline'] }),
  });
}

export function useContactCategories(includeArchived = false) {
  return useQuery({
    queryKey: contactKeys.categories(includeArchived),
    queryFn: () => api.get<ContactCategory[]>(`/contact-categories${includeArchived ? '?include_archived=true' : ''}`),
  });
}

export function useSaveContactCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<ContactCategory> }) =>
      id ? api.patch<ContactCategory>(`/contact-categories/${id}`, input) : api.post<ContactCategory>('/contact-categories', input),
    onSuccess: invalidate,
  });
}

export function useArchiveContactCategory() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete(`/contact-categories/${id}`), onSuccess: invalidate });
}

export async function downloadContactsCsv(filters: ContactFilters): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/contacts/export.csv${toQueryString({ ...filters })}`, { headers: getAuthHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filters.role === 'customer' ? 'customers' : filters.role === 'vendor' ? 'vendors' : 'contacts'}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
