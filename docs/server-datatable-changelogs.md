# ServerDataTable Changelogs — Architecture, Known Issues & Revision History

**Target route**: All views rendering a paginated, server-driven table (via `ServerDataTable`).
**Source files**:
- `src/components/ServerDataTable.tsx`
- `src/utils/tablePreferences.ts`

**Related global index**: [`docs/project-changelogs.md § 2026-09-23`](project-changelogs.md#2026-09-23)

---

## Architecture & Technical Invariants

### Contract with `fetchPage()`

Callers provide an async `fetchPage(query)` function that MUST satisfy this shape:

```ts
type ServerDataTableQuery = {
  pageIndex: number;      // 0-based
  pageSize: number;       // user-selectable: 25 | 50 | 100 (default 25)
  sortBy: string | null;  // matches ServerDataTableColumn.id
  sortDir: 'asc' | 'desc' | null;
  filters: Record<string, unknown>;  // keys = column.id
};
type ServerDataTableFetchResult<Row> = {
  rows: Row[];            // page of rows (length ≤ pageSize)
  count: number | null;   // total rows across all pages (for pagination UI); null = unknown
};
```

### Persistence Schema (`user_table_preferences`)

User-specific preferences are loaded via `loadTablePreferences(tableKey, userId)` and written via `upsertTablePreferences(userId, tableKey, { … })` from `src/utils/tablePreferences.ts`. The payload columns — and the React state fields they map to — are:

| DB Column | React State | Shape / Notes |
|-----------|-------------|---------------|
| `page_size` | `pageSize` | number (25 / 50 / 100) |
| `column_visibility` | `visibility` | `Record<string, boolean>`; `col.lockVisible=true` keys hard-forced to `true` on apply |
| `column_stickiness` | `stickiness` | `Record<string, 'left' \| 'right' \| null>`; `left` rejected at apply time for non-lockSticky cols |
| `sort_state` | `sortBy`, `sortDir` | stored as `[{ sortBy, sortDir }]` (object-in-array format) |
| `filter_state` | `filters`, `draftFilters` | `Record<string, unknown>` per column id |

### Sticky-Column Invariants

1. **Left stickiness is LOCKED DOWN for user-editable columns.** Only `col.lockSticky && col.sticky === 'left'` columns survive through persist + load pipelines. Any `left` value on a non-locked column is coerced to `null` at apply time and silently dropped in `persistStickiness`.
2. **Right stickiness is capped at 1 user-pinned column.** Calling `persistStickiness(colId, 'right')` on a 2nd non-lockSticky column automatically demotes the existing right-pinned user column to `null`. Lock-sticky columns (typically "Actions") do not count against this cap.
3. **Sticky offsets are DOM-measured.** Accumulated left/right offsets in the render phase depend on actual `<th>` `getBoundingClientRect()` widths, captured via:
   - `ResizeObserver` on `headerRowRef`, and
   - a `setTimeout` poller every 500 ms (guard for browsers without ResizeObserver).

### Component Guarantees

- **Cancel-safe fetches.** The fetch `useEffect` uses a `let cancelled = false` flag; stale resolves after unmount or parameter change are dropped.
- **Error-safe fetches.** `fetchPage()` is wrapped in `.catch()`; thrown promises are captured into `error` state (red text in the top toolbar), never propagated as unhandled rejections.
- **Fetches are gated on `preferencesReady`.** Before stored preferences are loaded (when `persistPreferences = true`), no data fetch fires. The component waits until preferences load before firing its first query.

---

### 2026-09-23.rev1 — Complete rewrite to match DSS reference (race-condition fixes + restored features)

**Scope**: `src/components/ServerDataTable.tsx` (1040 lines; functionally identical to DSS when ignoring whitespace).

#### Changes

- Split the old single "load preferences + apply preferences + start fetching" effect into two separate effects:
  1. **Load effect** — calls `loadTablePreferences(tableKey, userId)`, sets `rawPreferencesRow`, flips `preferencesReady = true`.
  2. **Apply effect** — watches `rawPreferencesRow` and materializes all 5 persisted fields into their state buckets, applying the anti-corruption rules.
- Replaced the single generic `persistPatch()` with five type-safe async persist functions:
  - `persistVisibility(next)` → sets `visibility`, persists under `column_visibility`.
  - `persistStickiness(colId, nextValue)` → enforces left-sticky block and right-pin cap before persist.
  - `persistPageSize(next)` → resets `pageIndex` to `0` after changing size.
  - `persistSort(sortBy, sortDir)` → resets `pageIndex` to `0`; stores as `[{ sortBy, sortDir }]`.
  - `persistFilters(next)` → resets `pageIndex` to `0`.
- Replaced inline style objects with three dedicated CSS-prop builder functions for correct z-index layering and RTL support:
  - `buildSortHeaderCellStyle(col)` → `sticky top:0; zIndex:30`
  - `buildFilterHeaderCellStyle(col)` → `sticky top:48; zIndex:20`
  - `buildBodyCellStyle(col)` → `zIndex:1` (sticky cells add `position:sticky`)
  All three set both `left`/`right` and `insetInlineStart`/`insetInlineEnd`, and set `overflowAnchor: 'none'`.
- Added `ResizeObserver` on `headerRowRef` plus a 500 ms poller for accurate sticky-pin width measurement. Fallback DOM-snapshot `readDomWidths()` fills in before state populates.
- Added scroll state tracking (`scrolledFromLeft`, `scrolledFromRight`) via scroll listener on the overflow container, rendering as inset box-shadow borders + solid gray-200 borders on the near side of any sticky cell.
- Added a direction lock: `[direction:ltr]` on both the scroll container and the table element to prevent RTL layout jumps.
- Added `hasActiveFilterValue(col)` helper driving a blue `h-2.5 w-2.5 rounded-full bg-blue-600` indicator dot on every column header with a non-empty filter applied.
- Added `hasDraftFilterValue`, `hasPendingFilterChanges` (memoized), and `hasAnyDraftFilters` to drive Apply/Clear button disabled state and Enter-key-apply behavior.
- Settings panel footer now has three actions: "Show all", "Hide all", "Reset defaults".
- Settings panel: lockSticky indicator shows a `Pinned Left/Right` info card with a `Locked` pill badge. The None/Right segmented toggle removes the (disallowed) Left option for users.
- Settings panel closes on outside `mousedown` or global Escape keydown.
- Enter key inside text/number inline filter inputs now calls `applyAllFilters()` immediately.
- Next button respects `totalPages` for disable; Top toolbar shows `X–Y of N` or `—` when count is null.

#### Found Bugs

- **BUG-SDT-01 — CRITICAL — Race condition on first render with `persistPreferences=true`**. The old single-effect pattern fired a fetch with default values because `preferencesReady` was set to `true` in the same tick as the saved preference state, and React state updates were not yet applied. All subsequent fetches also remained at the default page-size/sort/filter configuration because state writes were pending. Reproduction: any user with a previously saved `page_size: 100` who navigated into a ServerDataTable view would see page 1 at 25 rows on first paint.
- **BUG-SDT-02 — HIGH — Sort toggle logic collided when `col.id !== col.sortKey`.** Old code compared `sortBy !== col.sortKey` to decide whether to reset sort direction. Two columns sharing a `sortKey` (or a column with mismatched id/sortKey) never cleared or toggled correctly. Users would click sort and see the column header flicker between asc/desc without changing `sortBy`.
- **BUG-SDT-03 — HIGH — Sticky columns anti-corruption missing.** Users could pin arbitrary columns to `left`, causing two overlapping left-pinned non-header cells to render with broken layout. Persisted left-sticky records with `left` on a non-lockSticky column were re-applied verbatim on reload.
- **BUG-SDT-04 — HIGH — Right-pinned column stacking.** Users could set 5+ columns to right-sticky, which overflowed the viewport width and left no scrollable center region.
- **BUG-SDT-05 — MEDIUM — Settings panel sticky-column scroll shadows missing.** Old inline-style sticky cells had no visual "break" when scrolled, making it impossible to tell when the left/right column was on-screen or how far a user had scrolled.
- **BUG-SDT-06 — MEDIUM — No visible active-filter indicator on headers.** Users couldn't tell which columns had filters applied without scrolling down into the filter row.
- **BUG-SDT-07 — MEDIUM — Inline style objects lacked RTL and z-index layering.** Filter-row headers sometimes rendered *under* sort-row headers in RTL locales or when a user scrolled after switching tabs, because both layers used the same zIndex.
- **BUG-SDT-08 — LOW — No ResizeObserver fallback.** If the DOM hadn't painted `headerRowRef` cells before the first React render (rare but possible under heavy load), sticky pin offsets were calculated as `0` for the first frame, causing a visible 1-frame jump when widths arrived later.
- **BUG-SDT-09 — LOW — Pagination: "Next" button never disabled with count known.** The Next button kept incrementing `pageIndex` past the last page, showing empty rows and breaking the `Page X of Y` footer display.

#### Fixes

- **FIX-SDT-01** — Split preferences pipeline into two `useEffect` blocks (load → apply) and gate the fetch `useEffect` dependency list on `preferencesReady` so the first fetch fires only after materialized state is in React. Verified by checking React DevTools state panel before/after: `pageSize` now reads saved value before `loading` toggles to `true`.
- **FIX-SDT-02** — Rewrote `toggleSort(col)` to use `col.id` everywhere (matches `sortBy` state). Sort cycle: none → asc → desc → none per-column id. Load-time sort_state parse reads first array element `{ sortBy, sortDir }`. Persist now writes the same shape.
- **FIX-SDT-03** — Three layered defenses: (1) `persistStickiness()` immediately returns if `nextValue === 'left'` on a non-lockSticky column. (2) On `rawPreferencesRow` apply, every `left` value on a non-lockSticky column is coerced to `null`. (3) Settings UI removes "Left" from the segmented None/Right toggle unless the column has `lockSticky`.
- **FIX-SDT-04** — `persistStickiness()` computes `overflow = count_of_user_right - (maxUserRight - 1)` and demotes overflow count of oldest (first-encountered) non-lockSticky right columns to `null`.
- **FIX-SDT-05** — Track `scrolledFromLeft` / `scrolledFromRight` via `addEventListener('scroll', ... { passive: true })` on the scroll container. Apply `shadow-[inset_8px_0_...]` + a `border-l` / `border-r` on the shadow side of any sticky `<th>` (both rows) and `<td>`.
- **FIX-SDT-06** — Added `hasActiveFilterValue(col)` helper covering all four filter type switch cases. Rendered as an inline blue dot after the sort chevron in the sort header row button group.
- **FIX-SDT-07** — Three `build*CellStyle` functions with explicit z-index (30 / 20 / 1) and `insetInlineStart` / `insetInlineEnd` for RTL support.
- **FIX-SDT-08** — Combine three strategies: (a) `ResizeObserver` live updates on the header `<tr>`, (b) `setTimeout` poller first firing at 100 ms then every 500 ms, (c) fallback DOM-snapshot `readDomWidths()` inside `stickyOffsets` useMemo before state-based widths exist.
- **FIX-SDT-09** — Next button `disabled = loading || (totalPages != null && pageIndex >= totalPages - 1)`. Footer displays `totalPages` fallback correctly: `Page X` when unknown.
