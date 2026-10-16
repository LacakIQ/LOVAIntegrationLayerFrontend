# ThirdPLIL Frontend Architecture — Routing, Navigation, Permission Boundaries, View Inventory

**Backend twin PRD**: [01-PRD-master.md](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/01-PRD-master.md)
**Frontend changelog**: [kiriminaja-frontend-changelogs.md](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/KiriminAja/kiriminaja-frontend-changelogs.md)
**Global frontend project index**: [project-changelogs.md](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/project-changelogs.md)
**Related pattern references (MANDATORY read before writing code)**:
  - [AGENTS.md / page-layout-single-tab rules](../page-layout-standards-single-tab.md)
  - [page-layout-multi-tab (Webhook Log 3 sub-tabs)](../page-layout-standards-multi-tab.md)
  - [ui-modal-guidelines.md](../ui-modal-guidelines.md) — DeleteConfirmationModal, header-actions buttons, PIN entry modals
  - [theme-guide-changelogs.md](../theme-guide-changelogs.md) + [src/views/ThemeGuideView.tsx](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/views/ThemeGuideView.tsx) — all UI tones, colors, statuses
  - [ServerDataTable spec](../server-datatable-changelogs.md) + [src/components/ServerDataTable.tsx](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/components/ServerDataTable.tsx)
  - [`src/components/ui/STYLES.tsx`](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/components/ui/STYLES.tsx) — pageCard / banner / input / button classes

---

## 1. System Role (Frontend)

ThirdPLILFrontend is the **management-only operational UI** for the Third-Party Logistics Integration Layer.

**WHO uses it**:
- Ops/Admin users (subscriber_admin = IL operations staff, not Webstore buyers)
- Finance users (COD settlement views, KA Credit usage)
- Integration/dev engineers (debug price discrepancies, test connections, replay DLQ events)

**WHO does NOT use it**:
- Webstore storefront buyers (path B, entirely separate WebstoreFrontend project)
- WMS packing staff (they use DSS/CMS WMS)
- Merchant owners (they use Webstore admin; this IL UI is *platform ops* only unless we add a future merchant-login portal)

**CRITICAL invariant**: Frontend only uses **Path A JWT authentication** (login → Supabase auth.users). Path B (API key) is never used from browser; Path B is Webstore backend ↔ IL backend machine-to-machine only.

---

## 2. AppView Variants & Routing Inventory

### 2.1 Type Definition (src/types.ts — add these 5 variants)

```ts
export type AppView =
  // … existing variants …
  | 'kiriminaja-credentials'
  | 'kiriminaja-rate-calculator'
  | 'kiriminaja-shipments-dashboard'
  | 'kiriminaja-shipments-create'
  | 'kiriminaja-webhooks-log';
```

### 2.2 Nav Groups (src/app-routes.ts → APP_ROUTES — 3 nav groups)

| AppView | Nav Group | Nav Label | Icon (lucide-react) | layoutMode | Permission Required (VIEW_PERMISSIONS map) | Sibling Links |
|:---|:---|:---|:---|:---|:---|:---|
| `kiriminaja-credentials` | settings | Credentials (Logistics) | KeyRound | wide | `thirdplil.credentials.view` | none (leaf) |
| `kiriminaja-rate-calculator` | tools (NEW top-level group) | Rate Calculator | Calculator | wide | `thirdplil.rates.read` | none (leaf) |
| `kiriminaja-shipments-dashboard` | **thirdplil** (NEW top-level group) | Shipments Dashboard | Truck | full | `thirdplil.shipments.view` | parent of Shipments (children below) |
| `kiriminaja-shipments-create` | **thirdplil** — child of Shipments | Create Shipment (wizard) | PackagePlus | wide | `thirdplil.shipments.create` | child |
| `kiriminaja-webhooks-log` | **thirdplil** — sibling of Shipments | Webhook Admin | Repeat2 | full | `thirdplil.webhook.view` | child (3 sub-tabs inside) |

Nav group order in left sidebar:
1. 🏠 Dashboard (existing)
2. 🛠️ **ThirdPLIL** (NEW — Truck icon, expandable with 3 children: Shipments Dashboard / Create Shipment / Webhook Admin)
3. 📊 Reports (future if exists)
4. 🧰 **Tools** (NEW — Rate Calculator first child)
5. ⚙️ Settings (existing) — add child: Credentials (Logistics)

### 2.3 Permission Mapping (src/permission-context.tsx VIEW_PERMISSIONS update)

