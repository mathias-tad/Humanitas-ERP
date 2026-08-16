import React from "react";
import { useERPModules, ALL_ERP_MODULES } from "@/context/ModuleContext";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Grid,
  Search,
  Plus,
  Sparkles,
  MessageSquare,
  LogOut,
  Settings,
  ChevronDown,
  Palette,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import humanitas_logo from "@/assets/humanitas_logo.png";

interface EnterpriseTopHeaderProps {
  onOpenAiWidget?: () => void;
  onOpenChatDrawer?: () => void;
}

export const EnterpriseTopHeader: React.FC<EnterpriseTopHeaderProps> = ({
  onOpenAiWidget,
  onOpenChatDrawer,
}) => {
  const {
    activeModule,
    setIsAppLauncherOpen,
    setIsCommandPaletteOpen,
    isModuleSubscribed,
  } = useERPModules();
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  const currentModule = ALL_ERP_MODULES[activeModule] || ALL_ERP_MODULES.hrms;
  const ModuleIcon = currentModule.icon;

  return (
    <header className="h-14 w-full border-b border-border bg-card/80 backdrop-blur-md px-4 flex items-center justify-between gap-4 sticky top-0 z-40 select-none">
      {/* Left: 9-Dot Launcher & Logo & Active Workspace Badge */}
      <div className="flex items-center gap-3">
        {/* 9-Dot App Switcher Button (Dynamics 365 style) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsAppLauncherOpen(true)}
          className="h-9 w-9 rounded-lg text-foreground/80 hover:text-foreground hover:bg-surface-2 transition-transform hover:scale-105"
          title="App Launcher (9-Dots) - Switch Modules"
        >
          <Grid className="h-5 w-5" />
        </Button>

        {/* Brand Logo & Current App Indicator */}
        <div
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <img
            src={humanitas_logo}
            alt="Humanitas ERP"
            className="h-6 w-auto object-contain"
          />
          <span className="font-bold text-sm text-foreground tracking-tight hidden md:inline">
            Humanitas
          </span>
          <span className="text-muted-foreground/60 text-xs hidden md:inline">/</span>
          <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-foreground">
            <ModuleIcon className={`h-3.5 w-3.5 ${currentModule.color}`} />
            <span>{currentModule.shortLabel}</span>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar (Triggering Cmd+K Palette) */}
      <div className="flex-1 max-w-xl hidden sm:block">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg border border-border bg-surface-1 text-xs text-muted-foreground hover:border-primary/40 hover:bg-card transition-all shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">Search records, jump to pages, or execute commands...</span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Create, AI Trigger, Chat, Notifications & User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick Action (+ Create) Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-8 gap-1 rounded-lg px-2.5 text-xs font-semibold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Create</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              Quick Actions
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/products/new")} className="text-xs cursor-pointer">
              <span>New Product & QR</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/sales/quotations/new")} className="text-xs cursor-pointer">
              <span>New Sales Quotation</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/purchasing/orders/new")} className="text-xs cursor-pointer">
              <span>New Purchase Order</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/pos")} className="text-xs cursor-pointer">
              <span>Open POS Terminal</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* AI Assistant Button */}
        {isModuleSubscribed("ai") && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenAiWidget}
            className="relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all group"
            title="Open AI Assistant"
          >
            <Sparkles className="h-4 w-4 text-violet-500 group-hover:rotate-12 transition-transform" />
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
            </span>
          </Button>
        )}

        {/* Communication Drawer (Chat) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenChatDrawer}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2"
          title="Universal Chat & Communications"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        {/* System Notifications */}
        <NotificationBell />

        {/* User Profile & Account Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 gap-2 rounded-lg px-2 text-xs font-semibold text-foreground hover:bg-surface-2"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[11px]">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="hidden xl:inline max-w-[100px] truncate">{user?.email}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold leading-none text-foreground">{user?.email}</p>
                <p className="text-[10px] leading-none text-muted-foreground">Tenant: {tenant?.slug || "Default"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings/appearance")} className="text-xs gap-2 cursor-pointer">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Appearance & Theme</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/accesscontrol")} className="text-xs gap-2 cursor-pointer">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Access Control & Roles</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings/general")} className="text-xs gap-2 cursor-pointer">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Organization Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-xs gap-2 text-destructive cursor-pointer">
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
