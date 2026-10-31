# KiriminAja Provider (ThirdPLIL) Frontend Changelogs — Architecture, Known Issues & Revision History

**Target routes** (Phase 1 views):
- `/settings/kiriminAja/credentials` — Credential Management (API keys, env toggle, default sender, Test Connection)
- `/tools/rates` — Rate Calculator / Price Check
- `/shipments` — Shipments / AWB Dashboard (ServerDataTable with detail drawer)
- `/shipments/new` — Create Shipment Wizard (5 steps)
- `/admin/webhooks` — Webhook Event Log Viewer (events list + DLQ sub-tab + Consumer Registrations sub-tab)

**Source files** (views/components to create — none exist yet):
- `src/views/thirdplil/CredentialsKiriminAjaView.tsx`
- `src/views/thirdplil/RateCalculatorView.tsx`
- `src/views/thirdplil/ShipmentsDashboardView.tsx`
- `src/views/thirdplil/ShipmentCreateWizardView.tsx`
- `src/views/thirdplil/WebhookEventLogView.tsx`
- `src/components/thirdplil/SubdistrictCoverageLookup.tsx` (shared drill-down ValueHelp component)
- `src/components/thirdplil/ShipmentDetailDrawer.tsx` (reusable status timeline + AWB label actions)
- `src/components/thirdplil/RateResultsTable.tsx` (reusable rate quote display)

**Backend twin changelog**: [`kiriminaja-changelogs.md`](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md)
**Backend PRD Master**: [`01-PRD-master.md`](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/01-PRD-master.md)
**Backend API Contract**: [`03-api-contract.md`](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/03-api-contract.md)
**Related global index**: [`docs/project-changelogs.md § Module Directory`](../project-changelogs.md)

**Related UI pattern references** (per project AGENTS.md):
- Page layout standards (single-tab forms): [`docs/page-layout-standards-single-tab.md`](../page-layout-standards-single-tab.md)
- Page layout standards (multi-tab e.g. Webhook Log → 3 sub-tabs): [`docs/page-layout-standards-multi-tab.md`](../page-layout-standards-multi-tab.md)
- Modal header-actions rules + DeleteConfirmationModal: [`docs/ui-modal-guidelines.md`](../ui-modal-guidelines.md)
- UI pattern source of truth: [`/settings/theme-guide`](../theme-guide-changelogs.md) / [`src/views/ThemeGuideView.tsx`](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/views/ThemeGuideView.tsx)
- Shared Tailwind classes: [`src/components/ui/STYLES.tsx`](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/components/ui/STYLES.tsx)
- Table component: [`ServerDataTable-changelogs.md`](../server-datatable-changelogs.md) / [`src/components/ServerDataTable.tsx`](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/components/ServerDataTable.tsx)
- ValueHelpField lookup: [`src/components/ValueHelpField.tsx`](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/components/ValueHelpField.tsx)

---

## Architecture & Technical Invariants

### 1. System Role

ThirdPLILFrontend is the **management-only operational UI** for the Third-Party Logistics Integration Layer. It is NOT the storefront checkout or WMS packing UI. Those are separate projects (Webstore, DSS/CMS WMS) that call the **ThirdPLIL External Consumer API** (Supabase Edge Functions §2 in API Contract). This dashboard is used by:
- **Ops/Admin users**: Configure provider credentials, debug failed webhook deliveries, look up a shipment by AWB/external order ref, manually cancel or request return, replay DLQ events.
- **Finance users**: View COD collection status, KA Credit usage (KiriminAja-specific), QR payment status.
- **Dev/integration engineers**: Test connection with sandbox keys, use Rate Calculator to debug price discrepancies before Webstore go-live, fire "Replay" on a webhook that was dropped by a consumer staging URL.

### 2. View Routing & Lazy Loading Integration Plan

Views are added following AGENTS.md conventions. Implementation checklist (for future agent writing the actual views):

1. **Add new `AppView` variants** to `src/types.ts`:
   ```ts
   | 'kiriminaja-credentials'
   | 'kiriminaja-rate-calculator'
   | 'kiriminaja-shipments-dashboard'
   | 'kiriminaja-shipments-create'
   | 'kiriminaja-webhooks-log'
   ```

2. **Register routes** in `src/app-routes.ts → APP_ROUTES` with nav groups:
   - Nav group: `settings` → add `kiriminaja-credentials` (under Setting existing menu, alongside Theme Guide)
   - Nav group: `tools` (new top-level menu if needed) → `kiriminaja-rate-calculator`
   - Nav group: `thirdplil` (primary new top-level menu with Truck icon from lucide-react) → with children: Shipments Dashboard, Create Shipment, Webhook Admin.
   - layoutMode: all views use `'wide'` (max-w-[1600px]) except Shipments Dashboard which may be `'full'` for the wide ServerDataTable.

3. **Lazy import views** in `src/App.tsx` top of file (NOT in the render switch):
   ```ts
   const CredentialsKiriminAjaView = lazy(() => import('./views/thirdplil/CredentialsKiriminAjaView'));
   // …and 4 more
   ```

4. **Add cases to `renderView()` switch** in `App.tsx → AppShell → renderView()`.

5. **Wire sidebar navigation**: New top-level menu item `ThirdPLIL` with `Truck` lucide-react icon; expand to show children (Shipments, Create Shipment, Webhook Admin). Rate Calculator under `Tools` menu. Credentials under `Setting`.

6. **Wire permissions**: Map views → permissions in `src/permission-context.tsx → VIEW_PERMISSIONS` (or equivalent pattern — check file for exact structure). Permissions list per data model §4:
   - `thirdplil.credentials.view` / `.edit` → Credentials view
   - `thirdplil.rates.read` → Rate Calculator
   - `thirdplil.shipments.view` / `.create` / `.edit` / `.pickup`
   - `thirdplil.webhook.view` / `.replay` / `.consumers.edit`

### 3. UI Pattern Invariants (Carry Across All Views)

Per AGENTS.md and Theme Guide:

| Concern | Invariant |
|:---|:---|
| **Page chrome** | Every view starts with `<div className={STYLES.pageCard}>…</div>` wrapping `<Section>` (if exported from STYLES.tsx; otherwise matching the rounded-3xl bordered page-card with header kicker+h2+subtitle). |
| **Banner pattern** | Reusable dynamic banner region ABOVE Section card; 4 tones (info/success/warning/danger) matching `STYLES.bannerInfo`, `.bannerSuccess`, `.bannerWarning`, `.bannerDanger`. Set banner state from async response of every submit/test-connection/replay action. |
| **Buttons** | Primary = rounded-xl blue-600; Secondary = gray border; Danger = red; CTA row has right-aligned buttons with inline `Loader2` spinner while `submitting = true`. NEVER put modal action buttons in footer (per ui-modal-guidelines.md → always in modal header top-right). |
| **Inputs** | Use `STYLES.input` (rounded-xl bordered) + label above. `required` indicator as inline red asterisk label suffix. Validation errors show red border + inline text below input (NOT toast only). Group fields in 2-col `md:grid-cols-2` grid per Theme Guide. Address fields use full width. |
| **ServerDataTable usage** | Shipments Dashboard, Webhook Event Log (both sub-tabs: Events list, DLQ list, Consumer Registrations list) use `<ServerDataTable>`. Configure `persistPreferences=true`, sticky right column for Actions (buttons: View Detail / Cancel / Replay / Open in KiriminAja Dashboard). |
| **ValueHelpField usage** | Subdistrict drill-down in Rate Calculator + Create Shipment form (origin & destination). Use `ValueHelpField.tsx` OR build a custom two-stage drill-down (Province → City → District → Subdistrict) with cascading selects. **TODO during implementation**: pick pattern based on whether ValueHelpField supports chained cascading parent filters. |
| **Status badge coloring** | Shipment status column uses Badge component (per Theme Guide Status UI grid). Color mapping: <br>`draft` / `provider_submitted` → neutral gray<br>`awb_assigned` / `pickup_scheduled` / `pickup_requested` → blue info<br>`courier_picked_up` / `in_transit` / `out_for_delivery` → amber<br>`delivered` / `problem_resolved` → green success<br>`attempt_failed` / `return_in_progress` → orange warning<br>`returned` / `lost` / `damaged` / `canceled` / `problem_pending` → red danger |
| **Shipment detail drawer** | `<ShipmentDetailDrawer.tsx>` = right-side slide-in panel (2xl wide, max-w-[720px]) with: header row (AWB + status badge + Close button); SubTabs: Status History, Package & Items, Raw Provider Data, Actions (Cancel / Request Return / Request Pickup). Status History = vertical timeline with occurred_at, transition icon (PackageCheck / Truck / CheckCircle / AlertCircle / ArrowLeftRight), location, transition_reason tooltip. |
| **Create Shipment Wizard** | 5 steps with Stepper header OR SubTabs (per AGENTS SubTabs preference). Steps: (1) Sender + Recipient, (2) Packages + Items, (3) Rate Quote Selection → hit API to fetch rates live then render `<RateResultsTable>`, (4) Pickup Schedule selection, (5) Review + Submit. Step progress bar with checkmark state for completed steps. |
| **Unsaved changes guard** | Create Shipment form + Credentials edit page → `useEffect` with `beforeunload` event listener; if dirty = true, browser default prompt "Changes you made may not be saved." OK to use simple browser prompt; no custom modal required (unless we add later). |
| **KA Credit PIN field** | Input `type="password"` (6 digits maxlength, numeric inputmode). PIN value is EPHEMERAL: NEVER store in localStorage; NEVER console.log; NEVER send to provider_call_log via UI logging. Clear from state immediately after the API call returns (2xx or 5xx). |
| **Webhook Event payload viewer** | Use a collapsible `<pre>` block with JSON.stringify(pretty) + Copy-to-clipboard button + word-wrap so line lengths stay inside panel. Link to shipment row: clickable AWB/external_ref navigates to Shipments Dashboard filtered to that value or opens Detail Drawer directly. |

