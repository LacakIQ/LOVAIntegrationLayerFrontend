# AGENTS.md

This file contains repo-level instructions for AI coding agents and contributors working in this frontend project.

## Required Reading

- Read `project_context.md` first (if it exists) for the compact repo map, tenancy summary, and open-first files before scanning the wider codebase.
- If there are module-specific guideline docs under `docs/`, read the relevant one before modifying that module.

## Changelog Requirements (MANDATORY on every non-trivial form/view change)

Project changelogs are the authoritative audit trail for **form/view/page changes, discovered bugs, and fixes applied**. AI AGENTS MUST update changelogs on every non-trivial frontend change — skipping this is a failure of task completion.

### 1. Two-Tier Filesystem Layout

- **Per-Module Changelogs (Deep Technical Logs)**: For every distinct form, view, or UI module you modify, **create or append** to:
  ```
  docs/<kebab-case-module>-changelogs.md
  ```
  Examples:
  - Users → `docs/user-changelogs.md`
  - Orders → `docs/order-changelogs.md`
  - Dashboard → `docs/dashboard-changelogs.md`

- **Global Cross-Reference Index (Concise Developer Timeline)**:
  ```
  docs/project-changelogs.md
  ```
  The global file is a **scannable index only** — concise 2–3 line summary per module per date linking via **markdown header anchors** (`#anchor`). Never write fragile line numbers (`#Lstart-Lend`).

### 2. Per-Module Changelog Format (Detailed Technical Spec)

Each per-module `*-changelogs.md` must contain full architectural context:

1. **Header**: `# <Module> Changelogs — Architecture, Known Issues & Revision History`.
2. **Header metadata (recommended)**: Target route path, parent epic/ticket ID, cross-reference link to `docs/project-changelogs.md`, and clickable links to related source files.
3. **Architecture & Technical Invariants** (on first creation): Payload contracts, database relations, Edge Function / RPC integration, state machines, and RBAC permissions.
4. **Date-Descending Revision Sections** (newest on top):
   ```markdown
   ### YYYY-MM-DD.<revN> — <Short Descriptive Title>
   **Scope**: Components, hooks, or backend functions modified.

   #### Changes
   - In-depth technical explanation of modifications, state lifecycle, and UX behavior.

   #### Found Bugs
   - **BUG-<MOD>-XX**: Root cause analysis, reproduction conditions, and severity (CRITICAL / HIGH / MEDIUM / LOW).

   #### Fixes
   - **FIX-<MOD>-XX**: Code changes applied, edge cases addressed, and verification steps.
   ```
5. **Known Bugs & Architecture Issue Matrix** (recommended): Tabular summary of issues (`BUG-XX`), severities, root causes, impacts, and target resolutions.

**Hard formatting rule**: Every date section MUST have all three sub-headings — `Changes`, `Found Bugs`, `Fixes`. If a category has no items for this rev, write `(none for this rev)` under it. Never omit the category heading.

### 3. Global Index Update Flow (`docs/project-changelogs.md`)

After appending to the per-module changelog:

1. Open `docs/project-changelogs.md` and locate today's `## YYYY-MM-DD` date block (create it if first change of the day).
2. Under that date, add a concise entry with an anchor link pointing directly to the module revision header:
   ```markdown
   #### [Module Name](<module>-changelogs.md#header-anchor)
   - **Added/Changed**: Brief 1-line summary.
   - **Fixed**: Brief 1-line summary of bug solved (write `(none)` if none).
   ```
3. **Keep it concise and robust**: Never duplicate full paragraphs in the global file, and never use line-number deep links (`#L10-L20`).

### 4. When must you update changelogs?

Always update changelogs (both per-module + global) on any of the following:

- Any form save/submit flow changes (`handleSave`, `handleSubmit`, mutation side effects).
- Any bug fix for any bug report / runtime error / broken UX defect identified and corrected.
- Any validation rule added / removed / tightened / altered.
- Any permission check added / changed (e.g. `can('feature.edit')` gating).
- Any new Edge Function integration wired into a form.
- Any new backend RPC / Stored Proc calls wired into a form save.
- Any architectural integration decisions (atomicity, idempotency, retry mechanisms).
- Any workflow changes to navigation, post-submit routing, unsaved-changes guards.

