import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo?: string;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  isLoading: boolean;
  switchTenant: (tenantId: string) => void;
  setTenants: (tenants: Tenant[]) => void;
  clearTenant: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = 'current_tenant';
const TENANTS_STORAGE_KEY = 'available_tenants';

// Mock tenants for development - replace with API call in production
const MOCK_TENANTS: Tenant[] = [
  { id: '1', slug: 'acme', name: 'Acme Corporation', logo: '' },
  { id: '2', slug: 'techstart', name: 'TechStart Inc', logo: '' },
  { id: '3', slug: 'demo', name: 'Demo Company', logo: '' },
];

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load tenant from storage on mount
  useEffect(() => {
    const loadTenant = () => {
      try {
        // Load available tenants (would come from JWT/API in production)
        const storedTenants = localStorage.getItem(TENANTS_STORAGE_KEY);
        const tenants = storedTenants ? JSON.parse(storedTenants) : MOCK_TENANTS;
        setAvailableTenants(tenants);

        // Load current tenant selection
        const storedTenant = localStorage.getItem(TENANT_STORAGE_KEY);
        if (storedTenant) {
          const tenant = JSON.parse(storedTenant);
          // Verify tenant is still in available list
          const isValid = tenants.some((t: Tenant) => t.id === tenant.id);
          if (isValid) {
            setCurrentTenant(tenant);
          } else if (tenants.length > 0) {
            // Default to first tenant if stored one is invalid
            setCurrentTenant(tenants[0]);
            localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenants[0]));
          }
        } else if (tenants.length === 1) {
          // Auto-select if only one tenant
          setCurrentTenant(tenants[0]);
          localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenants[0]));
        }
      } catch (error) {
        console.error('Error loading tenant:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTenant();
  }, []);

  const switchTenant = (tenantId: string) => {
    const tenant = availableTenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenant));
      // Optionally reload to reset app state
      // window.location.reload();
    }
  };

  const setTenants = (tenants: Tenant[]) => {
    setAvailableTenants(tenants);
    localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(tenants));
    
    // If current tenant not in new list, select first one
    if (currentTenant && !tenants.some(t => t.id === currentTenant.id)) {
      if (tenants.length > 0) {
        setCurrentTenant(tenants[0]);
        localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenants[0]));
      } else {
        setCurrentTenant(null);
        localStorage.removeItem(TENANT_STORAGE_KEY);
      }
    }
  };

  const clearTenant = () => {
    setCurrentTenant(null);
    setAvailableTenants([]);
    localStorage.removeItem(TENANT_STORAGE_KEY);
    localStorage.removeItem(TENANTS_STORAGE_KEY);
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        availableTenants,
        isLoading,
        switchTenant,
        setTenants,
        clearTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}
