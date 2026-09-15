import React from "react";
import { useNavigate } from "react-router-dom";
import { ALL_ERP_MODULES, type ERPModuleKey } from "@/context/ModuleContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Sparkles,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Lock,
  Layers,
} from "lucide-react";

interface ComingSoonModulePageProps {
  moduleKey: ERPModuleKey;
  subSectionTitle?: string;
  plannedFeatures?: string[];
}

const MODULE_FEATURE_HIGHLIGHTS: Record<ERPModuleKey, string[]> = {
  products: [
    "Multi-level Product Categories with nested hierarchies",
    "Dynamic Variant Matrix generator (Size, Color, Style, Material)",
    "Cryptographic QR and Barcode generation (Code-128, EAN-13)",
    "Multi-UOM Engine with automatic conversion factors",
    "Multi-tier Price Lists (VIP, Wholesale, Retail, Distributor)",
    "Digital datasheets and technical manual attachments",
  ],
  inventory: [
    "Multi-Warehouse Hierarchy (Warehouse -> Zone -> Aisle -> Rack -> Bin)",
    "Real-time Stock Quant tracking and movement audit ledger",
    "FIFO and AVCO cost queue calculation via Python engine",
    "Batch, Lot and Expiration date tracking with automated FEFO picking",
    "Serial Number cradle-to-grave lifecycle tracking",
    "Cycle counts, blind stocktaking and inter-warehouse transfers",
  ],
  purchasing: [
    "Vendor directory, tax registration and performance scorecards",
    "Purchase Requisitions (PR) with department budget validation",
    "Request for Quotation (RFQ) side-by-side vendor bid comparison",
    "Automated 3-Way Matching Engine (PO == GRN == Vendor Bill)",
    "Landed Cost distribution (Freight, Customs, Insurance) on receipts",
    "Debit Notes, Return to Vendor and RMA tracking",
  ],
  sales: [
    "Lead capture and interactive Kanban sales opportunity pipeline",
    "Professional quotation builder with digital customer sign-off",
    "Sales Orders (SO) with stock reservation and credit limit checks",
    "Warehouse Delivery Orders (DO) with QR scan dispatch validation",
    "Regulatory E-Invoicing with tamper-proof cryptographic fiscalization",
    "Automated multi-rate tax engine and sales rep commission tracking",
  ],
  pos: [
    "Multi-register and branch architecture with PIN user switching",
    "High-velocity touch catalog and instant hardware barcode scanning",
    "Integrated Telebirr dynamic QR code payment checkout",
    "Cash float control, mid-shift safe drops and automated Z-Reports",
    "Offline-first resilience with IndexedDB and background sync",
    "ESC/POS thermal receipt printing and restaurant table management",
  ],
  accounting: [
    "Multi-tier Chart of Accounts (COA) with localized templates",
    "Double-Entry General Ledger with automated operational sub-ledger postings",
    "Fixed Asset Management with Straight-Line and Declining Balance depreciation",
    "Multi-Company and Branch financial consolidation with elimination journals",
    "Real-Time Balance Sheet, P&L, Cash Flow and Trial Balance (Python powered)",
    "Bank reconciliation with CSV/OFX statement parsing and rule matching",
  ],
  ai: [
    "AI Copilot answering operational queries via live AI Knowledge Base",
    "Template-Cloning Document Engine rendering PDF and DOCX reports",
    "AI Action Executor performing authorized ERP tasks safely under RBAC",
    "Employee lifecycle attrition prediction and performance analytics",
    "Predictive inventory reorder forecasting and demand planning",
    "Executive financial anomaly detection and automated commentary",
  ],
  hrms: [
    "Comprehensive digital employee lifecycle and reporting hierarchy",
    "Biometric device integration (ZKTeco and Hikvision) + mobile geofencing",
    "Cursor-based attendance processing for 100,000+ employees",
    "Python-powered payroll calculation with progressive statutory tax brackets",
    "Recruitment ATS with candidate Kanban and automated employee provisioning",
    "Automated leave accruals, overtime approvals and travel per diem claims",
  ],
  pms: [
    "Multi-project portfolio with health tracking and budget burn rate",
    "Agile Sprints, Backlog planning and burndown/burnup velocity charts",
    "Interactive Kanban board with WIP limits and Gantt timeline with critical paths",
    "Live stopwatch task timers with billable timesheet-to-invoice conversion",
    "Python-computed employee KPI and quarterly appraisal scores",
    "Review Queues and Task sign-off approvals",
  ],
  system: [
    "Real-time microservice health indicators (API, Python, AI, WebSockets)",
    "Failed Celery/Procrastinate job queue viewer with 1-click task retry",
    "API error logs with request/response payloads and stack traces",
    "Database connection pool diagnostics and slow query monitor",
    "Immutable audit trail tracking all create, update and delete transactions",
    "Tenant admin operational alerts and webhook notifications",
  ],
};

