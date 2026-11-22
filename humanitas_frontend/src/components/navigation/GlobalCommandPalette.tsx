import React, { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Settings, PlusCircle, FileText, LayoutGrid, MousePointerClick, Database, Loader2 } from "lucide-react";
import { useERPModules, ALL_ERP_MODULES } from "@/context/ModuleContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useRecordDrawer } from "@/components/platform/RecordDrawer";
import { allEntities, entityAccess } from "@/components/platform/entityRegistry";
import { MODULE_NAV_CONFIGS } from "@/components/navigation/ContextualModuleDock";
import { APP_ROUTES } from "@/lib/appRoutes.generated";
import {
  featureItems, pageItems, routeExists, searchItems, type IndexEntry, type PaletteGroup, type PaletteItem,
} from "@/lib/commandSearch";

const GROUP_ICON: Record<PaletteGroup, React.ComponentType<{ className?: string }>> = {
  Pages: LayoutGrid,
  "Features & buttons": MousePointerClick,
  Records: Database,
  Commands: PlusCircle,
};

/**
 * Ctrl+K: search the whole system the user can use (featureslist §11) — every menu and sub-menu
 * page of their subscribed modules, every feature and button described in the knowledge base,
 * records (products…) and quick commands. Only what their subscription and permissions allow.
 */
export const GlobalCommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const drawer = useRecordDrawer();
  const { isCommandPaletteOpen, setIsCommandPaletteOpen, switchModule, isModuleSubscribed } = useERPModules();
  const { hasPermission, hasAnyPermission } = useAuth();
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<PaletteItem[]>([]);
  const [searchingRecords, setSearchingRecords] = useState(false);

  const close = () => {
    setIsCommandPaletteOpen(false);
    setQuery("");
    setRecords([]);
  };
  const go = (url: string) => {
    close();
    navigate(url);
  };

  const index = useQuery({
    queryKey: ["me", "search-index"],
    queryFn: () => api.get<IndexEntry[]>("/me/search-index"),
    enabled: isCommandPaletteOpen,
    staleTime: 10 * 60 * 1000,
  });

  const commands = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];
    for (const m of Object.values(ALL_ERP_MODULES)) {
      if (!isModuleSubscribed(m.key)) continue;
      list.push({ id: `module:${m.key}`, group: "Commands", label: `Open ${m.label}`, hint: m.description, keywords: "switch module app", run: () => { close(); switchModule(m.key); } });
    }
    if (isModuleSubscribed("products") && hasPermission("create_products")) {
      list.push({ id: "cmd:new-product", group: "Commands", label: "New product", hint: "Products", keywords: "create add item", run: () => go("/products?new=1") });
    }
    list.push({ id: "cmd:appearance", group: "Commands", label: "Appearance settings", hint: "Theme and layout", keywords: "dark light theme", run: () => go("/settings/appearance") });
    return list.filter((c) => !c.id.startsWith("cmd:appearance") || routeExists(APP_ROUTES, "/settings/appearance"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModuleSubscribed, hasPermission]);

  const staticItems = useMemo<PaletteItem[]>(() => {
    const known = (k: string) => k in ALL_ERP_MODULES;
    const label = (k: string) => (ALL_ERP_MODULES as Record<string, { label: string }>)[k]?.label ?? k;
    return [
      ...pageItems(MODULE_NAV_CONFIGS, label, { isModuleSubscribed, hasAnyPermission, routes: APP_ROUTES }, go),
      ...featureItems(index.data ?? [], { isModuleSubscribed, isKnownModule: known, routes: APP_ROUTES }, go),
      ...commands,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index.data, isModuleSubscribed, hasAnyPermission, commands]);

  // Records (products…): every registered record type the user may view, searched on the server.
  useEffect(() => {
    const q = query.trim();
    if (!isCommandPaletteOpen || q.length < 2) {
      setRecords([]);
      return;
    }
    let alive = true;
    const t = window.setTimeout(async () => {
      const defs = allEntities().filter((d) => entityAccess(d, { hasPermission, isModuleSubscribed }).canView);
      setSearchingRecords(true);
      const found = await Promise.all(
        defs.map((d) =>
          d.search(q).then((rows) =>
            rows.slice(0, 5).map((r): PaletteItem => {
              const o = d.toOption(r);
              return {
                id: `record:${d.type}:${o.id}`, group: "Records", label: o.label, hint: `${d.label}${o.description ? ` · ${o.description}` : ""}`,
                keywords: q, run: () => { close(); drawer.open({ type: d.type, mode: "edit", id: o.id, title: d.label }); },
              };
            }),
          ).catch(() => []),
        ),
      );
      if (alive) {
        setRecords(found.flat());
        setSearchingRecords(false);
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isCommandPaletteOpen]);

  const results = useMemo(() => searchItems([...staticItems, ...records], query), [staticItems, records, query]);

  if (!isCommandPaletteOpen) return null;
  const empty = !query.trim();

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="fixed inset-0" onClick={close} />
      <div className="relative w-[92vw] sm:w-full max-w-2xl mx-auto overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-scaleUp">
        <Command className="w-full" shouldFilter={false} onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
          <div className="flex items-center px-4 border-b border-border bg-surface-1">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-3" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, buttons, products, settings… (ESC to close)"
              className="w-full py-4 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
            />
            {(index.isFetching || searchingRecords) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <kbd className="hidden sm:inline-block ml-2 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">ESC</kbd>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-3 text-sm space-y-2">
            {empty ? (
              <Command.Group heading="Go to" className="text-xs font-semibold uppercase text-muted-foreground px-2 py-1">
                {commands.map((c) => (
                  <Command.Item key={c.id} value={c.id} onSelect={c.run}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary text-foreground">
                    {c.id.startsWith("module:") ? <FileText className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                    <span className="font-medium text-xs">{c.label}</span>
                    {c.hint && <span className="ml-2 text-[11px] text-muted-foreground truncate">{c.hint}</span>}
                  </Command.Item>
                ))}
                <p className="px-3 pt-2 text-[11px] normal-case font-normal text-muted-foreground">
                  Type to search every page, button and record you can use.
                </p>
              </Command.Group>
            ) : results.length === 0 && !searchingRecords ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Nothing matches “{query.trim()}”.</p>
            ) : (
              results.map((g) => {
                const Icon = GROUP_ICON[g.group];
                return (
                  <Command.Group key={g.group} heading={g.group} className="text-xs font-semibold uppercase text-muted-foreground px-2 py-1">
                    {g.items.map((it) => (
                      <Command.Item key={it.id} value={it.id} onSelect={it.run}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary text-foreground normal-case">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="font-medium text-xs">{it.label}</span>
                        {it.hint && <span className="ml-auto pl-2 text-[11px] font-normal text-muted-foreground truncate max-w-[55%]">{it.hint}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
