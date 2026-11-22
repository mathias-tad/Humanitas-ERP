import "./App.css";
import AppRoutes from "./AppRoutes";
import { Toaster } from "@/components/ui/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ThemeApplicator } from "@/components/ThemeApplicator";
import { ErrorBoundary } from "@/components/platform/ErrorBoundary";
import { RecordDrawerProvider } from "@/components/platform/RecordDrawer";
// Record types any page can create/open in place (featureslist §29)
import "@/components/products/registerProductEntities";
import "@/components/crm/registerCrmEntities";
import "@/components/contacts/registerContactEntities";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplicator />
      <ErrorBoundary scope="app">
        <RecordDrawerProvider>
          <AppRoutes />
        </RecordDrawerProvider>
      </ErrorBoundary>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}

export default App;
