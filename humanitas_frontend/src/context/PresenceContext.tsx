import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SOCKET_URL, API_BASE_URL } from '@/config/api.config';

// WebSocket URL from environment variable
const WS_BASE_URL = SOCKET_URL || '';

interface PresenceContextType {
  onlineUsers: string[];
  isConnected: boolean;
  isUserOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers([]);
      }
      return;
    }

    // Check if SOCKET_URL is configured
    if (!WS_BASE_URL) {
      console.error('❌ VITE_SOCKET_URL is not configured. Please set it in environment variables.');
      console.error('Example: VITE_SOCKET_URL=https://mainapis.onrender.com');
      return;
    }

    console.log(`🔌 Connecting to WebSocket: ${WS_BASE_URL}/presence`);

    // Async function to setup WebSocket
    const setupWebSocket = async () => {
      // Fetch WebSocket token first (for cross-origin connections)
      let wsToken: string | undefined;
      if (WS_BASE_URL && WS_BASE_URL !== window.location.origin) {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/ws-token`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            wsToken = data.token;
            console.log('🎫 WebSocket token obtained');
          }
        } catch (error) {
          console.error('Failed to fetch WebSocket token:', error);
        }
      }

      const newSocket = io(`${WS_BASE_URL}/presence`, {
        auth: wsToken ? { token: wsToken } : undefined,
        withCredentials: true, // Send HttpOnly cookies (for same-origin)
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        console.log('✅ Presence socket connected');
        setIsConnected(true);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Presence socket disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('onlineUsers', (users: string[]) => {
        console.log('👥 Online users received:', users.length, 'users');
        setOnlineUsers(users);
      });

      newSocket.on('userOnline', (data: { userId: string }) => {
        setOnlineUsers(prev => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      });

      newSocket.on('userOffline', (data: { userId: string }) => {
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      });

      newSocket.on('connect_error', (error) => {
        console.error('Presence connection error:', error.message);
      });

      setSocket(newSocket);
      
      return newSocket;
    };

    // Call async function and setup cleanup
    setupWebSocket().then(newSocket => {
      // Cleanup function is stored in the useEffect return
      return () => {
        if (newSocket) {
          newSocket.disconnect();
        }
      };
    });

    // Return cleanup function
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isAuthenticated]);

  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineUsers.includes(userId);
  }, [onlineUsers]);

  return (
    <PresenceContext.Provider value={{ onlineUsers, isConnected, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}