### 4. API Integration: Frontend → Backend (Internal UI API §3)

All views call Supabase Edge Functions (NOT direct PL/pgSQL SELECT from client where permission/computation is nontrivial). Standard wrapper pattern:

```ts
// src/utils/thirdplilApi.ts  (future file)
export async function callThirdPLILInternalUI<T>(
  fnName: 'thirdplil-admin-credentials' | 'thirdplil-rates' | 'thirdplil-shipments' | 'thirdplil-admin-webhooks' | etc.,
  opts: { method: 'GET'|'POST'|'PATCH'|'PUT'|'DELETE'; pathSuffix?: string; body?: unknown; params?: Record<string,string|number|boolean> }
): Promise<T> {
  // 1. Inject transaction_id on POST/PATCH/DELETE (crypto.randomUUID())
  // 2. Use supabase.functions.invoke(fnName, { body, method, headers })
  //    OR fetch() direct if functions.invoke is not expressive for pathSuffix
  // 3. Parse error shape per API Contract §1.2 — throw with human message that caller sets to danger banner
  // 4. On 409 Conflict: same transaction_id dedup — return cached result (treat as success, info banner "This action was already processed.")
  // 5. On 503 Retry-After: auto-wait for Retry-After seconds then retry once (single retry; not 3x to keep UI responsive)
}
```

Future agent: extract this into its own reusable `thirdplilApi.ts` utility file in `src/utils/`. Use it from all views instead of duplicate fetch/supabase.invoke per page.

### 5. Package & Weight Input Validation Rules (Shared)

Shared hook `useShipmentPackageValidator()` — reused by Rate Calculator Package input, Create Shipment Packages step:
- `weight_g`: integer, minimum 1 = 1g, maximum 40000 = 40kg (KiriminAja instant cap; express may vary per courier — validate server-side, show warning banner if exceeded on client but allow submit so server returns exact error)
- `length_cm / width_cm / height_cm`: integer, minimum 1cm; maximum express ~200cm side (courier-dependent); volumetric = L*W*H/6000 displayed live to user as computed helper text below inputs.
- Items: `qty` integer min 1; `unit_value` numeric IDR min 0. If is_cod OR use_insurance → item_value_total required (non-zero) → show validation error banner.

---

## Known Bugs & Architecture Issue Matrix

| ID | Severity | Area | Root Cause | Impact | Target Resolution |
|:---|:---|:---|:---|:---|:---|
| BUG-KA-FE-17 | HIGH | Create Wizard payload | Wizard still built the pre-rehaul booking payload (no `origin_kecamatan_area_id`, zipcode, lat/long, `base_shipping_fee_idr`; `is_sandbox` hardcoded; expected nested `{ shipment }`) | Browser could not create a valid KiriminAja booking even after the backend was fixed | FIXED in r017 |
| BUG-KA-FE-18 | HIGH | Dashboard / Drawer / types | Screens assumed the old shipment enum + row shape (`quoted`, `origin_*`, `destination_*`, `new_status`, `note_jsonb`) | Status rendering drift, broken cancel route, wrong AWB label + drawer hydration | FIXED in r017 |
| BUG-KA-FE-19 | HIGH | `SubdistrictCoverageLookup` | Component fell back to hardcoded demo rows whenever the cache was empty or errored | Plausible but fake zipcode/lat/lng shown to operators | FIXED in r018 |
| BUG-KA-FE-20 | HIGH | Rate Calculator | `canFetch` required `level === 'subdistrict'` | Fetch Rates stayed disabled for a kecamatan selection; district lanes could not be priced at all | FIXED in r019 |
| BUG-KA-FE-21 | MEDIUM | Rate → Wizard deep link | URL carried only the area id, never the level | Any district selection was silently reinterpreted downstream | FIXED in r019 |
| BUG-KA-FE-22 | HIGH | Create Wizard prefill | Prefill hardcoded `level:'subdistrict'` and never populated `district_area_id` | A district prefill permanently failed step-1 `contactBlockMissing` validation | FIXED in r019 |
| BUG-KA-FE-23 | MEDIUM | Credentials view | The KA `order_id` prefix was not editable — it was a hardcoded adapter constant with no field on the credential | Operators could not align the IL with the "Format Order ID" registered on their KA account, so `request_pickup` returned HTTP 400 | FIXED in r020 |
| BUG-KA-FE-24 | HIGH | Create Wizard submit | Wizard sends local coverage `area_id`s as `origin/destination_kecamatan_area_id` (and subdistrict ids), which the shipments edge forwarded unchanged to KA | Booking against real KA failed with `Origin tidak ditemukan` (paired backend BUG-THIRDPLIL-35) | FIXED in r021 (backend-side) |
| BUG-KA-FE-25 | HIGH | Credentials callback setup | Credentials UI had no callback registration action or callback-state visibility; operators only saw a generated URL and had to manage KA `set_callback` manually outside the app | The redesigned webhook contract could not be executed from the dashboard, so the biggest inbound-auth gap stayed operationally unresolved | FIXED in r022 |
| BUG-KA-FE-26 | MEDIUM | Credentials create modal | The modal still treated `api_user` as a required auth field even though KiriminAja auth is Bearer-key-only and backend already made `api_user` optional metadata | Operators were blocked by a fake requirement and the UI contract drifted from the backend credential model | FIXED in r022 |

---

### 2026-10-31.r022 — Credentials page now manages callback registration and reflects the bearer-auth webhook redesign
**Scope**: [src/views/thirdplil/CredentialsKiriminAjaView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/CredentialsKiriminAjaView.tsx), [src/types/thirdplil.ts](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/types/thirdplil.ts)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-31.r022](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md)

#### Changes
- `SubscriberCredential` ([src/types/thirdplil.ts](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/types/thirdplil.ts)) now carries callback-management fields: `callback_url`, `ka_callback_registered_at`, `ka_callback_register_ok`, and `ka_callback_register_message`.
- [CredentialsKiriminAjaView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/CredentialsKiriminAjaView.tsx) now exposes callback management directly on each credential card: a callback status badge, the canonical callback URL with Copy action, last registration result text, and a new **Register Callback / Re-register Callback** action that calls `POST /thirdplil-admin-credentials/credentials/:id/register-callback`.
- The create-credential flow now treats `callback_url` as the primary setup artifact and updates the success banner copy accordingly. The legacy `wh_secret` is still displayed once as fallback-only cutover support, but it is no longer presented as the main integration path.
- The add modal copy now marks `api_user` as optional metadata rather than required auth material, and the submit validation only requires `account_label` + `api_key`.

#### Found Bugs
- **BUG-KA-FE-25 (HIGH)**: the Credentials page had no executable callback registration path, so operators could not complete the new KA-native `set_callback(url)` flow from the dashboard itself.
- **BUG-KA-FE-26 (MEDIUM)**: the add modal still enforced `api_user` as a required field even though KiriminAja auth is Bearer-key-only and the backend had already relaxed that requirement.

#### Fixes
- **FIX-KA-FE-25**: added callback state display and the `registerCallback()` UI action in [CredentialsKiriminAjaView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/CredentialsKiriminAjaView.tsx), wired to the new backend endpoint. The card now shows whether callback registration is pending, failed, or ready, plus the provider message from the latest attempt.
- **FIX-KA-FE-26**: removed the fake `api_user` requirement from the add modal validation and updated labels/help text so the UI matches the backend credential model. `npm run lint` (`tsc --noEmit`) clean.
- **Live smoke note**: the first `Register Callback` attempt hit the backend route and persisted callback attempt state correctly, but KA sandbox returned `Oops, terjadi kesalahan. Coba beberapa saat lagi.` The UI now surfaces that provider result on the card instead of hiding it.

---

### 2026-10-30.r021 — no frontend code this rev (backend resolves local coverage ids → KA ids, closing BUG-KA-FE-24)
**Scope**: (none — frontend unchanged)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-30.r021](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md)

