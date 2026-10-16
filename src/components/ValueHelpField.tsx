import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Search, X } from 'lucide-react';
import Tooltip from './Tooltip';

type SortDir = 'asc' | 'desc' | null;

type TextFilter = { type: 'text'; value: string };
type SelectFilter = { type: 'select'; value: string | null; options: { label: string; value: string }[] };
type BooleanFilter = { type: 'boolean'; value: boolean | null };
type NumberFilter = { type: 'number'; value: number | null };

export type ValueHelpColumnFilter =
  | ({ enabled: true } & (TextFilter | SelectFilter | BooleanFilter | NumberFilter))
  | { enabled: false };

export type ValueHelpColumn<Row> = {
  id: string;
  headerLabel: string;
  sortable?: boolean;
  sortKey?: string;
  filter?: ValueHelpColumnFilter;
  className?: string;
  renderCell: (row: Row) => ReactNode;
};

export type ValueHelpQuery = {
  pageIndex: number;
  pageSize: number;
  sortBy: string | null;
  sortDir: SortDir;
  filters: Record<string, unknown>;
};

export type ValueHelpFetchResult<Row> = {
  rows: Row[];
  count: number | null;
};

export type ValueHelpSelection<Row, Value> = {
  row: Row;
  value: Value;
  displayValue: string;
};

type ValueHelpFieldProps<Row, Value> = {
  label: string;
  value: Value | null;
  displayValue: string;
  placeholder?: string;
  helperText?: string;
  tooltipContent?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  dialogTitle: string;
  dialogDescription?: string;
  columns: ValueHelpColumn<Row>[];
  fetchPage: (query: ValueHelpQuery) => Promise<ValueHelpFetchResult<Row>>;
  getRowKey: (row: Row) => string | number;
  getValue: (row: Row) => Value;
  getDisplayValue: (row: Row) => string;
  onSelect: (selection: ValueHelpSelection<Row, Value>) => void;
  onClear?: () => void;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  emptyLabel?: string;
  openButtonLabel?: string;
  selectButtonLabel?: string;
  clearButtonLabel?: string;
  canClear?: boolean;
  isRowSelectable?: (row: Row) => boolean;
};

function buildDefaultFilters(columns: ValueHelpColumn<any>[]) {
  const result: Record<string, unknown> = {};
  for (const col of columns) {
    if (!col.filter || col.filter.enabled === false) continue;
    if (col.filter.type === 'text') result[col.id] = '';
    if (col.filter.type === 'select') result[col.id] = null;
    if (col.filter.type === 'boolean') result[col.id] = null;
    if (col.filter.type === 'number') result[col.id] = null;
  }
  return result;
}

function renderSortIcon(active: boolean, sortDir: SortDir) {
  if (!active || !sortDir) return <ChevronDown size={14} className="text-gray-300" />;
  if (sortDir === 'asc') return <ArrowUp size={14} className="text-blue-600" />;
  return <ArrowDown size={14} className="text-blue-600" />;
}

