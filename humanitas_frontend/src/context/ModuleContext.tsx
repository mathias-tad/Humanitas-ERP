import React, { createContext, useContext, useMemo } from "react";
import {
  Package,
  Boxes,
  ShoppingCart,
  TrendingUp,
  Store,
  Landmark,
  Sparkles,
  Users,
  FolderKanban,
  Server,
} from "lucide-react";

export type ERPModuleKey =
  | "products"
  | "inventory"
  | "purchasing"
  | "sales"
  | "pos"
  | "accounting"
  | "ai"
  | "hrms"
  | "pms"
  | "system";

export interface ERPModuleInfo {
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bgLight: string;
}

export const ALL_ERP_MODULES: Record<ERPModuleKey, ERPModuleInfo> = {
  products: {
    label: "Product Catalog & Matrix",
    shortLabel: "Products",
    description: "Multi-level categories, variant matrix generator, and barcode lifecycle engine.",
    icon: Package,
    color: "text-amber-500",
    bgLight: "bg-amber-500/10",
  },
  inventory: {
    label: "Warehouse & Stock Management",
    shortLabel: "Inventory",
    description: "Multi-warehouse hierarchy, stock quants, FIFO/AVCO valuations, and serial/lot tracking.",
    icon: Boxes,
    color: "text-blue-500",
    bgLight: "bg-blue-500/10",
  },
  purchasing: {
    label: "Procurement & Vendor Portal",
    shortLabel: "Purchasing",
    description: "Purchase requisitions, RFQs, 3-way matching, landed cost distribution, and vendor scorecards.",
    icon: ShoppingCart,
    color: "text-emerald-500",
    bgLight: "bg-emerald-500/10",
  },
  sales: {
    label: "Sales CRM & Order Pipeline",
    shortLabel: "Sales",
    description: "Opportunity Kanban pipeline, quotation builder, stock reservation, and e-invoicing.",
    icon: TrendingUp,
    color: "text-purple-500",
    bgLight: "bg-purple-500/10",
  },
  pos: {
    label: "Point of Sale & Retail Registers",
    shortLabel: "POS",
    description: "High-speed cashier touchscreen, Telebirr dynamic QR payments, offline sync, and ESC/POS receipts.",
    icon: Store,
    color: "text-rose-500",
    bgLight: "bg-rose-500/10",
  },
  accounting: {
    label: "Financial Ledger & Double-Entry",
    shortLabel: "Accounting",
    description: "Multi-tier chart of accounts, automated journal entries, bank reconciliations, and financial statements.",
    icon: Landmark,
    color: "text-cyan-500",
    bgLight: "bg-cyan-500/10",
  },
  ai: {
    label: "Enterprise AI Copilot",
    shortLabel: "AI Copilot",
    description: "Operational knowledge engine, document template cloning, attrition prediction, and anomaly detection.",
    icon: Sparkles,
    color: "text-yellow-500",
    bgLight: "bg-yellow-500/10",
  },
  hrms: {
    label: "Human Resource Management",
    shortLabel: "HRMS",
    description: "End-to-end employee lifecycle, biometric integrations, payroll processing, and leave workflows.",
    icon: Users,
    color: "text-indigo-500",
    bgLight: "bg-indigo-500/10",
  },
  pms: {
    label: "Project Management & Velocity",
    shortLabel: "PMS",
    description: "Agile sprints, backlog planning, Gantt timelines, billable task timers, and KPI scorecards.",
    icon: FolderKanban,
    color: "text-teal-500",
    bgLight: "bg-teal-500/10",
  },
  system: {
    label: "System Health & Audit Logs",
    shortLabel: "System",
    description: "Microservice diagnostics, Celery job retry queues, API error traces, and tamper-proof audit trails.",
    icon: Server,
    color: "text-slate-400",
    bgLight: "bg-slate-500/10",
  },
};

import { useAuth } from "./AuthContext";

export interface ModuleContextValue {
  enabledModules: Record<ERPModuleKey, boolean>;
  isModuleEnabled: (key: ERPModuleKey | string) => boolean;
  isModuleSubscribed: (key: ERPModuleKey | string) => boolean;
  isAiFeatureEnabled: (feature: 'help' | 'actions' | 'documents' | 'full') => boolean;
}