#### Changes
- (none for this rev)

#### Found Bugs
- **BUG-KA-FE-24 (HIGH)**: the Create Wizard submits the local coverage `area_id`s (`district_area_id`, `subdistrict.id`) as `origin/destination_kecamatan_area_id` / `_subdistrict_id`. The backend create path used to forward these to KiriminAja unchanged, so a real booking failed with `Origin tidak ditemukan`. Paired backend entry: BUG-THIRDPLIL-35.

#### Fixes
- **FIX-KA-FE-24**: closed by the backend r021 fix (the create path now translates the local ids to KA ids before booking). No frontend change was required — the wizard payload stays as-is, so `npm run lint` state is unchanged.
- Verified end-to-end from the wizard lane: the `Denpasar Barat → Gambir` G-3 booking returns HTTP 200 with `provider_order_id: "LVA-1-SMOKE-G3-003-1"` (see backend r021).

---

### 2026-10-30.r020 — KiriminAja `order_id` prefix is now per-credential and editable in the Credentials view
**Scope**: [src/views/thirdplil/CredentialsKiriminAjaView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/CredentialsKiriminAjaView.tsx), [src/types/thirdplil.ts](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/types/thirdplil.ts)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-30.r020](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md)

#### Changes
- `SubscriberCredential` ([src/types/thirdplil.ts](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/types/thirdplil.ts)) gained `order_id_prefix?: string | null`.
- [CredentialsKiriminAjaView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/CredentialsKiriminAjaView.tsx): the Add-credential modal now has an **"Order ID Prefix (Format Order ID KA)"** input (default `LVA`); each account card shows the prefix; a new **Edit** action opens a modal that edits `account_label` + `order_id_prefix` and saves via **`PATCH /thirdplil-admin-credentials/credentials/:id`** (the API wrapper already supports the `PATCH` verb, so no wrapper change was needed).

#### Found Bugs
- **BUG-KA-FE-23 (MEDIUM)**: the KA `order_id` prefix had no UI and no backing field — it was a hardcoded adapter constant. Since KA validates `order_id` against the account-registered format, operators had no way to configure it from the dashboard.
- **BUG-KA-FE-24 (HIGH)**: the Create Wizard sends the local coverage `area_id`s (`district_area_id`, `subdistrict.id`) as `origin/destination_kecamatan_area_id` / `_subdistrict_id`. The backend create path forwards these to KA unchanged, so a real booking fails with `Origin tidak ditemukan`. Paired backend entry: BUG-THIRDPLIL-35. Not fixed this rev.

#### Fixes
- **FIX-KA-FE-23**: added the `order_id_prefix` field (Add modal + card display), the Edit modal, and the `saveEdit()` PATCH call in [CredentialsKiriminAjaView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/CredentialsKiriminAjaView.tsx); `npm run lint` (`tsc --noEmit`) clean.
- Verified end-to-end against the live KA sandbox: the G-3 booking's `Format Order ID tidak sesuai` rejection is gone after the backend applied the `LVA` prefix (see backend r020).

---

### 2026-10-30.r019 — District (kecamatan) coverage made usable end-to-end in Rate Calculator and Create Wizard
**Scope**: [src/views/thirdplil/RateCalculatorView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/RateCalculatorView.tsx), [src/views/thirdplil/ShipmentCreateWizardView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/ShipmentCreateWizardView.tsx)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-30.r019](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md)

#### Changes
- Rate Calculator now accepts **kecamatan (district)** as a valid final origin/destination level. A new `isFinalLevel()` helper (`district` OR `subdistrict`) replaces the old `level === 'subdistrict'` check inside `canFetch`, matching the backend, which resolves either level to the provider `kecamatan_id` in `resolveProviderAreaIds()`. Weight/volume guards are unchanged.
- The Rate → Create Wizard deep link now carries the selected level: `onSelectQuote` appends `origin_level` / `destination_level` next to `origin_subdistrict_id` / `destination_subdistrict_id`, so the wizard can tell a kecamatan id from a kelurahan id.
- Create Wizard step-1 prefill now honours that level and seeds the kecamatan field. A new `pickLevel()` maps the query string to `'district' | 'subdistrict'`; when the level is `district` the incoming id is written into `district_area_id` (and the sender/recipient coverage object), so the visible prefill matches what step-1 validation actually checks.
- No change was needed in the shared `SubdistrictCoverageLookup`: its drill-down already emits the local `area_id` with `level='district'` and a selectable "Pilih Kecamatan ini" action, which is exactly the shape the wizard and Rate Calculator now consume.

#### Found Bugs
- **BUG-KA-FE-20 (HIGH)**: Rate Calculator's `canFetch` required `level === 'subdistrict'`. Because a kecamatan is a legitimate final level that the backend prices, a District → District lane left the Fetch Rates button permanently disabled and the operator could not get any quote.
- **BUG-KA-FE-21 (MEDIUM)**: the Rate → Wizard deep link forwarded only the area id, never the level. Any district selection was therefore silently reinterpreted once it reached the wizard, which had no way to know whether the id was a kelurahan or a kecamatan.
- **BUG-KA-FE-22 (HIGH)**: the wizard hardcoded the seeded coverage object to `level:'subdistrict'` and never populated `district_area_id` from the URL. Result: a District pick from the Rate Calculator produced a prefill that could never pass step-1 validation (`contactBlockMissing`), because the required kecamatan field stayed empty.

#### Fixes
- **FIX-KA-FE-20**: added `isFinalLevel()` in [RateCalculatorView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/RateCalculatorView.tsx) and applied it to `canFetch`, so both `district` and `subdistrict` selections enable Fetch Rates.
- **FIX-KA-FE-21**: [RateCalculatorView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/RateCalculatorView.tsx) `onSelectQuote` now appends `origin_level` / `destination_level` to the wizard deep link.
- **FIX-KA-FE-22**: [ShipmentCreateWizardView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/ShipmentCreateWizardView.tsx) reads the forwarded level via `pickLevel()` and seeds `district_area_id` whenever the level is `district`; a kelurahan prefill still resolves through its kecamatan parent as before.
- Verified against the live KA sandbox: `Denpasar Barat (91994) → Gambir (92354)`, 1000 g → `jnt:JND` Rp 38,000 · `tiki:ECO` Rp 18,000 · `tiki:REG` Rp 21,000; schedules for pickup `2026-10-31` return 4 windows. `npm run lint` (`tsc --noEmit`) clean.

---

### 2026-10-21.r018 — Coverage lookup now uses the real subscriber cache, not demo rows
**Scope**: [src/components/thirdplil/SubdistrictCoverageLookup.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/components/thirdplil/SubdistrictCoverageLookup.tsx), [src/views/thirdplil/ShipmentCreateWizardView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/ShipmentCreateWizardView.tsx)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-21.r016](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md)

#### Changes
- `SubdistrictCoverageLookup` now reads area rows from the subscriber-scoped admin cache endpoint (`GET /functions/v1/thirdplil-admin-coverage-sync?level=...`) instead of the old `thirdplil-rates/coverage/areas` + local demo fallback combination. Province/city/district/kelurahan browsing still works as the same 4-step cascade, but the component now shows the real cache state instead of fabricating rows when the cache is empty.
- The lookup banner copy was rewritten to be explicit: zipcode and geo fields are only auto-filled when the backend cache genuinely has them. Missing `latitude` / `longitude` are now treated as honest data gaps, not silently replaced by sample coordinates.
- `ShipmentCreateWizardView` now passes the current shipment environment (`sandbox` / `production`) into the lookup component and updates its step-1 helper text so operators understand that empty zipcode/lat/lng fields may still need manual entry until coverage enrichment is finished.

#### Found Bugs
- **BUG-KA-FE-19 (HIGH, FIXED this rev)**: `SubdistrictCoverageLookup` still fell back to hardcoded demo rows whenever the cache query returned empty or errored. Result: changing kelurahan could appear to produce plausible but fake zipcode/lat/lng values, which is exactly the misleading behavior the user flagged in the shipment wizard.

#### Fixes
- **FIX-KA-FE-19**: removed the local demo-row fallback path from [SubdistrictCoverageLookup.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/components/thirdplil/SubdistrictCoverageLookup.tsx) and switched the component to the real admin cache API. The UI now either shows actual cached rows or clearly explains what prerequisite is missing (parent selection, empty cache, or cache lookup failure).

### 2026-10-21.r017 — Frontend shipment contract realignment for KA booking, AWB pending flow, and canonical statuses
**Scope**: [docs/KiriminAja/04-frontend-shipment-alignment-checklist.md](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/docs/KiriminAja/04-frontend-shipment-alignment-checklist.md), [src/types/thirdplil.ts](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/types/thirdplil.ts), [src/views/thirdplil/ShipmentCreateWizardView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/ShipmentCreateWizardView.tsx), [src/views/thirdplil/RateCalculatorView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/RateCalculatorView.tsx), [src/views/thirdplil/ShipmentsDashboardView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/ShipmentsDashboardView.tsx), [src/components/thirdplil/ShipmentDetailDrawer.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/components/thirdplil/ShipmentDetailDrawer.tsx), [src/components/thirdplil/RateResultsTable.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/components/thirdplil/RateResultsTable.tsx)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-21.r015](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L84-L103)

