import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';

export interface AssetCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
}

export interface CompanyAsset {
  id: string;
  company_id?: string;
  branch_id?: string;
  category_id: string;
  category_name?: string;
  category_code?: string;
  name: string;
  model?: string;
  serial_number?: string;
  asset_tag: string;
  qr_code_data?: string;
  status: 'available' | 'assigned' | 'maintenance' | 'repair' | 'retired' | 'lost';
  current_condition: 'new' | 'excellent' | 'good' | 'fair' | 'damaged' | 'missing';
  purchase_cost: number;
  purchase_date?: string;
  warranty_expiry?: string;
  location?: string;
  notes?: string;
  current_assigned_user_id?: string;
  first_name?: string;
  last_name?: string;
  assigned_user_email?: string;
  assigned_user_department?: string;
  assignment_id?: string;
  assigned_date?: string;
  expected_return_date?: string;
  acknowledged_at?: string;
  assignment_history?: AssetAssignment[];
  maintenance_logs?: AssetMaintenanceLog[];
  created_at: string;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  department?: string;
  assigned_by?: string;
  assigned_date: string;
  expected_return_date?: string;
  returned_date?: string;
  received_by?: string;
  return_condition?: string;
  is_active: boolean;
  acknowledged_at?: string;
  notes?: string;
  created_at: string;
}

export interface AssetMaintenanceLog {
  id: string;
  asset_id: string;
  asset_name?: string;
  asset_tag?: string;
  title: string;
  description?: string;
  cost: number;
  service_provider?: string;
  service_date: string;
  next_service_date?: string;
  status: string;
  logged_by?: string;
  created_at: string;
}

export interface AssetAnalytics {
  total_assets: number;
  available_count: number;
  assigned_count: number;
  maintenance_count: number;
  retired_count: number;
  total_valuation: number;
  category_breakdown: { category_name: string; asset_count: number; total_cost: number }[];
  condition_breakdown: { current_condition: string; count: number }[];
}

const API_BASE = '/api/hrms/assets';

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${res.status}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export function useAssetCategories() {
  return useQuery<AssetCategory[]>({
    queryKey: ['asset-categories'],
    queryFn: () => fetcher<AssetCategory[]>(`${API_BASE}/categories`),
  });
}

export function useAssets(filters?: { category_id?: string; status?: string; search?: string }) {
  const queryParams = new URLSearchParams();
  if (filters?.category_id && filters.category_id !== 'all') queryParams.set('category_id', filters.category_id);
  if (filters?.status && filters.status !== 'all') queryParams.set('status', filters.status);
  if (filters?.search) queryParams.set('search', filters.search);

  const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return useQuery<CompanyAsset[]>({
    queryKey: ['assets', filters?.category_id, filters?.status, filters?.search],
    queryFn: () => fetcher<CompanyAsset[]>(`${API_BASE}${queryStr}`),
  });
}

export function useAsset(id: string) {
  return useQuery<CompanyAsset>({
    queryKey: ['asset', id],
    queryFn: () => fetcher<CompanyAsset>(`${API_BASE}/${id}`),
    enabled: !!id,
  });
}

export function useMyAssets() {
  return useQuery<CompanyAsset[]>({
    queryKey: ['my-assets'],
    queryFn: () => fetcher<CompanyAsset[]>(`${API_BASE}/my-assets`),
  });
}

export function useAssetAnalytics() {
  return useQuery<AssetAnalytics>({
    queryKey: ['asset-analytics'],
    queryFn: () => fetcher<AssetAnalytics>(`${API_BASE}/analytics`),
  });
}

export function useAssetMaintenanceLogs(assetId?: string) {
  const url = assetId ? `${API_BASE}/maintenance?asset_id=${assetId}` : `${API_BASE}/maintenance`;
  return useQuery<AssetMaintenanceLog[]>({
    queryKey: ['asset-maintenance', assetId],
    queryFn: () => fetcher<AssetMaintenanceLog[]>(url),
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CompanyAsset>) => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create asset');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-analytics'] });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<CompanyAsset>) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update asset');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['asset-analytics'] });
    },
  });
}

export function useAssignAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetId, ...payload }: { assetId: string; user_id: string; expected_return_date?: string; notes?: string }) => {
      const res = await fetch(`${API_BASE}/${assetId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to assign asset');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', variables.assetId] });
      queryClient.invalidateQueries({ queryKey: ['my-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-analytics'] });
    },
  });
}

export function useReturnAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetId, ...payload }: { assetId: string; return_condition?: string; returned_date?: string; notes?: string }) => {
      const res = await fetch(`${API_BASE}/${assetId}/return`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to return asset');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', variables.assetId] });
      queryClient.invalidateQueries({ queryKey: ['my-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-analytics'] });
    },
  });
}

export function useAcknowledgeAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(`${API_BASE}/assignments/${assignmentId}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to acknowledge asset');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-assets'] });
    },
  });
}

export function useLogAssetMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetId, ...payload }: { assetId: string; title: string; cost?: number; service_provider?: string; service_date?: string; description?: string }) => {
      const res = await fetch(`${API_BASE}/${assetId}/maintenance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to log maintenance');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset', variables.assetId] });
      queryClient.invalidateQueries({ queryKey: ['asset-maintenance'] });
    },
  });
}

export function useCreateAssetCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; code?: string; description?: string }) => {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create asset category');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
    },
  });
}
