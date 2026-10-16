# Frontend Reference

Compact map of the frontend app to reduce future prompt tokens. Focus on structure, key flows, open-first files.

## Location & Tooling

- Stack: React 19 + TypeScript + Vite + Tailwind 4 (via @tailwindcss/vite plugin — no PostCSS)
- Router: react-router-dom 7 (BrowserRouter, path-based routing)
- Icons: lucide-react — use lucide exclusively, no other icon libs
- Package manager: npm
- Scripts: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint` (tsc --noEmit)

## Entry points

- HTML: `index.html`
- React entry: `src/main.tsx` (wraps App in BrowserRouter)
- Root component + route shell: `src/App.tsx` (sidebar, top header, route switcher, lazy views, Suspense, permission gates)
- Central route map: `src/app-routes.ts`
- Tailwind/CSS entry: `src/index.css` (just `@import "tailwindcss";` — Tailwind 4)
- Vite config: `vite.config.ts`

## Environment variables

- Required at runtime (hard-fail on missing):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy `VITE_SUPABASE_ANON_KEY`)
  - Defined and validated in `src/utils/supabase.ts`.

## Navigation & routing model

- `AppView` union (string literals) in `src/types.ts` is the logical view ID.
- `APP_ROUTES` in `src/app-routes.ts` maps each `AppView` → `{ path, navGroup, layoutMode }`.
- App shell: sidebar (w-64 gray-900), top header (h-16 white, shadow-sm), main scrollable (`flex-1 p-4 md:p-6`, max-width switched by `contentWidthClass`).
- `/` redirects to first accessible view via `DefaultRouteRedirect` using the permission filter.
- Sidebar nav visibility is permission-filtered via `visibleNavigation`.
- **New views steps**: add `AppView` union case → add `APP_ROUTES` entry → add lazy import + case in `renderView` switch → add sidebar `NavigationItem` → add mapping in `VIEW_PERMISSIONS` if permission-gated.

## Route-level lazy loading

- View modules imported as `const XxxView = lazy(() => import('./views/XxxView'));`
- Permission checks are eager; inside `ProtectedPage` the Suspense wrapper is rendered *after* the gate passes.
- Shell/bootstrap/auth/permissions/types/routing imports are eagerly imported; everything else is lazy.
- Never broaden eager top-level imports in App.tsx.

## Layout standards

- Single-tab admin pages follow `docs/page-layout-standards-single-tab.md` (list view + full-page form via `?mode=create|edit&id=NN` query params).
- Multi-tab pages follow `docs/page-layout-standards-multi-tab.md` (parent header + SubTabs + active child tab view).
- All screens use shared `STYLES` card/button/input/kicker Tailwind constants from `src/components/ui/STYLES.ts` — no hard-coded duplicate Tailwind strings.
- Source-of-truth UI guide lives at `/settings/theme-guide` (`src/views/ThemeGuideView.tsx`).

## Reusable components

- `ServerDataTable` — server pagination, sort, filter, column visibility, column stickiness, persisted user preferences. Depends on `user_table_preferences` SQL table (see `src/utils/tablePreferences.ts`).
- `SubTabs` — standard border-b tab bar.
- `ValueHelpField` — generic large lookup dialog with server sort/filter/pagination.
- `Tooltip` — portal smart-flip tooltip (`info` icon default).
- `LoginForm` — split-pane login (dark brand panel + light auth card).
- `DeleteConfirmationModal` — shared delete confirmation modal.
- UI primitives from `src/components/ui/STYLES.ts`: `Badge`, `Section`, `KeyValueRow`, and `STYLES` class-string constants.

## Authorization / permissions

- `PermissionProvider` in `src/permission-context.tsx` — provides `can()` / `canAny()` / `canAll()` hooks, `VIEW_PERMISSIONS` map from `AppView → permission_code`.
- Replace the current `loadContext()` stub with a call to your actual backend RBAC source (your own service role RPC or edge function) when the backend RBAC is ready.
- `ProtectedPage` gates access *before* suspending for lazy chunks.

## Deployment note

Because we use `BrowserRouter` (path-based routing), production hosting MUST serve `index.html` for unknown routes, or client refresh on non-root paths will 404.
