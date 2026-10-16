# 5-Views Deep Specification (Per-View Field Grids, Validation, Columns, Actions)

**Parent architecture doc**: [01-frontend-architecture.md](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/KiriminAja/01-frontend-architecture.md)
**Shared hook/API wrapper**: [02-shared-thirdplilApi-wrapper-hook.md](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/KiriminAja/02-shared-thirdplilApi-wrapper-hook.md)
**Backend API contract**: [03-api-contract.md](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/03-api-contract.md)
**Frontend changelog**: [kiriminaja-frontend-changelogs.md](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/KiriminAja/kiriminaja-frontend-changelogs.md)

---

## 1. View 1: CredentialsKiriminAjaView (`/settings/kiriminAja/credentials`)

### 1.1 Purpose
Manage KiriminAja API accounts per subscriber (multi-account). Each credential = one KiriminAja account (sandbox or prod). Admin sets one account ⭐ DEFAULT per (provider + env). Credentials are used by Path B (Webstore backend) when calling IL to create shipments on behalf of buyers.

### 1.2 Page Layout (single tab)

| Section (top→bottom) | Content |
|:---|:---|
| **Dynamic banner region** | 4 tones. |
| **PageCard header** | Kicker: Settings › Logistics › Credentials. H2: "KiriminAja Accounts". Subtitle: "Kelola akun API, set default per environment, test koneksi, regenerate webhook secret yang dipaste ke dashboard KiriminAja Notification URL." |
| **Right action CTA bar** | + Add New Account (primary blue), ⓘ How to get API key (secondary, opens modal). |
| **Filter bar (top)** | Env badge toggle group: [Semua] (default) / [Sandbox] / [Production]. (Per env, ⭐ DEFAULT is displayed via star badge on cards.) |
| **Main body** | Responsive grid (md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4) of **Account Cards** (see §1.4). Empty state if 0 cards. |

### 1.3 Column / Filter Fields

Filter row:
- `credential_id search` (quick filter by account_label text)
- `is_sandbox` (badge toggle group All / Sandbox / Prod)
- `is_default` (optional Yes/No)
- `last_test_conn_ok` (All / OK / FAILED / NEVER)

### 1.4 Account Card Layout (per credential, 1 card = 1 credential row)

```
┌─ Card rounded-3xl border shadow ───────────────────────────────────────┐
│ [ENV BADGE: Sandbox blue / Production green]   [⭐ DEFAULT badge if true] │
│ 🔑 account_label (title, 18px)                                               │
│ Provider: KiriminAja • KA Credit: Yes/No • TOP: Yes/No                    │
│ Last Test Connection: (2026-10-07 14:22 WIB) • 🟢 OK / 🔴 FAIL / ⚪ N/A  │
│ Default Sender: (short one-line preview)                                    │
│ Webhook URL (copyable chip): POST /functions/v1/thirdplil-webhook/kirimin… │
│ — Actions Row —                                                             │
│ [Test Connection] [Regenerate Webhook Secret] [••• Menu (3 actions below)] │
└────────────────────────────────────────────────────────────────────────────┘
```

3-dot Menu Items:
1. **Set as Default** → disabled (grayed + ✔️) if already default; On click → 2-step confirmation: "Menjadikan ini default untuk semua transaksi di lingkungan Sandbox Anda?" → danger banner if others existed that were unset.
2. **Edit** → Open Credential Form modal (same form as Add, prefilled). Fields: account_label, is_sandbox (locked for edit), api_key (type="password", show/hide, empty string placeholder "Kosongkan jika tidak ingin rubah"), default_sender (4 fields + SubdistrictLookup), ka_credit_enabled checkbox, top_enabled checkbox.
3. **Delete** → DeleteConfirmationModal. GUARD: If this credential is `is_default=true` AND other credentials exist in the same group → BLOCK DELETE with message "Anda harus memilih default account baru sebelum menghapus default saat ini." If this is the ONLY credential → allow delete without block. "Satu-satunya akun; tidak akan bisa membuat shipment sampai menambah akun baru. Lanjut?"

### 1.5 Modals

