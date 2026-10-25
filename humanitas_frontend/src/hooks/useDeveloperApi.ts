import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  company_id?: string;
  branch_id?: string;
  rate_limit_rpm: number;
  last_used_at?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  raw_token?: string; // Only present on create response
}

export interface ApiKeyActivityLog {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  ip_address?: string;
  user_agent?: string;
  latency_ms?: number;
  created_at: string;
}

export interface WebhookSubscription {
  id: string;
  name: string;
  target_url: string;
  secret_key: string;
  events: string[];
  is_active: boolean;
  company_id?: string;
  branch_id?: string;
  failure_count: number;
  last_triggered_at?: string;
  created_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  webhook_name?: string;
  target_url?: string;
  event_type: string;
  payload: any;
  status_code?: number;
  response_body?: string;
  execution_time_ms?: number;
  attempts: number;
  error_message?: string;
  delivered_at: string;
}

export interface CreateApiKeyPayload {
  name: string;
  scopes?: string[];
  company_id?: string;
  branch_id?: string;
  rate_limit_rpm?: number;
  expires_at?: string;
}

export interface CreateWebhookPayload {
  name: string;
  target_url: string;
  secret_key?: string;
  events: string[];
  company_id?: string;
  branch_id?: string;
}

export interface UpdateWebhookPayload {
  name?: string;
  target_url?: string;
  events?: string[];
  is_active?: boolean;
}

export interface TestWebhookPayload {
  target_url: string;
  secret_key: string;
  event_type?: string;
}

export const AVAILABLE_WEBHOOK_EVENTS = [
  { event: 'employee.created', label: 'Employee Created', category: 'HRMS' },
  { event: 'employee.terminated', label: 'Employee Terminated', category: 'HRMS' },
  { event: 'attendance.clock_in', label: 'Attendance Clock-In', category: 'HRMS' },
  { event: 'attendance.clock_out', label: 'Attendance Clock-Out', category: 'HRMS' },
  { event: 'leave.requested', label: 'Leave Requested', category: 'HRMS' },
  { event: 'leave.approved', label: 'Leave Approved', category: 'HRMS' },
  { event: 'payroll.finalized', label: 'Payroll Cycle Finalized', category: 'HRMS' },
  { event: 'pms.task_completed', label: 'Task Completed', category: 'PMS' },
  { event: 'pms.sprint_closed', label: 'Sprint Closed', category: 'PMS' },
  { event: 'approval.pending', label: 'Approval Step Pending', category: 'Approvals' },
  { event: 'approval.decision', label: 'Approval Request Decided', category: 'Approvals' },
  { event: 'device.status_changed', label: 'Biometric Device Status Changed', category: 'Hardware' },
  { event: 'sales.order_created', label: 'Sales Order Created', category: 'Sales' },
  { event: 'inventory.stock_alert', label: 'Low Stock Alert', category: 'Inventory' },
];

export const AVAILABLE_API_SCOPES = [
  { scope: 'read:users', label: 'Read Users & Directory' },
  { scope: 'write:users', label: 'Manage Users & Profiles' },
  { scope: 'read:attendance', label: 'Read Attendance Records' },
  { scope: 'write:attendance', label: 'Log Attendance & Punches' },
  { scope: 'read:leave', label: 'Read Leave Requests' },
  { scope: 'write:leave', label: 'Submit Leave Requests' },
  { scope: 'read:payroll', label: 'Read Payroll & Payslips' },
  { scope: 'read:pms', label: 'Read Projects & Tasks' },
  { scope: 'write:pms', label: 'Manage Projects & Tasks' },
  { scope: 'read:approvals', label: 'Read Approvals' },
  { scope: 'write:approvals', label: 'Decide Approvals' },
  { scope: 'read:inventory', label: 'Read Inventory Stock' },
  { scope: 'read:sales', label: 'Read Sales Orders' },
];

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `API request failed with status ${res.status}`);
  }

  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

export function useApiKeys(companyId?: string, branchId?: string) {
  return useQuery<ApiKey[]>({
    queryKey: ['developer_api_keys', companyId, branchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      if (branchId) params.append('branch_id', branchId);
      const qs = params.toString();
      return apiFetch<ApiKey[]>(`/developer-api/keys${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useApiKeyLogs(keyId: string | null) {
  return useQuery<ApiKeyActivityLog[]>({
    queryKey: ['developer_api_key_logs', keyId],
    queryFn: () => apiFetch<ApiKeyActivityLog[]>(`/developer-api/keys/${keyId}/logs?limit=50`),
    enabled: Boolean(keyId),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation<ApiKey, Error, CreateApiKeyPayload>({
    mutationFn: (payload) =>
      apiFetch<ApiKey>('/developer-api/keys', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer_api_keys'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (keyId) =>
      apiFetch<{ success: boolean }>(`/developer-api/keys/${keyId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer_api_keys'] });
    },
  });
}

export function useWebhooks(companyId?: string, branchId?: string) {
  return useQuery<WebhookSubscription[]>({
    queryKey: ['developer_webhooks', companyId, branchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      if (branchId) params.append('branch_id', branchId);
      const qs = params.toString();
      return apiFetch<WebhookSubscription[]>(`/developer-api/webhooks${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation<WebhookSubscription, Error, CreateWebhookPayload>({
    mutationFn: (payload) =>
      apiFetch<WebhookSubscription>('/developer-api/webhooks', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer_webhooks'] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  return useMutation<WebhookSubscription, Error, { id: string; payload: UpdateWebhookPayload }>({
    mutationFn: ({ id, payload }) =>
      apiFetch<WebhookSubscription>(`/developer-api/webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer_webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (webhookId) =>
      apiFetch<{ success: boolean }>(`/developer-api/webhooks/${webhookId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer_webhooks'] });
      queryClient.invalidateQueries({ queryKey: ['developer_webhook_deliveries'] });
    },
  });
}

export function useTestWebhook() {
  return useMutation<
    { status_code: number; execution_time_ms: number; response_body?: string; signature_sent: string },
    Error,
    TestWebhookPayload
  >({
    mutationFn: (payload) =>
      apiFetch('/developer-api/webhooks/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

export function useWebhookDeliveries(webhookId?: string, limit: number = 50, offset: number = 0) {
  return useQuery<WebhookDeliveryLog[]>({
    queryKey: ['developer_webhook_deliveries', webhookId, limit, offset],
    queryFn: () => {
      const params = new URLSearchParams();
      if (webhookId) params.append('webhook_id', webhookId);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      return apiFetch<WebhookDeliveryLog[]>(`/developer-api/deliveries?${params.toString()}`);
    },
  });
}

export function useRetryWebhookDelivery() {
  const queryClient = useQueryClient();
  return useMutation<WebhookDeliveryLog, Error, string>({
    mutationFn: (deliveryId) =>
      apiFetch<WebhookDeliveryLog>(`/developer-api/deliveries/${deliveryId}/retry`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer_webhook_deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['developer_webhooks'] });
    },
  });
}
