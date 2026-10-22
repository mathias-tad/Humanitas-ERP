import { QueryClient } from '@tanstack/react-query';

// Centralized TanStack Query client configured with 1-minute global refresh
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 1 minute (60,000ms)
      staleTime: 60 * 1000,
      // Automatically refetch active queries every 1 minute across all components & pages
      refetchInterval: 60 * 1000,
      refetchIntervalInBackground: false,
      // If a request fails, retry 1 time
      retry: 1,
      // Refetch when window regains focus
      refetchOnWindowFocus: true,
    },
  },
});

export default queryClient;
