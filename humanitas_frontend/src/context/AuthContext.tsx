import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api.config';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  role_id?: string;
  department?: string;
  position?: string;
  phone?: string;
  avatar_url?: string;
  birth_date?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
  national_id?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  hire_date?: string;
  employment_type?: string;
  company_id?: string;
  branch_id?: string;
}

interface Tenant {
  id: string;
  slug: string;
  company_name: string;
  subscription_plan: string;
  enabled_features?: string[];
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  activeCompanyId: string | null;
  activeBranchId: string | null;
  setActiveCompany: (companyId: string | null) => void;
  setActiveBranch: (branchId: string | null) => void;
  login: (tenantSlug: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys for caching user/tenant info (NOT tokens - tokens are in HttpOnly cookies)
const USER_KEY = 'tenant_user';
const TENANT_KEY = 'tenant_info';
const PERMISSIONS_KEY = 'tenant_permissions';

// Session check interval (every 5 minutes)
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  const clearAuth = () => {
    setUser(null);
    setTenant(null);
    setPermissions([]);
    setActiveCompanyId(null);
    setActiveBranchId(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
  };

  // Check if session is still valid (user not suspended, token not expired)
  const checkSession = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        credentials: 'include', // Send HttpOnly cookies
      });

      if (response.status === 401) {
        const error = await response.json().catch(() => ({}));
        if (error.message?.includes('suspended')) {
          toast.error('Your account has been suspended. Please contact your administrator.');
        } else {
          toast.error('Your session has expired. Please login again.');
        }
        clearAuth();
        window.location.href = '/login';
        return false;
      }
      return response.ok;
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  };

  // On mount, verify session with backend
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have cached user data
        const storedUser = localStorage.getItem(USER_KEY);
        const storedTenant = localStorage.getItem(TENANT_KEY);
        const storedPermissions = localStorage.getItem(PERMISSIONS_KEY);

        if (storedUser && storedTenant) {
          // Temporarily set cached data
          setUser(JSON.parse(storedUser));
          setTenant(JSON.parse(storedTenant));
          setPermissions(storedPermissions ? JSON.parse(storedPermissions) : []);

          // Verify session is still valid with backend
          const isValid = await checkSession();
          if (!isValid) {
            clearAuth();
          }
        }
      } catch (error) {
        console.error('Session restore error:', error);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Periodic session check
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (tenantSlug: string, email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Receive HttpOnly cookies
      body: JSON.stringify({ tenant_slug: tenantSlug, email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();

    // Store user/tenant in state and localStorage cache (for quick restore)
    setUser(data.user);
    setTenant(data.tenant);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));

    // Fetch user permissions
    try {
      const permResponse = await fetch(`${API_BASE_URL}/users/permissions`, {
        credentials: 'include',
      });
      if (permResponse.ok) {
        const perms = await permResponse.json();
        setPermissions(perms);
        localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(perms));
      }
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Send HttpOnly cookies to clear them
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    clearAuth();
  };

  const refreshUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  };

  const hasPermission = (permission: string): boolean => {
    const role = user?.role?.toLowerCase();
    if (role === 'owner' || role === 'admin' || role === 'administrator') return true;
    // Also check for role_name text in case of mapping issues
    const roleName = (user as any)?.role_name?.toLowerCase();
    if (roleName === 'owner' || roleName === 'admin' || roleName === 'administrator') return true;

    return permissions.includes(permission) || permissions.includes('*');
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    const role = user?.role?.toLowerCase();
    if (role === 'owner' || role === 'admin' || role === 'administrator') return true;
    const roleName = (user as any)?.role_name?.toLowerCase();
    if (roleName === 'owner' || roleName === 'admin' || roleName === 'administrator') return true;

    if (permissions.includes('*')) return true;
    return perms.some(p => permissions.includes(p));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        permissions,
        isLoading,
        isAuthenticated: !!user && !!tenant,
        activeCompanyId,
        activeBranchId,
        setActiveCompany: (id: string | null) => setActiveCompanyId(id),
        setActiveBranch: (id: string | null) => setActiveBranchId(id),
        login,
        logout,
        refreshUser,
        updateUser,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper for API calls - use credentials: 'include' to send HttpOnly cookies
export function getAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
  };
}