| Modal | Trigger | Fields | Validations | Submission behavior |
|:---|:---|:---|:---|:---|
| Credential Form (Add / Edit) | +Add button / Edit menu | account_label text (not empty), is_sandbox radio group, api_key password required on add, default_sender_name, default_sender_phone, default_sender_address, SubdistrictCoverageLookup for sender_subdistrict_id, KA Credit toggle, TOP toggle. | Label UNIQUE per group (sandbox + provider). api_key required min 12 chars. Sender subdistrict_id required if any default sender field filled. | On Submit → POST /thirdplil-admin-credentials (12 permission code). Banner success: "Akun disimpan. Tes koneksi? (button CTA on success banner: Ya, Jalankan Test Sekarang)". |
| Webhook Regenerate Secret | Regenerate button | None; just 2-step confirm. | After confirm → regenerate; show NEW secret once in password input with copy button + WARNING banner "Secret hanya ditampilkan sekali. Paste ke KiriminAja dashboard → menu Settings → Notification Settings. Simpan dengan aman." |
| Test Connection Result | Test button | Opens modal with result log + duration ms + status code + masked headers snapshot. | On error: suggest "Cek environment (sandbox/prod) sesuai dengan API key yang didapat dari dashboard KiriminAja (sandbox.kiriminaja.com vs app.kiriminaja.com)." |

---

## 2. View 2: RateCalculatorView (`/tools/rates`) — Live Price Check

### 2.1 Layout (single tab form; 2 columns md:grid md:grid-cols-2 gap-6)

Left column = **INPUTS CARD**; Right column = **RESULTS CARD (RateResultsTable)**.

### 2.2 Input Form Fields (ALL required unless stated Optional)

| Field / Row | Type | Validation |
|:---|:---|:---|
| **Delivery mode group** | Radio buttons: Express / Instant. | Default Express. If Instant → show Vehicle_type dropdown (Motorcycle / Car / Van). |
| Sender: Name, Phone, Address (3 text rows) | Text inputs | Not blank. Phone starts with 0/62/+. |
| Sender Subdistrict | `<SubdistrictCoverageLookup>` cascading drilldown 4-levels | Required (must select subdistrict). Displays selected full path: "DKI Jakarta › Kota Adm. Jakarta Selatan › Kec. Tebet › Kel. Tebet Barat" |
| Recipient: Name, Phone, Address | Text inputs | Same |
| Recipient Subdistrict | `<SubdistrictCoverageLookup>` (2nd instance) | Required |
| COD toggle? | Switch + if ON → COD Amount number input | If cod_enabled → cod_amount_idr > 0 |
| Insurance toggle? | Switch + insurance category radio if ON (Standard/Fragile/Electronics) + insurance_amount (sum of items default) | ON → insurance_amount > 0 |
| **Packages table (editable grid)** | Repeating rows: Weight g, Length/W/H cm, content_value, qty (default 1), fragile bool (checkbox), description. Add Package / Remove row buttons. | Min 1 package row. Each field positive integer. Content value required if insurance ON or COD ON. |
| Override default credential account? (Optional) | `<Select>` of credentials (is_default one = preselected + star badge). Optional: override for this test (if admin has multiple accounts). | Optional, default = is_default credential for env |
| Env | Radio Sandbox/Prod (default Sandbox). Filters credential dropdown options. | Required. |
| CTA Row | Right aligned. [Clear Form] [Use Demo Address Quick Fill] [🔍 Fetch Live Rates (primary blue)] | Fetch rates button disabled until all required filled; shows Loader2 while loading. |

### 2.3 RateResultsTable (Right Column)

Column grid:
1. Courier (logo + name text — 2-line)
2. Service Code (badge, blue outline)
3. ETD (e.g. "1–2 hari")
4. Base Shipping Fee (IDR thousand-separated)
5. Insurance Fee (if applicable)
6. COD Fee (if applicable)
7. Other fees (if KA has packing/other charges)
8. **Grand Total (bold right-aligned green text)**
9. Action: 🔘 Radio + "Book This Rate" → navigates to ShipmentCreateWizardView with sender/recipient/packages prefilled.

