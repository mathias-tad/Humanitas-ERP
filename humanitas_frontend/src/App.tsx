import "./App.css";
import AppRoutes from "./AppRoutes";
import { Toaster } from "@/components/ui/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ThemeApplicator } from "@/components/ThemeApplicator";

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
