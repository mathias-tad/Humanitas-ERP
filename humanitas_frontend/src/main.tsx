import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { TenantProvider } from "./context/TenantContext";
import { AuthProvider } from "./context/AuthContext";
import { PresenceProvider } from "./context/PresenceContext";
import { MessagingProvider } from "./context/MessagingContext";
import { ThemeProvider } from "@/components/theme-provider";

import { ModuleProvider } from "./context/ModuleContext";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StrictMode>
      <AuthProvider>
        <ModuleProvider>
          <PresenceProvider>
            <MessagingProvider>
              <TenantProvider>
                <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                  <App />
                </ThemeProvider>
              </TenantProvider>
            </MessagingProvider>
          </PresenceProvider>
        </ModuleProvider>
      </AuthProvider>
    </StrictMode>
  </BrowserRouter>
);
