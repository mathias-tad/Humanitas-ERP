import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useERPModules, ALL_ERP_MODULES, type ERPModuleKey } from "@/context/ModuleContext";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Package,
  Boxes,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Calculator,
  Bot,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FileText,
  Key,
  Calendar,
  CalendarClock,
  Megaphone,
  CalendarDays,
  Computer,
  FolderKanban,
  CheckSquare,
  Clock,
  Shield,
  Layers,
  QrCode,
  Tag,
  Warehouse,
  Truck,
  Receipt,
  FileSpreadsheet,
  BookOpen,
  PieChart,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  permissions?: string[];
  badge?: string;
}

export interface ModuleNavConfig {
  moduleKey: ERPModuleKey;
  sections: {
    title: string;
    items: NavItem[];
  }[];
}

// Module-specific sub-navigation trees
const MODULE_NAV_CONFIGS: Record<ERPModuleKey, { title: string; items: NavItem[] }[]> = {
  hrms: [
    {
      title: "Workforce",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
        { title: "Directory", url: "/accounts", icon: Users, permissions: ["view_users"] },
        { title: "Recruitment (ATS)", url: "/recruitment", icon: UserPlus, permissions: ["manage_recruitment", "view_hrm_settings"] },
        { title: "Attendance", url: "/attendance", icon: Clock },
        { title: "Leaves", url: "/leave", icon: CalendarDays },
        { title: "Shifts & Roster", url: "/scheduling", icon: CalendarClock },
        { title: "Payroll", url: "/payroll/dashboard", icon: Calculator },
        { title: "Loans & Per Diem", url: "/loans", icon: CreditCard },
      ],
    },
    {
      title: "Organization",
      items: [
        { title: "Announcements", url: "/announcements", icon: Megaphone },
        { title: "Calendar", url: "/calendar", icon: Calendar },
        { title: "Biometric Devices", url: "/devices", icon: Computer },
        { title: "Access Control", url: "/accesscontrol", icon: Key, permissions: ["view_roles"] },
        { title: "HR Reports", url: "/hrms/reports", icon: PieChart },
        { title: "HR Settings", url: "/settings/general", icon: Settings },
      ],
    },
  ],

  pms: [
    {
      title: "Projects & Sprints",
      items: [
        { title: "PMS Dashboard", url: "/pms/dashboard", icon: BarChart3 },
        { title: "All Projects", url: "/pms/projects", icon: FolderKanban },
        { title: "My Tasks", url: "/pms/my-tasks", icon: CheckSquare },
        { title: "Team Boards", url: "/pms/teams", icon: Users },
        { title: "Review Queue", url: "/pms/review-queue", icon: Shield },
      ],
    },
    {
      title: "Analytics & Config",
      items: [
        { title: "PMS Reports", url: "/pms/reports", icon: PieChart },
        { title: "PMS Settings", url: "/pms/settings", icon: Settings },
      ],
    },
  ],

  products: [
    {
      title: "Catalog",
      items: [
        { title: "All Products", url: "/products", icon: Package },
        { title: "Categories & Trees", url: "/products/categories", icon: Layers },
        { title: "Price Lists", url: "/products/pricelists", icon: Tag },
        { title: "QR & Barcode Studio", url: "/products/qr-studio", icon: QrCode },
      ],
    },
    {
      title: "Catalog Insights",
      items: [
        { title: "Product Reports", url: "/products/reports", icon: PieChart },
        { title: "Product Settings", url: "/products/settings", icon: Settings },
      ],
    },
  ],

  inventory: [
    {
      title: "Warehouse Operations",
      items: [
        { title: "Stock Overview", url: "/inventory", icon: Boxes },
        { title: "Warehouses & Bins", url: "/inventory/warehouses", icon: Warehouse },
        { title: "Stock Movements", url: "/inventory/movements", icon: Truck },
        { title: "Batches & Expiry", url: "/inventory/batches", icon: Clock },
        { title: "Stocktake Audits", url: "/inventory/stocktakes", icon: CheckSquare },
      ],
    },
    {
      title: "Valuation & Config",
      items: [
        { title: "FIFO / AVCO Valuation", url: "/inventory/valuation", icon: Calculator },
        { title: "Inventory Reports", url: "/inventory/reports", icon: PieChart },
        { title: "Inventory Settings", url: "/inventory/settings", icon: Settings },
      ],
    },
  ],

  purchasing: [
    {
      title: "Procurement",
      items: [
        { title: "Purchasing Dashboard", url: "/purchasing", icon: BarChart3 },
        { title: "Vendors Directory", url: "/purchasing/vendors", icon: Users },
        { title: "Requisitions (PR)", url: "/purchasing/requisitions", icon: FileText },
        { title: "Purchase Orders (PO)", url: "/purchasing/orders", icon: ShoppingCart },
        { title: "Goods Receipts (GRN)", url: "/purchasing/receipts", icon: Boxes },
        { title: "3-Way Match Bills", url: "/purchasing/bills", icon: Receipt },
      ],
    },
    {
      title: "Vendor Intelligence",
      items: [
        { title: "Purchasing Reports", url: "/purchasing/reports", icon: PieChart },
        { title: "Purchasing Settings", url: "/purchasing/settings", icon: Settings },
      ],
    },
  ],

  sales: [
    {
      title: "Sales & Invoicing",
      items: [
        { title: "Sales Overview", url: "/sales", icon: BarChart3 },
        { title: "Customers & Leads", url: "/sales/customers", icon: Users },
        { title: "Quotations", url: "/sales/quotations", icon: FileText },
        { title: "Sales Orders (SO)", url: "/sales/orders", icon: TrendingUp },
        { title: "Delivery Orders", url: "/sales/deliveries", icon: Truck },
        { title: "Sales Invoices", url: "/sales/invoices", icon: Receipt },
      ],
    },
    {
      title: "Performance & CRM",
      items: [
        { title: "Sales Reports", url: "/sales/reports", icon: PieChart },
        { title: "Sales Settings", url: "/sales/settings", icon: Settings },
      ],
    },
  ],

  pos: [
    {
      title: "Point of Sale",
      items: [
        { title: "Register Terminal", url: "/pos", icon: CreditCard, badge: "Live POS" },
        { title: "Active Sessions", url: "/pos/sessions", icon: Clock },
        { title: "Sales History", url: "/pos/transactions", icon: Receipt },
        { title: "Cash Float & Z-Reports", url: "/pos/z-reports", icon: Calculator },
      ],
    },
    {
      title: "POS Management",
      items: [
        { title: "POS Reports", url: "/pos/reports", icon: PieChart },
        { title: "POS Settings", url: "/pos/settings", icon: Settings },
      ],
    },
  ],

  accounting: [
    {
      title: "General Ledger",
      items: [
        { title: "Financial Dashboard", url: "/accounting", icon: BarChart3 },
        { title: "Chart of Accounts", url: "/accounting/accounts", icon: BookOpen },
        { title: "Journal Entries", url: "/accounting/journals", icon: FileSpreadsheet },
        { title: "Accounts Receivable", url: "/accounting/receivables", icon: TrendingUp },
        { title: "Accounts Payable", url: "/accounting/payables", icon: ShoppingCart },
        { title: "Bank Reconciliation", url: "/accounting/bank-rec", icon: CheckSquare },
      ],
    },
    {
      title: "Financial Statements",
      items: [
        { title: "Balance Sheet", url: "/accounting/reports/balance-sheet", icon: Calculator },
        { title: "Profit & Loss (P&L)", url: "/accounting/reports/pnl", icon: PieChart },
        { title: "Trial Balance", url: "/accounting/reports/trial-balance", icon: FileText },
        { title: "Accounting Settings", url: "/accounting/settings", icon: Settings },
      ],
    },
  ],

  ai: [
    {
      title: "AI Intelligence",
      items: [
        { title: "AI Assistant", url: "/ai", icon: Bot, badge: "AI" },
        { title: "Document Generator", url: "/ai/documents", icon: FileText },
        { title: "Knowledge Registry", url: "/ai/knowledge", icon: BookOpen },
        { title: "AI Action Logs", url: "/ai/actions", icon: Shield },
      ],
    },
    {
      title: "AI Configuration",
      items: [
        { title: "AI Capability Settings", url: "/ai/settings", icon: Settings },
      ],
    },
  ],

  system: [
    {
      title: "Diagnostics & Logs",
      items: [
        { title: "System Health", url: "/system-logs", icon: Activity },
        { title: "Audit Trail", url: "/audit-logs", icon: Shield },
        { title: "Access Control", url: "/accesscontrol", icon: Key },
        { title: "Appearance Settings", url: "/settings/appearance", icon: Settings },
      ],
    },
  ],
};

