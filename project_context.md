# Project Context

Compact repo map for AI agents and contributors. Replace placeholders with real info before starting work.

## Project Identity

- **Project Name**: `CMS`
- **Short description**: `Frontend for content management system`
- **Stack**: Frontend (React 19 + Vite + TypeScript + Tailwind 4 + React Router 7 + Supabase) + Supabase Backend (Edge Functions + Postgres)
- **Tenancy model**: `multi-tenant (company-scoped)`

## Open-first files for this project

Before doing anything else, read these:

1. `AGENTS.md` at project root — non-negotiable rules (changelogs, scope guardrail, UI rules)
2. `FRONTEND_REFERENCE.md` — compact architecture map, routing model, component locations
3. `src/views/ThemeGuideView.tsx` — visual source of truth for page/form/table/button styles
4. `docs/page-layout-standards-single-tab.md` — standard list + full-page-form pattern

## Key source layout

```
src/
├─ App.tsx                      # Route shell + sidebar + header + lazy route rendering switch
├─ main.tsx                     # BrowserRouter entry
├─ index.css                    # Tailwind 4 import (one line)
├─ types.ts                     # AppView union + domain entity interfaces
├─ app-routes.ts                # APP_ROUTES definitions, path helpers
├─ permission-context.tsx       # PermissionProvider + can() hooks, VIEW_PERMISSIONS map
├─ useAuth.ts                   # Supabase session loading + validation
├─ utils/
│  ├─ supabase.ts               # Singleton Supabase client (hard-fails on missing env)
│  └─ tablePreferences.ts       # ServerDataTable persisted user prefs → SQL user_table_preferences
├─ components/
│  ├─ ServerDataTable.tsx       # Server pagination/sort/filter/sticky/visibility/prefs persistence
│  ├─ ValueHelpField.tsx        # Generic lookup dialog with server-side sort/filter/paginate
│  ├─ SubTabs.tsx               # SubTabs tab bar
│  ├─ Tooltip.tsx               # Portal-based smart-flip tooltip
│  ├─ LoginForm.tsx             # Split-pane login screen
│  ├─ shared/DeleteConfirmationModal.tsx
│  └─ ui/STYLES.ts              # Shared card/button/input/badge Tailwind strings + Badge/Section/KeyValueRow
└─ views/
   ├─ DashboardView.tsx
   └─ ThemeGuideView.tsx        # Visual source-of-truth UI guide

docs/
├─ project-changelogs.md        # Global changelog index (per-module logs under docs/<module>-changelogs.md)
├─ page-layout-standards-single-tab.md
├─ page-layout-standards-multi-tab.md
└─ ui-modal-guidelines.md
```

## Current open questions / things agents should not invent answers for:

- (none yet — add items as they come up.)