#### Changes
- Added a new implementation checklist document, [`04-frontend-shipment-alignment-checklist.md`](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/docs/KiriminAja/04-frontend-shipment-alignment-checklist.md), to lock the shipment-frontend work before and during execution. It lists the exact backend contract deltas: 17 canonical statuses, hosted AWB URL handling, create+booking semantics, new location fields, `base_shipping_fee_idr`, and the real shipment/detail row shape.
- Re-aligned `src/types/thirdplil.ts` to the current backend contract. `ShipmentStatus` now matches the 17 DB-canonical values; shipment types now model `shipment_id`, `credential_id`, `sender_*`, `recipient_*`, optional `partner_order_ids`, `grand_total_idr`, and the new create payload fields (`origin_kecamatan_area_id`, `origin_zipcode`, lat/long, `base_shipping_fee_idr`, `external_ref`, `external_order_ref`). Compatibility aliases were kept for a few old `origin_*` / `destination_*` consumers while the screens were being moved.
- Updated the create wizard to submit the real booking payload expected by the backend. The wizard now collects `kecamatan_area_id`, `zipcode`, `latitude`, and `longitude` for both sender and recipient, sends the chosen quote’s `base_fee_idr` as `base_shipping_fee_idr`, forwards `credentialId` through the request header, supports a real `is_sandbox` toggle, and removes the old empty-string `transaction_id` body field that conflicted with header-based idempotency.
- Changed create success handling to the new backend response semantics: `POST /shipments` is now treated as **create + KiriminAja booking**. The wizard success banner distinguishes `awb_assigned` (AWB returned immediately) from `provider_submitted` (booking accepted but AWB pending webhook/polling), and the navigation back to the dashboard uses `shipment_id` instead of the old nested `shipment.id` assumption.
- Reworked shipments dashboard read behavior to the current contract: canonical status labels/tones, real field names (`sender_*`, `recipient_*`, `shipment_id`), `DELETE /thirdplil-shipments/:id` for cancel instead of the non-existent `/cancel` sub-route, and the new AWB label response shape `{ url, awb_no, provider }`.
- Reworked `ShipmentDetailDrawer` around the actual detail/timeline payload we now return. The drawer summary reads `sender_*` / `recipient_*`, grand total falls back to `grand_total_idr`, the pickup tab describes booking/AWB progress using `pickup_requested` / `pickup_scheduled` / `courier_picked_up`, and the timeline uses the real history fields (`history_id`, `status`, `transition_reason`, `source`, `actor`, `raw_provider_status`) instead of the older `prior_status` / `new_status` / `note_jsonb` assumption.
- Updated the fallback sample `RateResultsTable` quotes to use the composite service-code pattern `"{courier_code}:{service_type}"`, so even placeholder flows no longer teach the old `JNE-REG` style contract.
- Verification: `npm run lint` (`tsc --noEmit`) exits clean after the alignment pass.

#### Found Bugs
- **BUG-KA-FE-17 (HIGH)**: The shipment wizard still built the pre-rehaul payload: no `origin_kecamatan_area_id`, no zipcode/lat/long, no `base_shipping_fee_idr`, `is_sandbox` hardcoded `false`, and it expected a nested `{ shipment }` response. Result: even after the backend was fixed, the browser could not create a valid KiriminAja booking payload.
- **BUG-KA-FE-18 (HIGH)**: Dashboard/detail screens still assumed the old shipment enum and row shape (`quoted`, `payment_failed`, `origin_*`, `destination_*`, `id`, `provider_credential_id`, timeline `new_status`/`note_jsonb`). Result: status rendering drift, broken cancel route, incorrect AWB label assumptions, and drawer hydration/type drift against the current backend payload.

#### Fixes
- **FIX-KA-FE-17**: Wizard payload + submit/result flow updated to the backend contract. The UI now gathers the required booking fields, forwards quote base fee, lets the operator choose sandbox mode, uses the credential override header when present, and handles both immediate-AWB and AWB-pending success paths correctly.
- **FIX-KA-FE-18**: Dashboard/detail/types were re-aligned to the canonical shipment contract and the current history shape. Cancel now hits the real route, AWB label handling uses the hosted URL response, and canonical statuses render consistently across the dashboard and drawer.

### 2026-10-07.r001 — Tenancy Approval + Frontend Scaffold (View Definitions, Routing Plan, UI Invariants locked)
**Scope**: Full UI scaffolding spec lock-in (AppView variants, routes, permission mapping, 5 views components list, shared components list, UI invariant patterns). **Implementation (actual components/hooks/utils files) deferred to next rev (this rev = spec + planning only).**
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-07.r001](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L80-L97)

#### Changes
- **Tenancy naming alignment lock**: All frontend types/interfaces (ILTenant → ILSubscriber, tenant_id → subscriber_id everywhere). Frontend `permission-context.tsx` → `subscriberRole` field uses DSS identical enum `'subscriber_admin' | 'subscriber_user'`; permission codes map 1:1 with backend migration 0006_rls_seed.sql 12 permission codes list (thirdplil.credentials.view/edit, thirdplil.rates.read, thirdplil.shipments.view/create/edit/pickup, thirdplil.coverage.read, thirdplil.webhook.view/replay/consumers.edit).
- **Routing spec finalisation (locked before implementation)**: §2 (6-step routing plan) made effective for next rev implementation — added 5 AppView variants (`kiriminaja-credentials`, `kiriminaja-rate-calculator`, `kiriminaja-shipments-dashboard`, `kiriminaja-shipments-create`, `kiriminaja-webhooks-log`), split nav groups: `settings` → Credentials; `tools` → Rate Calculator; new top-level `ThirdPLIL` (Truck icon) → Shipments Dashboard + Create + Webhooks Admin. layoutMode wide/full per view.
- **UI invariant patterns lock-in §3**: Status badge → color grid (12 status → tone), PIN ephemeral discipline, credential star-badge for `is_default=true` (account card UI, Set Default button + Delete guard), wizard 5-step, drawer right panel 720px, SubdistrictCoverageLookup cascading 4-level drill-down.
- **thirdplilApi.ts wrapper spec §4 locked**: T generic, pathSuffix support, 409 dedup auto-handle + info banner, 503 Retry-After once, auto-inject transaction_id on mutations.
- **Backend changelog 0001–0006 SQL migration family paired (this frontend rev is planning-only; next rev begins writing the actual TSX/hook files listed at top of file).**

#### Found Bugs
- (none for this rev — planning-only; no code written)

#### Fixes
- (none for this rev)

---

### 2026-10-07.r002 — Frontend PRD Scaffold (3 Deep Specs Docs Completed: Routing → Shared Wrapper → 5 Views)
**Scope**: Specification documents only (no actual TSX / routing code written yet). 3 new files in `docs/KiriminAja/` → 01-frontend-architecture.md, 02-shared-thirdplilApi-wrapper-hook.md, 03-5-views-deep-spec.md.
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-07.r002](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L101-L117)

