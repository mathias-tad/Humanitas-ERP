import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { ModuleProvider, useERPModules } from "@/context/ModuleContext";
import { EnterpriseTopHeader } from "@/components/navigation/EnterpriseTopHeader";
import { ContextualModuleDock } from "@/components/navigation/ContextualModuleDock";
import { TopbarModuleNavigation } from "@/components/navigation/TopbarModuleNavigation";
import { DelegationBanner } from "@/components/delegations/DelegationBanner";
import { AppLauncherModal } from "@/components/navigation/AppLauncherModal";
import { GlobalCommandPalette } from "@/components/navigation/GlobalCommandPalette";
import { ChatWidget } from "@/components/messaging/ChatWidget";
import { AiAssistantWidget, type AiAssistantWidgetHandle } from "@/components/ai/AiAssistantWidget";
import { useGlobalPrefetch } from "@/hooks/useGlobalPrefetch";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";

function EnterpriseLayoutContent() {
  const prefetchAll = useGlobalPrefetch();
  const aiWidgetRef = useRef<AiAssistantWidgetHandle>(null);
  const { isTopbar } = useNavigationLayout();

  useEffect(() => {
    // Prefetch background cache on mount
    prefetchAll();
  }, [prefetchAll]);

  const { isModuleSubscribed } = useERPModules();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Contextual Left Rail Navigation Dock & Mobile Drawer */}
      <ContextualModuleDock />

      {/* Main Right Workspace Area */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden min-w-0">
        {/* Top Global Command Header & Topbar Navigation (Strictly pinned, never moves on scroll) */}
        <div className="shrink-0 sticky top-0 z-20 w-full bg-card/95 backdrop-blur-md">
          <EnterpriseTopHeader
            onOpenAiWidget={() => aiWidgetRef.current?.open()}
            onOpenChatDrawer={() => {
              // Dispatch custom event to toggle chat widget if needed
              window.dispatchEvent(new CustomEvent("toggle-chat-drawer"));
            }}
          />

          {/* Horizontal Navigation Bar (rendered when user selects Topbar layout) */}
          {isTopbar && <TopbarModuleNavigation />}
          <DelegationBanner />
        </div>

        {/* Dynamic Page Workspace Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-background/50">
          <Outlet />
        </main>
      </div>

      {/* 9-Dot App Switcher Modal */}
      <AppLauncherModal />

      {/* Global Command Palette (Ctrl/Cmd + K) */}
      <GlobalCommandPalette />

      {/* Universal Floating Foundation Drawers */}
      <ChatWidget />
      {isModuleSubscribed("ai") && <AiAssistantWidget ref={aiWidgetRef} />}
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
