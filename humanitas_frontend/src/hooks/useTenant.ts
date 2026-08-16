// Re-export from TenantContext for backward compatibility
// This hook now uses context-based tenant management instead of subdomain detection

export { useTenantContext as useTenant } from '@/context/TenantContext';
export type { Tenant } from '@/context/TenantContext';

// Helper to get current tenant from storage
export function getCurrentTenant(): { id: string; slug: string; name: string } | null {
  try {
    const stored = localStorage.getItem('current_tenant');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// Helper to get tenant ID for API calls
export function getTenantId(): string | null {
  const tenant = getCurrentTenant();
  return tenant?.id || null;
}

// Helper to get tenant slug
export function getTenantSlug(): string | null {
  const tenant = getCurrentTenant();
  return tenant?.slug || null;
}
