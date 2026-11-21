import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Signup from './Signup';

vi.mock('@/components/mode-toggle', () => ({ ModeToggle: () => null }));

const OPTIONS = {
  enabled: true,
  trial_days: 21,
  platform_name: 'Humanitas',
  support_email: 'support@example.com',
  modules: [
    { key: 'hrms', name: 'Human Capital', category: 'people', description: 'HR', depends: [], status: 'available' },
    { key: 'products', name: 'Products & Catalog', category: 'operations', description: 'Catalog', depends: [], status: 'available' },
    { key: 'pos', name: 'Point of Sale', category: 'commercial', description: 'POS', depends: ['products'], status: 'coming_soon' },
  ],
};

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const body = handler(url, init);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

// Radix Checkbox measures itself with ResizeObserver, which jsdom does not have.
// Set once for the file (not vi.stubGlobal, which is undone after each test).
const g = globalThis as unknown as { ResizeObserver?: unknown };
g.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const renderPage = () => render(<MemoryRouter><Signup /></MemoryRouter>);

describe('Signup page', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.restoreAllMocks());

  it('shows the trial length and the modules, with coming-soon ones disabled', async () => {
    mockFetch(() => OPTIONS);
    renderPage();
    expect(await screen.findByText('Start your 21-day free trial')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Point of Sale/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Products & Catalog/ })).not.toBeDisabled();
  });

  it('suggests the organization ID, signs up and shows where the set-up link went', async () => {
    const fetchSpy = mockFetch((url, init) => {
      if (url.endsWith('/public/signup/options')) return OPTIONS;
      if (url.includes('slug-available')) return { available: true };
      if (init?.method === 'POST') {
        return { company_name: 'Abebe Trading', slug: 'abebe-trading', contact_email: 'o@abebe.et', trial_ends_at: '2026-12-12T00:00:00Z', modules: ['products'] };
      }
      return {};
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Company name'), { target: { value: 'Abebe Trading' } });
    expect(screen.getByLabelText('Organization ID')).toHaveValue('abebe-trading');
    fireEvent.change(screen.getByLabelText('Your work email'), { target: { value: 'o@abebe.et' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Products & Catalog/ }));
    await screen.findByText(/Available\./);
    fireEvent.click(screen.getByRole('button', { name: 'Start free trial' }));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText('abebe-trading')).toBeInTheDocument();
    const post = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual(
      expect.objectContaining({ company_name: 'Abebe Trading', slug: 'abebe-trading', contact_email: 'o@abebe.et', modules: ['products'] }),
    );
  });

  it('says when online sign-up is closed', async () => {
    mockFetch(() => ({ ...OPTIONS, enabled: false }));
    renderPage();
    expect(await screen.findByText('Online sign-up is closed right now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@example.com' })).toHaveAttribute('href', 'mailto:support@example.com');
  });
});
