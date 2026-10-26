import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useERPModules, ALL_ERP_MODULES } from "@/context/ModuleContext";
import { useAuth } from "@/context/AuthContext";
import { MODULE_NAV_CONFIGS, type NavItem } from "./ContextualModuleDock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, MoreHorizontal } from "lucide-react";

export const TopbarModuleNavigation: React.FC = () => {
  const { activeModule } = useERPModules();
  const { hasPermission } = useAuth();
  const location = useLocation();

  const currentModule = ALL_ERP_MODULES[activeModule] || ALL_ERP_MODULES.hrms;
  const navSections = MODULE_NAV_CONFIGS[activeModule] || MODULE_NAV_CONFIGS.hrms;

  // Flatten all visible items for this module
  const allVisibleItems: NavItem[] = navSections.flatMap((section: { title: string; items: NavItem[] }) =>
    section.items.filter((item: NavItem) => {
      if (!item.permissions || item.permissions.length === 0) return true;
      return item.permissions.some((p: string) => hasPermission(p));
    })
  );

  // Take primary items for the horizontal bar and put the rest in an overflow dropdown
  const PRIMARY_COUNT = 7;
  const primaryItems = allVisibleItems.slice(0, PRIMARY_COUNT);
  const overflowItems = allVisibleItems.slice(PRIMARY_COUNT);

  return (
    <nav className="w-full bg-card/80 backdrop-blur-md border-b border-border/70 px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none select-none z-30">
      <div className="flex items-center gap-1.5 min-w-0">
        {primaryItems.map((item: NavItem, idx: number) => {
          const Icon = item.icon;
          const isActive =
            item.url === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(item.url);

          return (
            <NavLink
              key={idx}
              to={item.url}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "gold-gradient font-bold shadow-xs text-slate-950"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-slate-950" : "text-muted-foreground"}`} />
              <span>{item.title}</span>
              {item.badge && (
                <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-[9px] font-bold">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {overflowItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 whitespace-nowrap transition-all">
                <MoreHorizontal className="h-3.5 w-3.5" />
                <span>More ({overflowItems.length})</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-[380px] overflow-y-auto">
              {overflowItems.map((item: NavItem, idx: number) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.url);
                return (
                  <DropdownMenuItem key={idx} asChild>
                    <NavLink
                      to={item.url}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-md cursor-pointer ${
                        isActive ? "font-bold text-primary bg-primary/10" : ""
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate flex-1">{item.title}</span>
                      {item.badge && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 pl-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-semibold text-foreground/80">{currentModule.shortLabel}</span>
      </div>
    </nav>
  );
};
