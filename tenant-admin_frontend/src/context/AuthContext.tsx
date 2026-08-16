import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'support';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session validity
  const checkSession = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'POST',
        credentials: 'include', // Send HttpOnly cookies
      });

      if (response.ok) {
        return true;
      }

      // Session invalid, clear user
      setUser(null);
      localStorage.removeItem(USER_KEY);
      return false;
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem(USER_KEY);

        if (storedUser) {
          // Verify session is still valid
          const isValid = await checkSession();
          if (isValid) {
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = (admin: AdminUser) => {
    setUser(admin);
    localStorage.setItem(USER_KEY, JSON.stringify(admin));
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Send HttpOnly cookies
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setUser(null);
    localStorage.removeItem(USER_KEY);
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