export const ContextualModuleDock: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {
    activeModule,
    setIsAppLauncherOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  } = useERPModules();
  const { hasPermission } = useAuth();
  const location = useLocation();

  const currentModule = ALL_ERP_MODULES[activeModule] || ALL_ERP_MODULES.hrms;
  const navSections = MODULE_NAV_CONFIGS[activeModule] || MODULE_NAV_CONFIGS.hrms;
  const ModuleIcon = currentModule.icon;

  const content = (
    <div className="flex flex-col h-full w-full select-none bg-dock-bg border-r border-dock-border">
      {/* Top App Header & App Launcher Trigger */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-dock-border bg-surface-1">
        {(!isCollapsed || isMobileSidebarOpen) && (
          <div
            onClick={() => {
              setIsAppLauncherOpen(true);
              setIsMobileSidebarOpen(false);
            }}
            className="flex items-center gap-2.5 cursor-pointer group flex-1 min-w-0"
            title="Open App Launcher (9-Dots)"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <ModuleIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {currentModule.shortLabel}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                Click to switch app
              </p>
            </div>
          </div>
        )}

        {isCollapsed && !isMobileSidebarOpen && (
          <button
            onClick={() => setIsAppLauncherOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-2 text-primary transition-colors mx-auto"
            title="Open App Launcher (9-Dots)"
          >
            <ModuleIcon className="h-5 w-5" />
          </button>
        )}

        {/* Mobile Close Button / Desktop Collapse Toggle */}
        {isMobileSidebarOpen ? (
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`h-6 w-6 hidden md:flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors ${
              isCollapsed ? "hidden" : "flex"
            }`}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Links (Grouped by section) */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navSections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => {
            if (!item.permissions || item.permissions.length === 0) return true;
            return item.permissions.some((p) => hasPermission(p));
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              {(!isCollapsed || isMobileSidebarOpen) && (
                <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {section.title}
                </p>
              )}

              <div className="space-y-0.5">
                {visibleItems.map((item, iIdx) => {
                  const Icon = item.icon;
                  const isActive =
                    item.url === "/dashboard"
                      ? location.pathname === "/dashboard"
                      : location.pathname.startsWith(item.url);

                  return (
                    <NavLink
                      key={iIdx}
                      to={item.url}
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-xl text-xs font-medium transition-all ${
                        isCollapsed && !isMobileSidebarOpen
                          ? "h-10 w-10 justify-center mx-auto"
                          : "px-3 py-2.5 w-full"
                      } ${
                        isActive
                          ? "gold-gradient font-bold shadow-sm shadow-amber-500/20 text-slate-950"
                          : "text-foreground/80 hover:bg-surface-2 hover:text-foreground"
                      }`}
                      title={isCollapsed && !isMobileSidebarOpen ? item.title : undefined}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-slate-950" : "text-muted-foreground"}`} />

                      {(!isCollapsed || isMobileSidebarOpen) && (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-[9px] font-bold">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pinned Bottom Controls */}
      <div className="border-t border-dock-border p-2 bg-surface-1/50 space-y-1">
        {isCollapsed && !isMobileSidebarOpen ? (
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 mx-auto"
            title="Expand Sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="px-2 py-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">Humanitas ERP v2.0</span>
            <span className="font-semibold text-primary">Live</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Static Rail) */}
      <aside
        className={`hidden md:flex flex-col h-screen border-r border-dock-border select-none transition-all duration-200 z-30 shrink-0 ${
          isCollapsed ? "w-[64px]" : "w-[240px]"
        }`}
      >
        {content}
      </aside>

      {/* Mobile Drawer (Slide-Over with Backdrop) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-fadeIn">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative flex flex-col w-[280px] max-w-[85vw] h-full shadow-2xl z-10 animate-slideRight">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
