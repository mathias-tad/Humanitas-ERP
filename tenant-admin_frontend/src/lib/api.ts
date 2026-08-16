// Admin API helper - for master admin panel
// This does NOT include tenant headers as admin panel manages all tenants
// Uses HttpOnly cookies for authentication (secure - not accessible by JavaScript)

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { headers = {}, params, ...restOptions } = options;

  const requestHeaders: HeadersInit = {
    ...headers,
  };

  // Only set Content-Type if there's a body
  if (restOptions.body) {
    (requestHeaders as Record<string, string>)['Content-Type'] = 'application/json';
  }

  let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  // Add query params if provided
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    ...restOptions,
    headers: requestHeaders,
    credentials: 'include', // Send HttpOnly cookies with every request
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  // Handle empty responses (204 No Content, etc.)
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) {
    return {} as T;
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

// Tenant-specific API calls (with tenant context for admin impersonation)
export const tenantApi = {
  get: <T = unknown>(tenantId: string, endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'GET',
      headers: {
        ...options?.headers,
        'X-Tenant-ID': tenantId,
      },
    }),

  post: <T = unknown>(tenantId: string, endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        ...options?.headers,
        'X-Tenant-ID': tenantId,
      },
    }),
};

export default api;