export default function ValueHelpField<Row, Value>({
  label,
  value,
  displayValue,
  placeholder = 'Select a value...',
  helperText,
  tooltipContent,
  required = false,
  disabled = false,
  dialogTitle,
  dialogDescription,
  columns,
  fetchPage,
  getRowKey,
  getValue,
  getDisplayValue,
  onSelect,
  onClear,
  pageSizeOptions = [10, 25, 50],
  defaultPageSize = 10,
  emptyLabel = 'No results found.',
  openButtonLabel = 'Prompt',
  selectButtonLabel = 'Select',
  clearButtonLabel = 'Clear',
  canClear = true,
  isRowSelectable,
}: ValueHelpFieldProps<Row, Value>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, unknown>>(() => buildDefaultFilters(columns));
  const [draftFilters, setDraftFilters] = useState<Record<string, unknown>>(() => buildDefaultFilters(columns));
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFilterInputRef = useRef<HTMLInputElement | null>(null);

  const totalPages = useMemo(() => {
    if (!count || count <= 0) return null;
    return Math.max(1, Math.ceil(count / pageSize));
  }, [count, pageSize]);

  const currentRange = useMemo(() => {
    if (count === 0) return { from: 0, to: 0 };
    const from = pageIndex * pageSize + 1;
    const to = Math.min((pageIndex + 1) * pageSize, count ?? (pageIndex + 1) * pageSize);
    return { from, to };
  }, [count, pageIndex, pageSize]);

  const selectedRow = useMemo(() => {
    return rows.find((row) => getRowKey(row) === selectedRowKey) ?? null;
  }, [rows, getRowKey, selectedRowKey]);

  const hasPendingFilterChanges = useMemo(() => {
    return JSON.stringify(filters) !== JSON.stringify(draftFilters);
  }, [filters, draftFilters]);

  const hasAnyDraftFilters = useMemo(() => {
    return columns.some((col) => {
      if (!col.filter || col.filter.enabled === false) return false;
      const value = draftFilters[col.id];
      return (
        (col.filter.type === 'text' && typeof value === 'string' && value.trim().length > 0) ||
        (col.filter.type === 'select' && value != null) ||
        (col.filter.type === 'boolean' && value != null) ||
        (col.filter.type === 'number' && value != null)
      );
    });
  }, [columns, draftFilters]);

  useEffect(() => {
    if (!dialogOpen) return;
    const timer = window.setTimeout(() => {
      firstFilterInputRef.current?.focus();
      firstFilterInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDialogOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      const query: ValueHelpQuery = {
        pageIndex,
        pageSize,
        sortBy,
        sortDir,
        filters,
      };
      const result = await fetchPage(query).catch((err: unknown) => ({
        rows: [] as Row[],
        count: null as number | null,
        error: err,
      }));

      if (cancelled) return;

      if ((result as { error?: unknown }).error) {
        setRows([]);
        setCount(null);
        setError(String((result as { error?: unknown }).error));
      } else {
        setRows(result.rows);
        setCount(result.count);
      }

      setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, pageIndex, pageSize, sortBy, sortDir, filters, fetchPage]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (value == null) {
      setSelectedRowKey(null);
      return;
    }

    const matched = rows.find((row) => getValue(row) === value);
    if (matched) {
      setSelectedRowKey(getRowKey(matched));
    }
  }, [dialogOpen, rows, value, getRowKey, getValue]);

  function openDialog() {
    if (disabled) return;
    setDialogOpen(true);
    setPageIndex(0);
    setSelectedRowKey(null);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  function toggleSort(col: ValueHelpColumn<Row>) {
    if (!col.sortable || !col.sortKey) return;
    setPageIndex(0);
    if (sortBy !== col.id) {
      setSortBy(col.id);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortBy(null);
    setSortDir(null);
  }

  function updateDraftFilter(columnId: string, nextValue: unknown) {
    setDraftFilters((prev) => ({ ...prev, [columnId]: nextValue }));
  }

  function applyFilters() {
    setFilters(draftFilters);
    setPageIndex(0);
  }

  function clearFilters() {
    const defaults = buildDefaultFilters(columns);
    setDraftFilters(defaults);
    setFilters(defaults);
    setPageIndex(0);
  }

  function handleSelectRow(row: Row) {
    if (isRowSelectable && !isRowSelectable(row)) return;
    setSelectedRowKey(getRowKey(row));
  }

  function commitSelection(row: Row | null) {
    if (!row) return;
    if (isRowSelectable && !isRowSelectable(row)) return;
    onSelect({
      row,
      value: getValue(row),
      displayValue: getDisplayValue(row),
    });
    setDialogOpen(false);
  }

  function renderInlineFilter(col: ValueHelpColumn<Row>, index: number) {
    if (!col.filter || col.filter.enabled === false) return null;

    if (col.filter.type === 'text') {
      const currentValue = typeof draftFilters[col.id] === 'string' ? (draftFilters[col.id] as string) : '';
      return (
        <input
          ref={index === 0 ? firstFilterInputRef : null}
          value={currentValue}
          onChange={(e) => updateDraftFilter(col.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyFilters();
            }
          }}
          placeholder="Filter..."
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      );
    }

    if (col.filter.type === 'number') {
      const currentValue = draftFilters[col.id] == null ? '' : String(draftFilters[col.id]);
      return (
        <input
          ref={index === 0 ? firstFilterInputRef : null}
          value={currentValue}
          onChange={(e) => {
            const trimmed = e.target.value.trim();
            updateDraftFilter(col.id, trimmed === '' ? null : Number(trimmed));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyFilters();
            }
          }}
          inputMode="numeric"
          placeholder="Equals..."
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      );
    }

    if (col.filter.type === 'select') {
      const currentValue = draftFilters[col.id];
      return (
        <select
          value={currentValue == null ? '' : String(currentValue)}
          onChange={(e) => updateDraftFilter(col.id, e.target.value === '' ? null : e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">All</option>
          {col.filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (col.filter.type === 'boolean') {
      const currentValue = draftFilters[col.id];
      return (
        <select
          value={currentValue == null ? '' : currentValue ? 'true' : 'false'}
          onChange={(e) => {
            if (e.target.value === '') updateDraftFilter(col.id, null);
            else updateDraftFilter(col.id, e.target.value === 'true');
          }}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">All</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-1.5">
          <label className="text-sm font-semibold text-gray-700">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {tooltipContent && <Tooltip content={tooltipContent} />}
        </div>
      )}
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            readOnly
            value={displayValue}
            placeholder={placeholder}
            className={
              'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ' +
              (disabled ? 'cursor-not-allowed bg-gray-50 text-gray-400' : '')
            }
            disabled={disabled}
          />
          <Search size={16} className="pointer-events-none absolute right-3 top-3.5 text-gray-400" />
        </div>
        <button
          type="button"
          onClick={openDialog}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          <Search size={16} />
          {openButtonLabel}
        </button>
        {canClear && onClear && value != null && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {clearButtonLabel}
          </button>
        )}
      </div>
      {!tooltipContent && helperText && <span className="text-xs text-gray-500">{helperText}</span>}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 px-4 py-6">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={dialogTitle}
            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Prompt Field</p>
                  <h3 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{dialogTitle}</h3>
                  {dialogDescription && (
                    <p className="mt-2 text-sm leading-6 text-gray-500">{dialogDescription}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {count != null ? (
                  <span>
                    {currentRange.from}-{currentRange.to} of {count}
                  </span>
                ) : (
                  <span>-</span>
                )}
                {loading && <span className="text-gray-400">Loading...</span>}
                {error && <span className="text-red-600">{error}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applyFilters}
                  disabled={!hasPendingFilterChanges}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={!hasAnyDraftFilters && !hasPendingFilterChanges}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
                >
                  Clear Filters
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPageIndex(0);
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none transition hover:bg-gray-50"
                  >
                    {pageSizeOptions.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 [&_th]:bg-gray-50">
                  <tr className="border-b border-gray-100">
                    {columns.map((col) => (
                      <th key={col.id} className={'sticky top-0 z-20 px-4 py-3 font-medium ' + (col.className ?? '')}>
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          disabled={!col.sortable || !col.sortKey}
                          className={
                            'inline-flex items-center gap-2 rounded-lg px-2 py-1 text-left transition ' +
                            (col.sortable && col.sortKey ? 'hover:bg-gray-100' : '')
                          }
                        >
                          <span>{col.headerLabel}</span>
                          {renderSortIcon(sortBy === col.id, sortDir)}
                        </button>
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    {columns.map((col, index) => (
                      <th
                        key={`${col.id}-filter`}
                        className={'sticky top-12 z-10 px-4 py-3 align-top shadow-[0_1px_0_0_rgba(243,244,246,1)] ' + (col.className ?? '')}
                      >
                        {renderInlineFilter(col, index)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {!loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-500">
                        {emptyLabel}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const key = getRowKey(row);
                      const selectable = isRowSelectable ? isRowSelectable(row) : true;
                      const selected = selectedRowKey === key;
                      return (
                        <tr
                          key={key}
                          className={
                            'transition ' +
                            (selectable ? 'cursor-pointer hover:bg-blue-50/60 ' : 'cursor-not-allowed opacity-60 ') +
                            (selected ? 'bg-blue-50' : 'bg-white')
                          }
                          onClick={() => handleSelectRow(row)}
                          onDoubleClick={() => commitSelection(row)}
                        >
                          {columns.map((col) => (
                            <td key={col.id} className={'px-4 py-4 ' + (col.className ?? '')}>
                              {col.renderCell(row)}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-3">
              <div className="text-sm text-gray-600">
                {count != null ? (
                  <span>
                    Page {pageIndex + 1}
                    {totalPages ? ` of ${totalPages}` : ''}
                  </span>
                ) : (
                  <span>Page {pageIndex + 1}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                  disabled={pageIndex === 0 || loading}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (totalPages) setPageIndex((prev) => Math.min(totalPages - 1, prev + 1));
                    else setPageIndex((prev) => prev + 1);
                  }}
                  disabled={loading || (totalPages != null && pageIndex >= totalPages - 1)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => commitSelection(selectedRow)}
                  disabled={!selectedRow}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {selectButtonLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
