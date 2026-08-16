import React, { useState, useMemo } from "react";
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
  Trash2,
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
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor?: (row: T) => any;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
  hideable?: boolean;
}

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
}

export function DataTable<T extends Record<string, any>>({
  columns,
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
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(new Set());

  // Visible columns
  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumnKeys.has(col.key)),
    [columns, hiddenColumnKeys]
  );

  // Filter & Search
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();

    return data.filter((row) =>
      columns.some((col) => {
        const val = col.accessor ? col.accessor(row) : row[col.key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      })
    );
  }, [data, searchTerm, columns]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    const col = columns.find((c) => c.key === sortKey);
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
      return sortDirection === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection, columns]);

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
    } else {
      paginatedData.forEach((row) => newSelected.add(row[keyField as string]));
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectRow = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  // CSV Export
  const exportToCSV = () => {
    const headers = visibleColumns.map((c) => c.header).join(",");
    const rows = sortedData.map((row) =>
      visibleColumns
        .map((c) => {
          const val = c.accessor ? c.accessor(row) : row[c.key];
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title ? title.toLowerCase().replace(/\s+/g, "_") : "export"}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {toolbarActions}

          {/* Column Visibility Selector */}
          {filterable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs font-semibold">Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={!hiddenColumnKeys.has(col.key)}
                    onCheckedChange={(checked) => {
                      const newHidden = new Set(hiddenColumnKeys);
                      if (checked) {
                        newHidden.delete(col.key);
                      } else {
                        newHidden.add(col.key);
                      }
                      setHiddenColumnKeys(newHidden);
                    }}
                  >
                    {col.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export Menu */}
          {exportable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium">
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Export to CSV</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Bulk Actions Banner (When rows are selected) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm transition-all animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">
              {selectedIds.size} {selectedIds.size === 1 ? "item" : "items"} selected
            </span>
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

      {/* Data Table Grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="erp-table-header border-b border-border">
                {selectable && (
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer accent-primary"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`px-4 py-3 select-none ${
                      col.sortable !== false ? "cursor-pointer hover:text-foreground" : ""
                    } ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    }`}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === "right" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.sortable !== false && (
                        <span className="text-muted-foreground">
                          {sortKey === col.key ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                // Loading Skeleton Rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="erp-table-row animate-pulse">
                    {selectable && (
                      <td className="px-4 py-3 text-center">
                        <div className="h-4 w-4 rounded bg-muted mx-auto" />
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <div className="h-4 w-3/4 rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                // Empty State
                <tr>
                  <td
                    colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {emptyState || (
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">No records found</p>
                        <p className="text-xs">
                          {searchTerm
                            ? "Try adjusting your search query or filters"
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
                      className={`erp-table-row ${isSelected ? "selected" : ""} ${
                        onRowClick ? "cursor-pointer" : ""
                      }`}
                    >
                      {selectable && (
                        <td
                          className="w-10 px-4 py-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectRow(id, e as any)}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer accent-primary"
                          />
                        </td>
                      )}
                      {visibleColumns.map((col) => {
                        const cellVal = col.accessor ? col.accessor(row) : row[col.key];
                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-3 text-sm ${
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface-1 text-xs text-muted-foreground">
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
