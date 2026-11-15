import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api.config';
import { useInterviews } from './useRecruitmentPipeline';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeCompanyId: null, activeBranchId: null }),
  getAuthHeaders: () => ({ 'x-tenant-slug': 'acme' }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('useInterviews', () => {
  it('loads interviews from the API and maps them to the UI model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 7,
            job_id: 3,
            job_title: 'Engineer',
            candidate_id: 11,
            candidate_name: 'Sara',
            scheduled_at: '2026-11-20T09:00:00Z',
            duration_minutes: '60',
            rating: '4',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useInterviews('job 3'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/recruitment/interviews?job_id=job%203`);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ 'x-tenant-slug': 'acme' });
    expect(result.current.data).toEqual([
      expect.objectContaining({
        id: '7',
        job_id: '3',
        candidate_id: '11',
        candidate_name: 'Sara',
        interview_type: 'technical',
        status: 'scheduled',
        duration_minutes: 60,
        rating: 4,
      }),
    ]);
  });

  it('reports backend validation errors instead of inventing data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: ['job_id must be a UUID', 'bad'] }, 400)));

    const { result } = renderHook(() => useInterviews(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('job_id must be a UUID, bad');
    expect(result.current.data).toBeUndefined();
  });
});
