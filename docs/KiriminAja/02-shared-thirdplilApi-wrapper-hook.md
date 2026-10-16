# Shared Wrapper Hook `useThirdPLILApi` + Type Definitions — `thirdplilApi.ts`

**Frontend architecture parent**: [01-frontend-architecture.md](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/KiriminAja/01-frontend-architecture.md)
**Backend API contract (reference truth)**: [03-api-contract.md](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/03-api-contract.md)
**Backend changelog**: [kiriminaja-changelogs.md](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/kiriminaja-changelogs.md)
**UI pattern refs**: See §6 at bottom.

---

## 1. Scope — Path Only

🚨 **Frontend (Path A only)**: This utility is for the **IL dashboard operator (Path A JWT user)**. It uses Supabase `authenticated` JWT.

🚫 **NOT for Webstore frontend**: Webstore's storefront never calls IL directly (the buyer flows always go through the Webstore backend → Path B API key bridge). This file lives in ThirdPLILFrontend only; do NOT copy into WebstoreFrontend. (WebstoreFrontend will have its own internal `callWebstoreBackend` that handles routing through Webstore backend for IL on behalf of the merchant.)

---

## 2. File Creation Plan

### 2.1 Files To Create

| Path (in ThirdPLILFrontend) | What goes here |
|:---|:---|
| `src/types/thirdplil.ts` | ALL shared TS types — interfaces, enums, discriminated unions for shipment / package / item / rate quote / credential / webhook event / payment order. **NO runtime code here; just type declarations exported.** |
| `src/utils/thirdplilApi.ts` | Single stateless generic function `callThirdPLILInternalUI<T>(…)` — returns Promise<T>, handles headers, dedup, 409, 503, error parsing, banner state setter. |
| `src/hooks/useThirdPLILApi.tsx` | React hook wrapper that injects banner-state setter from view + transaction_id generator + loading/submitting states. Calls `callThirdPLILInternalUI`. Returns `{call, loading, banner}`. |

---

## 3. `src/types/thirdplil.ts` — Full Type Schema