After 409 dedup → info banner "Rate ini sudah di-fetch X detik yang lalu, menampilkan hasil cache (id transaksi: 8aF3…bC2)".
If 0 results → warning banner "Tidak ada layanan kurir tersedia untuk rute ini. Pastikan alamat sesuai, atau coba Instant jika jarak <50km."

---

## 3. View 3: ShipmentsDashboardView + ShipmentDetailDrawer (`/shipments`)

### 3.1 Layout (Single tab + right-side drawer on row click. full page width.)

- Top filter bar (persistent via ServerDataTable persistPreferences=true)
- ServerDataTable (below) → row click = opens drawer right side
- Drawer open: 720px wide, overlay backdrop, Close X top right

### 3.2 ServerDataTable Column Grid

| Column ID | Column Title | Type / Renderer | Sortable | Filterable |
|:---|:---|:---|:---:|:---:|
| status | Status | StatusBadge (color grid per 12-status) | ✅ | ✅ (multi-select statuses) |
| awb_no | AWB No. | Link → opens drawer; copy-to-clipboard icon on hover | ✅ | ✅ (text search) |
| external_ref | Merchant Order Ref | Small monospace text; copy | ✅ | ✅ |
| courier_service | Courier | Logo + service badge | | ✅ |
| delivery_mode | Mode | Express/Instant badge; icon (truck / zap) | ✅ | ✅ |
| recipient_name | Recipient | 2 line: name, first 20 chars address | | ✅ (text) |
| grand_total | Total Cost | IDR, bold, right aligned | ✅ | ✅ (numeric range) |
| cod_amount | COD Amount | If COD enabled → amount, else dash | ✅ | |
| updated_at | Last Update | WIB relative time + tooltip absolute | ✅ | ✅ (date range) |
| actions | Actions | [Open Drawer] • [Download AWB] • [Cancel] • [Request Pickup] dropdown | | |

### 3.3 Bulk Actions (top right of table; enabled when ≥ 1 row selected)
- Download AWB labels (selected) → ZIP file download
- Cancel Selected → 2-step confirm "Membatalkan X shipment. Yakin?" (warning)
- Request Pickup (Selected) → redirects to Request Pickup modal; shows error if shipment not in eligible status (draft / awb_assigned)
- Export CSV (selected rows / all rows)

### 3.4 Drawer (ShipmentDetailDrawer) — 4 SubTabs

#### Subtab 1: Status History (Vertical timeline)
Rows of timeline (icon left, body right). Icon based on status category (PackageCheck=delivered, Truck=transit, AlertCircle=problem, ArrowLeftRight=return, Clock=scheduled). Each row: occurred_at WIB, location_text, status badge, courier raw status (small gray pill), note field if manual. Button at bottom of tab: "Refresh (poll latest)" → re-fetch from provider.

#### Subtab 2: Package & Items
Accordion per package: Weight, dims, billed weight, content value, fragile. Inside accordion: Items table (name, qty, value, SKU if set, description).

#### Subtab 3: Raw Provider Data
Collapsible `<pre>` with JSON.stringify(data, null, 2) + Copy JSON button. Show "⚠️ BERISI DATA MENTAH DARI PENYEDIA — HANYA UNTUK DEBUGGING" banner.

#### Subtab 4: Actions (permissions-aware)
- Cancel shipment → FSM validates eligible status; modal confirm
- Request Return → required reason textarea; confirm
- Request / Modify Pickup → open PickupScheduleFormModal
- Download AWB → GET awb-label route
- Re-sync status (poll provider) → call internal UI API

---

## 4. View 4: ShipmentCreateWizardView (5-step Stepper)

`/shipments/new`

### 4.1 Stepper Flow

Steps (top: Stepper component OR SubTabs):
1. **Sender & Recipient** → (fields: same as rate calculator + notes_for_courier optional textarea)
2. **Packages & Items** → (editable grid packages table; each package expandable to line items table)
3. **Rate Quotes → Select Service** → (fetch rates live; render RateResultsTable → radio selection)
4. **Pickup Schedule** → (select schedule slot, optional: skip pickup if sender drops off at KA counter)
5. **Review & Submit** → full summary 2-column grid, payment method selection, SUBMIT & CREATE ORDER

