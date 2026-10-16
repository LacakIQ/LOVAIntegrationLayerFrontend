# Build & Tooling Changelogs — Architecture, Known Issues & Revision History

**Scope**: Cross-cutting build/compile/typecheck fixes, environment declarations, and cross-module pattern-mismatch call-site fixes that do not belong in a single feature's per-module changelog.

**Source files touched in this rev**:
- `src/vite-env.d.ts` (new file — Vite client type declarations)
- `src/views/ThemeGuideView.tsx` (SubTabs call-site prop-name fix — also documented in `theme-guide-changelogs.md` as `BUG-TG-01`)

**Related global index**: [`docs/project-changelogs.md § 2026-09-23`](project-changelogs.md#2026-09-23)

---

## Architecture & Technical Invariants

### TypeScript + Vite Invariants

1. **`import.meta.env` MUST be declared via the Vite Client types.** Vite ships its `ImportMetaEnv` interface in `node_modules/vite/client.d.ts`. The only project-side declaration required is a single-file reference: `/// <reference types="vite/client" />` inside `src/vite-env.d.ts` (or any `.d.ts` reachable via `tsconfig.json`). Without this file, every access to `import.meta.env.VITE_*` surfaces a TypeScript error:
   > *Property 'env' does not exist on type 'ImportMeta'.*
2. **Project-specific env keys.** `src/utils/supabase.ts` depends on `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` being accessible through `import.meta.env`. Any `.env.example` change that adds a new `VITE_*` variable MUST also be represented here (no action required for new keys — Vite's ambient default allows any key). If strict typing of env keys is introduced later, extend `ImportMetaEnv` in this file.
3. **Component signatures must match their call-sites.** When copying component files (e.g. SubTabs, ServerDataTable) from a sister project, the *consuming call-site* props must be updated to match the *exported* component's signature, not the source-project calling convention.

---

### 2026-09-23.rev1 — `import.meta.env` type declarations restored + cross-project SubTabs prop mismatch repaired

**Scope**: `src/vite-env.d.ts` (created); one call-site in `src/views/ThemeGuideView.tsx`.

#### Changes

- Created `src/vite-env.d.ts` with `/// <reference types="vite/client" />`. This file has the same contents and location as its twin in the DSS project and is the standard Vite scaffold pattern (`npm create vite@latest` generates it).
- Verified it is picked up by `tsconfig.json`: the config's `include` covers `src/**/*`, so the `.d.ts` is ambiently available throughout the frontend TS compilation unit.
- Updated the SubTabs call-site in `ThemeGuideView.tsx` to use props `active` and `setActive` (see also: theme-guide-changelogs.md rev1 BUG-TG-01 / FIX-TG-01 for a fuller write-up of the behavioral impact).

#### Found Bugs

- **BUG-BT-01 — HIGH — All `import.meta.env.VITE_*` usages failed TypeScript type-check with `'env' does not exist on ImportMeta`.** The CMSFrontend project scaffold was missing `src/vite-env.d.ts` despite every Vite project (and its DSS twin) requiring it. Impact: 2 compile-time errors in `src/utils/supabase.ts`; any new file using `import.meta.env` would fail the same way. `npm run lint` (tsc --noEmit) produced 2 type errors and blocked CI if lint was a gate. Reproduction: run `tsc --noEmit` on the previous commit.
- **BUG-BT-02 — CRITICAL — Cross-project SubTabs call-site prop name mismatch caused Theme Guide tab switching to silently fail.** When the Theme Guide skeleton was copied from a different source, the SubTabs call kept the source-project's older prop names (`activeTab`, `onTabChange`) while the CMSFrontend `SubTabs.tsx` component exposed a newer signature (`active`, `setActive`). Both prop names are valid identifiers at the JSX level, so no runtime exception was thrown — the tab content simply never changed and React logged no warnings. Impact: 3-tab navigation completely broken in the Theme Guide. Reproduction: click the "Table + Actions" tab — the text beneath never updates. Severity CRITICAL because the primary UI pattern reference page (AGENTS-mandated Source of Truth) became completely misleading the moment a 2nd/3rd tab was relied upon.

#### Fixes

- **FIX-BT-01** — Added `src/vite-env.d.ts`. Verification steps: (1) Run `npm run lint` in the project root — 0 errors. (2) Open `src/utils/supabase.ts` in VSCode — no red squiggles on `import.meta.env.VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`. (3) `npm run build` succeeds with no type errors or module-resolution failures for the `vite/client` ambient.
- **FIX-BT-02** — Call-site updated from `SubTabs activeTab=… onTabChange=…` to `SubTabs active=… setActive=…`. Verification steps: (1) Load `/settings/theme-guide`. (2) Click "Table + Actions" — content updates to show the full working table. (3) Click "Status UI" — content updates to show semantic banners + status strip. (4) Click "Form Layout" — content updates to show full demo form. (5) React DevTools show `active` prop updating correctly on SubTabs, no unknown-prop console warnings.
