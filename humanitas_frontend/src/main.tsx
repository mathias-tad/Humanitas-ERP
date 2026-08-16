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

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StrictMode>
      <AuthProvider>
        <PresenceProvider>
          <MessagingProvider>
            <TenantProvider>
              <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                <App />
              </ThemeProvider>
            </TenantProvider>
          </MessagingProvider>
        </PresenceProvider>
      </AuthProvider>
    </StrictMode>
  </BrowserRouter>
);