#### Changes
- **01-frontend-architecture.md** written: 5 AppView variants (`kiriminaja-credentials`, `kiriminaja-rate-calculator`, `kiriminaja-shipments-dashboard`, `kiriminaja-shipments-create`, `kiriminaja-webhooks-log`). Nav plan: 3 groups — Settings › Credentials (Logistics); Tools › Rate Calculator; New top-level `ThirdPLIL` (Truck icon) expandable with 3 children. VIEW_PERMISSIONS + ACTION_PERMISSIONS mapping for 12 backend permission codes. App.tsx 4-step wiring plan, 5-route breadcrumb grid, per-view header CTA bar (5 view specific action rows). 3 Shared components file list (SubdistrictCoverageLookup, RateResultsTable, ShipmentDetailDrawer) plus write order (routing → shared → views).
- **02-shared-thirdplilApi-wrapper-hook.md** written: Path A only (no Path B from browser). File creations: `src/types/thirdplil.ts` (12 enums: ShipmentStatus/DeliveryMode/PaymentType/etc. + 14 interfaces: CoverageArea, Credential, RateQuote, Shipment family, Webhook Admin, StandardError/Envelope). `callThirdPLILInternalUI<T>` typed generic signature (functionName 6 options, method, pathSuffix, body, params, transactionId). 10-row error → banner tone mapping table (400/401/403/404/409/422/429/500/503 + KA PIN wrong/locked behaviors). §4.3 KA Credit PIN ephemeral wrapper pattern (clear useState in finally no matter success). Hook: `useThirdPLILApi(scope)` returns {loading, lastError, banner, call<T>()}.
- **03-5-views-deep-spec.md** written: 5 per-view deep specs:
  1. Credentials: multi-column account cards layout (md:2 / lg:3 / xl:4 grid), env filter, ⭐ DEFAULT badge + 3-dot menu (Set Default/Edit/Delete), delete guard if default and others exist. 3 modals (Credential Form, Regenerate Secret once-shown, Test Connection Result). 5 form fields + SubdistrictLookup + UNIQUE per group label validation.
  2. Rate Calculator: 2-col layout, input form 17 field grid (mode express/instant + vehicle_type, sender/recipient 4 + SubdistrictLookup × 2, COD toggle+amount, insurance toggle+category+amount, packages edit grid rows × N, env + credential override optional, CTA: Clear/Demo Fill/Fetch Rates). Right = RateResultsTable 9 columns, 0-result warning banner, 409 cache info banner.
  3. Shipments Dashboard + Drawer: 9-col ServerDataTable (StatusBadge, AWB→drawer link, Ext ref, Courier Service badge, Mode, Recipient 2-line, Totals right align, COD amount, Last Updated WIB, Actions 4-dropdown). Bulk CTA: Download AWB, Cancel Selected, Request Pickup, Export CSV. Right drawer 720px × 4 SubTabs: Status History vertical timeline icons, Package & Items accordion line items grid, Raw Provider Data collapsible + copy JSON, Actions (Cancel/Return/Modify Pickup/Download AWB/Resync Poll).
  4. Create Shipment 5-step Wizard: Stepper header, 5 validation steps. Step 5 summary 2-col grid, payment method switch with KA Credit PIN password input max 6 digits numeric. Submit CTA row, 422 per-field validation, 409 dedup info banner, PIN clear finally no matter 2xx 5xx outcome.
  5. Webhook Admin 3 SubTabs tabbed multi-tab: Inbound Events 10-col ServerDataTable, DLQ replay no-op guard, Consumer Registrations (11 cols, form modal 10-field validation for URL/secret/HMAC/subscribed events/extra headers JSON). Noop on DLQ replay if event already moved past a certain shipment status.
  Plus: 5 shared modals (PickupScheduleForm, KaCreditPinEntry, AWBLabelPreview, RawJsonViewer, Confirm2Step), 7 global rules (currency IDR, timezone WIB, debounce 300ms search, clipboard copy-toast, 403 redirect to login, loading inline spinners in all submit buttons, network error banners).
- **Write order locked**: Next coding phase → routing/types first (append types.ts 5 AppView variants → app-routes.ts nav + permission context VIEW_PERMS/ACTION_PERMS → App.tsx lazy imports + switch) THEN 3 shared components THEN 5 views in order: Credentials → Rate Calculator → Dashboard+Drawer → Webhook Log → Shipment Wizard. Follow AGENTS changelog sequence for every code change (write changelog first → code → global index entry per rev).

#### Found Bugs
- (none for this rev — docs only)

#### Fixes
- (none for this rev)

---

### 2026-10-07.r003 — Frontend Phase 1 Wiring: AppView Variants + Routes Registry + Navigation Tree + Permission Mapping (5 Views Placeholder Stubs)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-07.r003](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L120-L135)

#### Changes
- **`src/types.ts`** (line append): Added 5 new `AppView` discriminated union variants: `kiriminaja-credentials`, `kiriminaja-rate-calculator`, `kiriminaja-shipments-dashboard`, `kiriminaja-shipments-create`, `kiriminaja-webhooks-log`. Kept existing `UserProfile` interface intact.
- **`src/app-routes.ts → APP_ROUTES`** (append 5 entries): Registered 5 route definitions with correct nav groups + layoutMode per 01-frontend-architecture.md:
  1. `/settings/kiriminAja/credentials` → `settings` nav group (under Setting alongside Theme Guide), layoutMode `wide`.
  2. `/tools/rates` → `tools` nav group, layoutMode `wide`.
  3. `/shipments` → new `thirdplil` top-level nav group, layoutMode `full` (wide ServerDataTable needs extra horizontal space).
  4. `/shipments/new` → `thirdplil` nav group child, layoutMode `wide`.
  5. `/admin/webhooks` → `thirdplil` nav group child, layoutMode `full`.
- **`src/App.tsx`** (4 sections modified):
  1. **Imports**: Added `Truck` (lucide-react) icon for new ThirdPLIL top-level nav group.
  2. **Lazy imports**: Added 5 lazy-loaded view imports (CredentialsKiriminAjaView, RateCalculatorView, ShipmentsDashboardView, ShipmentCreateWizardView, WebhookEventLogView) pointing to new `src/views/thirdplil/` subdirectory (matching spec file list at top of this changelog).
  3. **Navigation tree (useMemo)**: Added 3 nav groups:
     - `settings` → existing group + new child `Credentials (Logistics)` (maps to `kiriminaja-credentials`, permission `thirdplil.credentials.view`).
     - `tools` (new top-level group) with `Calculator` icon → child `Rate Calculator` (permission `thirdplil.rates.read`).
     - `thirdplil` (new top-level group) with `Truck` lucide-react icon, default expanded=true. Children: Shipments Dashboard, Create Shipment, Webhook Admin (permissions per VIEW_PERMISSIONS mapping).
  4. **renderView() switch**: Added 5 cases mapping AppView → lazy component.
  5. **getFirstAccessibleView() preferredViews[]**: Added shipments-dashboard as primary landing page (after dashboard).
- **`src/permission-context.tsx` (VIEW_PERMISSIONS map)**: Added 5 view → backend permission code mappings (12 codes from migration 0006 seed):
  1. `kiriminaja-credentials` → `'thirdplil.credentials.view'`
  2. `kiriminaja-rate-calculator` → `'thirdplil.rates.read'`
  3. `kiriminaja-shipments-dashboard` → `'thirdplil.shipments.view'`
  4. `kiriminaja-shipments-create` → `'thirdplil.shipments.create'`
  5. `kiriminaja-webhooks-log` → `'thirdplil.webhook.view'`
  Also added `thirdplil` to `expandedItems` default-true record.
- **Placeholder stub views (5 files in NEW folder `src/views/thirdplil/`)**: Created minimal placeholder TSX for each of the 5 views (pageCard via STYLES.tsx, header kicker + h2 + subtitle, info banner about spec location, breadcrumb grid per 01-frontend-architecture.md §6). These stubs prevent lazy import runtime errors after routing wiring.

#### Found Bugs
- (none for this rev — routing/plumbing only; actual view UI implementation deferred to r004+)

#### Fixes
- (none for this rev)

---

### 2026-10-08.r005 — Frontend: Full Credentials + Rate Calculator + Dashboard/Drawer + Wizard Step 1-3 Live Wires
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r005](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L140-L189)

#### Changes
- **CredentialsKiriminAjaView full impl** (was placeholder):
  - `useEffect` on-mount → `callThirdPLILInternalUI<SubscriberCredential[]>('thirdplil-admin-credentials', { method: 'GET', query: { env: 'all' } })` → cards populated from real backend list.
  - 2-column responsive grid (md:2, lg:3, xl:4). Card shows: default ⭐ Star badge, Production/Sandbox tone Badge, `credit_balance_idr` formatted IDR, `credit_updated_at` relative time, Encrypted green Shield badge for api_user non-empty.
  - Hover actions on each card: `Set Default` (disabled if already default) → POST to `/credentials/:id/set-default` + `banner = success`. `Test Connection` → `/credentials/:id/test-connection` → spinner + result tone success/danger banner, updates `last_test_conn_at`/`last_test_conn_ok` on card. `Delete` → confirm Modal, 422 guard if `is_default && credentialsInEnv > 1` → banner "Pilih default lain terlebih dahulu."
  - Add Credential Modal (dashed tile click → `useState(open)`): 6 fields (account_label, provider_slug dropdown [default kiriminaja] + is_sandbox switch + api_user(email) + api_key(password-type masked) + optional api_url_base). POST body → returns { raw_key_once } banner copy-to-clipboard success with "Simpan key ini, tidak akan muncul lagi" warning banner.
  - ENV filter pill row (All / Production / Sandbox) with count badges.
- **RateCalculatorView full impl**:
  - LEFT COLUMN (2/5): Two `SubdistrictCoverageLookup` instances stacked ("Origin" kicker first, then "Destination"). Callbacks: `onOriginSelect(area)` → setState `origin`, `onDestinationSelect(area)` → setState `destination`.
  - Same column, below lookups: 4-column 2-row grid weight/dims/declared/cod/insurance toggles + `ka_credit_cod_cutoff_note_info` banner.
  - CTA `Fetch Rates` disabled until `origin && destination && weight > 0`. onClick → loading spinner + call `callThirdPLILInternalUI<RateQuote[]>('thirdplil-rates', { method: 'GET', query: all })`.
  - RIGHT COLUMN (3/5): Real `RateResultsTable` with quotes returned from server. `onSelectQuote(quote)` → push navigate to `/shipments/new` with queryParams `?courier_service_code=X&origin_subdistrict_id=Y&...` pre-filling Wizard.