```ts
// Existing permission-context hook maps: ctx.permission_codes (string[]) -> can()
// Add 5 view rows to VIEW_PERMISSIONS dict:
VIEW_PERMISSIONS = {
  // … other views …
  'kiriminaja-credentials':           ['thirdplil.credentials.view'],
  'kiriminaja-rate-calculator':       ['thirdplil.rates.read', 'thirdplil.coverage.read'],
  'kiriminaja-shipments-dashboard':   ['thirdplil.shipments.view'],
  'kiriminaja-shipments-create':      ['thirdplil.shipments.create', 'thirdplil.coverage.read', 'thirdplil.rates.read'],
  'kiriminaja-webhooks-log':          ['thirdplil.webhook.view'],
};

// Action permissions (useCan hook within each view):
ACTION_PERMISSIONS = {
  'thirdplil.credentials.edit':   ['thirdplil.credentials.edit'],
  'thirdplil.shipments.edit':     ['thirdplil.shipments.edit'],
  'thirdplil.shipments.pickup':   ['thirdplil.shipments.pickup'],
  'thirdplil.webhook.replay':     ['thirdplil.webhook.replay'],
  'thirdplil.webhook.consumers.edit': ['thirdplil.webhook.consumers.edit'],
};
```

### 2.4 App.tsx Wiring (4 step pattern — AGENTS routing convention)

1. `lazy()` import at top (NOT inside render switch):
   ```ts
   const CredentialsKiriminAjaView = lazy(() => import('./views/thirdplil/CredentialsKiriminAjaView'));
   const RateCalculatorView = lazy(() => import('./views/thirdplil/RateCalculatorView'));
   const ShipmentsDashboardView = lazy(() => import('./views/thirdplil/ShipmentsDashboardView'));
   const ShipmentCreateWizardView = lazy(() => import('./views/thirdplil/ShipmentCreateWizardView'));
   const WebhookEventLogView = lazy(() => import('./views/thirdplil/WebhookEventLogView'));
   ```
2. Switch/case inside `renderView()` → one case per AppView → render lazy component.
3. Sidebar nav: add new groups in menu order §2.2. Use `lucide-react` icons. Expandable menus for ThirdPLIL (expand collapse Chevron).
4. NotFound fallback: 404 page with Back button.

### 2.5 Breadcrumb Standard (per AGENTS page layout)

| View | Breadcrumb (3-segment): |
|:---|:---|
| CredentialsKiriminAjaView | Settings › Credentials (Logistics) › Overview |
| RateCalculatorView | Tools › Rate Calculator › Live Price Check |
| ShipmentsDashboardView | ThirdPLIL › Shipments › Dashboard |
| ShipmentCreateWizardView | ThirdPLIL › Shipments › Create New (5-step wizard) |
| WebhookEventLogView | ThirdPLIL › Webhook Admin (multi-tab: Events / DLQ / Consumer URLs) › All Events |

---

## 3. Page-level CTA Header Bar (every view)

Per AGENTS page layout: every view starts with `<div className={STYLES.pageCard}>` → inside that:

**Page header region (3-row layout per page-card standard from Theme Guide)**:
1. Kicker (small blue pill-label text — e.g. "ThirdPLIL Settings")
2. H2 title + subtitle (description)
3. **Top-right action CTA bar** (primary/secondary/danger buttons as appropriate):

| View | Primary CTA (rightmost, blue-600 rounded-xl) | Secondary CTA 1 | Secondary CTA 2 |
|:---|:---|:---|:---|
| CredentialsKiriminAjaView | + Add New Credential Account | Test Connection (per-card) | Generate New Webhook Secret (per-card) |
| RateCalculatorView | Fetch Live Rates (after all required fields filled) | Clear Form | Use Demo Address (quick-fill) |
| ShipmentsDashboardView | Create Shipment → → → navigates to wizard (same action as nav) | ⬇️ Export CSV (selected rows) | Bulk Actions dropdown (Cancel / Request Pickup / Download AWB) |
| ShipmentCreateWizardView | Submit & Create Order (Step 5 only) | Back / Save Draft | Rate Calculator preview (step 3 inline) |
| WebhookEventLogView | ⟲ Replay Selected (DLQ only, button in DLQ tab) | Add Consumer URL button (Consumer URLs tab only) | Filter reset button (global) |

### Dynamic banner region (above pageCard, per Theme Guide):
**Every view has 4 tone banners**: info / success / warning / danger.
- Set via `useState<{tone:string; message:string} | null>()`
- 409 dedup → success banner `This action was already processed; displaying cached result (duplicate transaction_id)`
- 403 Forbidden → danger banner `You do not have permission to perform this action. Contact your platform administrator.`
- 503 Retry-After → warning banner auto-dismiss after delay `Provider overloaded, auto-retried after N seconds …`
- PIN wrong → danger `PIN salah. Sisa percobaan: X (kiriminaja lockout after N wrong attempts).`

---

## 4. 5 Views + 3 Shared Components — File Creation Plan

### 4.1 5 Views (src/views/thirdplil/ folder)

