import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useERPModules, ALL_ERP_MODULES } from "@/context/ModuleContext";
import { useAuth } from "@/context/AuthContext";
import { MODULE_NAV_CONFIGS, type NavItem } from "./ContextualModuleDock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Search, X } from "lucide-react";

export const TopbarModuleNavigation: React.FC = () => {
  const { activeModule, setIsAppLauncherOpen } = useERPModules();
  const { hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isAllMenusOpen, setIsAllMenusOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = 240;
    el.scrollBy({ left: direction === "left" ? -distance : distance, behavior: "smooth" });
  };

  const currentModule = ALL_ERP_MODULES[activeModule] || ALL_ERP_MODULES.hrms;
  const ModuleIcon = currentModule.icon;
  const navSections = MODULE_NAV_CONFIGS[activeModule] || MODULE_NAV_CONFIGS.hrms;

  // Filter accessible items per section based on RBAC permissions
  const filteredSections = navSections
    .map((section) => ({
      title: section.title,
      items: section.items.filter((item: NavItem) => {
        if (!item.permissions || item.permissions.length === 0) return true;
        return item.permissions.some((p: string) => hasPermission(p));
      }),
    }))
    .filter((section) => section.items.length > 0);

  // Check if a section contains the currently active route
  const isSectionActive = (section: { items: NavItem[] }) => {
    return section.items.some((item) =>
      item.url === "/dashboard"
        ? location.pathname === "/dashboard"
        : location.pathname.startsWith(item.url)
    );
  };

  // For "All Menus" search filter
  const matchesSearch = (title: string) => {
    if (!searchQuery.trim()) return true;
    return title.toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  return (
    <>
      <nav className="relative w-full bg-card/95 backdrop-blur-md border-b border-border/80 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 select-none z-30 shrink-0">
        <div className="relative flex items-center flex-1 min-w-0">
          {/* Left overflow indicator & scroll button */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-3 bg-gradient-to-r from-card via-card/90 to-transparent pointer-events-auto">
              <button
                type="button"
                onClick={() => handleScroll("left")}
                className="h-6 w-6 rounded-full bg-background border border-border shadow-md flex items-center justify-center text-foreground hover:bg-surface-2 hover:text-primary transition-all duration-150"
                title="Scroll left to see more menus"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Scrollable menu items (no visible scrollbar) */}
          <div
            ref={scrollContainerRef}
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] touch-pan-x w-full py-0.5"
          >
            {/* Module Switcher Badge (clicking opens 9-dot launcher) */}
            <button
              onClick={() => setIsAppLauncherOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-2 text-foreground hover:bg-surface-3 transition-colors shrink-0 mr-1 group"
              title="Switch Module"
            >
              <ModuleIcon className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
              <span className="font-bold hidden md:inline">{currentModule.shortLabel}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>

            {/* Categorized Dropdowns / Mega-menus for all module sections */}
            {filteredSections.map((section, sIdx) => {
              const active = isSectionActive(section);

              // If a section has only 1 item, render it directly as a link
              if (section.items.length === 1) {
                const singleItem = section.items[0];
                const Icon = singleItem.icon;
                const isItemActive =
                  singleItem.url === "/dashboard"
                    ? location.pathname === "/dashboard"
                    : location.pathname.startsWith(singleItem.url);

                return (
                  <NavLink
                    key={sIdx}
                    to={singleItem.url}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      isItemActive
                        ? "gold-gradient font-bold shadow-xs text-slate-950"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isItemActive ? "text-slate-950" : "text-muted-foreground"}`} />
                    <span>{singleItem.title}</span>
                  </NavLink>
                );
              }

              return (
                <DropdownMenu key={sIdx}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all outline-none ${
                        active
                          ? "bg-primary/10 text-primary font-bold border-b-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                      }`}
                    >
                      <span>{section.title}</span>
                      <span className="text-[10px] text-muted-foreground/70 bg-surface-2 px-1 rounded-sm">
                        {section.items.length}
                      </span>
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 p-1.5 shadow-lg border-border">
                    <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                      {section.title}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {section.items.map((item, iIdx) => {
                      const Icon = item.icon;
                      const isItemActive =
                        item.url === "/dashboard"
                          ? location.pathname === "/dashboard"
                          : location.pathname.startsWith(item.url);

                      return (
                        <DropdownMenuItem key={iIdx} asChild>
                          <NavLink
                            to={item.url}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                              isItemActive
                                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                : "text-foreground hover:bg-surface-2"
                            }`}
                          >
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${isItemActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                            <span className="truncate flex-1">{item.title}</span>
                            {item.badge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-surface-3">
                                {item.badge}
                              </span>
                            )}
                          </NavLink>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>

          {/* Right overflow indicator & scroll button */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-3 bg-gradient-to-l from-card via-card/90 to-transparent pointer-events-auto">
              <button
                type="button"
                onClick={() => handleScroll("right")}
                className="h-6 w-6 rounded-full bg-background border border-border shadow-md flex items-center justify-center text-foreground hover:bg-surface-2 hover:text-primary transition-all duration-150"
                title="Scroll right to see more menus"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Action: All Menus Grid Button */}
        <div className="flex items-center gap-2 shrink-0 pl-2">
          <button
            onClick={() => {
              setSearchQuery("");
              setIsAllMenusOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-foreground transition-all shadow-2xs group border border-border/50"
            title="Browse all menus in this module"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">All Menus</span>
          </button>
        </div>
      </nav>

      {/* All Menus Mega-Grid Modal / Site Map */}
      <Dialog open={isAllMenusOpen} onOpenChange={setIsAllMenusOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border bg-surface-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ModuleIcon className="h-5 w-5 text-primary" />
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    {currentModule.label} — All Navigation Menus
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Complete menu directory for the active module
                  </p>
                </div>
              </div>
            </div>

            {/* Quick search input */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={`Search ${currentModule.shortLabel} menus...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </DialogHeader>

          {/* Categorized Menu Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-background">
            {filteredSections.map((section, sIdx) => {
              const matchedItems = section.items.filter((item) => matchesSearch(item.title));
              if (matchedItems.length === 0) return null;

              return (
                <div key={sIdx} className="space-y-2">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border/60">
                    <span>{section.title}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({matchedItems.length})
                    </span>
                  </h3>
                  <div className="space-y-1">
                    {matchedItems.map((item, iIdx) => {
                      const Icon = item.icon;
                      const isItemActive =
                        item.url === "/dashboard"
                          ? location.pathname === "/dashboard"
                          : location.pathname.startsWith(item.url);

                      return (
                        <button
                          key={iIdx}
                          onClick={() => {
                            navigate(item.url);
                            setIsAllMenusOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                            isItemActive
                              ? "bg-primary text-primary-foreground font-bold shadow-xs"
                              : "text-foreground hover:bg-surface-2"
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${isItemActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                          <span className="truncate flex-1 font-medium">{item.title}</span>
                          {item.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-surface-3">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