### 4.2 Per-step Validation Rules

1. Step 1 complete: Sender & recipient (name, phone, address, subdistrict) filled.
2. Step 2 complete: ≥ 1 package, each package has weight, l, w, h filled. ≥ 1 item per package (with name + unit_value if COD/insurance).
3. Step 3: "Fetch rates" required → user must click before next. Radio button selection required.
4. Step 4: If delivery_mode express → required pickup schedule or "will drop off at KA branch" switch ON (then skip schedule). For instant → instant_pickup_window dropdown.
5. Step 5: Payment method required. Options:
   - Non-COD (QRIS / E-wallet / Bank transfer)
   - COD via KA Credit → REQUIRES PIN input field (type=password, 6 digit, inputMode=numeric, maxLength=6, use §4.3 ephemeral wrapper)
   - COD via bank transfer (manual)

### 4.3 Submit Actions (CTA Row in Step 5)
- [Save Draft] → secondary; saves status draft, not sent to provider
- [Back] (step 4)
- [Submit & Create Order →] primary blue; Loader2 while submitting → success banner "Shipment dibuat dengan AWB: XXXXXX → Link Dashboard" → navigate to ShipmentsDashboardView and auto open drawer for that shipment_id.
- 409 dedup → info banner + skip re-sending (return existing draft/existing shipment object).
- 422 FSM / validation → danger banner with per-field messages under each field.
- **PIN Ephemerality**: Step 5 on submit → after promise resolves (regardless of outcome 2xx/5xx), clear useState(pin). Do not re-render the value.

---

## 5. View 5: WebhookEventLogView (3 SubTabs Multi-Tab Page `full` layout)

Nav: ThirdPLIL › Webhook Admin. Subtabs:
1. **Inbound Events** (provider → us)
2. **DLQ + Replay** (failed outbound consumer deliveries)
3. **Consumer Registrations (Webhook URLs)** (we → Webstore/WMS)

Shared Filter Bar (top, cross-tabs): date range (default: last 7 days), search free text.

### 5.1 SubTab 1: Inbound Events (ServerDataTable)

| Column | Details |
|:---|:---|
| occurred_at WIB | |
| Provider | KiriminAja badge |
| provider_event_id | Copy + link to provider dashboard (if KA exposes it) |
| mapped_status | Status badge color |
| mapped_event_type | Pill badge |
| AWB No / our_shipment_id | Link → opens ShipmentDetailDrawer |
| processed_successfully? | 🟢 success chip / 🔴 red chip + processing_error tooltip |
| duplicate? | If duplicate_of_event_id exists → "🔁 Duplicate #54321" link |
| Actions | [View Raw JSON Modal] • [Re-ingest (override dedup)] if failed |

### 5.2 SubTab 2: DLQ (Dead-Letter Queue) — Queue status delivery

Columns: created_at WIB, event_type badge, target_url (truncated middle + copy), last_http_status 4xx/5xx chip, attempt_count / max_attempts (pill), dlqed_at WIB.
Top CTA per row = ▶️ Replay button → modal confirm. Bulk action: ⟲ Replay All Filtered (applies only to rows with delivery_status='dlq'). After replay → queue status becomes 'replayed' → fan-out worker processes again with backoff. "No-op guard": if shipment status already moved past the event state (e.g. replaying a delivered event when shipment is already returned), → skip + mark as 'no_op' with a log entry in details.

### 5.3 SubTab 3: Consumer Registrations (Webhook URLs) — 1 row = 1 registered consumer (Webstore prod / WMS staging / etc.)

