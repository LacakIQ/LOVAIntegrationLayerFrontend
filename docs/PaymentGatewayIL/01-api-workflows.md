# PaymentGatewayIL (PGIL) — API Workflows & Integration Guide

- **Status**: Ready for staging (2026-10-15). Backend + frontend tested end-to-end locally.
- **Audience**: (A) Platform admin onboarding a subscriber to PGIL, (B) Webstore backend engineer integrating via Path B API key.
- **Prerequisites**: Auth tenancy design doc, webhook spec doc.

---

## 1. Scope

PGIL is a **provider-abstraction layer for payment gateways**, Phase 1 = Midtrans (Snap only).

- Unified `pgil_transactions` table (provider-agnostic).
- Snap popup/iframe flow (PCI SAQ A).
- Full + partial refunds.
- Dual-path auth: Path A (Supabase JWT for UI), Path B (`X-PGIL-API-Key` SHA-256 for Webstore).
- Webstore owns Midtrans credentials (syncs to PGIL); PGIL UI is **read-only**.
- Inbound webhook proxy + outbound fan-out to Webstore (HMAC-SHA256, DLQ, replay).
- Always `subscriber_id` (never `tenant_id`); reuses `public.subscribers` + `public.profiles`.
- All PGIL tables live in `pgil` schema; private helpers in `pgil_private`.

---

## 2. Midtrans APIs Used

| PGIL Operation | Midtrans Endpoint | Method |
|:---|:---|:---|
| Create Snap transaction | `https://app.{sandbox,}.midtrans.com/snap/v1/transactions` | POST |
| Get transaction status | `https://api.{sandbox,}.midtrans.com/v2/{order_id}/status` | GET |
| Refund | `https://api.{sandbox,}.midtrans.com/v2/{order_id}/refund` | POST |
| Test connection | `GET /v2/pgil-test-conn-{ts}/status` | GET |
| Inbound webhook | Midtrans → PGIL | POST |

Auth: HTTP Basic Auth with `server_key` (decrypted edge-side AES-GCM).

---

## 3. Onboarding Flow

```mermaid
flowchart TD
    A[Deploy migrations 0001-0009<br/>supabase db push] --> B[Set edge secrets<br/>PGIL_KEK, SUPABASE_URL, SERVICE_ROLE_KEY]
    B --> C[Create subscriber<br/>public.subscribers]
    C --> D[Link auth user<br/>public.profiles]
    D --> E[Webstore syncs credential<br/>POST /pgil-credentials/sync]
    E --> F[(pgil.pgil_subscriber_credentials<br/>encrypted server_key, client_key)]
    F --> G[Register Midtrans webhook URL<br/>in Midtrans dashboard]
    G --> H[Generate Path B API key<br/>UI: API Keys view]
    H --> I[(pgil.pgil_consumer_api_keys<br/>SHA-256 hash only)]
    I --> J[Ready!]
```