**If you skip the changelog updates on a task, YOUR WORK IS NOT CONSIDERED COMPLETE. Go back and add them before marking tasks as done.**

## HARD RULE: SCOPE GUARDRAIL — NO NEW DATABASE FIELDS WITHOUT USER CONSULT

Before adding any new database field (column, enum variant, new table with custom columns, new settings rows, configurable tolerance columns or any soft-configurable feature that currently has no existing schema column — ALWAYS consult the user FIRST in chat via AskUserQuestion BEFORE implementing. NEVER add new fields or introduce new configuration columns or new setting storage just to support a feature you are implementing unless the user has explicitly approved it in chat.

If you add any database field without user consultation, YOUR WORK IS NOT CONSIDERED COMPLETE. Go back and consult the user before proceeding.

## Project-Specific Conventions

### Routing and Views

- `AppView` union in `src/types.ts` is the logical view identifier.
- `APP_ROUTES` in `src/app-routes.ts` maps each `AppView` → `{ path, navGroup, layoutMode }` (layoutMode: default = `max-w-6xl`, wide = `max-w-[1600px]`, full = `w-full`).
- `src/App.tsx` contains the route shell: sidebar (fixed w-64 gray-900), top header (h-16), scrollable main (p-4 md:p-6), and central render switch with lazy-loaded Suspense-wrapped views.
- `/` redirects to first accessible view via `DefaultRouteRedirect` (permissions filter).

### Route-Level Lazy Loading

- View modules imported as `const XxxView = lazy(() => import('./views/XxxView'))` at top of `App.tsx`.
- Permission checks are eager. `ProtectedPage` renders `Suspense(fallback=RouteChunkLoadingPanel())` *after* gate passes.
- Shell/bootstrap/auth/permissions/routing/type imports are always eager; don't broaden eager imports.

### Authorization & RBAC

- Wrap `<App>` inside `<PermissionProvider profile={...}>` — defined in `src/permission-context.tsx`.
- Hook: `const { can, canAny, canAll } = usePermissions()`.
- Map views to permissions via `VIEW_PERMISSIONS` in `permission-context.tsx`.
- Always-allowed views live in `ALWAYS_ALLOWED_VIEWS`.

### Database Client

- Import `supabase` from `src/utils/supabase.ts`. This file throws at import time if env vars are missing — never call `createClient()` yourself inside components.

### UI Patterns

- Shared Tailwind class constants (`pageCard`, section cards, buttons, inputs, banners) live in `src/components/ui/STYLES.ts`. Reuse `STYLES.x` strings instead of duplicating long class lists.
- Visual reference (source of truth) for all screens: `src/views/ThemeGuideView.tsx` → route `/settings/theme-guide`.
- **Page layout standards**: see `docs/page-layout-standards-single-tab.md` and `docs/page-layout-standards-multi-tab.md`.
- **Modal rules**: `docs/ui-modal-guidelines.md` (actions in the header top-right, no footer actions).
- **Modals**: Actions always in the modal header. Delete confirmations use the shared `DeleteConfirmationModal` in `src/components/shared/DeleteConfirmationModal.tsx`.

### Architecture Rules

- Tables: `ServerDataTable` (`src/components/ServerDataTable.tsx`) = server pagination, server sort, inline per-column text/select/boolean/number filters, sticky left/right columns, column visibility toggle, persisted user preferences via `user_table_preferences` SQL table (requires prerequisite SQL — see `src/utils/tablePreferences.ts`).
- Lookup fields: `ValueHelpField.tsx` = generic lookup dialog with its own server-driven page/sort/filter.
- Tab bars: `SubTabs.tsx`.
- Tooltips: `Tooltip.tsx` (portal, smart flip placement).
- SubTabs state via `useState` in parent; URL sync optional.