```ts
// ------------------------------
// §3.1 Shared / Enum Types (mirrors backend ENUMs — keep in sync!)
// ------------------------------
export type ShipmentStatus =
  | 'draft' | 'provider_submitted' | 'awb_assigned'
  | 'pickup_requested' | 'pickup_scheduled' | 'courier_picked_up'
  | 'in_transit' | 'out_for_delivery' | 'attempt_failed' | 'delivered'
  | 'return_in_progress' | 'returned' | 'canceled'
  | 'problem_pending' | 'problem_resolved' | 'lost' | 'damaged';

export type DeliveryMode = 'express' | 'instant';
export type PaymentType = 'non_cod_qr' | 'cod_ka_credit' | 'cod_bank_transfer' | 'non_cod_bank_transfer' | 'non_cod_ewallet';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded' | 'partial';
export type PickupStatus = 'requested' | 'scheduled' | 'driver_assigned' | 'picked_up' | 'canceled' | 'no_show' | 'failed';
export type CoverageLevel = 'province' | 'city' | 'district' | 'subdistrict';
export type WebhookEventType =
  | 'shipment.created' | 'shipment.status_changed' | 'shipment.awb_assigned'
  | 'shipment.pickup_scheduled' | 'shipment.out_for_delivery' | 'shipment.attempt_failed'
  | 'shipment.delivered' | 'shipment.problem_pending' | 'shipment.problem_resolved'
  | 'shipment.returned' | 'shipment.canceled' | 'shipment.lost_or_damaged'
  | 'payment.status_changed' | 'pickup.driver_assigned' | 'pickup.picked_up' | 'pickup.failed';
export type CodSettlementStatus = 'pending_collection' | 'courier_collected' | 'in_settlement' | 'settled' | 'disputed' | 'returned_merchant';
export type SubscriberRole = 'subscriber_admin' | 'subscriber_user';

// ------------------------------
// §3.2 Coverage hierarchy (for SubdistrictCoverageLookup cascading select)
// ------------------------------
export interface CoverageArea {
  area_id: number;
  level: CoverageLevel;
  parent_area_id: number | null;
  name: string;
  code_provider: string;
  postal_code?: string;
}

// ------------------------------
// §3.3 Credential (account card model — multi-account per subscriber)
// ------------------------------
export interface SubscriberCredential {
  credential_id: number;
  subscriber_id: number;
  provider_id: number;
  is_sandbox: boolean;
  account_label: string;
  is_default: boolean;
  webhook_secret?: string;
  default_sender_name?: string;
  default_sender_phone?: string;
  default_sender_address?: string;
  default_sender_subdistrict_id?: number;
  ka_credit_enabled: boolean;
  top_enabled: boolean;
  last_test_conn_at?: string;
  last_test_conn_ok?: boolean;
  created_at: string;
  updated_at: string;
}

// ------------------------------
// §3.4 Rate Quotes + Checkout
// ------------------------------
export interface RateQuotePackageInput {
  weight_g: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  content_value_idr: number;
  qty?: number;
  is_fragile?: boolean;
  description?: string;
}
export interface RateQuoteQuery {
  sender_subdistrict_id: number;
  recipient_subdistrict_id: number;
  packages: RateQuotePackageInput[];
  delivery_mode: DeliveryMode;
  vehicle_type?: string;
  cod_enabled: boolean;
  cod_amount_idr?: number;
  insurance_enabled: boolean;
  insurance_category?: 'standard' | 'fragile' | 'electronics';
  credential_id?: number;        // override default account (optional)
}
export interface RateQuote {
  provider_service_code: string;
  provider_service_name: string;
  courier_display_name: string;
  delivery_mode: DeliveryMode;
  etd_min_days: number;
  etd_max_days: number;
  base_shipping_fee_idr: number;
  insurance_fee_idr: number;
  cod_fee_idr: number;
  other_fees_idr: number;
  grand_total_idr: number;
  supports_cod: boolean;
  supports_insurance: boolean;
  volumetric_divisor: number;
  total_billed_weight_g: number;
}

// ------------------------------
// §3.5 Shipment Family
// ------------------------------
export interface ShipmentPackage {
  package_id: number;
  package_seq: number;
  tracking_no?: string;
  awb_no?: string;
  description?: string;
  weight_g: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volumetric_weight_g: number;
  billed_weight_g: number;
  content_value_idr: number;
  is_fragile: boolean;
  items: ShipmentItem[];
}
export interface ShipmentItem {
  item_id: number;
  sku?: string;
  name: string;
  qty: number;
  unit_value_idr: number;
  line_value_idr: number;
  weight_per_unit_g?: number;
  category?: string;
  is_fragile?: boolean;
  description?: string;
}
export interface ShipmentStatusHistoryRow {
  history_id: number;
  status: ShipmentStatus;
  occurred_at: string;
  location_text?: string;
  raw_provider_status?: string;
  note?: string;
  source: 'internal' | 'provider_webhook' | 'ui_manual' | 'polling';
  source_event_ref?: string;
}
export interface Shipment {
  shipment_id: number;
  subscriber_id: number;
  provider_id: number;
  credential_id: number;
  delivery_mode: DeliveryMode;
  vehicle_type?: string;
  courier_service_code?: string;
  courier_service_name?: string;
  transaction_id: string;
  external_ref?: string;
  awb_no?: string;
  awb_label_storage?: string;
  awb_label_generated_at?: string;
  status: ShipmentStatus;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  sender_subdistrict_id: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_subdistrict_id: number;
  base_shipping_fee_idr: number;
  cod_enabled: boolean;
  cod_amount_idr: number;
  cod_fee_idr: number;
  insurance_enabled: boolean;
  insurance_amount_idr: number;
  insurance_fee_idr: number;
  grand_total_idr: number;
  items_total_value_idr: number;
  total_actual_weight_g: number;
  total_billed_weight_g: number;
  total_packages: number;
  notes_for_courier?: string;
  pickup_scheduled_at?: string;
  problem_pending_code?: string;
  problem_pending_reason?: string;
  problem_pending_at?: string;
  problem_resolved_code?: string;
  problem_resolved_at?: string;
  packages: ShipmentPackage[];
  history: ShipmentStatusHistoryRow[];
  created_at: string;
  updated_at: string;
}

// ------------------------------
// §3.6 Webhook Admin (3 tabs)
// ------------------------------
export interface ProviderWebhookEventRow {
  event_id: number;
  provider_id: number;
  provider_event_id?: string;
  occurred_at: string;
  received_at: string;
  provider_shipment_ref?: string;
  our_shipment_id?: number;
  mapped_status?: ShipmentStatus;
  mapped_event_type?: WebhookEventType;
  processed_successfully?: boolean;
  processing_error?: string;
  duplicate_of_event_id?: number;
  raw_body_preview?: unknown;
}
export interface ConsumerWebhookRegistration {
  registration_id: number;
  subscriber_id: number;
  label: string;
  target_url: string;
  http_method: string;
  hmac_shared_secret?: string;
  hmac_algorithm: 'sha256' | 'sha512';
  hmac_header_name: string;
  subscribed_event_types: WebhookEventType[];
  send_for_all_event_types: boolean;
  extra_headers?: Record<string, string>;
  enabled: boolean;
  last_success_at?: string;
  last_failure_at?: string;
  consecutive_failure_count: number;
  paused_until?: string;
  created_at: string;
  updated_at: string;
}
export interface ConsumerWebhookQueueRow {
  queue_id: number;
  registration_id: number;
  event_type: WebhookEventType;
  event_idempotency_key: string;
  target_url: string;
  delivery_status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'dlq' | 'replayed';
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string;
  last_attempted_at?: string;
  last_http_status?: number;
  last_error_code?: string;
  last_error_message?: string;
  processed_at?: string;
  dlqed_at?: string;
  shipment_id?: number;
  inbound_event_id?: number;
  created_at: string;
}

// ------------------------------
// §3.7 Error shape + response envelope (100% matches API contract §1.2)
// ------------------------------
export interface ThirdPLILStandardError {
  http_status: number;
  error_code: string;               // e.g. 'CREDENTIAL_NOT_FOUND' / 'INVALID_COVERAGE' / 'FORBIDDEN' / 'RATE_LIMIT'
  user_message: string;            // safe to show to operator as danger banner
  developer_message?: string;      // debug; only shown if is_subscriber_admin
  hint?: string;
  request_id?: string;
  details?: unknown;               // form validation per-field map keyed by field_path: [error_code, message]
}
export interface ThirdPLILLEnvelope<T> {
  ok: boolean;
  data: T;
  meta?: {
    is_duplicate?: boolean;
    page?: number;
    page_size?: number;
    total_count?: number;
    transaction_id?: string;
  };
  error?: ThirdPLILStandardError;
}
```

