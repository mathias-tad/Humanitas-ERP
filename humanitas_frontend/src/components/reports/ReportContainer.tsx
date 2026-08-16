import React, { useState } from "react";
import { PageHeader, type BreadcrumbItem } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, FileSpreadsheet, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ReportContainerProps {
  title: string;
  description?: string;
  moduleName?: string;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
  onRefresh?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  actions?: React.ReactNode;
}

export const ReportContainer: React.FC<ReportContainerProps> = ({
  title,
  description,
  moduleName,
  breadcrumbs,
  children,
  onRefresh,
  onExportCsv,
  onExportPdf,
  actions,
}) => {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "ytd" | "all">("30d");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Header & Export Actions */}
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={
          breadcrumbs || [
            { label: moduleName || "Module", href: "#" },
            { label: "Reports" },
          ]
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Date Range Quick Selector */}
            <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs">
              <button
                onClick={() => setDateRange("7d")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  dateRange === "7d"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setDateRange("30d")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  dateRange === "30d"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setDateRange("90d")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  dateRange === "90d"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Quarter
              </button>
              <button
                onClick={() => setDateRange("ytd")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  dateRange === "ytd"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                YTD
              </button>
            </div>

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="h-8 gap-1.5 text-xs font-medium"
                title="Refresh Report Data"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            )}

            {/* Universal Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={onExportCsv || (() => window.print())}
                  className="gap-2 cursor-pointer text-xs"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Export to CSV / Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onExportPdf || (() => window.print())}
                  className="gap-2 cursor-pointer text-xs"
                >
                  <FileText className="h-4 w-4 text-rose-600" />
                  <span>Export to PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {actions}
          </div>
        }
      />

      {/* Main Report Dashboard Content */}
      <div className="space-y-6">{children}</div>
    </div>
  );
};