### 3.1 Deploy + Secrets
- `supabase db push` (applies 0001–0009).
- Set `PGIL_KEK` (32-byte, `openssl rand -hex 32`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### 3.2 Subscriber + Profile
PGIL reuses `public.subscribers` and `public.profiles` (shared with ThirdPLIL).

### 3.3 Credential Sync (Webstore → PGIL)
```http
POST /functions/v1/pgil-credentials/sync
X-PGIL-API-Key: pgil_sk_sandbox_xxxxxxxx
```
```json
{ "external_credential_ref": "midtrans-sandbox-main", "provider_slug": "midtrans",
  "is_sandbox": true, "server_key": "SB-Mid-server-xxx", "client_key": "SB-Mid-client-xxx",
  "is_default": true }
```
Upserts by `(subscriber_id, external_credential_ref)`. Keys encrypted with AES-GCM.

### 3.4 Midtrans Webhook URL
```
POST https://<project-ref>.supabase.co/functions/v1/pgil-webhook-inbound-proxy/midtrans/<subscriber_id>
```
`<subscriber_id>` is the numeric `public.subscribers.subscriber_id`, passed as a **path segment**
(not a query string). PGIL injects this full URL automatically on every Snap create call via the
Midtrans `X-Override-Notification` header, so **no manual Midtrans dashboard configuration is
required**. If a merchant's Midtrans account has not enabled the override feature, the same URL can
be pasted into Midtrans dashboard → Settings → Configuration instead.

The URL carries no secret: requests are authenticated by Midtrans' native `signature_key`
(SHA512 of `order_id + status_code + gross_amount + server_key`). The subscriber id only selects
which credential's `server_key` the signature is verified against. The `order_id` sent to Midtrans
is always the consumer's `external_order_ref` — PGIL never rewrites it. When the path segment is
absent (e.g. an un-migrated dashboard URL), the proxy falls back to resolving the transaction by
`external_order_ref` and testing the signature against each candidate credential.

### 3.5 Generate Path B API Key
UI → API Keys → Generate. Raw key shown **once** (`pgil_sk_sandbox_...` or `pgil_sk_live_...`).

---

## 4. Auth Workflow

```mermaid
flowchart LR
    subgraph PathA[Path A — Supabase JWT UI]
        A1[User logs in<br/>Supabase Auth] --> A2[Authorization: Bearer JWT]
        A2 --> A3[Edge: auth.getUser JWT]
        A3 --> A4[(public.profiles<br/>resolve subscriber_id)]
    end
    subgraph PathB[Path B — API Key Webstore]
        B1[X-PGIL-API-Key: pgil_sk_xxx] --> B2[Edge: SHA-256 hash]
        B2 --> B3[RPC pgil_verify_consumer_api_key]
        B3 --> B4[(pgil.pgil_consumer_api_keys<br/>hash lookup)]
    end
    A4 --> C[GUC pgil.current_subscriber_id<br/>set inside RPC via p_subscriber_id]
    B4 --> C
    C --> D[(pgil.* tables<br/>RLS filters by subscriber_id)]
```

### 4.1 `p_subscriber_id` pattern
GUC doesn't persist across PostgREST RPC calls (connection pooling). All 6 RPCs accept `p_subscriber_id bigint DEFAULT NULL` and set the GUC internally:
```sql
if p_subscriber_id is not null then
  perform set_config('pgil.current_subscriber_id', p_subscriber_id::text, false);
end if;
v_subscriber_id := pgil_private.current_user_subscriber_id();
```

### 4.2 Outbound webhook signature
```
PGIL-Signature: t=<unix_ms>,v1=<hex_hmac_sha256(t.payload, consumer_secret)>
```
64-hex consumer secret shown once at registration. Verify with constant-time compare + ±5 min skew.

---

## 5. Consumer-Facing API Endpoint Workflows

Base: `https://<project-ref>.supabase.co/functions/v1`

All responses: `StandardEnvelope<T>` = `{ success, data, errors, is_duplicate, warnings }`.

### 5.1 `POST /pgil-credentials/sync` — Sync Credential

```mermaid
flowchart TD
    A[Webstore POST /pgil-credentials/sync] --> B[Edge: resolvePathBCaller]
    B --> C[(pgil.pgil_consumer_api_keys<br/>hash lookup → subscriber_id)]
    C --> D[Edge: AES-GCM encrypt server_key/client_key]
    D --> E[RPC pgil_credential_sync_rpc p_input, p_subscriber_id]
    E --> F[(pgil.pgil_subscriber_credentials<br/>UPSERT by subscriber_id+external_credential_ref)]
    F --> G[Return credential_id]
```

### 5.2 `GET /pgil-credentials` — List Credentials

```mermaid
flowchart LR
    A[Webstore GET /pgil-credentials] --> B[Edge: resolve caller subscriber_id]
    B --> C[(pgil.pgil_subscriber_credentials<br/>SELECT WHERE subscriber_id<br/>RLS)]
    C --> D[Mask server_key/client_key<br/>first4+last4]
    D --> E[Return list]
```

### 5.3 `POST /pgil-transactions` — Create Transaction (Snap)

```mermaid
flowchart TD
    A[Webstore POST /pgil-transactions<br/>external_order_ref, gross_amount_idr, customer_*] --> B[Edge: resolve caller + credential]
    B --> C[(pgil.pgil_subscriber_credentials<br/>default or X-PGIL-Credential-Ref)]
    C --> D[Edge: decrypt server_key]
    D --> E[RPC pgil_transaction_create_rpc p_input, p_subscriber_id]
    E --> F{SELECT WHERE<br/>subscriber_id+external_order_ref}
    F -- exists --> G[Return is_duplicate=true]
    F -- not exists --> H[(pgil.pgil_transactions<br/>INSERT status=pending)]
    H --> I[(pgil.pgil_transaction_status_history<br/>INSERT old=null → new=pending)]
    I --> J[Edge: POST Midtrans /snap/v1/transactions]
    J --> K[Midtrans returns token+redirect_url]
    K --> L[(pgil.pgil_transactions<br/>UPDATE snap_token, payment_url)]
    L --> M[Return transaction_id, snap_token, payment_url]
    G --> M
```

**Idempotency**: `external_order_ref` is the dedup key. Retry-safe.

### 5.4 `POST /pgil-transactions/:id/refund` — Refund

```mermaid
flowchart TD
    A[Webstore POST /pgil-transactions/:id/refund<br/>refund_amount_idr, reason] --> B[RPC pgil_refund_create_rpc]
    B --> C[(pgil.pgil_transactions<br/>SELECT gross_amount_idr, provider_id)]
    C --> D{refund_amount + existing ≤ gross?}
    D -- no --> E[Raise: exceeds amount]
    D -- yes --> F[(pgil.pgil_refunds<br/>INSERT status=requested)]
    F --> G[Edge: POST Midtrans /v2/order_id/refund]
    G -- success --> H[(pgil.pgil_refunds<br/>UPDATE status=approved, provider_refund_id)]
    G -- fail --> I[(pgil.pgil_refunds<br/>UPDATE status=rejected, provider_data.error)]
    H --> J[Return refund_id]
    I --> J
```

### 5.5 `POST /pgil-transactions/:id/expire` — Expire

```mermaid
flowchart TD
    A[Webstore POST /pgil-transactions/:id/expire] --> B[RPC pgil_transaction_transition_status_rpc]
    B --> C[SET GUC pgil.current_subscriber_id]
    C --> D[(pgil.pgil_transactions<br/>SELECT status FOR UPDATE)]
    D --> E{already terminal?}
    E -- yes --> F[Return skipped=true]
    E -- no --> G[(pgil.pgil_transactions<br/>UPDATE status=expire, status_source=api)]
    G --> H[(pgil.pgil_transaction_status_history<br/>INSERT old_status → expire)]
    H --> I[Return true]
    F --> I
```

### 5.6 `GET /pgil-transactions` & `GET /pgil-transactions/:id` — List / Detail

Paginated list or full detail + status history + refunds, filtered by `subscriber_id` via RLS.

---

## 6. Webhook Workflow

### 6.1 Inbound: Midtrans → PGIL

```mermaid
flowchart TD
    A[Midtrans POST /pgil-webhook-inbound-proxy/midtrans/subscriber_id] --> B[Edge: read raw body]
    B --> R[Resolve candidates<br/>WHERE external_order_ref = order_id<br/>AND subscriber_id = path segment]
    R --> C{Verify signature_key<br/>SHA512 order_id+status_code+gross+server_key<br/>against each candidate credential}
    C -- no match --> D[HTTP 401]
    C -- match --> E[Edge: mapMidtransStatus]
    E --> F[RPC pgil_webhook_event_ingest_rpc<br/>+ p_our_transaction_id + p_subscriber_id]
    F --> G{UNIQUE subscriber_id, direction,<br/>provider_id, provider_event_id}
    G -- duplicate --> H[Skip, return 200]
    G -- new --> I[(pgil.pgil_webhook_events<br/>INSERT direction=inbound_provider)]
    I --> J[RPC pgil_transaction_transition_status_rpc<br/>mapped status + terminal/backward guards]
    J --> K[(pgil.pgil_transactions<br/>UPDATE status)]
    K --> L[(pgil.pgil_transaction_status_history<br/>INSERT)]
    L --> M[Enqueue outbound fan-out job]
    M --> N[HTTP 200]
    H --> N
```

When the `subscriber_id` path segment is absent, step R widens to every transaction sharing that
`external_order_ref`; the signature check in step C then picks the correct subscriber (only the
owner's `server_key` can produce a valid `signature_key`).

### 6.2 Outbound: PGIL → Webstore (Fan-Out)

```mermaid
flowchart TD
    A[pgil-webhook-fanout-worker<br/>cron/edge-triggered] --> B[(pgil.pgil_webhook_events<br/>SELECT pending outbound)]
    B --> C[(pgil.pgil_consumer_webhooks<br/>SELECT subscribed consumers)]
    C --> D[Build PGIL-Signature header<br/>HMAC-SHA256 t.payload]
    D --> E[POST to consumer endpoint]
    E --> F{2xx?}
    F -- yes --> G[(pgil.pgil_webhook_events<br/>UPDATE status=delivered)]
    F -- no --> H{retries < 3?}
    H -- yes --> I[Retry 1s/5s/20s backoff]
    I --> E
    H -- no --> J[(pgil.pgil_webhook_dlq<br/>INSERT)]
    J --> K[UI: DLQ → Replay]
    K --> E
```

### 6.3 Event Types
`transaction.created`, `transaction.status_changed`, `transaction.refunded`, `transaction.expired`.

---

## 7. Offboarding Flow

```mermaid
flowchart TD
    A[Revoke API key<br/>UI → Revoke] --> B[(pgil.pgil_consumer_api_keys<br/>UPDATE revoked_at=now)]
    B --> C[Path B requests → 401]
    D[Disable credential<br/>POST /pgil-credentials/:id/disable] --> E[(pgil.pgil_subscriber_credentials<br/>UPDATE is_active=false)]
    E --> F[No new transactions]
    G[Delete consumer webhook<br/>UI → Delete] --> H[(pgil.pgil_consumer_webhooks<br/>DELETE)]
    H --> I[No more fan-out to that endpoint]
    J[Full decommission] --> B & D & G
    J --> K[Retain transaction/refund/webhook records for audit]
```

---

## 8. Staging Readiness Checklist

| Item | Status |
|:---|:---|
| Migrations 0001–0009 applied | ✅ |
| All 6 RPCs have `p_subscriber_id` + set GUC | ✅ |
| Schema grants (`pgil`, `pgil_private`) | ✅ |
| `pgcrypto` `search_path` fix | ✅ |
| 8 edge functions | ✅ (tested locally) |
| `PGIL_KEK` secret | ⚠️ Set in staging dashboard |
| Frontend PGIL views | ✅ (tsc + build clean) |
| Real Midtrans sandbox credential | ⚠️ Run sync with real key |
| Midtrans webhook URL | ⚠️ Configure in Midtrans dashboard |
