import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALL_ERP_MODULES, useERPModules } from "@/context/ModuleContext";
import { Check, Sparkles, Layers } from "lucide-react";

export const AppLauncherModal: React.FC = () => {
  const {
    isAppLauncherOpen,
    setIsAppLauncherOpen,
    activeModule,
    switchModule,
    isModuleSubscribed,
  } = useERPModules();

  const moduleList = Object.values(ALL_ERP_MODULES).filter((m) =>
    isModuleSubscribed(m.key)
  );

  return (
    <Dialog open={isAppLauncherOpen} onOpenChange={setIsAppLauncherOpen}>
      <DialogContent className="sm:max-w-2xl bg-card border-border shadow-2xl p-6">
        <DialogHeader className="pb-4 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Humanitas ERP Applications
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Switch instantly between your organization's subscribed modules
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Grid of ERP Modules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4 max-h-[60vh] overflow-y-auto pr-1">
          {moduleList.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.key;

            return (
              <div
                key={mod.key}
                onClick={() => switchModule(mod.key)}
                className={`group relative flex items-start gap-3.5 rounded-xl border p-3.5 transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                    : "border-border/70 hover:border-border hover:bg-surface-1 hover:shadow-sm"
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${mod.bgLight}`}
                >
                  <Icon className={`h-5 w-5 ${mod.color}`} />
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {mod.label}
                    </span>
                    {mod.badge && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                        <Sparkles className="h-2.5 w-2.5" />
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                {isActive && (
                  <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
