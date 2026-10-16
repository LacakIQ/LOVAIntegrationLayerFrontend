import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal, ArrowUp, ArrowDown, X } from 'lucide-react'

import { loadTablePreferences, upsertTablePreferences, type ColumnStickinessMap, type TablePreferencesRow } from '../utils/tablePreferences'

type SortDir = 'asc' | 'desc' | null

type TextFilter = { type: 'text'; value: string }
type SelectFilter = { type: 'select'; value: string | null; options: { label: string; value: string }[] }
type BooleanFilter = { type: 'boolean'; value: boolean | null }
type NumberFilter = { type: 'number'; value: number | null }

export type ColumnFilter =
  | ({ enabled: true } & (TextFilter | SelectFilter | BooleanFilter | NumberFilter))
  | { enabled: false }

export type ServerDataTableColumn<Row> = {
  id: string
  headerLabel: string
  sortable?: boolean
  sortKey?: string
  filter?: ColumnFilter
  defaultVisible?: boolean
  lockVisible?: boolean
  sticky?: 'left' | 'right'
  lockSticky?: boolean
  className?: string
  renderCell: (row: Row) => ReactNode
}

export type ServerDataTableQuery = {
  pageIndex: number
  pageSize: number
  sortBy: string | null
  sortDir: SortDir
  filters: Record<string, unknown>
}

export type ServerDataTableFetchResult<Row> = {
  rows: Row[]
  count: number | null
}

type ServerDataTableProps<Row> = {
  userId: string | null
  tableKey: string
  columns: ServerDataTableColumn<Row>[]
  fetchPage: (query: ServerDataTableQuery) => Promise<ServerDataTableFetchResult<Row>>
  pageSizeOptions?: number[]
  defaultPageSize?: number
  externalReloadKey?: string | number
  emptyLabel?: string
  rowKey?: (row: Row) => string | number
  persistPreferences?: boolean
  showTableSettings?: boolean
}

function normalizeVisibility(columns: { id: string; defaultVisible?: boolean; lockVisible?: boolean }[]) {
  const map: Record<string, boolean> = {}
  for (const col of columns) {
    map[col.id] = col.lockVisible ? true : col.defaultVisible !== false
  }
  return map
}

function normalizeStickiness(columns: ServerDataTableColumn<any>[]): ColumnStickinessMap {
  const map: ColumnStickinessMap = {}
  for (const col of columns) {
    map[col.id] = col.sticky ?? null
  }
  return map
}

function buildDefaultFilters(columns: ServerDataTableColumn<any>[]) {
  const result: Record<string, unknown> = {}
  for (const col of columns) {
    if (!col.filter || col.filter.enabled === false) continue
    if (col.filter.type === 'text') result[col.id] = ''
    if (col.filter.type === 'select') result[col.id] = null
    if (col.filter.type === 'boolean') result[col.id] = null
    if (col.filter.type === 'number') result[col.id] = null
  }
  return result
}