- **ShipmentsDashboardView full impl + drawer click handler**:
  - `useEffect` loads list via `callThirdPLILInternalUI<ShipmentHeader[]>('thirdplil-shipments')` (Paginated: page=1 per-page=20).
  - Per-row Actions column: `Details` → `openDrawer(shipment.id)`, `Download AWB` → GET `/shipments/{id}/awb-label?redirect=true` via `window.open(url)`, `Cancel` → confirm dialog → PATCH cancel → refresh.
  - `ShipmentDetailDrawer`: Real on-open call → `callThirdPLILInternalUI<ShipmentDetail>('thirdplil-shipments/' + id)` → populates real Summary + Packages + Pickup Window + Timeline from response. Placeholder sample data removed.
- **ShipmentCreateWizardView full impl (Steps 1-3 live)**:
  - Step 1 `Sender & Recipient`: 2 `SubdistrictCoverageLookup` side-by-side (Origin / Dest). 4 contact fields per side. `Continue` button enabled only when all required fields valid.
  - Step 2 `Packages`: dynamic package add/remove (max 20). Each package has 4 dim inputs + items dynamic add/remove (SKU, qty, unit price, fragile flag). Per-package auto-display `Actual / Volumetric / Billed` computed locally as preview (final server recomputes in RPC, so preview has helper note "Nilai final dihitung server di shipment_create_rpc").
  - Step 3 `Rate Quote`: Pre-filled from query params if navigated from Rate Calculator; else `Fetch Rates` inline → render `RateResultsTable` compact → onSelect → locked summary card.
  - Steps 4/5 state wired (not yet live impl to call create endpoint) — Step 4 Pickup schedule form; Step 5 Review + KA PIN input (ephemeral `useState<string | null>(pin);` cleared unconditionally in `finally {}` block after call).
- **Banner propagation**: Each view now uses `const [banner, setBanner] = useState<BannerMessage | null>(null)` + Banner component at top. Wrapper `callThirdPLILInternalUI` result `.banner` gets directly piped into setter.

#### Found Bugs
- **[PRE-EXISTING SCAFFOLD]** `SubdistrictCoverageLookup` sample data grid used `selectedIds` prop read but parent was passing undefined → no badges shown in placeholder. **Bundled Fix in same r005**: Add default `selectedIds = { province:null, city:null, district:null, subdistrict:null }` in component destructuring + skip badges if all null.

#### Fixes
- `thirdplilApi.ts` r004 had `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_ANON_KEY` as fallback, but some Vite setups use `VITE_SUPABASE_ANON_KEY` only. **Bundled fix**: priority order `VITE_SUPABASE_ANON_KEY || VITE_SUPABASE_PUBLISHABLE_KEY || VITE_SUPABASE_ANON_KEY` (alias fallback, safe).

---

### 2026-10-21.r016 — Frontend NONE this rev (Backend doc reconciliation: KiriminAja adapter audited vs official MitraAPI spec)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-21.r012](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L80-L106)

#### Changes
- **No frontend source changed** — this entry records the paired backend revision so the two changelogs stay in step.
- Backend rev `2026-10-21.r012` audited `_shared/thirdplil/providers/kiriminaja.ts` against the official KiriminAja MitraAPI spec (`api-reference.json`) plus a live sandbox probe, and found the adapter targets a **non-existent API shape** (Bearer-only auth, no `/api/v2` base suffix, all 11 endpoint paths invented, envelope key `results`, no webhook event id). Full rewrite plan: `09-mitraapi-adapter-reconciliation.md`.
- Backend also reconciled the umbrella docs `07-auth-tenancy-design.md` (new §0 Schema Map; `lova_il.current_subscriber_id`) and `08-onboarding-and-openapi-workflows.md`. Repo naming in those docs updated from `ThirdPLILFrontend` → `LOVAIntegrationLayerFrontend`.

#### Found Bugs
- (none for this rev — backend-only findings, tracked as BUG-THIRDPLIL-07 through -16)

#### Fixes
- (none for this rev)

---

### 2026-10-20.r016b — Frontend repo rename + IL schema consolidation notes
**Backend twin changelog (paired)**: [webstoresupabase-migration-fix-plan.md](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/webstoresupabase-migration-fix-plan.md)

#### Changes
- **No frontend source changed** in this rev. Recorded for traceability: the backend migration rehaul consolidated the old `0001`–`0009` ThirdPLIL family into `lova_il` + `thirdpl_il` + `pgil`, renamed the session GUC to `lova_il.current_subscriber_id`, and dropped the `private` schema. The frontend repo is now **`LOVAIntegrationLayerFrontend`** (unified ThirdPLIL + PGIL UI) — any code or doc that still calls `thirdpl_il.verify_consumer_api_key(sha256, ip)` or reads `profiles.uid` is stale.
- **Follow-up (not done in this rev)**: the frontend `src/types/thirdplil.ts` and `src/utils/thirdplilApi.ts` still mirror the pre-rewrite provider contract; they must be re-synced after the backend adapter rewrite (Phase D of doc 09) lands.

#### Found Bugs
- (none for this rev)

#### Fixes
- (none for this rev)

---

### 2026-10-12.r015 — Type updates for courier field capture (paired with backend r015 adapter mapping audit)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-12.r015](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L193-L226)

#### Changes
- **`src/types/thirdplil.ts`**: Added `courier_code?: string | null` + `courier_name?: string | null` to `RateQuote`, `ShipmentHeader`, and `CourierServiceCache`. Added `provider_order_id?: string | null` to `ShipmentHeader`. Relaxed most `CourierServiceCache` fields to optional (KA may not return all).

---

### 2026-10-12.r014 — Credentials view: display webhook URL + wh_secret after credential creation (paired with backend r014 credential & auth gap fixes)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-12.r014](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L193-L232)

#### Changes
- **`CredentialsKiriminAjaView.tsx`**: After creating a KiriminAja credential, the success banner now displays **both** `webhook_url` (full URL to paste into KA Dashboard → Settings → Webhooks) and `raw_key_once` (the 64-hex `wh_secret`), each with its own Copy button. Previously only `raw_key_once` was shown — the user had no way to get the full webhook URL without manually constructing it.
- Added `showWebhookUrlOnce` state; `submitNew` captures both `raw_key_once` and `webhook_url` from the `POST /credentials` response.
- Updated labels: `raw_key_once` is now labeled "Webhook secret (wh_secret)" (not "API key"), since the KA API key is encrypted at rest and never re-displayed.

#### Found Bugs
- Frontend showed `raw_key_once` labeled as "secret key" without context — value is actually the webhook `wh_secret`, not the KA API key. User had no visibility into the `webhook_url` they must paste into the KA dashboard.

#### Fixes
- Display both `webhook_url` and `raw_key_once` with clear labels + individual copy buttons. Single Hide button clears both.

---

### 2026-10-08.r013 — Frontend NONE this rev (Backend docs-only pair: SCOPE CORRECTION rollback — Saved Address Book storage moved back out of IL to Webstore)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r013](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L193-L220)

#### Changes
- (Frontend: no code this rev — pure backend OpenAPI scope boundary correction rollback. Backend pair writes during this revision:
  1. Rollback r012 Saved Address Book spec over-scope: DELETE 5 paths `/consumers/{cid}/addresses*` + DELETE 4 schemas SavedAddress(Create/Update/Type) + revert CreateShipmentRequest strict required 8 inline origin/destination fields (removed use_saved_* expand-by-ref).
  2. KEEP r012 in-scope CORRECT items: `GET /coverage/tree` hierarchical + schema `CoverageAreaNode` stable id (this is standard address mapping API webstore wanted).
  3. Rewrite onboarding §3.5 to correct guidance: webstore owns saved address book storage with FK `subdistrict_id_thirdplil → CoverageAreaNode.id` on their own DB.)

#### Found Bugs
- r012 Saved Address Book endpoints were scope creep (IL domain should be pure integration/translation, NOT CRM/address-book storage). Fixed via rollback.

#### Fixes
- Rollback. Scope boundary now clean.

---

### 2026-10-08.r012 — Frontend NONE this rev (Backend docs-only pair: Consumer OpenAPI coverage tree + saved addresses book CRUD)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r012](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L193-L215)

#### Changes
- (Frontend: no code this rev — pure backend OpenAPI spec extension. Backend pair writes during this revision:
  1. 06-consumer-openapi.yaml Coverage tag expanded GET /coverage/tree (hierarchical 4-level nodes province→city→district→subdistrict) — stable id=area_id bigint FK; provider external ids stored in code_provider/metadata.
  2. 06-consumer-openapi.yaml NEW Saved Address Book tag: group endpoints /consumers/{consumer_id}/addresses CRUD (list/single/create/update/delete soft archive) + schema SavedAddress with subdistrict_id FK to coverage areas + provider_snapshot jsonb.
  3. 08-onboarding §3 prep expanded with saved-address flow.)