const ModuleContext = createContext<ModuleContextValue>({
  enabledModules: {
    hrms: false,
    pms: false,
    products: false,
    inventory: false,
    purchasing: false,
    sales: false,
    pos: false,
    accounting: false,
    ai: false,
    system: true,
  },
  isModuleEnabled: () => false,
  isModuleSubscribed: () => false,
  isAiFeatureEnabled: () => false,
});

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let authContext: any = null;
  try {
    authContext = useAuth();
  } catch {
    // Outside AuthProvider
  }
  const tenant = authContext?.tenant;

  const isAiFeatureEnabled = (feature: 'help' | 'actions' | 'documents' | 'full'): boolean => {
    const feats = tenant?.enabled_features?.map((f: string) => f.toLowerCase().trim()) || [];
    if (feats.includes('*') || feats.includes('ai') || feats.includes('ai.full')) {
      return true;
    }
    if (feature === 'help') {
      return feats.includes('ai.help') || feats.includes('ai.actions') || feats.includes('ai.documents');
    }
    if (feature === 'actions') {
      return feats.includes('ai.actions');
    }
    if (feature === 'documents') {
      return feats.includes('ai.documents');
    }
    if (feature === 'full') {
      return feats.includes('ai.full') || feats.includes('ai');
    }
    return false;
  };

  const isModuleSubscribed = (key: ERPModuleKey | string): boolean => {
    const k = String(key || "").toLowerCase().trim();
    if (!k) return false;

    // Core identity & infrastructure modules are always enabled
    const CORE_PLATFORM_MODULES = [
      "users",
      "system",
      "notifications",
      "auth",
      "settings",
      "presence",
      "announcements",
      "events",
    ];
    if (CORE_PLATFORM_MODULES.includes(k)) {
      return true;
    }

    const feats = tenant?.enabled_features?.map((f: string) => f.toLowerCase().trim()) || [];

    // Master wildcard allows all features
    if (feats.includes("*")) {
      return true;
    }

    // AI sub-feature capability check
    if (k.startsWith("ai")) {
      if (k === "ai" || k === "ai.help") {
        return isAiFeatureEnabled("help");
      }
      if (k === "ai.actions") {
        return isAiFeatureEnabled("actions");
      }
      if (k === "ai.documents") {
        return isAiFeatureEnabled("documents");
      }
      if (k === "ai.full") {
        return isAiFeatureEnabled("full");
      }
    }

    // Direct match against tenant package subscription
    if (feats.includes(k)) {
      return true;
    }

    // HRMS parent bundle access
    if (k === "hrms" && feats.some((f: string) => ["hrms", "hr", "attendance", "leave", "payroll"].includes(f))) {
      return true;
    }
    if (k === "hr" && feats.some((f: string) => ["hrms", "hr"].includes(f))) {
      return true;
    }

    // Full HRMS bundle unlocks standard HR workflows
    if (feats.includes("hrms") && ["attendance", "leave", "scheduling", "recruitment", "messaging"].includes(k)) {
      return true;
    }

    return false;
  };

  const isModuleEnabled = isModuleSubscribed;

  const enabledModules = useMemo(
    () => ({
      hrms: isModuleSubscribed("hrms"),
      pms: isModuleSubscribed("pms"),
      payroll: isModuleSubscribed("payroll"),
      attendance: isModuleSubscribed("attendance"),
      leave: isModuleSubscribed("leave"),
      scheduling: isModuleSubscribed("scheduling"),
      recruitment: isModuleSubscribed("recruitment"),
      ai: isModuleSubscribed("ai"),
      messaging: isModuleSubscribed("messaging"),
      system: true,
      products: false,
      inventory: false,
      purchasing: false,
      sales: false,
      pos: false,
      accounting: false,
    } as any),
    [tenant?.enabled_features],
  );

  return (
    <ModuleContext.Provider value={{ enabledModules, isModuleEnabled, isModuleSubscribed, isAiFeatureEnabled }}>
      {children}
    </ModuleContext.Provider>
  );
};

export const useModules = () => {
  const ctx = useContext(ModuleContext);
  return {
    ...ctx,
    isModuleSubscribed: ctx.isModuleSubscribed || ctx.isModuleEnabled,
    isAiFeatureEnabled: ctx.isAiFeatureEnabled,
  };
};

export const useERPModules = useModules;