---

## 4. `callThirdPLILInternalUI<T>` Signature + Behavior Contract

### 4.1 Function Signature

```ts
import type { ThirdPLILLEnvelope, ThirdPLILStandardError } from '@/types/thirdplil';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BannerStateSetter {
  setBanner: (banner: {
    tone: 'info' | 'success' | 'warning' | 'danger';
    message: string;
    subtitle?: string;
  } | null) => void;
}

export interface ThirdPLILCallOpts {
  /** Edge Function name — maps to /functions/v1/thirdplil-admin-<name> */
  functionName:
    | 'thirdplil-admin-credentials'
    | 'thirdplil-admin-rates'
    | 'thirdplil-admin-shipments'
    | 'thirdplil-admin-webhooks'
    | 'thirdplil-admin-coverage'
    | 'thirdplil-admin-payments';
  /** HTTP method. GET = never include body. */
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Appended to function name with `/`. e.g. '/credentials/123' */
  pathSuffix?: string;
  /** JSON body (POST/PATCH/PUT) — auto stringified. */
  body?: unknown;
  /** Query parameters — auto stringify & encode. */
  params?: Record<string, string | number | boolean | undefined>;
  /** Optional — if caller already has a transaction_id. Leave undefined and we'll generate UUID. */
  transactionId?: string;
}

export interface ThirdPLILCallResult<T> {
  ok: boolean;
  data?: T;
  /** OK response meta */
  meta?: ThirdPLILLEnvelope<T>['meta'];
  /** Error; ALWAYS populated when ok=false */
  err?: ThirdPLILStandardError;
  httpStatus: number;
}

/**
 * Pure-ish async call helper. Returns Promise<ThirdPLILCallResult<T>>.
 * Never throws (so callers don't need try/catch; just check result.ok).
 * Handles:
 *   - auto-inject Transaction-ID header on POST/PATCH/PUT/DELETE
 *   - auto dedup 409 (conflict response -> treat as SUCCESS with meta.is_duplicate=true, info banner)
 *   - 503 Retry-After: wait once, retry once
 *   - banner state setter: success/danger/warning/info banners
 *   - supabase.functions.invoke() or fetch() fallback (pathSuffix flexibility)
 */
export async function callThirdPLILInternalUI<TData>(
  supabase: SupabaseClient,
  opts: ThirdPLILCallOpts,
  banner?: BannerStateSetter
): Promise<ThirdPLILCallResult<TData>> { … }
```

