import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ChatWidget } from "@/components/messaging/ChatWidget";
import { Outlet } from "react-router-dom";

function MobileFixedTrigger() {
  const { isMobile, openMobile } = useSidebar();
  if (!isMobile || openMobile) return null;
  return <SidebarTrigger className="fixed top-3 left-3 z-[1000]" />;
}

import { useGlobalPrefetch } from "./hooks/useGlobalPrefetch";
import { useEffect, useRef } from "react";
import { AiAssistantWidget, type AiAssistantWidgetHandle } from "@/components/ai/AiAssistantWidget";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout() {
  const prefetchAll = useGlobalPrefetch();
  const aiWidgetRef = useRef<AiAssistantWidgetHandle>(null);

  useEffect(() => {
    // Start prefetching all critical data as soon as Layout mounts (authenticated)
    prefetchAll();
  }, [prefetchAll]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <MobileFixedTrigger />

        <div className="fixed top-2 right-4 flex items-center gap-2 z-50">
          {/* AI Assistant Topbar Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => aiWidgetRef.current?.open()}
            className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 group"
            title="AI Assistant"
          >
            <Sparkles className="h-[18px] w-[18px] group-hover:rotate-12 transition-transform duration-300" />
            {/* Subtle glow pulse */}
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          </Button>

          <NotificationBell />
        </div>

        <div className="w-full overflow-x-hidden">
          <Outlet />
        </div>
        <ChatWidget />
        <AiAssistantWidget ref={aiWidgetRef} />
      </SidebarInset>
    </SidebarProvider>
  );
}
