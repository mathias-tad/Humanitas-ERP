import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  FileSpreadsheet,
  FileText,
  Printer,
  Trash2,
  Filter,
  Pin,
  MoveUp,
  MoveDown,
  X,
  RotateCcw,
  Rows,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export type FilterOperator =
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty";

export interface ColumnFilter {
  operator: FilterOperator;
  value: string;
}

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor?: (row: T) => any;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string | number;
  minWidth?: number;
  maxWidth?: number;
  hideable?: boolean;
  pinned?: "left" | "right" | false;
  filterable?: boolean;
}

export type GridDensity = "compact" | "normal" | "spacious";

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyField?: keyof T | string;
  title?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  selectable?: boolean;
  isLoading?: boolean;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  bulkActions?: (selectedRows: T[], clearSelection: () => void) => React.ReactNode;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  toolbarActions?: React.ReactNode;
  defaultDensity?: GridDensity;
  enableDensityToggle?: boolean;
  enableColumnReorder?: boolean;
  enableColumnResize?: boolean;
  enableColumnPinning?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns: initialColumns,
  data,
  keyField = "id",
  title,
  searchPlaceholder = "Search records...",
  searchable = true,
  filterable = true,
  exportable = true,
  selectable = true,
  isLoading = false,
  pageSizeOptions = [10, 25, 50, 100],
  initialPageSize = 25,
  bulkActions,
  emptyState,
  onRowClick,
  toolbarActions,
  defaultDensity = "normal",
  enableDensityToggle = true,
  enableColumnReorder = true,
  enableColumnResize = true,
  enableColumnPinning = true,
}: DataTableProps<T>) {
  // Density mode state (compact/dense, normal, spacious)
  const [density, setDensity] = useState<GridDensity>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("erp_datatable_density");
      if (saved === "compact" || saved === "normal" || saved === "spacious") {
        return saved;
      }
    }
    return defaultDensity;
  });

  const handleDensityChange = (newDensity: GridDensity) => {
    setDensity(newDensity);
    try {
      localStorage.setItem("erp_datatable_density", newDensity);
    } catch {}
  };

  // Column order & visibility
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    initialColumns.map((c) => c.key)
  );
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(new Set());

  // Column pinning (key -> 'left' | 'right')
  const [pinnedColumns, setPinnedColumns] = useState<Record<string, "left" | "right">>(() => {
    const initialPinned: Record<string, "left" | "right"> = {};
    initialColumns.forEach((c) => {
      if (c.pinned) initialPinned[c.key] = c.pinned;
    });
    return initialPinned;
  });

  // Column widths (key -> pixel width)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    initialColumns.forEach((c) => {
      if (typeof c.width === "number") {
        widths[c.key] = c.width;
      } else if (typeof c.width === "string" && c.width.endsWith("px")) {
        widths[c.key] = parseInt(c.width, 10);
      }
    });
    return widths;
  });

  // Active resizing column
  const resizingColRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Sorting
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Search & Multi-condition column filters
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({});

  // Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [selectAllAcrossPages, setSelectAllAcrossPages] = useState(false);

  // Synchronize column order if initialColumns changes
  useEffect(() => {
    setColumnOrder((prev) => {
      const keys = initialColumns.map((c) => c.key);
      const preserved = prev.filter((k) => keys.includes(k));
      const newKeys = keys.filter((k) => !preserved.includes(k));
      return [...preserved, ...newKeys];
    });
  }, [initialColumns]);

  // Map of column definitions by key
  const columnsMap = useMemo(() => {
    const map = new Map<string, ColumnDef<T>>();
    initialColumns.forEach((c) => map.set(c.key, c));
    return map;
  }, [initialColumns]);

  // Ordered & visible columns with pinning grouping
  const orderedVisibleColumns = useMemo(() => {
    const visible = columnOrder
      .map((key) => columnsMap.get(key))
      .filter((col): col is ColumnDef<T> => !!col && !hiddenColumnKeys.has(col.key));

    // Sort: left-pinned first, unpinned, then right-pinned
    const leftPinned: ColumnDef<T>[] = [];
    const unpinned: ColumnDef<T>[] = [];
    const rightPinned: ColumnDef<T>[] = [];

    visible.forEach((col) => {
      const pin = pinnedColumns[col.key];
      if (pin === "left") leftPinned.push(col);
      else if (pin === "right") rightPinned.push(col);
      else unpinned.push(col);
    });

    return [...leftPinned, ...unpinned, ...rightPinned];
  }, [columnOrder, columnsMap, hiddenColumnKeys, pinnedColumns]);

  // Column Resizing logic
  const handleResizeMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = columnWidths[key] || 150;
    resizingColRef.current = { key, startX: e.clientX, startWidth: currentWidth };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return;
      const { key: colKey, startX, startWidth } = resizingColRef.current;
      const deltaX = moveEvent.clientX - startX;
      const colDef = columnsMap.get(colKey);
      const min = colDef?.minWidth || 60;
      const max = colDef?.maxWidth || 1000;
      const newWidth = Math.max(min, Math.min(max, startWidth + deltaX));

      setColumnWidths((prev) => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      resizingColRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Column reordering handlers
  const moveColumn = (key: string, direction: "up" | "down") => {
    setColumnOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;

      const newOrder = [...prev];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      const [removed] = newOrder.splice(idx, 1);
      newOrder.splice(targetIdx, 0, removed);
      return newOrder;
    });
  };

  const togglePin = (key: string, pinType: "left" | "right") => {
    setPinnedColumns((prev) => {
      const current = prev[key];
      if (current === pinType) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: pinType };
    });
  };

  const resetColumns = () => {
    setColumnOrder(initialColumns.map((c) => c.key));
    setHiddenColumnKeys(new Set());
    const initialPinned: Record<string, "left" | "right"> = {};
    initialColumns.forEach((c) => {
      if (c.pinned) initialPinned[c.key] = c.pinned;
    });
    setPinnedColumns(initialPinned);
    setColumnWidths({});
  };

  // Multi-condition filtering evaluation
  const filteredData = useMemo(() => {
    let result = data;

    // 1. Global search term across all columns
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((row) =>
        initialColumns.some((col) => {
          const val = col.accessor ? col.accessor(row) : row[col.key];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(term);
        })
      );
    }

    // 2. Column-specific filters
    const activeFilters = Object.entries(columnFilters);
    if (activeFilters.length > 0) {
      result = result.filter((row) =>
        activeFilters.every(([key, filter]) => {
          const col = columnsMap.get(key);
          const rawVal = col?.accessor ? col.accessor(row) : row[key];
          const valStr = rawVal === null || rawVal === undefined ? "" : String(rawVal).toLowerCase();
          const targetStr = (filter.value || "").toLowerCase();

          switch (filter.operator) {
            case "contains":
              return valStr.includes(targetStr);
            case "equals":
              return valStr === targetStr;
            case "starts_with":
              return valStr.startsWith(targetStr);
            case "ends_with":
              return valStr.endsWith(targetStr);
            case "greater_than":
              return Number(rawVal) > Number(filter.value);
            case "less_than":
              return Number(rawVal) < Number(filter.value);
            case "is_empty":
              return rawVal === null || rawVal === undefined || String(rawVal).trim() === "";
            case "is_not_empty":
              return rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== "";
            default:
              return true;
          }
        })
      );
    }

    return result;
  }, [data, searchTerm, columnFilters, initialColumns, columnsMap]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    const col = columnsMap.get(sortKey);
    return [...filteredData].sort((a, b) => {
      const valA = col?.accessor ? col.accessor(a) : a[sortKey];
      const valB = col?.accessor ? col.accessor(b) : b[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection, columnsMap]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Selection
  const allCurrentPageSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row) => selectedIds.has(row[keyField as string]));

  const toggleSelectAll = () => {
    const newSelected = new Set(selectedIds);
    if (allCurrentPageSelected) {
      paginatedData.forEach((row) => newSelected.delete(row[keyField as string]));
      setSelectAllAcrossPages(false);
    } else {
      paginatedData.forEach((row) => newSelected.add(row[keyField as string]));
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAllAcrossPages = () => {
    const newSelected = new Set<string | number>();
    sortedData.forEach((row) => newSelected.add(row[keyField as string]));
    setSelectedIds(newSelected);
    setSelectAllAcrossPages(true);
  };

  const toggleSelectRow = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      setSelectAllAcrossPages(false);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllAcrossPages(false);
  };

  const selectedRows = useMemo(
    () => data.filter((row) => selectedIds.has(row[keyField as string])),
    [data, selectedIds, keyField]
  );

  // Sorting handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Export Suite (CSV, Excel, PDF/Print)
  const getExportData = () => {
    return sortedData.map((row) =>
      orderedVisibleColumns.map((c) => {
        const val = c.accessor ? c.accessor(row) : row[c.key];
        return val ?? "";
      })
    );
  };

  const exportToCSV = () => {
    const headers = orderedVisibleColumns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
    const rows = getExportData().map((row) =>
      row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
    );

    const csvContent = "\uFEFF" + [headers, ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title ? title.toLowerCase().replace(/\s+/g, "_") : "grid_export"}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const headers = orderedVisibleColumns.map((c) => `<th>${c.header}</th>`).join("");
    const rows = getExportData()
      .map(
        (row) =>
          `<tr>${row.map((val) => `<td>${String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`
      )
      .join("");

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
        <x:Name>${title || "Sheet1"}</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Segoe UI, Arial, sans-serif; }
          th { background-color: #1a1a2e; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #ddd; }
          td { padding: 8px; border: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h2>${title || "Data Export"}</h2>
        <p>Exported on: ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title ? title.toLowerCase().replace(/\s+/g, "_") : "grid_export"}_${new Date().toISOString().split("T")[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToPrint = () => {
    const headers = orderedVisibleColumns.map((c) => `<th>${c.header}</th>`).join("");
    const rows = getExportData()
      .map(
        (row) =>
          `<tr>${row.map((val) => `<td>${String(val).replace(/</g, "&lt;")}</td>`).join("")}</tr>`
      )
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title || "Print Report"}</title>
        <style>
          body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; color: #111; }
          h1 { margin-bottom: 4px; font-size: 20px; font-weight: 700; color: #1a1a2e; }
          .meta { font-size: 12px; color: #666; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f4f4f5; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; font-weight: 600; text-transform: uppercase; font-size: 10px; color: #555; }
          td { padding: 6px 10px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #fafafa; }
          @media print {
            body { padding: 0; }
            th { background: #eee !important; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h1>${title || "Enterprise Data Report"}</h1>
        <div class="meta">Exported on: ${new Date().toLocaleString()} &bull; Total records: ${sortedData.length}</div>
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Density-specific style classes
  const densityCellClasses = {
    compact: "px-3 py-1.5 text-xs",
    normal: "px-4 py-2.5 text-sm",
    spacious: "px-4 py-3.5 text-sm",
  }[density];

  const densityHeaderClasses = {
    compact: "px-3 py-1.5 text-xs font-semibold",
    normal: "px-4 py-2.5 text-xs font-semibold",
    spacious: "px-4 py-3 text-sm font-semibold",
  }[density];

  // Calculate sticky left offsets for pinned columns
  const getStickyStyle = (col: ColumnDef<T>, index: number) => {
    const pin = pinnedColumns[col.key];
    if (!pin) {
      if (typeof col.width === "number") return { width: `${col.width}px` };
      if (typeof col.width === "string") return { width: col.width };
      if (columnWidths[col.key]) return { width: `${columnWidths[col.key]}px` };
      return undefined;
    }

    const width = columnWidths[col.key] || (typeof col.width === "number" ? col.width : 150);

    if (pin === "left") {
      let leftOffset = selectable ? 40 : 0;
      for (let i = 0; i < index; i++) {
        const c = orderedVisibleColumns[i];
        if (pinnedColumns[c.key] === "left") {
          leftOffset += columnWidths[c.key] || (typeof c.width === "number" ? c.width : 150);
        }
      }
      return {
        position: "sticky" as const,
        left: `${leftOffset}px`,
        width: `${width}px`,
        zIndex: 15,
      };
    }

    if (pin === "right") {
      let rightOffset = 0;
      for (let i = index + 1; i < orderedVisibleColumns.length; i++) {
        const c = orderedVisibleColumns[i];
        if (pinnedColumns[c.key] === "right") {
          rightOffset += columnWidths[c.key] || (typeof c.width === "number" ? c.width : 150);
        }
      }
      return {
        position: "sticky" as const,
        right: `${rightOffset}px`,
        width: `${width}px`,
        zIndex: 15,
      };
    }

    return undefined;
  };

  const activeFilterCount = Object.keys(columnFilters).length;

  return (
    <div className="space-y-3">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          {searchable && (
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9 bg-card border-border text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {toolbarActions}

          {/* Density Selector */}
          {enableDensityToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium">
                  <Rows className="h-3.5 w-3.5" />
                  <span className="capitalize">{density}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuLabel className="text-xs font-semibold">Row Density</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={density} onValueChange={(v) => handleDensityChange(v as GridDensity)}>
                  <DropdownMenuRadioItem value="compact" className="text-xs cursor-pointer">
                    Compact (High-Density)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="normal" className="text-xs cursor-pointer">
                    Standard
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="spacious" className="text-xs cursor-pointer">
                    Comfortable
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Column Visibility, Reordering & Pinning Manager */}
          {filterable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="text-xs font-semibold p-0">Manage Columns</DropdownMenuLabel>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetColumns}
                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                </div>
                <DropdownMenuSeparator />
                {columnOrder.map((colKey, idx) => {
                  const col = columnsMap.get(colKey);
                  if (!col) return null;
                  const isHidden = hiddenColumnKeys.has(colKey);
                  const pin = pinnedColumns[colKey];

                  return (
                    <div
                      key={colKey}
                      className="flex items-center justify-between px-2 py-1 hover:bg-muted/50 rounded-sm text-xs"
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          disabled={col.hideable === false}
                          onChange={(e) => {
                            const newHidden = new Set(hiddenColumnKeys);
                            if (e.target.checked) newHidden.delete(colKey);
                            else newHidden.add(colKey);
                            setHiddenColumnKeys(newHidden);
                          }}
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                        />
                        <span className="truncate">{col.header}</span>
                      </label>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {enableColumnPinning && (
                          <button
                            title={pin === "left" ? "Unpin left" : "Pin to left"}
                            onClick={() => togglePin(colKey, "left")}
                            className={`p-1 rounded hover:bg-muted ${pin === "left" ? "text-primary font-bold" : "text-muted-foreground"}`}
                          >
                            <Pin className="h-3 w-3" />
                          </button>
                        )}
                        {enableColumnReorder && (
                          <>
                            <button
                              disabled={idx === 0}
                              onClick={() => moveColumn(colKey, "up")}
                              className="p-1 rounded text-muted-foreground hover:bg-muted disabled:opacity-20"
                              title="Move earlier"
                            >
                              <MoveUp className="h-3 w-3" />
                            </button>
                            <button
                              disabled={idx === columnOrder.length - 1}
                              onClick={() => moveColumn(colKey, "down")}
                              className="p-1 rounded text-muted-foreground hover:bg-muted disabled:opacity-20"
                              title="Move later"
                            >
                              <MoveDown className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 1-Click Export Suite (CSV, Excel, PDF/Print) */}
          {exportable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium">
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer text-xs">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  <span>Export to CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export to Excel (.xls)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportToPrint} className="gap-2 cursor-pointer text-xs">
                  <Printer className="h-3.5 w-3.5 text-purple-600" />
                  <span>Print / Save as PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-surface-1/50 border border-border/80 rounded-lg p-2 text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3 text-primary" />
            Active Filters ({activeFilterCount}):
          </span>
          {Object.entries(columnFilters).map(([key, filter]) => {
            const col = columnsMap.get(key);
            return (
              <Badge key={key} variant="secondary" className="gap-1 text-xs font-normal">
                <span className="font-medium text-foreground">{col?.header || key}</span>
                <span className="text-muted-foreground">{filter.operator.replace(/_/g, " ")}</span>
                {filter.value && <span className="font-semibold text-primary">"{filter.value}"</span>}
                <button
                  onClick={() => {
                    setColumnFilters((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    });
                  }}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setColumnFilters({})}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all filters
          </Button>
        </div>
      )}

      {/* Multi-Row Bulk Actions Banner (When rows are selected) */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm transition-all animate-fadeIn">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-primary">
              {selectedIds.size} {selectedIds.size === 1 ? "record" : "records"} selected
            </span>
            {sortedData.length > paginatedData.length && !selectAllAcrossPages && (
              <Button
                variant="link"
                size="sm"
                onClick={handleSelectAllAcrossPages}
                className="h-7 text-xs text-primary p-0 underline"
              >
                Select all {sortedData.length} records across all pages
              </Button>
            )}
            {selectAllAcrossPages && (
              <span className="text-xs text-muted-foreground italic">
                (All {sortedData.length} records in this view are selected)
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {bulkActions ? (
              bulkActions(selectedRows, clearSelection)
            ) : (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Selected</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* High-Density Enterprise Data Grid Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="erp-table-header border-b border-border bg-surface-1 select-none">
                {selectable && (
                  <th
                    className={`w-10 ${densityHeaderClasses} text-center sticky left-0 bg-surface-1 z-20 border-r border-border/40`}
                  >
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                    />
                  </th>
                )}

                {orderedVisibleColumns.map((col, idx) => {
                  const isPinned = pinnedColumns[col.key];
                  const hasActiveFilter = !!columnFilters[col.key];
                  const stickyStyle = getStickyStyle(col, idx);
                  const isSortable = col.sortable !== false;
                  const isFilterable = col.filterable !== false && filterable;

                  return (
                    <th
                      key={col.key}
                      style={stickyStyle}
                      className={`${densityHeaderClasses} relative group border-r border-border/40 last:border-r-0 ${
                        isPinned ? "bg-surface-1 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]" : ""
                      } ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 w-full ${
                          col.align === "right"
                            ? "justify-end"
                            : col.align === "center"
                            ? "justify-center"
                            : "justify-between"
                        }`}
                      >
                        {/* Column Header Title & Sort */}
                        <div
                          onClick={() => isSortable && handleSort(col.key)}
                          className={`inline-flex items-center gap-1 truncate ${
                            isSortable ? "cursor-pointer hover:text-foreground" : ""
                          }`}
                        >
                          <span className="truncate">{col.header}</span>
                          {isSortable && (
                            <span className="text-muted-foreground flex-shrink-0">
                              {sortKey === col.key ? (
                                sortDirection === "asc" ? (
                                  <ArrowUp className="h-3 w-3 text-primary" />
                                ) : (
                                  <ArrowDown className="h-3 w-3 text-primary" />
                                )
                              ) : (
                                <ArrowUpDown className="h-2.5 w-2.5 opacity-30 group-hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </div>

                        {/* Column-Specific Filter Popover */}
                        {isFilterable && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className={`p-0.5 rounded hover:bg-muted/80 transition-colors ${
                                  hasActiveFilter ? "text-primary font-bold" : "text-muted-foreground/50 opacity-0 group-hover:opacity-100"
                                }`}
                                title={`Filter ${col.header}`}
                              >
                                <Filter className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-56 p-3 space-y-2">
                              <div className="text-xs font-semibold text-foreground">
                                Filter: {col.header}
                              </div>
                              <select
                                value={columnFilters[col.key]?.operator || "contains"}
                                onChange={(e) => {
                                  const op = e.target.value as FilterOperator;
                                  setColumnFilters((prev) => ({
                                    ...prev,
                                    [col.key]: {
                                      operator: op,
                                      value: prev[col.key]?.value || "",
                                    },
                                  }));
                                }}
                                className="w-full text-xs rounded border border-border bg-card p-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="contains">Contains</option>
                                <option value="equals">Equals</option>
                                <option value="starts_with">Starts with</option>
                                <option value="ends_with">Ends with</option>
                                <option value="greater_than">Greater than (&gt;)</option>
                                <option value="less_than">Less than (&lt;)</option>
                                <option value="is_empty">Is empty</option>
                                <option value="is_not_empty">Is not empty</option>
                              </select>

                              {!["is_empty", "is_not_empty"].includes(
                                columnFilters[col.key]?.operator
                              ) && (
                                <Input
                                  size={1}
                                  placeholder="Filter value..."
                                  value={columnFilters[col.key]?.value || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setColumnFilters((prev) => ({
                                      ...prev,
                                      [col.key]: {
                                        operator: prev[col.key]?.operator || "contains",
                                        value: val,
                                      },
                                    }));
                                  }}
                                  className="h-7 text-xs"
                                />
                              )}

                              <div className="flex items-center justify-between pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setColumnFilters((prev) => {
                                      const next = { ...prev };
                                      delete next[col.key];
                                      return next;
                                    });
                                  }}
                                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Clear
                                </Button>
                                <span className="text-[10px] text-muted-foreground">
                                  Press Enter to apply
                                </span>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      {/* Interactive Column Resize Drag Handle */}
                      {enableColumnResize && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize select-none touch-none hover:bg-primary/50 active:bg-primary z-20"
                          onMouseDown={(e) => handleResizeMouseDown(col.key, e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                // Loading Skeleton Rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="erp-table-row animate-pulse">
                    {selectable && (
                      <td className={`${densityCellClasses} text-center`}>
                        <div className="h-3.5 w-3.5 rounded bg-muted mx-auto" />
                      </td>
                    )}
                    {orderedVisibleColumns.map((col) => (
                      <td key={col.key} className={densityCellClasses}>
                        <div className="h-4 rounded bg-muted w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                // Empty State
                <tr>
                  <td
                    colSpan={orderedVisibleColumns.length + (selectable ? 1 : 0)}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    {emptyState || (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-foreground">No records found</p>
                        <p className="text-xs text-muted-foreground">
                          {searchTerm || activeFilterCount > 0
                            ? "Try adjusting your search query or column filters"
                            : "No items have been added to this list yet"}
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                // Data Rows
                paginatedData.map((row, idx) => {
                  const id = row[keyField as string] ?? idx;
                  const isSelected = selectedIds.has(id);

                  return (
                    <tr
                      key={id}
                      onClick={() => onRowClick && onRowClick(row)}
                      className={`erp-table-row transition-colors hover:bg-muted/40 ${
                        isSelected ? "bg-primary/5" : ""
                      } ${onRowClick ? "cursor-pointer" : ""}`}
                    >
                      {selectable && (
                        <td
                          className={`w-10 ${densityCellClasses} text-center sticky left-0 bg-card z-10 border-r border-border/40`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectRow(id, e as any)}
                            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                          />
                        </td>
                      )}
                      {orderedVisibleColumns.map((col, colIdx) => {
                        const cellVal = col.accessor ? col.accessor(row) : row[col.key];
                        const isPinned = pinnedColumns[col.key];
                        const stickyStyle = getStickyStyle(col, colIdx);

                        return (
                          <td
                            key={col.key}
                            style={stickyStyle}
                            className={`${densityCellClasses} border-r border-border/30 last:border-r-0 ${
                              isPinned ? "bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]" : ""
                            } ${
                              col.align === "right"
                                ? "text-right"
                                : col.align === "center"
                                ? "text-center"
                                : "text-left"
                            }`}
                          >
                            {col.render ? col.render(cellVal, row) : (cellVal ?? "—")}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-surface-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>
              Showing {sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <span className="px-2 font-medium text-foreground">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