Columns: Label (e.g. "Webstore — Order Production Webhook"), Target URL (https://webstore…/il/webhook), HMAC Algorithm pill (sha256/sha512), HMAC Header Name, Status: Enabled/Disabled, last_success_at, last_failure_at, consecutive_failure_count, Paused Until (if auto-paused).
Top-right CTA: + Add Consumer URL → opens form modal. Fields: Label, Target URL, HTTP method (POST only for now), HMAC Algorithm, HMAC Header Name, HMAC Shared Secret (auto-generated with regen button; copy once), subscribed_event_types (17 checkboxes, or toggle "Send for all event types" that disables the list), Enabled switch, Extra Headers (JSON editor key-value pairs for Authorization).
Edit modal same; Delete modal requires 2-step confirm "Ini akan menghentikan semua event untuk URL ini untuk subscriber Anda. Lanjut?".

### 5.4 Validation Rules (Webhook Registrations Form)
- URL must be https:// (production-only). Warn if plain http → allow with warning for staging dev.
- Label UNIQUE per subscriber + URL combination (backend validation).
- Secret: auto-generate 32 crypto-random bytes on first save; Regenerate button with confirm "Consumer URL ini akan mengupdate secret; update secret di backend Webstore/WMS bersamaan. Yakin?"

---

## 6. Modals Shared (Used Across Views)

| Modal Name | Used In | Purpose |
|:---|:---|:---|
| PickupScheduleFormModal | ShipmentCreateWizard Step 4, Dashboard Actions | Pickup date + schedule slot (query /pickup/schedules endpoint). Driver fields disabled until KA assigns. |
| KaCreditPinEntryModal | COD via KA Credit flows (payment step) | Centered modal single password input max 6 digits, numeric inputMode, 30s timeout auto-close, "Salah tersisa X attempts" banner if wrong. |
| AWBLabelPreviewModal | Dashboard Actions, Drawer | Render PDF in iframe or PNG preview; Download PDF, Print, Copy URL buttons. |
| RawJsonViewerModal (generic) | Inbound events subtab, drawer raw provider data | Collapsible pre, Copy, Format, Search string within JSON. |
| Confirm2Step (generic base) | Delete credential, Cancel shipment, Replay DLQ, Delete registration, Regenerate webhook secret, Set as Default. | Per AGENTS ui-modal-guidelines. Header only, 2 action buttons top-right. NEVER footer buttons. |

---

## 7. Global Shared Behavior

1. **Loading states**: ALL submit buttons have inline Loader2 spinner while submitting. Disabled.
2. **403**: redirect to login + "You don't have permission" banner. 401 → redirect /signin.
3. **Async errors**: If network fails → danger banner "Gagal terhubung ke server. Periksa koneksi internet, lalu refresh." Never show raw errors.
4. **Currency formatting**: ALL money numbers in Rupiah (IDR) use `Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0})`.
5. **Dates/times**: ALL displayed WIB timezone (Asia/Jakarta). UTC only stored in DB, never shown. Tooltips show exact absolute date + WIB.
6. **Debouncing**: Search text fields debounced 300ms. Rate calculator recalculate buttons click only.
7. **Clipboard copy**: Use `navigator.clipboard.writeText` + small "Disalin!" toast 1.5s.

---

## 8. How Future AI Should Use This Document

1. Implement 5 views in this order (simple → complex): Credentials → Rate Calculator → Shipments Dashboard + Drawer → Webhook Log (3 tabs) → ShipmentCreateWizardView.
2. **Before writing any view**: Append a new 2026-10-07.r003 (r004, r005…) revision entry to kiriminaja-frontend-changelogs.md (Changes / Found Bugs / Fixes) → append entry to frontend project-changelogs.md → THEN write the code. AGENTS mandatory: never skip changelog step before writing code.
3. **Invent nothing** for UI. Copy paste class names from ThemeGuideView.tsx; if a missing component is needed (no Stepper in theme guide yet?) → AskUserQuestion first (scope guardrail AGENTS). Don't create ad-hoc components.
4. **Permissions**: Every action button should check permission via permission-context useCan() before rendering. If a user lacks `edit`, show the button as disabled with a tooltip reason.
5. After all 5 views written → Proceed to:
   - Backend: PL/pgSQL 4 atomic RPC wrappers (per §8 of PRD)
   - Backend: Edge Functions (4)
   - Then: Frontend wiring + testing on real data.