export default function ServerDataTable<Row>({
  userId,
  tableKey,
  columns,
  fetchPage,
  pageSizeOptions = [25, 50, 100],
  defaultPageSize = 25,
  externalReloadKey,
  emptyLabel = 'No results found.',
  rowKey,
  persistPreferences = true,
  showTableSettings = true,
}: ServerDataTableProps<Row>) {
  const [preferencesReady, setPreferencesReady] = useState(!persistPreferences)
  const [rawPreferencesRow, setRawPreferencesRow] = useState<TablePreferencesRow | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [filters, setFilters] = useState<Record<string, unknown>>(() => buildDefaultFilters(columns))
  const [draftFilters, setDraftFilters] = useState<Record<string, unknown>>(() => buildDefaultFilters(columns))
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    normalizeVisibility(columns),
  )
  const [stickiness, setStickiness] = useState<ColumnStickinessMap>(() =>
    normalizeStickiness(columns),
  )

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(true)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [scrolledFromLeft, setScrolledFromLeft] = useState(false)
  const [scrolledFromRight, setScrolledFromRight] = useState(false)
  const [leftStickyWidths, setLeftStickyWidths] = useState<Record<string, number>>({})
  const [rightStickyWidths, setRightStickyWidths] = useState<Record<string, number>>({})
  const headerRowRef = useRef<HTMLTableRowElement | null>(null)
  const widthsStable = useRef(false)

  const orderedVisibleColumns = useMemo(() => {
    const visible = columns.filter((col) => visibility[col.id] !== false)
    const leftStickies: ServerDataTableColumn<Row>[] = []
    const normals: ServerDataTableColumn<Row>[] = []
    const rightStickies: ServerDataTableColumn<Row>[] = []
    for (const col of visible) {
      const effective = stickiness[col.id] ?? null
      if (effective === 'left') leftStickies.push(col)
      else if (effective === 'right') rightStickies.push(col)
      else normals.push(col)
    }
    return [...leftStickies, ...normals, ...rightStickies]
  }, [columns, visibility, stickiness])

  const visibleColumns = orderedVisibleColumns

  const stickyOffsets = useMemo(() => {
    function readDomWidths(): { left: Record<string, number>; right: Record<string, number> } | null {
      if (typeof document === 'undefined') return null
      const target: HTMLTableRowElement | null =
        headerRowRef.current ??
        document.querySelector('thead > tr[data-sticky-header-row]') ??
        document.querySelector('thead > tr:first-child')
      if (!target) return null
      const cells = target.querySelectorAll<HTMLTableCellElement>('th[role="columnheader"]')
      const left: Record<string, number> = {}
      const right: Record<string, number> = {}
      for (const cell of cells) {
        const colId = cell.dataset.colId
        const sticky = cell.dataset.sticky as 'left' | 'right' | undefined
        if (!colId) continue
        const rect = cell.getBoundingClientRect()
        if (sticky === 'left') left[colId] = rect.width
        if (sticky === 'right') right[colId] = rect.width
      }
      return { left, right }
    }

    let useLeft = leftStickyWidths
    let useRight = rightStickyWidths
    if (Object.keys(useLeft).length === 0 && Object.keys(useRight).length === 0) {
      const dom = readDomWidths()
      if (dom) {
        useLeft = dom.left
        useRight = dom.right
      }
    }

    const offsets: Record<string, number> = {}
    let accumLeft = 0
    for (const col of orderedVisibleColumns) {
      const effective = stickiness[col.id] ?? null
      if (effective === 'left') {
        offsets[col.id] = accumLeft
        accumLeft += useLeft[col.id] ?? 0
      }
    }
    let accumRight = 0
    const rightCols = orderedVisibleColumns.filter(
      (c) => (stickiness[c.id] ?? null) === 'right',
    )
    for (let i = rightCols.length - 1; i >= 0; i--) {
      const col = rightCols[i]
      offsets[col.id] = accumRight
      accumRight += useRight[col.id] ?? 0
    }
    return offsets
  }, [orderedVisibleColumns, stickiness, leftStickyWidths, rightStickyWidths])

  const totalPages = useMemo(() => {
    if (!count || count <= 0) return null
    return Math.max(1, Math.ceil(count / pageSize))
  }, [count, pageSize])

  const currentRange = useMemo(() => {
    if (count === 0) return { from: 0, to: 0 }
    const from = pageIndex * pageSize + 1
    const to = Math.min((pageIndex + 1) * pageSize, count ?? (pageIndex + 1) * pageSize)
    return { from, to }
  }, [count, pageIndex, pageSize])

  useEffect(() => {
    if (!persistPreferences) {
      setPreferencesReady(true)
      return
    }

    let cancelled = false

    async function load() {
      const { row } = await loadTablePreferences(tableKey, userId)
      if (cancelled) return

      setRawPreferencesRow(row)
      setPreferencesReady(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tableKey, userId, persistPreferences])

  useEffect(() => {
    if (!rawPreferencesRow) return

    const row = rawPreferencesRow
    if (row.page_size) setPageSize(row.page_size)
    if (row.column_visibility && typeof row.column_visibility === 'object') {
      const base = normalizeVisibility(columns)
      const merged = { ...base, ...row.column_visibility } as Record<string, boolean>
      for (const col of columns) {
        if (col.lockVisible) merged[col.id] = true
      }
      setVisibility(merged)
    }
    if (row.column_stickiness && typeof row.column_stickiness === 'object') {
      const base = normalizeStickiness(columns)
      const merged: ColumnStickinessMap = { ...base, ...(row.column_stickiness as ColumnStickinessMap) }
      for (const col of columns) {
        if (col.lockSticky && col.sticky) {
          merged[col.id] = col.sticky
        } else if (merged[col.id] === 'left') {
          merged[col.id] = null
        }
      }
      setStickiness(merged)
    }
    if (row.sort_state && Array.isArray(row.sort_state)) {
      const first = (row.sort_state as any[])[0]
      if (first && typeof first === 'object') {
        if (typeof first.sortBy === 'string') setSortBy(first.sortBy)
        if (first.sortDir === 'asc' || first.sortDir === 'desc') setSortDir(first.sortDir)
      }
    }
    if (row.filter_state && typeof row.filter_state === 'object') {
      const defaults = buildDefaultFilters(columns)
      const nextFilters = { ...defaults, ...(row.filter_state as any) }
      setFilters(nextFilters)
      setDraftFilters(nextFilters)
    }
  }, [rawPreferencesRow, columns])

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (settingsOpen && settingsRef.current && !settingsRef.current.contains(target)) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [settingsOpen])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false)
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen])

  useEffect(() => {
    function measureStickyWidths() {
      const row = headerRowRef.current
      if (!row) return
      const cells = row.querySelectorAll<HTMLTableCellElement>('th[role="columnheader"]')
      const leftWidths: Record<string, number> = {}
      const rightWidths: Record<string, number> = {}
      for (const cell of cells) {
        const colId = cell.dataset.colId
        const sticky = cell.dataset.sticky
        if (!colId) continue
        const rect = cell.getBoundingClientRect()
        if (sticky === 'left') leftWidths[colId] = rect.width
        if (sticky === 'right') rightWidths[colId] = rect.width
      }
      setLeftStickyWidths((prev) => {
        const same =
          Object.keys(prev).length === Object.keys(leftWidths).length &&
          Object.entries(leftWidths).every(([k, v]) => prev[k] === v)
        return same ? prev : leftWidths
      })
      setRightStickyWidths((prev) => {
        const same =
          Object.keys(prev).length === Object.keys(rightWidths).length &&
          Object.entries(rightWidths).every(([k, v]) => prev[k] === v)
        return same ? prev : rightWidths
      })
    }
    void measureStickyWidths()
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measureStickyWidths())
        : null
    if (ro && headerRowRef.current) ro.observe(headerRowRef.current)
    let rafId = 0
    function poll() {
      measureStickyWidths()
      widthsStable.current = true
      rafId = window.setTimeout(poll, 500)
    }
    rafId = window.setTimeout(poll, 100)
    return () => {
      if (ro) ro.disconnect()
      window.clearTimeout(rafId)
    }
  }, [orderedVisibleColumns])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    function updateScrollState() {
      const { scrollLeft, scrollWidth, clientWidth } = container
      setScrolledFromLeft(scrollLeft > 0)
      setScrolledFromRight(scrollLeft + clientWidth < scrollWidth - 1)
    }
    updateScrollState()
    container.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      container.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [orderedVisibleColumns, rows, loading])

  function buildSortHeaderCellStyle(col: ServerDataTableColumn<Row>): CSSProperties {
    const effective = stickiness[col.id] ?? null
    const base: CSSProperties = { position: 'sticky', top: 0, zIndex: 30 }
    if (effective === 'left' || effective === 'right') {
      const offset = stickyOffsets[col.id] ?? 0
      if (effective === 'left') {
        return { ...base, left: offset, insetInlineStart: offset, overflowAnchor: 'none' }
      }
      return { ...base, right: offset, insetInlineEnd: offset, overflowAnchor: 'none' }
    }
    return base
  }

  function buildFilterHeaderCellStyle(col: ServerDataTableColumn<Row>): CSSProperties {
    const effective = stickiness[col.id] ?? null
    const base: CSSProperties = { position: 'sticky', top: 48, zIndex: 20 }
    if (effective === 'left' || effective === 'right') {
      const offset = stickyOffsets[col.id] ?? 0
      if (effective === 'left') {
        return { ...base, left: offset, insetInlineStart: offset, overflowAnchor: 'none' }
      }
      return { ...base, right: offset, insetInlineEnd: offset, overflowAnchor: 'none' }
    }
    return base
  }

  function buildBodyCellStyle(col: ServerDataTableColumn<Row>): CSSProperties {
    const effective = stickiness[col.id] ?? null
    if (effective === 'left' || effective === 'right') {
      const offset = stickyOffsets[col.id] ?? 0
      if (effective === 'left') {
        return { left: offset, insetInlineStart: offset, position: 'sticky', overflowAnchor: 'none', zIndex: 1 }
      }
      return { right: offset, insetInlineEnd: offset, position: 'sticky', overflowAnchor: 'none', zIndex: 1 }
    }
    return { zIndex: 1 }
  }

  async function persistVisibility(next: Record<string, boolean>) {
    setVisibility(next)
    if (!persistPreferences) return
    await upsertTablePreferences(userId, tableKey, { column_visibility: next })
  }

  async function persistStickiness(
    colId: string,
    nextValue: 'left' | 'right' | null,
  ) {
    const col = columns.find((c) => c.id === colId)
    if (col?.lockSticky && col.sticky) return

    if (nextValue === 'left') return

    const next: ColumnStickinessMap = { ...stickiness, [colId]: nextValue }

    if (nextValue === 'right') {
      const userRightIds = columns
        .filter((c) => !c.lockSticky && c.id !== colId && next[c.id] === 'right')
        .map((c) => c.id)
      const maxUserRight = 1
      let overflow = userRightIds.length - (maxUserRight - 1)
      if (overflow > 0) {
        for (const rid of userRightIds) {
          if (overflow <= 0) break
          next[rid] = null
          overflow--
        }
      }
    }

    setStickiness(next)
    if (!persistPreferences) return
    await upsertTablePreferences(userId, tableKey, { column_stickiness: next })
  }

  async function persistPageSize(next: number) {
    setPageSize(next)
    setPageIndex(0)
    if (!persistPreferences) return
    await upsertTablePreferences(userId, tableKey, { page_size: next })
  }

  async function persistSort(nextSortBy: string | null, nextSortDir: SortDir) {
    setSortBy(nextSortBy)
    setSortDir(nextSortDir)
    setPageIndex(0)
    if (!persistPreferences) return
    await upsertTablePreferences(userId, tableKey, { sort_state: [{ sortBy: nextSortBy, sortDir: nextSortDir }] })
  }

  async function persistFilters(next: Record<string, unknown>) {
    setFilters(next)
    setPageIndex(0)
    if (!persistPreferences) return
    await upsertTablePreferences(userId, tableKey, { filter_state: next })
  }

  function toggleSort(col: ServerDataTableColumn<Row>) {
    if (!col.sortable || !col.sortKey) return
    if (sortBy !== col.id) {
      void persistSort(col.id, 'asc')
      return
    }
    if (sortDir === 'asc') {
      void persistSort(col.id, 'desc')
      return
    }
    void persistSort(null, null)
  }

  useEffect(() => {
    if (!preferencesReady) return
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      const query: ServerDataTableQuery = {
        pageIndex,
        pageSize,
        sortBy,
        sortDir,
        filters,
      }
      const result = await fetchPage(query).catch((err: unknown) => {
        return { rows: [] as Row[], count: null as number | null, error: err }
      })

      if (cancelled) return

      if ((result as any).error) {
        setRows([])
        setCount(null)
        setError(String((result as any).error))
      } else {
        setRows(result.rows)
        setCount(result.count)
      }

      setLoading(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [preferencesReady, pageIndex, pageSize, sortBy, sortDir, filters, fetchPage, externalReloadKey])

  function hasActiveFilterValue(col: ServerDataTableColumn<Row>) {
    if (!col.filter || col.filter.enabled === false) return false
    const value = filters[col.id]
    return (
      (col.filter.type === 'text' && typeof value === 'string' && value.trim().length > 0) ||
      (col.filter.type === 'select' && value != null) ||
      (col.filter.type === 'boolean' && value != null) ||
      (col.filter.type === 'number' && value != null)
    )
  }

  function hasDraftFilterValue(col: ServerDataTableColumn<Row>) {
    if (!col.filter || col.filter.enabled === false) return false
    const value = draftFilters[col.id]
    return (
      (col.filter.type === 'text' && typeof value === 'string' && value.trim().length > 0) ||
      (col.filter.type === 'select' && value != null) ||
      (col.filter.type === 'boolean' && value != null) ||
      (col.filter.type === 'number' && value != null)
    )
  }

  const hasPendingFilterChanges = useMemo(() => {
    return JSON.stringify(draftFilters) !== JSON.stringify(filters)
  }, [draftFilters, filters])

  const hasAnyDraftFilters = useMemo(() => {
    return columns.some((col) => hasDraftFilterValue(col))
  }, [columns, draftFilters])

  function renderSortIcon(col: ServerDataTableColumn<Row>) {
    if (!col.sortable || !col.sortKey) return null
    if (sortBy !== col.id || !sortDir) return <ChevronDown size={14} className="text-gray-300" />
    if (sortDir === 'asc') return <ArrowUp size={14} className="text-blue-600" />
    return <ArrowDown size={14} className="text-blue-600" />
  }

  function updateDraftFilter(columnId: string, value: unknown) {
    setDraftFilters((prev) => ({ ...prev, [columnId]: value }))
  }

  function applyAllFilters() {
    void persistFilters(draftFilters)
  }

  function clearAllFilters() {
    const defaults = buildDefaultFilters(columns)
    setDraftFilters(defaults)
    void persistFilters(defaults)
  }

  function renderInlineFilter(col: ServerDataTableColumn<Row>) {
    if (!col.filter || col.filter.enabled === false) return null

    if (col.filter.type === 'text') {
      const value = typeof draftFilters[col.id] === 'string' ? (draftFilters[col.id] as string) : ''
      return (
        <div className="space-y-1">
          <input
            value={value}
            onChange={(e) => updateDraftFilter(col.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyAllFilters()
              }
            }}
            placeholder="Filter..."
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      )
    }

    if (col.filter.type === 'number') {
      const rawValue = draftFilters[col.id]
      const value = rawValue == null ? '' : String(rawValue)
      return (
        <div className="space-y-1">
          <input
            value={value}
            onChange={(e) => {
              const trimmed = e.target.value.trim()
              updateDraftFilter(col.id, trimmed === '' ? null : Number(trimmed))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyAllFilters()
              }
            }}
            inputMode="numeric"
            placeholder="Equals..."
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      )
    }

    if (col.filter.type === 'select') {
      const value = draftFilters[col.id]
      return (
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => updateDraftFilter(col.id, e.target.value === '' ? null : e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">All</option>
          {col.filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    if (col.filter.type === 'boolean') {
      const value = draftFilters[col.id]
      return (
        <select
          value={value == null ? '' : value ? 'true' : 'false'}
          onChange={(e) => {
            if (e.target.value === '') updateDraftFilter(col.id, null)
            else updateDraftFilter(col.id, e.target.value === 'true')
          }}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">All</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )
    }

    return null
  }

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          {count != null ? (
            <span>
              {currentRange.from}–{currentRange.to} of {count}
            </span>
          ) : (
            <span>—</span>
          )}
          {loading && <span className="text-gray-400">Loading…</span>}
          {error && <span className="text-red-600">{error}</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyAllFilters}
              disabled={!hasPendingFilterChanges}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={clearAllFilters}
              disabled={!hasAnyDraftFilters && !hasPendingFilterChanges}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => void persistPageSize(Number(e.target.value))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none transition hover:bg-gray-50"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          {showTableSettings && (
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <SlidersHorizontal size={16} />
                Table settings
              </button>
              {settingsOpen && (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">Columns</p>
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(false)}
                        className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto px-4 py-3">
                    <div className="space-y-3">
                      {columns.map((col) => {
                        const effectiveSticky = stickiness[col.id] ?? null
                        const stickyLocked = col.lockSticky && !!col.sticky
                        return (
                          <div
                            key={col.id}
                            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-gray-700">
                                {col.headerLabel}
                              </span>
                              <input
                                type="checkbox"
                                checked={visibility[col.id] !== false}
                                disabled={col.lockVisible}
                                onChange={(e) => {
                                  const next = { ...visibility, [col.id]: col.lockVisible ? true : e.target.checked }
                                  void persistVisibility(next)
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-100"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 shrink-0">
                                Pin
                              </span>
                              {stickyLocked ? (
                                <div className="flex-1 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-blue-700">
                                    Pinned {effectiveSticky === 'left' ? 'Left' : 'Right'}
                                  </span>
                                  <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                    Locked
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 flex-1 bg-white rounded-lg border border-gray-200 p-0.5">
                                  {(['none', 'right'] as const).map((val) => {
                                    const current = effectiveSticky === null ? 'none' : 'right'
                                    const active = val === current
                                    return (
                                      <button
                                        type="button"
                                        key={val}
                                        onClick={() => {
                                          const mapped: 'right' | null =
                                            val === 'none' ? null : 'right'
                                          void persistStickiness(col.id, mapped)
                                        }}
                                        className={
                                          'flex-1 px-2 py-1 rounded-md text-[11px] font-semibold transition ' +
                                          (active
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-50')
                                        }
                                      >
                                        {val === 'none' ? 'None' : 'Right'}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVis: Record<string, boolean> = {}
                          for (const col of columns) nextVis[col.id] = col.lockVisible ? true : true
                          void persistVisibility(nextVis)
                        }}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Show all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVis: Record<string, boolean> = {}
                          for (const col of columns) nextVis[col.id] = col.lockVisible ? true : false
                          void persistVisibility(nextVis)
                        }}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Hide all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVis = normalizeVisibility(columns)
                          const baseSticky = normalizeStickiness(columns)
                          const nextSticky: ColumnStickinessMap = {}
                          for (const col of columns) {
                            if (col.lockSticky && col.sticky === 'right') {
                              nextSticky[col.id] = 'right'
                            } else if (col.lockSticky && col.sticky === 'left') {
                              nextSticky[col.id] = 'left'
                            } else {
                              nextSticky[col.id] =
                                baseSticky[col.id] === 'left' ? null : baseSticky[col.id] ?? null
                            }
                          }
                          void persistVisibility(nextVis)
                          setStickiness(nextSticky)
                          if (persistPreferences) {
                            void upsertTablePreferences(userId, tableKey, {
                              column_visibility: nextVis,
                              column_stickiness: nextSticky,
                            })
                          }
                        }}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                      >
                        Reset defaults
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="overflow-x-auto relative [direction:ltr] min-w-0">
        <table className="w-full text-left text-sm border-separate border-spacing-0 [direction:ltr]">
          <thead className="bg-gray-50 text-gray-500 [&_th]:bg-gray-50">
            <tr ref={headerRowRef} data-sticky-header-row>
              {visibleColumns.map((col) => {
                const cellStyle = buildSortHeaderCellStyle(col)
                const effectiveSticky = stickiness[col.id] ?? null
                const isLeftSticky = effectiveSticky === 'left'
                const isRightSticky = effectiveSticky === 'right'
                const needsLeftShadow = isRightSticky && scrolledFromRight
                const needsRightShadow = isLeftSticky && scrolledFromLeft
                const stickyClass = isLeftSticky || isRightSticky ? 'bg-gray-50' : ''
                return (
                  <th
                    key={col.id}
                    role="columnheader"
                    data-col-id={col.id}
                    data-sticky={effectiveSticky ?? undefined}
                    style={cellStyle}
                    className={
                      'px-4 py-3 font-medium border-b border-gray-100 ' +
                      stickyClass +
                      ' ' +
                      (needsLeftShadow
                        ? 'shadow-[inset_8px_0_8px_-6px_rgba(0,0,0,0.12)] border-l border-gray-200'
                        : '') +
                      ' ' +
                      (needsRightShadow
                        ? 'shadow-[inset_-8px_0_8px_-6px_rgba(0,0,0,0.12)] border-r border-gray-200'
                        : '') +
                      ' ' +
                      (col.className ?? '')
                    }
                  >
                    <div className="flex items-center">
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
                        {renderSortIcon(col)}
                      </button>
                      {hasActiveFilterValue(col) && (
                        <span className="ml-2 inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
            {showFilters && (
              <tr>
                {visibleColumns.map((col) => {
                  const cellStyle = buildFilterHeaderCellStyle(col)
                  const effectiveSticky = stickiness[col.id] ?? null
                  const isLeftSticky = effectiveSticky === 'left'
                  const isRightSticky = effectiveSticky === 'right'
                  const needsLeftShadow = isRightSticky && scrolledFromRight
                  const needsRightShadow = isLeftSticky && scrolledFromLeft
                  const stickyClass = isLeftSticky || isRightSticky ? 'bg-gray-50' : ''
                  return (
                    <th
                    key={`${col.id}-filter`}
                    data-col-id={col.id + '-filter'}
                    style={cellStyle}
                    className={
                      'px-4 py-3 align-top shadow-[0_1px_0_0_rgba(243,244,246,1)] border-b border-gray-100 ' +
                        stickyClass +
                        ' ' +
                        (needsLeftShadow
                          ? 'shadow-[inset_8px_0_8px_-6px_rgba(0,0,0,0.12)] border-l border-gray-200'
                          : '') +
                        ' ' +
                        (needsRightShadow
                          ? 'shadow-[inset_-8px_0_8px_-6px_rgba(0,0,0,0.12)] border-r border-gray-200'
                          : '') +
                        ' ' +
                        (col.className ?? '')
                      }
                    >
                      {renderInlineFilter(col)}
                    </th>
                  )
                })}
              </tr>
            )}
          </thead>
          <tbody className="bg-white">
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-gray-500">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={rowKey ? rowKey(row) : idx} className="group hover:bg-gray-50">
                  {visibleColumns.map((col) => {
                    const cellStyle = buildBodyCellStyle(col)
                    const effectiveSticky = stickiness[col.id] ?? null
                    const isLeftSticky = effectiveSticky === 'left'
                    const isRightSticky = effectiveSticky === 'right'
                    const needsLeftShadow = isRightSticky && scrolledFromRight
                    const needsRightShadow = isLeftSticky && scrolledFromLeft
                    return (
                      <td
                        key={col.id}
                        style={cellStyle}
                        className={
                          'px-4 py-4 bg-white group-hover:bg-gray-50 border-b border-gray-100 ' +
                            (isLeftSticky || isRightSticky
                              ? isRightSticky
                                ? 'col-sticky-right'
                                : 'col-sticky-left'
                              : '') +
                            ' ' +
                            (needsLeftShadow
                              ? 'shadow-[inset_8px_0_8px_-6px_rgba(0,0,0,0.12)] border-l border-gray-200'
                              : '') +
                            ' ' +
                            (needsRightShadow
                              ? 'shadow-[inset_-8px_0_8px_-6px_rgba(0,0,0,0.12)] border-r border-gray-200'
                              : '') +
                            ' ' +
                            (col.className ?? '')
                        }
                      >
                        {col.renderCell(row)}
                      </td>
                    )
                  })}
                </tr>
              ))
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0 || loading}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              if (totalPages) setPageIndex((p) => Math.min(totalPages - 1, p + 1))
              else setPageIndex((p) => p + 1)
            }}
            disabled={loading || (totalPages != null && pageIndex >= totalPages - 1)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

    </div>
  )
}