### 4.2 Error → Banner Mapping Table (Non-Negotiable)

| HTTP | Error Code Class | banner.tone | banner.message |
|:---|:---|:---|:---|
| 400 INVALID_REQUEST | field-validation | danger | `Periksa kembali data yang Anda masukkan. ${developer_message or "X field invalid / Y required"}` + render per-field validation state if exists in `details` map |
| 401 UNAUTHENTICATED | auth_expired / session | danger | `Sesi login telah berakhir. Silakan login kembali.` + redirect |
| 403 FORBIDDEN | permission | danger | `Anda tidak memiliki izin untuk aksi ini. Hubungi admin platform.` |
| 404 NOT_FOUND | resource_missing | warning | `Data tidak ditemukan (sudah dihapus atau invalid).` |
| 409 CONFLICT | duplicate_transaction_id | info (NOT danger) → ok=true with meta.is_duplicate | `Aksi ini sudah diproses sebelumnya. Menampilkan hasil cache (duplikat id: XXXX…).` |
| 422 VALIDATION | state_conflict / fsm_invalid | warning + subtitle with hint | `Transisi status tidak valid: shipment dalam status X tidak bisa Y. Coba refresh halaman.` |
| 429 RATE_LIMIT / 503 UPSTREAM OVERLOADED | with Retry-After header (10s or 5s default) | warning + auto retry once → if 2nd fails → danger | `Penyedia logistik sedang sibuk; otomatis mencoba kembali… [timer] → jika gagal 2x: danger banner: `Penyedia sibuk. Coba lagi 1-2 menit lagi.` |
| 500 / 502 | server_error / provider_down | danger | `Terjadi kesalahan sistem. Detail: request_id=XXXX → paste ke tim dev jika butuh bantuan.` Never show stacktrace to user. |
| KA-PIN-WRONG (custom code in 422.details) | pin_incorrect | danger + `Sisa percobaan PIN: ${remaining}. KiriminAja akan mengunci PIN setelah N salah berturut-turut.` + lock hint |
| KA-PIN-LOCKED (custom code) | pin_locked | danger | `PIN KA Credit terkunci. Hubungi tim finance untuk unlock melalui dashboard KiriminAja.` + link to KA dashboard |

### 4.3 PIN Ephemeral Wrapper Pattern (Use in all COD KA Credit flows)

Never store PIN in state across page unload. Use this wrapper:

```ts
// In a form submit handler (RateCalculatorView, ShipmentCreateWizardView payment step):
const [pin, setPin] = useState<string>('');     // Type=password, maxLength=6, inputMode=numeric
const submitting = useRef(false);

