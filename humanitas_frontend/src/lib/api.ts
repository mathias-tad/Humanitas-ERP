// API helper with automatic tenant header injection and 401 handling
import { API_BASE_URL } from '@/config/api.config';

interface RequestOptions extends RequestInit {
  skipTenant?: boolean;
  skipRetry?: boolean; // Skip 401 retry (used for refresh endpoint)
}

export function getCurrentTenantSlug(): string | null {
  try {
    const stored = localStorage.getItem('tenant_info');
    if (stored) {
      const tenant = JSON.parse(stored);
      return tenant.slug || null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

// Try to refresh token
export async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Clear auth and redirect to login
function handleAuthFailure() {
  localStorage.removeItem('tenant_user');
  localStorage.removeItem('tenant_info');
  localStorage.removeItem('tenant_permissions');
  window.location.href = '/login';
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipTenant = false, skipRetry = false, headers = {}, ...restOptions } = options;

  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add tenant header if available and not skipped
  if (!skipTenant) {
    const tenantSlug = getCurrentTenantSlug();
    if (tenantSlug) {
      (requestHeaders as Record<string, string>)['x-tenant-slug'] = tenantSlug;
    }
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...restOptions,
    headers: requestHeaders,
    credentials: 'include',
  });

  // Handle 401 Unauthorized - try to refresh token
  if (response.status === 401 && !skipRetry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request
      const retryResponse = await fetch(url, {
        ...restOptions,
        headers: requestHeaders,
        credentials: 'include',
      });
      if (retryResponse.ok) {
        return retryResponse.json();
      }
    }
    // Refresh failed, logout
    handleAuthFailure();
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Convenience methods
export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = unknown>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
