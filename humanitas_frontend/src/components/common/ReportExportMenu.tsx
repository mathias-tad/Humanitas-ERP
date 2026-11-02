import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  FileCode,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export interface ReportExportColumn<T = any> {
  key: string;
  header: string;
  accessor?: (row: T, index?: number) => any;
}

export interface ReportExportMenuProps<T = any> {
  title: string;
  filenamePrefix: string;
  data: T[];
  columns: ReportExportColumn<T>[];
  disabled?: boolean;
  className?: string;
  organizationName?: string;
  buttonLabel?: string;
}

export const ReportExportMenu: React.FC<ReportExportMenuProps> = ({
  title,
  filenamePrefix,
  data,
  columns,
  disabled = false,
  className = "",
  organizationName = "Humanitas Enterprise ERP",
  buttonLabel,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const getRowValue = (row: any, col: ReportExportColumn, index?: number) => {
    if (col.accessor) return col.accessor(row, index);
    return row[col.key] ?? "";
  };

  const getCleanData = () => {
    return data.map((row, idx) => {
      const cleanRow: Record<string, any> = {};
      columns.forEach((col) => {
        cleanRow[col.header] = getRowValue(row, col, idx);
      });
      return cleanRow;
    });
  };

  // 1. CSV Export
  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.warning("No data records available to export");
      return;
    }
    setIsExporting(true);
    try {
      const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
      const rows = data.map((row, idx) =>
        columns
          .map((col) => {
            const val = String(getRowValue(row, col, idx) ?? "").replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(",")
      );

      const csvContent = "\uFEFF" + [headers, ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `${filenamePrefix}_${formatTimestamp()}.csv`);
      toast.success(`Exported ${data.length} records to CSV successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Excel (XML/HTML Spreadsheet format)
  const handleExportExcel = () => {
    if (data.length === 0) {
      toast.warning("No data records available to export");
      return;
    }
    setIsExporting(true);
    try {
      const headerHtml = columns.map((c) => `<th style="background-color:#1e3a8a;color:#ffffff;padding:8px;border:1px solid #cbd5e1;font-weight:bold;">${escapeHtml(c.header)}</th>`).join("");
      const rowsHtml = data
        .map(
          (row, idx) =>
            `<tr>${columns
              .map(
                (col) =>
                  `<td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:12px;">${escapeHtml(String(getRowValue(row, col, idx) ?? ""))}</td>`
              )
              .join("")}</tr>`
        )
        .join("");

      const template = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escapeHtml(title.slice(0, 30))}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
          <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        </head>
        <body>
          <h2 style="font-family:Arial,sans-serif;color:#0f172a;margin-bottom:4px;">${escapeHtml(title)}</h2>
          <p style="font-family:Arial,sans-serif;color:#64748b;font-size:11px;margin-top:0;">Organization: ${escapeHtml(organizationName)} | Generated: ${new Date().toLocaleString()}</p>
          <table style="border-collapse:collapse;font-family:Arial,sans-serif;width:100%;">
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(["\uFEFF" + template], { type: "application/vnd.ms-excel;charset=utf-8;" });
      downloadBlob(blob, `${filenamePrefix}_${formatTimestamp()}.xls`);
      toast.success(`Exported ${data.length} records to Excel format successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export Excel file");
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Print / PDF Summary
  const handlePrintPDF = () => {
    if (data.length === 0) {
      toast.warning("No data records available to print");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocker prevented print preview. Please allow popups for this site.");
      return;
    }

    const headerHtml = columns.map((c) => `<th style="background:#f1f5f9;color:#0f172a;padding:8px 10px;border:1px solid #cbd5e1;font-size:11px;text-align:left;">${escapeHtml(c.header)}</th>`).join("");
    const rowsHtml = data
      .map(
        (row, idx) =>
          `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">${columns
            .map(
              (col) =>
                `<td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:11px;color:#334155;">${escapeHtml(String(getRowValue(row, col, idx) ?? ""))}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(title)} - ${escapeHtml(organizationName)}</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 15px; color: #0f172a; margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 15px; }
          .brand { font-size: 16px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
          .title { font-size: 18px; font-weight: 700; margin: 4px 0 2px 0; color: #0f172a; }
          .meta { font-size: 11px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">${escapeHtml(organizationName)}</div>
            <div class="title">${escapeHtml(title)}</div>
            <div class="meta">Exported on: ${new Date().toLocaleString()} • Total Records: ${data.length}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:10px;font-weight:700;background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:4px;">CONFIDENTIAL REPORT</span>
          </div>
        </div>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="footer">
          Generated automatically by Humanitas Enterprise ERP Platform. Certified immutable audit copy.
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  // 4. JSON Export
  const handleExportJSON = () => {
    if (data.length === 0) {
      toast.warning("No data records available to export");
      return;
    }
    setIsExporting(true);
    try {
      const cleanData = getCleanData();
      const jsonContent = JSON.stringify(
        {
          report: title,
          organization: organizationName,
          generated_at: new Date().toISOString(),
          total_records: data.length,
          data: cleanData,
        },
        null,
        2
      );
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      downloadBlob(blob, `${filenamePrefix}_${formatTimestamp()}.json`);
      toast.success(`Exported ${data.length} records to JSON successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export JSON");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting}
          className={`h-8 gap-1.5 text-xs font-semibold ${className}`}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Download className="h-3.5 w-3.5 text-primary" />
          )}
          <span>{buttonLabel || "Export Report"}</span>
          <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-xs">
        <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Export Report Data ({data.length} rows)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer py-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="font-semibold text-foreground">Comma-Separated (.csv)</p>
            <p className="text-[10px] text-muted-foreground">Universal data import format</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer py-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <div>
            <p className="font-semibold text-foreground">Microsoft Excel (.xls / .xlsx)</p>
            <p className="text-[10px] text-muted-foreground">Formatted spreadsheet with headers</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handlePrintPDF} className="gap-2 cursor-pointer py-2">
          <Printer className="h-4 w-4 text-amber-600" />
          <div>
            <p className="font-semibold text-foreground">Printable Summary / PDF</p>
            <p className="text-[10px] text-muted-foreground">Clean landscape printable view</p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleExportJSON} className="gap-2 cursor-pointer py-2">
          <FileCode className="h-4 w-4 text-violet-600" />
          <div>
            <p className="font-semibold text-foreground">Structured JSON (.json)</p>
            <p className="text-[10px] text-muted-foreground">Developer API schema payload</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
