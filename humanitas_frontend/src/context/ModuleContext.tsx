import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Briefcase,
  Package,
  Boxes,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Calculator,
  Bot,
  Activity,
  type LucideIcon,
} from "lucide-react";

export type ERPModuleKey =
  | "hrms"
  | "pms"
  | "products"
  | "inventory"
  | "purchasing"
  | "sales"
  | "pos"
  | "accounting"
  | "ai"
  | "system";

export interface ERPModuleInfo {
  key: ERPModuleKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  defaultRoute: string;
  color: string;
  badge?: string;
  bgLight: string;
  isCommon?: boolean;
}

export const ALL_ERP_MODULES: Record<ERPModuleKey, ERPModuleInfo> = {
  hrms: {
    key: "hrms",
    label: "Human Capital (HRMS)",
    shortLabel: "HRMS",
    description: "Employees, Attendance, Leave, Shifts & Payroll",
    icon: Users,
    defaultRoute: "/dashboard",
    color: "text-blue-600 dark:text-blue-400",
    bgLight: "bg-blue-500/10 dark:bg-blue-500/20",
  },
  pms: {
    key: "pms",
    label: "Projects & Tasks (PMS)",
    shortLabel: "PMS",
    description: "Sprints, Kanban Boards, Time Tracking & KPIs",
    icon: Briefcase,
    defaultRoute: "/pms/dashboard",
    color: "text-indigo-600 dark:text-indigo-400",
    bgLight: "bg-indigo-500/10 dark:bg-indigo-500/20",
  },
  products: {
    key: "products",
    label: "Products & Catalog",
    shortLabel: "Products",
    description: "Variants, Price Lists & Automated QR Codes",
    icon: Package,
    defaultRoute: "/products",
    color: "text-emerald-600 dark:text-emerald-400",
    bgLight: "bg-emerald-500/10 dark:bg-emerald-500/20",
  },
  inventory: {
    key: "inventory",
    label: "Inventory & Warehouses",
    shortLabel: "Inventory",
    description: "Multi-Location Stock, Batches & FIFO Valuation",
    icon: Boxes,
    defaultRoute: "/inventory",
    color: "text-amber-600 dark:text-amber-400",
    bgLight: "bg-amber-500/10 dark:bg-amber-500/20",
  },
  purchasing: {
    key: "purchasing",
    label: "Purchasing & Vendors",
    shortLabel: "Purchasing",
    description: "Vendor RFQs, Purchase Orders & 3-Way Match",
    icon: ShoppingCart,
    defaultRoute: "/purchasing",
    color: "text-purple-600 dark:text-purple-400",
    bgLight: "bg-purple-500/10 dark:bg-purple-500/20",
  },
  sales: {
    key: "sales",
    label: "Sales, CRM & Invoicing",
    shortLabel: "Sales",
    description: "Leads, Quotations, Sales Orders & Deliveries",
    icon: TrendingUp,
    defaultRoute: "/sales",
    color: "text-teal-600 dark:text-teal-400",
    bgLight: "bg-teal-500/10 dark:bg-teal-500/20",
  },
  pos: {
    key: "pos",
    label: "Point of Sale (POS)",
    shortLabel: "POS",
    description: "Rapid QR/Barcode Checkout, Shifts & Z-Reports",
    icon: CreditCard,
    defaultRoute: "/pos",
    color: "text-rose-600 dark:text-rose-400",
    bgLight: "bg-rose-500/10 dark:bg-rose-500/20",
  },
  accounting: {
    key: "accounting",
    label: "Financials & Accounting",
    shortLabel: "Accounting",
    description: "Double-Entry General Ledger, AR/AP & Reports",
    icon: Calculator,
    defaultRoute: "/accounting",
    color: "text-cyan-600 dark:text-cyan-400",
    bgLight: "bg-cyan-500/10 dark:bg-cyan-500/20",
  },
  ai: {
    key: "ai",
    label: "AI Intelligence Suite",
    shortLabel: "AI Suite",
    description: "AI Document Engine, Help & Automated Actions",
    icon: Bot,
    defaultRoute: "/ai",
    color: "text-violet-600 dark:text-violet-400",
    bgLight: "bg-violet-500/10 dark:bg-violet-500/20",
    badge: "AI Powered",
  },
  system: {
    key: "system",
    label: "System Health & Logs",
    shortLabel: "System",
    description: "Microservice Status, Failed Queues & Diagnostics",
    icon: Activity,
    defaultRoute: "/system-logs",
    color: "text-slate-600 dark:text-slate-400",
    bgLight: "bg-slate-500/10 dark:bg-slate-500/20",
    isCommon: true,
  },
};

