import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@/config/api.config';
import { api, getCurrentTenantId, getCurrentTenantSlug } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('tenant helpers', () => {
  it('read slug and id from tenant_info', () => {
    localStorage.setItem('tenant_info', JSON.stringify({ slug: 'acme', id: 't-1' }));
    expect(getCurrentTenantSlug()).toBe('acme');
    expect(getCurrentTenantId()).toBe('t-1');
  });

  it('return null when tenant_info is missing or broken', () => {
    expect(getCurrentTenantSlug()).toBeNull();
    localStorage.setItem('tenant_info', '{not json');
    expect(getCurrentTenantId()).toBeNull();
  });
});

describe('apiRequest', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends tenant and scope headers, cookies and a JSON body', async () => {
    localStorage.setItem('tenant_info', JSON.stringify({ slug: 'acme', id: 't-1' }));
    localStorage.setItem('active_company_id', 'c-1');
    localStorage.setItem('active_branch_id', 'b-1');
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await expect(api.post('/things', { name: 'x' })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/things`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-tenant-slug': 'acme',
      'x-tenant-id': 't-1',
      'x-company-id': 'c-1',
      'x-branch-id': 'b-1',
    });
  });

  it('omits tenant headers with skipTenant and keeps absolute URLs', async () => {
    localStorage.setItem('tenant_info', JSON.stringify({ slug: 'acme', id: 't-1' }));
    fetchMock.mockResolvedValue(jsonResponse([]));

    await api.get('https://example.test/x', { skipTenant: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.test/x');
    expect(init.headers).not.toHaveProperty('x-tenant-slug');
    expect(init.headers).not.toHaveProperty('x-tenant-id');
  });

  it('refreshes the session once on 401 and retries', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({}, 200)) // POST /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ value: 42 }));

    await expect(api.get('/me')).resolves.toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/refresh`);
  });

  it('logs out when the refresh fails', async () => {
    // jsdom cannot navigate; it reports the redirect to /login as a console error.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem('tenant_user', '{}');
    localStorage.setItem('tenant_info', '{}');
    localStorage.setItem('tenant_permissions', '[]');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401));

    await expect(api.get('/me')).rejects.toThrow('Session expired');
    expect(localStorage.getItem('tenant_user')).toBeNull();
    expect(localStorage.getItem('tenant_info')).toBeNull();
    expect(localStorage.getItem('tenant_permissions')).toBeNull();
  });

  it('surfaces the server error message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Shift not found' }, 404));
    await expect(api.delete('/shifts/1')).rejects.toThrow('Shift not found');
  });
});
