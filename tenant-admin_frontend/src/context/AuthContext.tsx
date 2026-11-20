import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_BASE_URL } from '@/lib/config';
import { SESSION_EXPIRED_EVENT } from '@/lib/api';

export type AdminRole = 'super_admin' | 'admin' | 'support';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
}

interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (admin: AdminUser) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = 'admin_user';

function readStoredUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearUser = () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
  };

  // Ask the server who we are. The role comes from the server (it is re-read from
  // the database on every request), never from what was stored at login.
  const checkSession = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'POST',
        credentials: 'include', // Send HttpOnly cookies
      });

      if (!response.ok) {
        clearUser();
        return false;
      }

      const me = (await response.json()) as { id: string; email: string; role: AdminRole };
      const stored = readStoredUser();
      const merged: AdminUser = {
        id: me.id,
        email: me.email,
        role: me.role,
        full_name: stored && stored.id === me.id ? stored.full_name : me.email,
      };
      setUser(merged);
      localStorage.setItem(USER_KEY, JSON.stringify(merged));
      return true;
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  };

  useEffect(() => {
    checkSession().finally(() => setIsLoading(false));

    // Any API call that gets a 401 ends the session in the UI.
    window.addEventListener(SESSION_EXPIRED_EVENT, clearUser);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, clearUser);
  }, []);

  const login = (admin: AdminUser) => {
    setUser(admin);
    localStorage.setItem(USER_KEY, JSON.stringify(admin));
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Send HttpOnly cookies
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    clearUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkSession,
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

/**
 * What the signed-in admin may do, mirroring the API's rules (the API enforces
 * them; this only hides controls that would be refused).
 */
export function useAdminAccess() {
  const { user } = useAuth();
  const role = user?.role;
  const canManage = role === 'admin' || role === 'super_admin';
  return {
    role,
    isSuperAdmin: role === 'super_admin',
    /** Create/edit/suspend tenants, packages, roles. */
    canManage,
    /** Settings, AI configuration, logs, migrations. */
    canConfigure: canManage,
  };
}
