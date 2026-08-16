import "./App.css";
import AppRoutes from "./AppRoutes";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeApplicator } from "@/components/ThemeApplicator";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // If a request fails, retry 1 time
      retry: 1,
      // Refetch on window focus
      refetchOnWindowFocus: true,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplicator />
      <AppRoutes />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}

export default App;
