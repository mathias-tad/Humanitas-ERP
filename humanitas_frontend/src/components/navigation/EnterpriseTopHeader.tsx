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
  Menu,
  Building2,
  User,
  PanelLeft,
  PanelTop,
} from "lucide-react";
import { CompanyBranchSwitcher } from "./CompanyBranchSwitcher";
import { Button } from "@/components/ui/button";
import { useNavigationLayout } from "@/hooks/useNavigationLayout";
import { toast } from "sonner";
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
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    isModuleSubscribed,
  } = useERPModules();
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const { isTopbar, toggleLayout } = useNavigationLayout();

  const handleToggleLayout = () => {
    const nextMode = toggleLayout();
    if (nextMode === "topbar") {
      toast.success("Switched to Topbar navigation");
    } else {
      toast.success("Switched to Sidebar navigation");
    }
  };

  const currentModule = ALL_ERP_MODULES[activeModule] || ALL_ERP_MODULES.hrms;
  const ModuleIcon = currentModule.icon;

  return (
    <header className="h-14 w-full border-b border-border bg-card/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 select-none">
      {/* Left: Mobile Menu Toggle + 9-Dot Launcher & Logo */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        {/* Mobile Hamburger Drawer Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="h-9 w-9 rounded-lg md:hidden text-foreground hover:bg-surface-2"
          title="Toggle Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

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
          className="flex items-center gap-2 cursor-pointer group shrink-0"
        >
          <img
            src={humanitas_logo}
            alt="Humanitas ERP"
            className="h-6 w-auto object-contain"
          />
          <span className="font-bold text-sm text-foreground tracking-tight hidden lg:inline">
            Humanitas
          </span>
          <span className="text-muted-foreground/40 text-xs hidden lg:inline">/</span>
          <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-semibold text-primary">
            <ModuleIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate max-w-[80px] sm:max-w-none">{currentModule.shortLabel}</span>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar (Triggering Cmd+K Palette) */}
      <div className="flex-1 max-w-xs md:max-w-sm lg:max-w-xl hidden md:block">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-border bg-surface-1 text-xs text-muted-foreground hover:border-primary/50 hover:bg-card transition-all shadow-xs group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            <span className="truncate">Search records, jump to pages, or execute commands...</span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Center-Right: Company & Branch Context Switcher (visible on tablet & desktop) */}
      <div className="hidden md:flex items-center shrink-0">
        <CompanyBranchSwitcher />
      </div>

      {/* Right: Search (on mobile), Quick Create, AI Trigger, Chat, Notifications & User Profile */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Mobile Search Button (<md) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCommandPaletteOpen(true)}
          className="h-8 w-8 rounded-lg md:hidden text-muted-foreground hover:text-foreground"
          title="Search (Ctrl + K)"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Quick Action (+ Create) Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-8 gap-1 sm:gap-1.5 rounded-xl px-2 sm:px-3 text-xs font-bold gold-gradient gold-glow border-none transition-transform hover:scale-105 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Create</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
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
            <DropdownMenuItem onClick={() => navigate("/profile")} className="text-xs gap-2 cursor-pointer font-medium">
              <User className="h-3.5 w-3.5 text-primary" />
              <span>My Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleLayout} className="text-xs gap-2 cursor-pointer">
              {isTopbar ? (
                <PanelLeft className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <PanelTop className="h-3.5 w-3.5 text-amber-500" />
              )}
              <div className="flex items-center justify-between flex-1">
                <span>Layout: {isTopbar ? "Topbar" : "Sidebar"}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Switch
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings/appearance")} className="text-xs gap-2 cursor-pointer">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Appearance & Theme</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/accesscontrol")} className="text-xs gap-2 cursor-pointer">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Access Control & Roles</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings/organization")} className="text-xs gap-2 cursor-pointer">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Company & Branch Structure</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings/general")} className="text-xs gap-2 cursor-pointer">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span>General Settings</span>
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
