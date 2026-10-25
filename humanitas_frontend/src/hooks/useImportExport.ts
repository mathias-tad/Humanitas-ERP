import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';

export type EntityType =
  | 'employees'
  | 'attendance'
  | 'leave_balances'
  | 'payroll_adjustments'
  | 'assets'
  | 'training_records';

export type JobStatus =
  | 'pending'
  | 'validating'
  | 'validated'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type ImportMode = 'create_only' | 'upsert';

export interface ValidationErrorItem {
  row_index: number;
  field: string;
  error: string;
  raw_value: any;
}

export interface ImportValidationResult {
  job_id: string;
  entity_type: EntityType;
  mode: ImportMode;
  total_rows: number;
  valid_rows_count: number;
  error_rows_count: number;
  is_valid: boolean;
  validation_errors: ValidationErrorItem[];
  preview_rows: Record<string, any>[];
}

export interface ImportExportJob {
  id: string;
  company_id?: string;
  branch_id?: string;
  job_type: 'import' | 'export';
  entity_type: EntityType;
  format: 'csv' | 'xlsx' | 'pdf';
  status: JobStatus;
  file_name?: string;
  total_rows: number;
  processed_rows: number;
  error_rows: number;
  validation_errors: ValidationErrorItem[];
  rollback_window_expires_at?: string;
  can_rollback: boolean;
  is_rollback_active?: boolean;
  created_by?: string;
  created_at: string;
}

export interface TemplateSchema {
  entity: string;
  headers: string[];
  required: string[];
  descriptions: Record<string, string>;
  example: Record<string, any>;
}

export interface ExportTemplate {
  id: string;
  name: string;
  entity_type: EntityType;
  selected_fields: string[];
  filter_config?: Record<string, any>;
  schedule_cron?: string;
  delivery_email?: string;
  is_active: boolean;
  created_at: string;
}

export interface ImportExportStats {
  total_imports: number;
  total_exports: number;
  total_rows_processed: number;
  success_rate_pct: number;
  active_schedules: number;
}

const API_BASE = '/api/hrms/import-export';

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to fetch data');
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export function useImportExportStats() {
  return useQuery<ImportExportStats>({
    queryKey: ['import-export-stats'],
    queryFn: () => fetcher<ImportExportStats>(`${API_BASE}/stats`),
  });
}

export function useImportExportJobs(limit = 50) {
  return useQuery<ImportExportJob[]>({
    queryKey: ['import-export-jobs', limit],
    queryFn: () => fetcher<ImportExportJob[]>(`${API_BASE}/jobs?limit=${limit}`),
  });
}

export function useTemplateSchema(entityType: EntityType) {
  return useQuery<TemplateSchema>({
    queryKey: ['import-template-schema', entityType],
    queryFn: () => fetcher<TemplateSchema>(`${API_BASE}/template/${entityType}`),
    enabled: Boolean(entityType),
  });
}

export function useExportTemplates() {
  return useQuery<ExportTemplate[]>({
    queryKey: ['export-templates'],
    queryFn: () => fetcher<ExportTemplate[]>(`${API_BASE}/export-templates`),
  });
}

export function useValidateImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      entity_type: EntityType;
      mode?: ImportMode;
      rows: Record<string, any>[];
      file_name?: string;
    }): Promise<ImportValidationResult> => {
      const res = await fetch(`${API_BASE}/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Import validation failed');
      }
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-export-jobs'] });
    },
  });
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      job_id: string;
      entity_type: EntityType;
      mode?: ImportMode;
      validated_rows: Record<string, any>[];
    }) => {
      const res = await fetch(`${API_BASE}/commit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Import commit failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-export-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
    },
  });
}

export function useRollbackImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`${API_BASE}/rollback/${jobId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Rollback failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-export-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
    },
  });
}

export function useTriggerExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      entity_type: EntityType;
      format: 'csv' | 'xlsx' | 'pdf';
      selected_fields?: string[];
      filters?: Record<string, any>;
    }) => {
      const res = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Data export failed');
      }
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-export-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
    },
  });
}

export function useCreateExportTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      entity_type: EntityType;
      selected_fields: string[];
      filter_config?: Record<string, any>;
      schedule_cron?: string;
      delivery_email?: string;
    }) => {
      const res = await fetch(`${API_BASE}/export-templates`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save export recipe');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-templates'] });
      queryClient.invalidateQueries({ queryKey: ['import-export-stats'] });
    },
  });
}

export function useUpdateExportTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; is_active?: boolean; name?: string }) => {
      const res = await fetch(`${API_BASE}/export-templates/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-templates'] });
    },
  });
}