#### Found Bugs
- None (pure OpenAPI yaml + docs rev).

#### Fixes
- None.

---

### 2026-10-08.r011 — Frontend NONE this rev (Backend docs-only pair: 08-onboarding §7 ASCII pipe-art table → Mermaid sequence diagram)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r011](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L193-L211)

#### Changes
- (Frontend: no code this rev — pure backend markdown diagram fix. Backend pair writes during this revision:
  1. 08-onboarding-and-openapi-workflows.md §7 "Consumer End-to-End Workflow": confusing ASCII 5-column pipe-art table drawing replaced with proper Mermaid `sequenceDiagram` fenced block. 5 participants: Checkout/ThirdPLIL/KiriminAja/Fanout/WebstoreBackend. Steps 1–8 preserved exact original order. 4 Mermaid `alt` blocks for failure paths mirror §7.1 textual failure table.)

#### Found Bugs
- None (pure docs-only drawing replace).

#### Fixes
- ASCII column alignment broken on narrow tab widths; fixed with native Mermaid render auto-layout.

---

### 2026-10-08.r010 — Frontend NONE this rev (Backend docs-only pair: Onboarding & OpenAPI Workflows start-to-end document)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r010](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L193-L222)

#### Changes
- (Frontend: no code this rev — pure backend markdown. Backend pair writes during this revision:
  1. **New document 08-onboarding-and-openapi-workflows.md**: Start-to-end 7-section onboarding for IL ops admin + Webstore backend engineer integrating via OpenAPI 06. Covers: Staging first-time setup (supabase link/db push/functions deploy + 6 env secrets); Admin onboarding UI menu paths to create Subscriber + add KiriminAja credential validate; Post-KA cache warmup (coverage nightly + courier services); Webstore auth dual-path (Path A Bearer JWT internal UI, Path B X-ThirdPLIL-API-Key server-to-server); Override headers (Credential-Id/Idempotency-Key 504 retry-safe dedup rule); 06-consumer-openapi 7 endpoints full JSON payload + response examples (coverage/rates/schedules/shipment create/get/cancel/awb-label signed URL); end-to-end consumer sequence diagram with DLQ Replay fallback.
  2. PRD §8 future AI reading order updated: 08-onboarding #1 entry.)

#### Found Bugs
- None (pure markdown docs-only rev).

#### Fixes
- Bundled consistency fix: §6 JSON examples ensure exact property names match TypeScript interfaces (selected_courier_service_code, declared_value_total_idr, credential_id) to reduce drift during integration.

---

### 2026-10-08.r009 — Frontend NONE this rev (Backend only pair: Move all tables/types/RPCs from public schema → thirdpl_il dedicated schema)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r009](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L192-L234)

#### Changes
- (Frontend: no code this rev — pure backend SQL schema boundary isolation. Backend pair writes during this revision:
  1. NEW migration 0009 moves ALL 16 tables, 7 enums, 3 composite types, 5 RPC wrapper functions + verify_consumer_api_key from `public` SCHEMA → new dedicated schema `thirdpl_il` (avoids polluting webstore public schema).
  2. GRANTs: authenticated/anon/service_role SET search_path → "$user", public, thirdpl_il (so `supabase.from('thirdplil_shipments')` still resolves).
  3. 5 thin public RPC aliases forward → thirdpl_il.* (no SDK TypeScript edits needed because Supabase-js `.rpc()` still finds the public schema wrapper that then calls the real function inside thirdpl_il schema).)

#### Found Bugs
- None (pure boundary move; 0 new columns/enums).

#### Fixes
- Bundled 1 anticipated bug-fix with aliases: `supabase.rpc('fn_name')` default only looks public schema → would break after move. Alias wrappers avoid PostgREST `db-schemas` manual config change.

---

### 2026-10-08.r008 — Frontend NONE this rev (Backend docs-only pair: Auth + Tenancy single canonical doc)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r008](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L193-L208)

#### Changes
- (Frontend: no code this rev — pure backend docs. Backend pair writes during this revision:
  1. **New document 07-auth-tenancy-design.md** created: Canonical single reference explaining dual-path auth (Path A Bearer JWT + Path B API key sha256), downstream GUC thirdplil.current_subscriber_id equivalence, 11+ RLS policies, outbound webhook ThirdPLIL-Signature t=,v1= HMAC-SHA256 signing algorithm + external consumer verify snippet, only-once 64-hex consumer secret banner pattern, optional override headers (Credential-Id / Idempotency-Key), PIN Ephemeral Triple Discipline rule, audit/rotation table.
  2. PRD 01-master §8 Future AI reading order: 07-auth-tenancy-design.md moved to #1 FIRST spot (read this file for all auth/tenancy/signature questions before opening old 05-tenancy-design.md).)

#### Found Bugs
- (none — docs-only rev; no TypeScript / React / SQL / RPC code.)

#### Fixes
- (none beyond new doc delivered)

---

### 2026-10-08.r007 — Frontend NONE this rev (Backend only pair: OpenAPI + pg_cron nightly sync + PRD §7 Status Tracker update)
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r007](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L193-L210)

#### Changes
- (Frontend: no code this rev — paired backend rev writes:
  1. Consumer OpenAPI 06 spec updated: GET /schedules/pickup dual-auth security schemes (PathA BearerJWT + PathB ApiKey X-ThirdPLIL-API-Key);
  2. Migration 0008 pg_cron nightly 02:00 UTC coverage sync + weekly Mon courier cache refresh.
  3. PRD 01-master §7 Status Tracker fully synchronized with real project state.)

#### Found Bugs
- (none)

#### Fixes
- (none — frontend tsc --noEmit 0 errors + GetDiagnostics 0 diagnostics confirmed end of r006, no regressions.)

---

### 2026-10-08.r006 — Frontend: Wizard Steps 1-5 FULL live + Webhook Log 3-tabs FULL live + Drawer hydrate (r005 Part 2) + Backend pair: Schedules KA Credit Coverage Sync Edges
**Backend twin changelog (paired)**: [kiriminaja-changelogs.md § 2026-10-08.r006](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L192-L232)

#### Changes
- **ShipmentCreateWizardView full 5-step live-wire**:
  - `useEffect` on mount → read `window.location.search` URLSearchParams → hydrate state for `origin_subdistrict_id, destination_subdistrict_id, courier_service_code, declared_total_value_idr, cod_amount_idr, insurance_enabled, total_actual_weight_g` (comes from RateCalculatorView when user clicks quote).
  - **Step 1 Sender/Receiver**: 2 stacked `SubdistrictCoverageLookup` with individual kicker tones (blue Origin, green Destination). Contact form: name/phone/email/address_line textarea — validation & required state.
  - **Step 2 Packages & Items**: Dynamic `packages[]` array state max 20, items max 50 project-wide. Add Package button → 4 input row (L/W/H/cm, actual_weight_g, description). Add Item row per package: SKU, name, qty, unit_value_idr, is_fragile checkbox, hs_code optional. Line_value auto-calc client-side for display (server recomputes).
  - **Step 3 Rate Quote**: If `courier_service_code` from URL prefills & matches any quote, lock it; else `Fetch Rates` inline → shared `RateResultsTable` compact mode → on select sets state + grand total preview card.
  - **Step 4 Pickup Schedule**: `useEffect(step===4)` → `GET thirdplil-schedules/pickup?origin_subdistrict_id=id&date_local=YYYY-MM-DD` (date defaults to today + 1, with manual date picker override). Grid radio cards: window_id → start/end time + cut-off time Badge, availability disabled grayed out if `is_available=false`. Fee small tone Badge.
  - **Step 5 Review & Submit**: Summary 5-card grid compact of Steps 1–4. KA Credit PIN `input type=password maxLength=6 pattern=[0-9]*` (validates 6-digit numeric before submit). Submit → call `POST thirdplil-shipments` with full payload. **PIN ephemeral**: `finally { setKAPin(''); }` always clears state, and `window.addEventListener('beforeunload', clearPinHandler);` also removes on tab close. On success → navigate Shipments Dashboard with new `shipmentId` drawer auto-open via URL hash `#drawer-open-id=1234`.
- **WebhookEventLogView 3 sub-tabs FULL live-wire**:
  - Tab 1 **Inbound Events**: `useEffect(tab===inbound && page)` → `GET /admin-webhooks/events?direction=inbound&page=${page}&per_page=25`. ServerDataTable columns: occurred_at ts local WIB, provider_slug tone Badge, event_type → Badge (pickup.*/shipment.*/return.* etc), dedup Badge is_duplicate=true yellow "Duplikat skip persist", shipment_id → link onClick opens Drawer, consumer_fanout summary badge (queued=amber, sent=green, failed=red, dead_letter=dark-gray), payload preview trunc 600 chars JSON pretty-print. **Replay** button per row → `POST /events/:id/replay` → banner "Replay OK, queued → fanout worker will pick up in next 60s".
  - Tab 2 **DLQ**: Same table layout + extra cols: last_http_status (4xx red, 5xx orange), attempts count Badge e.g. `5/5 exhausted`, last_error_msg trunc 200ch. **Replay** button → `POST /dlq/:id/replay` transitions queue row delivery_status = replayed attempts=0 next_retry_at=NOW().
  - Tab 3 **Consumer Registrations**: `GET /admin-webhooks/consumers` → cards list. Each card: slug Badge, url (click opens new tab), events_subscribed comma list + tone Badge per event, hmac_secret masked preview `****-a3f1-e8c9` last 8 chars only, algorithm Badge sha256, registration.created_at + last_success_at. Add Registration modal (form: slug, url, events checkbox list — all 36 ConsumerWebhookEventType checkboxes). On submit POST → response returns raw `hmac_secret_64_hex_once` → banner copy-to-clipboard "Secret hanya muncul SEKALI — simpan di consumer Webstore/WMS env. Tidak akan muncul lagi." **Test Ping** button per registration → POST `/consumers/:id/test-ping` — posts a signed HMAC test payload with `event_type=test.ping`. Returns banner "Ping: 200 OK" green / "Ping: 403 HMAC Fail" red + diff snippet actual vs expected first 32 chars.
- **ShipmentDetailDrawer Part 2 (live hydrate)**: samplePackages/sampleTimeline static arrays removed entirely. On drawer open → useEffect(open) → `callThirdPLILInternalUI` GET /thirdplil-shipments/:id with combined shape `{ shipment, history }` → state set `shipment`, `history` array; timeline tab uses `history` rows sort occurred_at asc; packages tab uses shipment.packages (nested from RPC join); Pickup tab driver_name/driver_phone hydrate from `pickup_driver_assigned` history row `note_jsonb` fields; empty state dashed skeleton Loader2 when loading && !shipment.
- **Permission mappings updated**: Added permission codes `shipments:schedule:view`, `admin:ka_credit:balance`, `admin:coverage:sync`, `shipments:create:wizard`, `admin:webhooks:read`, `admin:webhooks:replay`, `admin:consumers:write` to VIEW_PERMISSIONS map for 5 views.

#### Found Bugs
- **[TYPE DRIFT]** r005 thirdplil.ts ShipmentHeader missing 5 optional `pickup_*` fields (window_id, date_local, start_time, end_time, driver_note) — Wizard Step 4 + Drawer Pickup need them. **Fix bundled r006**: Add 5 optional fields to both frontend & backend shared types.ts; no DB schema change (they are optional cols on thirdplil_shipments per migration 0002 shipments family).
- **[Badge Label Type Guard]** Sticky header loading pill in ShipmentsDrawer used ReactNode `<Loader2/> + text` inside Badge label prop. Badge interface defines label: string only; TS error (mild dev only, production didn't surface). Fix: inline styled `<span>` instead of Badge for loading pills.

#### Fixes
- Drawer close cleanup effect: before r005, when user closed drawer state wasn't reset (shipment/history/banner persisted). Added `useEffect(open===false)` → resets all state to `null` + tab back to 'summary'. Prevents stale data on next open of different ID without refresh.

---

### 2026-10-07.r004 — Frontend Shared Types (thirdplil.ts) + typed API Wrapper (thirdplilApi.ts) + 3 Shared Components Scaffold
**Scope**: src/types/thirdplil.ts, src/utils/thirdplilApi.ts, src/components/thirdplil/*
**Backend twin changelog**: [kiriminaja-changelogs.md § 2026-10-07.r004](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#L140-L160)

#### Changes
- **New file `src/types/thirdplil.ts`**: Per PRD 02 §2 Type Definitions. 12 enums: `EnvToggle`, `CredentialEnvFilter`, `ProviderSlug`, `CoverageAreaLevel`, `CourierServiceType`, `CourierServiceTier`, `ShipmentStatus` (17 values from FSM), `PackageDimensionUom`, `PickupWindowStatus`, `WebhookEventDeliveryStatus`, `ConsumerWebhookEventType` (36 values), `PermissionCode` (12 codes). 14 interfaces: `ThirdPLILCoverageArea`, `CourierServiceCache`, `SubscriberCredential`, `RateDimension`, `RateQuote`, `PickupWindowOption`, `PackageItemRow`, `PackageWithItems`, `ShipmentHeader`, `ShipmentDetail`, `CreateShipmentRequest`, `TransitionStatusResponse`, `InboundWebhookEvent`, `ConsumerWebhookRegistration` + `StandardEnvelope<T>` + `BannerMessage`. Exports AppView (re-export from sibling `types.ts`) + `BannerState` (React setState shape).
- **New file `src/utils/thirdplilApi.ts`**: Per PRD 02 §3 `callThirdPLILInternalUI<T>()` T-generic wrapper. Contract:
  1. Path A JWT ONLY (fetch auto-sends Supabase anon key + Authorization JWT via `createClientComponentClient()` supabase-js, no custom headers — matches Edge Functions pattern that expect standard Supabase auth).
  2. URL = `${SUPABASE_URL}/functions/v1/${fnName}`.
  3. `Content-Type: application/json` always.
  4. Auto-generates UUIDv4 `X-ThirdPLIL-Transaction-ID` header on mutations (opts.transactionId override = valid for dedup retry scenarios).
  5. Auto-injects optional `X-ThirdPLIL-Credential-Id: opts.credentialId`.
  6. Parses standard `StandardEnvelope<T>`.
  7. Status mapping: `200 + envelope.success = true` → `{ ok:true, data:T, isDuplicate?, warnings? }` banner success info (green toast optional). `409 Conflict` → returns is_duplicate=true from response.data, existing_shipment_id extracted (do NOT raise error — dedup is success path; caller decides if banner should appear).
  8. Banner error mapping: `400` → `validation_error` danger banner with field-prefixed messages array joined; `401`/`403` → login expired/forbidden danger banner; `422` → per-field errors from envelope.errors[] + field pointer lookup; `500` → backend_unhandled danger banner; `503` → provider_down warning banner (KA API unreachable, retry in N minutes).
  9. Throws only on truly unrecoverable (network error, 5xx with no envelope response). Caller receives typed `CallResult<T>` discriminated union (OK | ErrWithBanner).
  10. **PIN EPHEMERAL DISCIPLINE**: Exported `PIN_FIELD_PATHS: string[]` helper list = `['payment.pin', 'payment.ka_pin', 'ka_credit_pin', 'shipment.payment.pin']`. Caller MUST pass `{ excludeFromLog: PIN_FIELD_PATHS }` before calling; wrapper recursively sets those fields to undefined in the request body sent to edge. Explicitly does NOT add PIN to any console.log or fetch metadata object.
- **3 Shared Components scaffold (stubs with STYLES.pageCard + banner + layout matching deep spec)**:
  1. `components/thirdplil/SubdistrictCoverageLookup.tsx` — props `{ level: CoverageAreaLevel, parentId?, onSelect(area: ThirdPLILCoverageArea), selectedIds?, showSearchBar?: true }`. 4-level cascading Province → City → District → Subdistrict; 16 sample rows per level. On `onSelect` at subdistrict, emits `{ id, level: 'subdistrict', fullPathBreadcrumb: 'DKI Jakarta › Kota Jakarta Pusat › Menteng › Menteng Dalam' }`.
  2. `components/thirdplil/RateResultsTable.tsx` — props `{ quotes: RateQuote[], onSelectQuote(q: RateQuote) }`. 8-col grid (Courier Name · Service Code · Tier Badge · ETD days · Weight KG · Base Fee IDR · Insurance/Cod Surcharges · Grand Total IDR · Action → Select). Sample 12 rows (5 providers × 2-3 service tiers) matching deep spec; status tone badges (Express gold, Reguler blue, Economy grey).
  3. `components/thirdplil/ShipmentDetailDrawer.tsx` — props `{ open: bool, shipmentId: bigint, onClose }`. 4 SubTabs (Header Summary + Packages/Items grid + Pickup window + Timeline FSM history). Sample 5-row packages/items, 5-step FSM timeline with delivered→green, problem→red dots, current step bolded. Banner on top: AWB label "download PDF" CTA button (stub for storage URL).
- **Hook scaffold** (to be filled r005): interface `UseThirdPLILApi<TArgs, TResult>` in new file `src/hooks/useThirdPLILApi.ts` — returns `{ loading, data, banner, run() }` shape with banner state setter. Not implemented yet; exported as type only for future views.

#### Found Bugs
- (none for this rev — scaffold + interface locks; actual fetch tests deferred to r005)

#### Fixes
- (none for this rev)

---

### YYYY-MM-DD.<revN> — Short human title for this revision
**Scope**: Components / views / hooks / utils modified.
**Backend twin changelog** (if paired): `[kiriminaja-changelogs.md § YYYY-MM-DD.revN](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md#)`

#### Changes
(none for this rev)

#### Found Bugs
(none for this rev)

#### Fixes
(none for this rev)