interface ModuleContextType {
  activeModule: ERPModuleKey;
  setActiveModule: (moduleKey: ERPModuleKey) => void;
  isAppLauncherOpen: boolean;
  setIsAppLauncherOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  subscribedModules: ERPModuleKey[];
  isModuleSubscribed: (moduleKey: ERPModuleKey | string) => boolean;
  switchModule: (moduleKey: ERPModuleKey) => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant } = useAuth();

  // Active module state
  const [activeModule, setActiveModule] = useState<ERPModuleKey>("hrms");
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Subscribed modules for current tenant dynamically derived from tenant settings/package
  const subscribedModules = useMemo<ERPModuleKey[]>(() => {
    // If no features configured yet, enable all modules for dev/admin onboarding
    if (!tenant || !tenant.enabled_features || tenant.enabled_features.length === 0) {
      return [
        "hrms",
        "pms",
        "products",
        "inventory",
        "purchasing",
        "sales",
        "pos",
        "accounting",
        "ai",
        "system",
      ];
    }

    const feats = tenant.enabled_features.map((f) => f.toLowerCase());
    const result: ERPModuleKey[] = [];

    if (feats.some((f) => f === "hr" || f === "hrms" || f === "*")) result.push("hrms");
    if (feats.some((f) => f === "pms" || f === "*")) result.push("pms");
    if (feats.some((f) => f === "products" || f === "*")) result.push("products");
    if (feats.some((f) => f === "inventory" || f === "*")) result.push("inventory");
    if (feats.some((f) => f === "purchasing" || f === "*")) result.push("purchasing");
    if (feats.some((f) => f === "sales" || f === "*")) result.push("sales");
    if (feats.some((f) => f === "pos" || f === "*")) result.push("pos");
    if (feats.some((f) => f === "accounting" || f === "*")) result.push("accounting");
    if (feats.some((f) => f.startsWith("ai") || f === "*")) result.push("ai");
    result.push("system"); // System logs always accessible

    return result.length > 0
      ? result
      : ["hrms", "system"];
  }, [tenant]);

  // Synchronize active module based on current URL path
  useEffect(() => {
    const path = location.pathname.toLowerCase();

    if (path.startsWith("/pms")) {
      setActiveModule("pms");
    } else if (path.startsWith("/products")) {
      setActiveModule("products");
    } else if (path.startsWith("/inventory")) {
      setActiveModule("inventory");
    } else if (path.startsWith("/purchasing")) {
      setActiveModule("purchasing");
    } else if (path.startsWith("/sales")) {
      setActiveModule("sales");
    } else if (path.startsWith("/pos")) {
      setActiveModule("pos");
    } else if (path.startsWith("/accounting")) {
      setActiveModule("accounting");
    } else if (path.startsWith("/ai")) {
      setActiveModule("ai");
    } else if (path.startsWith("/system") || path.startsWith("/system-logs")) {
      setActiveModule("system");
    } else {
      setActiveModule("hrms");
    }
  }, [location.pathname]);

  // Keyboard shortcut Ctrl/Cmd + K for Global Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isModuleSubscribed = (key: ERPModuleKey | string): boolean => {
    const k = String(key).toLowerCase();
    // HRMS sub-modules inherit access from hrms package subscription
    if (["payroll", "attendance", "leave", "scheduling", "recruitment", "messaging"].includes(k)) {
      if (subscribedModules.includes(k as ERPModuleKey)) return true;
      return subscribedModules.includes("hrms");
    }
    return subscribedModules.includes(k as ERPModuleKey);
  };

  const switchModule = (key: ERPModuleKey) => {
    setActiveModule(key);
    setIsAppLauncherOpen(false);
    const targetModule = ALL_ERP_MODULES[key];
    if (targetModule) {
      navigate(targetModule.defaultRoute);
    }
  };

  return (
    <ModuleContext.Provider
      value={{
        activeModule,
        setActiveModule,
        isAppLauncherOpen,
        setIsAppLauncherOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        subscribedModules,
        isModuleSubscribed,
        switchModule,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
};

export const useERPModules = (): ModuleContextType => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error("useERPModules must be used within a ModuleProvider");
  }
  return context;
};