| File Path (exact) | Export Default Name | Spec Doc (deep dive later) | Page-level AGENTS page mode (single vs multi-tab) |
|:---|:---|:---|:---|
| `CredentialsKiriminAjaView.tsx` | `CredentialsKiriminAjaView` | 03-5-views-deep-spec §1 | single-tab page; list of account cards. Per-card: star badge ⭐ = default, env badge (sandbox blue / prod green), 2-dot menu Set as Default / Delete / Regenerate Secret / Test Connection. |
| `RateCalculatorView.tsx` | `RateCalculatorView` | 03-5-views-deep-spec §2 | single-tab form; left side = inputs (sender/recipient addresses ← SubdistrictCoverageLookup 4-level drilldown + packages grid) ; right side = `<RateResultsTable>` results after submit. |
| `ShipmentsDashboardView.tsx` | `ShipmentsDashboardView` | 03-5-views-deep-spec §3 | multi-view? **NO**: Single-tab page but with right-hand `<ShipmentDetailDrawer>` slide-in panel (720px wide, open on row click) with 4 sub-tabs inside drawer (Status History / Package & Items / Raw Provider Data / Actions). Uses `<ServerDataTable>` (full layout). |
| `ShipmentCreateWizardView.tsx` | `ShipmentCreateWizardView` | 03-5-views-deep-spec §4 | 5-step wizard (Stepper header + SubTabs fallback). Unsaved changes guard via beforeunload listener + dirty state. PIN input (Step 4/5 if COD via KA Credit) → password field, ephemeral useState cleared in finally. |
| `WebhookEventLogView.tsx` | `WebhookEventLogView` | 03-5-views-deep-spec §5 | Multi-tab page (AGENTS SubTabs multi-tab pattern) with THREE SubTabs: **Inbound Events List**, **DLQ + Replay**, **Consumer Registrations (URLs + Secrets + HMAC config)**. All 3 tabs use `<ServerDataTable>` in full layout. |

### 4.2 3 Shared Components (src/components/thirdplil/ folder — reused across views)

| File Name | Props Contract | Used In |
|:---|:---|:---|
| `SubdistrictCoverageLookup.tsx` | 4 cascading selects: Province → City → District → Subdistrict. Each level: options fetched on parent change (cache in context to avoid repeated calls). **Exports 2 values**: `value: { area_id bigint, full_path_label: string }` + `onChange` handler + `disabled boolean` prop + `initialValue`. | Rate Calculator, Create Shipment Steps 1 (Sender + 2x recipients, render 2 instances), Sender default address setter in Credentials view. |
| `RateResultsTable.tsx` | `rates: RateQuote[]` (carrier name, service code, service name, etd, price IDR, awb_fee, insurance_fee, cod_fee, grand_total). Selection mode (radio button → `selected_rate_code: string` controlled by parent). Action column: "Book This Rate" button disabled until selection. | Rate Calculator (right panel) + Create Shipment Step 3 (full width). |
| `ShipmentDetailDrawer.tsx` | `open:boolean, onClose, shipmentId: bigint`. Panel inside renders four SubTabs (Status timeline vertical, Package & Items accordion list, Raw Provider Data collapsible pre + copy to clipboard, Actions cancel/return/request pickup). Status-tone badge color mapping per §3 UI invariant grid. | Shipments Dashboard row click → opens drawer; Webhook Event Log AWB link click → opens drawer filtered to same shipment. |

---

## 5. Deep Links / Spec Chaining

Follow this order when writing code (future AI agents always follow same sequence):

1. **Routing first**: `src/types.ts` (5 AppView variants) → `src/app-routes.ts` (nav groups) → `src/permission-context.tsx` (VIEW_PERMISSIONS + ACTION_PERMISSIONS map) → `src/App.tsx` (lazy imports + switch).
2. **Shared components next**: build 3 components in folder `components/thirdplil/` — validate visually first before view wiring.
3. **Views**: Credentials first → Rate Calculator (uses SubdistrictLookup + RateResultsTable) → Dashboard (ServerDataTable + Drawer) → Create Wizard (5 steps, reuses shared components) → Webhook Log (3 ServerDataTables).
4. **Write per-module changelog FIRST before any TSX file save per AGENTS rule**: append new `2026-10-07.r002` (routing) / `2026-10-07.r003` (shared components) to kiriminaja-frontend-changelogs.md with mandatory Changes / Found Bugs / Fixes sub-headings, THEN write the actual code.
5. **Append global index entry** to frontend project-changelogs.md for each new rev.

---

## 6. How Future AI Should Continue From This Document

1. Read this file FIRST before writing ANY ThirdPLILFrontend code (AppView changes / new route / permission edits).
2. Write the actual type updates to `src/types.ts` → `app-routes.ts` → `permission-context.tsx` → `App.tsx` BEFORE writing any view components.
3. **NEXT DEEP DIVE**: Open sibling `02-shared-thirdplilApi-wrapper-hook.md` (typed call contract for all backend calls) → use it in every view (never inline supabase.functions.invoke raw per view).
4. After 02 → Open `03-5-views-deep-spec.md` for 5 views' individual field grids, validation rules, column grids, modal actions list.
5. AGENTS page layout rules MUST be followed EXACTLY (pageCard, kicker+H2+subtitle, right action bar, 4-tone dynamic banners). Reference the Theme Guide View file directly (`src/views/ThemeGuideView.tsx`) for exact className patterns to copy-paste (do not invent new classes).
6. No new UI components/colors outside theme-guide palette. If a missing component is needed (e.g. stepper not yet in theme guide) → AskUserQuestion per AGENTS scope guardrail first, BEFORE inventing a new pattern that breaks family consistency across the 3 projects (DSS/Webstore/IL frontends).