export const ComingSoonModulePage: React.FC<ComingSoonModulePageProps> = ({
  moduleKey,
  subSectionTitle,
  plannedFeatures,
}) => {
  const navigate = useNavigate();
  const moduleInfo = ALL_ERP_MODULES[moduleKey] || {
    label: "Enterprise Module",
    description: "This enterprise module is currently under active development.",
    icon: Layers,
    color: "text-primary",
    bgLight: "bg-primary/10",
  };

  const IconComponent = moduleInfo.icon;
  const features = plannedFeatures || MODULE_FEATURE_HIGHLIGHTS[moduleKey] || [];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden p-4 md:p-8">
      {/* Background Mockup Skeleton Layer (Blurred Underneath) */}
      <div className="pointer-events-none select-none opacity-30 blur-sm transition-opacity dark:opacity-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl border bg-card p-6 shadow-sm">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-32 rounded bg-muted" />
              <div className="mt-2 h-3 w-40 rounded bg-muted" />
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="col-span-2 h-80 rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex justify-between">
              <div className="h-5 w-48 rounded bg-muted" />
              <div className="h-8 w-24 rounded bg-muted" />
            </div>
            <div className="mt-6 space-y-3">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="flex h-10 items-center justify-between rounded bg-muted/40 px-4">
                  <div className="h-3 w-28 rounded bg-muted" />
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-1 h-80 rounded-xl border bg-card p-6 shadow-sm">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="mt-8 flex h-48 items-center justify-center rounded-lg bg-muted/30">
              <div className="h-32 w-32 rounded-full border-8 border-muted/50" />
            </div>
          </div>
        </div>
      </div>

      {/* Rule 13: Frosted Backdrop Blur Overlay and Coming Soon Card */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-md p-4">
        <Card className="w-full max-w-2xl border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/40 shadow-inner">
              <IconComponent className={"h-8 w-8 " + (moduleInfo.color || "text-primary")} />
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge variant="default" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30 px-3 py-1 font-semibold text-xs tracking-wider uppercase">
                <Clock className="mr-1.5 h-3.5 w-3.5 animate-pulse text-amber-500" />
                Coming Soon
              </Badge>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Enterprise ERP Tier
              </Badge>
            </div>

            <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight">
              {subSectionTitle ? subSectionTitle + " (" + moduleInfo.shortLabel + ")" : moduleInfo.label}
            </CardTitle>
            <CardDescription className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto mt-2">
              {moduleInfo.description}. This enterprise feature is currently in production and will be rolled out according to the system roadmap.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-2">
            {/* Planned Feature Capabilities */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Planned Enterprise Capabilities (featureslist.md)
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Navigation Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Requires Tenant Package Subscription</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => navigate("/dashboard")}
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Return to HR Dashboard
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => navigate("/features")}
                >
                  View ERP Feature List
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ComingSoonModulePage;
