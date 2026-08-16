import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { ModuleProvider } from "@/context/ModuleContext";
import { EnterpriseTopHeader } from "@/components/navigation/EnterpriseTopHeader";
import { ContextualModuleDock } from "@/components/navigation/ContextualModuleDock";
import { AppLauncherModal } from "@/components/navigation/AppLauncherModal";
import { GlobalCommandPalette } from "@/components/navigation/GlobalCommandPalette";
import { ChatWidget } from "@/components/messaging/ChatWidget";
import { AiAssistantWidget, type AiAssistantWidgetHandle } from "@/components/ai/AiAssistantWidget";
import { useGlobalPrefetch } from "@/hooks/useGlobalPrefetch";

function EnterpriseLayoutContent() {
  const prefetchAll = useGlobalPrefetch();
  const aiWidgetRef = useRef<AiAssistantWidgetHandle>(null);

  useEffect(() => {
    // Prefetch background cache on mount
    prefetchAll();
  }, [prefetchAll]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Contextual Left Rail Navigation Dock (Dynamics 365 style) */}
      <ContextualModuleDock />

      {/* Main Right Workspace Area */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden min-w-0">
        {/* Top Global Command Header */}
        <EnterpriseTopHeader
          onOpenAiWidget={() => aiWidgetRef.current?.open()}
          onOpenChatDrawer={() => {
            // Dispatch custom event to toggle chat widget if needed
            window.dispatchEvent(new CustomEvent("toggle-chat-drawer"));
          }}
        />

        {/* Dynamic Page Workspace Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background/50">
          <Outlet />
        </main>
      </div>

      {/* 9-Dot App Switcher Modal */}
      <AppLauncherModal />

      {/* Global Command Palette (Ctrl/Cmd + K) */}
      <GlobalCommandPalette />

      {/* Universal Floating Foundation Drawers */}
      <ChatWidget />
      <AiAssistantWidget ref={aiWidgetRef} />
    </div>
  );
}

export default function EnterpriseLayout() {
  return (
    <ModuleProvider>
      <EnterpriseLayoutContent />
    </ModuleProvider>
  );
}