const onSubmit = wrapKaPinEphemeral(
  pin, () => setPin(''),
  async () => {
    submitting.current = true;
    try {
      // callThirdPLILInternalUI including the KA credit PIN validation flow ...
    } finally {
      submitting.current = false;
    }
  }
);
// where wrapKaPinEphemeral = async (pin, clearPin, fn) => {
//    try { return await fn(); }
//    finally { clearPin(''); }  // ALWAYS CLEAR
// };
```

Plus: Provider call log (server-side already masks PIN via recursive mask_pin_fields helper). Never include PIN in console.log; never console.error raw responses with PIN field.

---

## 5. React Hook `useThirdPLILApi(…)` (View-Level Convenience)

```ts
// src/hooks/useThirdPLILApi.tsx
import type { BannerStateSetter } from '@/utils/thirdplilApi';
import { callThirdPLILInternalUI, type ThirdPLILCallResult, type ThirdPLILCallOpts } from '@/utils/thirdplilApi';

interface UseThirdPLILApiOpts {
  /** Unique scope for logging; used as banner title prefix */
  scope?: string;
}
interface UseThirdPLILApiReturn {
  loading: boolean;
  lastError: unknown;
  banner: BannerStateSetter['banner'];
  /** Calls callThirdPLILInternalUI with banner auto-setter */
  call: <T>(opts: ThirdPLILCallOpts) => Promise<ThirdPLILCallResult<T>>;
}

/**
 * React hook. Keeps loading state + banner state in one place; reuses banner setter
 * from view-level useState. Caller should render the dynamic banner above PageCard.
 */
export function useThirdPLILApi(opts: UseThirdPLILApiOpts = {}): UseThirdPLILApiReturn { /* … */ }
```

Also export helper `useBulkActionGuard(selection)` → returns `{selectedCount, atLeastOne, requireSelection}` to guard Dashboard "Download AWB" / "Cancel Selected" / "Request Pickup" bulk actions.

---

## 6. UI Pattern References (MANDATORY Copy-Paste)

View developers NEVER invent class names or layout components. Copy exact patterns from these files:

| Concern | Reference File + Lines |
|:---|:---|
| Banner 4 tones (info / success / warning / danger) | [ThemeGuideView.tsx Banner region](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/views/ThemeGuideView.tsx) |
| Input fields + validation (red border, error text below) | [ThemeGuideView.tsx Form Demo](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/views/ThemeGuideView.tsx) |
| Buttons (primary / secondary / danger) | Same as above |
| pageCard + kicker/h2/subtitle + right action CTA header | Same as above |
| ServerDataTable config (persist prefs, sticky Actions column, bulk actions dropdown) | [server-datatable-changelogs.md](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/server-datatable-changelogs.md) + [`ServerDataTable.tsx`](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/src/components/ServerDataTable.tsx) |
| DeleteConfirmationModal + Modal header-actions rule (buttons in TOP-RIGHT HEADER, NEVER footer) | [ui-modal-guidelines.md](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/ui-modal-guidelines.md) |
| Status badge tone-color 12-grid | [kiriminaja-frontend-changelogs.md §3 row status badge table](file:///home/calvin/WebstoreGroup/ThirdPLILFrontend/docs/KiriminAja/kiriminaja-frontend-changelogs.md) |

---

## 7. How Future AI Should Use This Document

1. **First**: Implement `src/types/thirdplil.ts` §3 before any view — do NOT inline ad-hoc types per component.
2. **Second**: Implement `callThirdPLILInternalUI` §4. Use pure function (testable; no React). Implement the full mapping table in §4.2.
3. **Third**: Implement `useThirdPLILApi` React hook.
4. **Then**: Start writing views. For each view, the 5 deep per-view specs in 03-5-views-deep-spec.md describe per-column grids, form fields, validation rules per field, async state transitions, and banner scenarios.
5. **Never deviate from the error→banner mapping §4.2**. If an unforeseen error code surfaces, AskUserQuestion per AGENTS scope guardrail before inventing a new mapping that breaks family UI consistency across DSS/Webstore/IL frontends.
6. **PIN ephemerality**: For any flow that touches a PIN input, ALWAYS wrap with §4.3 wrapper — NO EXCEPTIONS. Do not "save for next time" or "persist on submit success". Never trust the backend alone; frontend must always clear the PIN state regardless of outcome.
