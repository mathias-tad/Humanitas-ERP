import React from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { useERPModules, ALL_ERP_MODULES } from "@/context/ModuleContext";
import {
  Search,
  Settings,
  PlusCircle,
  CreditCard,
  FileText,
} from "lucide-react";

export const GlobalCommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    switchModule,
    isModuleSubscribed,
  } = useERPModules();

  const handleSelect = (callback: () => void) => {
    setIsCommandPaletteOpen(false);
    callback();
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div
        className="fixed inset-0"
        onClick={() => setIsCommandPaletteOpen(false)}
      />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-scaleUp">
        <Command className="w-full">
          {/* Search Input */}
          <div className="flex items-center px-4 border-b border-border bg-surface-1">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-3" />
            <Command.Input
              autoFocus
              placeholder="Type a command, page, or search records... (ESC to exit)"
              className="w-full py-4 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
            />
            <kbd className="hidden sm:inline-block rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Command List Results */}
          <Command.List className="max-h-96 overflow-y-auto p-3 text-sm space-y-2">
            <Command.Empty className="py-8 text-center text-xs text-muted-foreground">
              No matching commands or pages found.
            </Command.Empty>

            {/* Switch Module Group */}
            <Command.Group heading="Switch Workspace Application" className="text-xs font-semibold uppercase text-muted-foreground px-2 py-1">
              {Object.values(ALL_ERP_MODULES)
                .filter((m) => isModuleSubscribed(m.key))
                .map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <Command.Item
                      key={mod.key}
                      onSelect={() => handleSelect(() => switchModule(mod.key))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary transition-colors aria-selected:bg-primary/10 aria-selected:text-primary"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-xs">{mod.label}</span>
                        <span className="ml-2 text-[11px] text-muted-foreground truncate">{mod.description}</span>
                      </div>
                    </Command.Item>
                  );
                })}
            </Command.Group>

            {/* Quick Actions Group */}
            <Command.Group heading="Quick Create" className="text-xs font-semibold uppercase text-muted-foreground px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => handleSelect(() => navigate("/products/new"))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium">Create New Product & Generate QR</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate("/sales/quotations/new"))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-teal-500" />
                <span className="text-xs font-medium">Create Sales Quotation</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate("/purchasing/orders/new"))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium">Create Purchase Order</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate("/pos"))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <CreditCard className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-medium">Open POS Terminal</span>
              </Command.Item>
            </Command.Group>

            {/* Navigation Shortcuts */}
            <Command.Group heading="Navigation Shortcuts" className="text-xs font-semibold uppercase text-muted-foreground px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => handleSelect(() => navigate("/settings/appearance"))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span className="text-xs">Appearance & Theme Settings</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect(() => navigate("/system-logs"))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs">System Logs & Health Monitor</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Navigate with arrows</span>
              <span>•</span>
              <span>Enter to select</span>
            </div>
            <span>Global Search</span>
          </div>
        </Command>
      </div>
    </div>
  );
};
