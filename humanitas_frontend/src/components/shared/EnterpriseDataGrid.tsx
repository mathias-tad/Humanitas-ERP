import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Filter, X, CheckSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnConfig<T> {
  key: keyof T | string;
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
}

export interface BulkAction<T> {
  label: string;
  icon?: React.ElementType;
  variant?: 'default' | 'danger';
  onClick: (rows: T[]) => void;
}

interface EnterpriseDataGridProps<T extends Record<string, unknown>> {
  columns: ColumnConfig<T>[];
  data: T[];
  title?: string;
  isLoading?: boolean;
  bulkActions?: BulkAction<T>[];
  exportFilename?: string;
  emptyMessage?: string;
  rowKey?: keyof T;
}

// ─── CSV Export ────────────────────────────────────────────────────────────────

function exportToCsv<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows
    .map(r =>
      Object.values(r)
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
  const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getNestedValue<T extends Record<string, unknown>>(obj: T, key: string): unknown {
  return key.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function EnterpriseDataGrid<T extends Record<string, unknown>>({
  columns,
  data,
  title,
  isLoading = false,
  bulkActions = [],
  exportFilename = 'export',
  emptyMessage = 'No records found',
  rowKey,
}: EnterpriseDataGridProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // ── Sorting ──
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ── Filtered + Sorted data ──
  const processedData = useMemo(() => {
    let result = [...data];

    // Global filter
    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase();
      result = result.filter(row =>
        columns.some(col => {
          const val = getNestedValue(row, col.key as string);
          return String(val ?? '').toLowerCase().includes(q);
        })
      );
    }

    // Column filters
    Object.entries(columnFilters).forEach(([key, val]) => {
      if (!val.trim()) return;
      const q = val.toLowerCase();
      result = result.filter(row => {
        const v = getNestedValue(row, key);
        return String(v ?? '').toLowerCase().includes(q);
      });
    });

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const av = String(getNestedValue(a, sortKey) ?? '');
        const bv = String(getNestedValue(b, sortKey) ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    return result;
  }, [data, globalFilter, columnFilters, sortKey, sortDir, columns]);

  // ── Row selection ──
  const getRowId = (row: T, index: number): string => {
    if (rowKey && row[rowKey] !== undefined) return String(row[rowKey]);
    return String(index);
  };

  const selectedRows = processedData.filter((row, i) => selectedKeys.has(getRowId(row, i)));
  const allSelected = processedData.length > 0 && processedData.every((row, i) => selectedKeys.has(getRowId(row, i)));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(processedData.map((row, i) => getRowId(row, i))));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setColumnFilters({});
    setGlobalFilter('');
  };

  const hasActiveFilters = globalFilter.trim() || Object.values(columnFilters).some(v => v.trim());
  const filterCount = (globalFilter.trim() ? 1 : 0) + Object.values(columnFilters).filter(v => v.trim()).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {title && <span className="font-semibold text-gray-800">{title}</span>}
          {isLoading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <input
            type="text"
            placeholder="Search all columns…"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />

          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              showFilters
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {filterCount > 0 && (
              <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => exportToCsv(selectedRows.length > 0 ? selectedRows : processedData, exportFilename)}
            title={selectedRows.length > 0 ? `Export ${selectedRows.length} selected` : 'Export all'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {selectedRows.length > 0 ? `Export (${selectedRows.length})` : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* ── Column Filters ── */}
      {showFilters && (
        <div className="flex gap-3 p-3 bg-gray-50 border-b border-gray-100 flex-wrap items-end">
          {columns.filter(c => c.filterable !== false).map(col => (
            <div key={col.key as string} className="flex flex-col min-w-[100px]">
              <label className="text-xs text-gray-500 mb-1">{col.header}</label>
              <input
                type="text"
                value={columnFilters[col.key as string] ?? ''}
                onChange={e => setColumnFilters(prev => ({ ...prev, [col.key as string]: e.target.value }))}
                placeholder="Filter…"
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          ))}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="self-end flex items-center gap-1 text-xs text-red-500 hover:text-red-700 pb-1">
              <X className="w-3 h-3" />Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Bulk Action Bar ── */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
          <CheckSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-700">
            {selectedRows.length} row{selectedRows.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 flex-wrap">
            {bulkActions.map(action => (
              <button
                key={action.label}
                onClick={() => { action.onClick(selectedRows); setSelectedKeys(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  action.variant === 'danger'
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {action.icon && <action.icon className="w-3 h-3" />}
                {action.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSelectedKeys(new Set())} className="ml-auto text-xs text-gray-500 hover:text-gray-700">
            Clear selection
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {bulkActions.length > 0 && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key as string}
                  style={col.width ? { width: col.width } : undefined}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none"
                >
                  <div
                    className={`flex items-center gap-1.5 ${col.sortable !== false ? 'cursor-pointer hover:text-gray-800' : ''}`}
                    onClick={() => col.sortable !== false && handleSort(col.key as string)}
                  >
                    {col.header}
                    {col.sortable !== false && (
                      sortKey === col.key ? (
                        sortDir === 'asc'
                          ? <ArrowUp className="w-3 h-3 text-amber-500" />
                          : <ArrowDown className="w-3 h-3 text-amber-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0)}
                  className="px-4 py-16 text-center text-gray-400 text-sm"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Loading…
                    </div>
                  ) : emptyMessage}
                </td>
              </tr>
            ) : (
              processedData.map((row, rowIndex) => {
                const id = getRowId(row, rowIndex);
                const isSelected = selectedKeys.has(id);
                return (
                  <tr
                    key={id}
                    className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-amber-50/60' : ''}`}
                  >
                    {bulkActions.length > 0 && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key as string} className="px-4 py-3 text-gray-700">
                        {col.cell
                          ? col.cell(row)
                          : String(getNestedValue(row, col.key as string) ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span>
          {processedData.length} of {data.length} rows
          {hasActiveFilters && ' (filtered)'}
        </span>
        {selectedRows.length > 0 && (
          <span className="text-amber-600 font-medium">{selectedRows.length} selected</span>
        )}
      </div>
    </div>
  );
}
