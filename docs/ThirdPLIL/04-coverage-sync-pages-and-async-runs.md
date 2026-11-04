# ThirdPLIL — Coverage Admin Pages + Durable Async Coverage Sync + Credit-Default

- **Status**: **IMPLEMENTED (2026-11-04, r030).** Phases 1–5 shipped; Phase 6 = the paired r030 changelog entries (both repos) + this doc marked done. Backend gate verified live (see §6/§7); live booking checks T7–T9 also verified, and T10 verified against the monitor's live data contract (§7 note) — no browser-automation tooling was available in the environment, so the pixel-level click-through was not performed by the agent; the underlying live-progress + terminal-stop behaviour was verified end-to-end against the API.
- **Scope**: `LOVAIntegrationLayerFrontend` (two new admin pages, wizard default) + `WebstoreSupabase` (`thirdpl_il` durable run model, Edge fn refactor, one new worker fn, one new cron job, payment default).
- **Phase**: ThirdPLIL only (naming stays provider-agnostic so PGIL can mirror later).
- **Prerequisite reading**: [03-credential-selector-and-path-ab-test-plan.md](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/docs/ThirdPLIL/03-credential-selector-and-path-ab-test-plan.md) (§6.6 fixes F1–F6), [12-consumer-credential-selection-redesign.md](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/docs/ThirdPLIL/KiriminAja/12-consumer-credential-selection-redesign.md).

## Locked Decisions

| # | Decision | Locked value |
| --- | --- | --- |
| **L1** | Payment default on create | **`payment_method` omitted → `ka_credit`**, in the shared `thirdplil-shipments` create handler (covers Path A + Path B) and in the admin wizard (default selection `ka_credit`). If the credential has **no stored PIN** → **hard fail `422 ka_credit_pin_missing`** (no silent fallback to cash). |
| **L2** | Sync engine | **B — Durable run + cron worker.** A run row is created on demand, a `* * * * *` cron worker drains it one batch per tick. The legacy synchronous `POST /sync` stays for one-shot/back-compat. |
| **L3** | Frontend shape | **Two separate pages** — `CoverageView` (browse + Start Sync) and `CoverageSyncMonitorView` (live run progress). Not a single tabbed page. |
| **L4** | Coverage stats | **Add backend stats endpoint** (`GET /stats`) rather than the frontend issuing several count queries. |

---

## 1. Problem Statement

Three gaps, verified from code:

| # | Gap | Evidence |
| --- | --- | --- |
| **G1** | There is **no admin page** to view a provider's cached coverage area, and **no button** to kick a sync. The only coverage UI is an embedded lookup (`SubdistrictCoverageLookup`) buried in the credentials screen, and the only browser of the 4-level cache lives inside it. | [SubdistrictCoverageLookup.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/components/thirdplil/SubdistrictCoverageLookup.tsx), [CredentialsKiriminAjaView.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/CredentialsKiriminAjaView.tsx) |
| **G2** | Coverage sync is **synchronous and single-request**. It runs 5 steps inside one HTTP call with a 40 s district budget and returns `{steps_completed, total_steps, pending_district_cities, sync_complete}`. Because the KA limiter spaces sandbox calls 7 s apart, a full sweep of the remaining ~507 district-less cities is ≈ **1 h wall-clock** → roughly **~100 manual clicks**. There is **no run table, no worker, no progress surface**, and `last_sync_at` is hard-coded `null`. | [thirdplil-admin-coverage-sync/index.ts#L503-L627](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/functions/thirdplil-admin-coverage-sync/index.ts#L503-L627), [#L460-L476](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/functions/thirdplil-admin-coverage-sync/index.ts#L460-L476) |
| **G3** | Shipment create **defaults to cash**. KA's create body without `payment_method` is treated as `cash` → `payment_status:"unpaid"` → the package is never live → the KA simulator rejects status changes with *"Invalid package status for simulation"*. The correct default for this integration is `ka_credit` (which resolves the credential's stored encrypted PIN → `paid` → simulatable). | [kiriminaja.ts#L1137](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/functions/_shared/thirdplil/providers/kiriminaja.ts#L1137), [thirdplil-shipments/index.ts#L486-L514](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/functions/thirdplil-shipments/index.ts#L486-L514), [ShipmentCreateWizardView.tsx#L156](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/ShipmentCreateWizardView.tsx#L156) |

**Known trap to code around (learned in F4)**: any durable run table introduced here **must** ship with an `updated_at` column because the shared `moddatetime` trigger convention is applied by name; a table carrying the trigger without the column aborts every UPDATE with SQLSTATE `09000`.

---

## 2. Part 1 — Backend: durable run model

Migration `supabase/migrations/20261104130000_thirdplil_coverage_sync_runs.sql`.

### 2.1 Table `thirdpl_il.thirdplil_coverage_sync_runs`

| Column | Type | Notes |
| --- | --- | --- |
| `run_id` | `bigint GENERATED ALWAYS AS IDENTITY` | PK |
| `subscriber_id` | `bigint NOT NULL` | |
| `provider_id` | `bigint NOT NULL` | resolved at create time |
| `provider_slug` | `text NOT NULL` | denormalised for the partial index |
| `env` | `text NOT NULL` | `CHECK (env IN ('sandbox','production'))` |
| `trigger_source` | `text NOT NULL DEFAULT 'manual'` | `CHECK (… IN ('manual','nightly','api'))` |
| `status` | `text NOT NULL DEFAULT 'queued'` | `CHECK (… IN ('queued','running','completed','failed','cancelled'))` |
| `current_step` | `text` | `province│city│district│courier_services` |
| `steps_completed` | `int NOT NULL DEFAULT 0` | |
| `total_steps` | `int NOT NULL DEFAULT 5` | |
| `row_counts` | `jsonb NOT NULL DEFAULT '{"province":0,"city":0,"district":0,"subdistrict":0,"courier_services":0}'` | |
| `total_cities` | `int` | denominator for the progress bar |
| `processed_cities` | `int NOT NULL DEFAULT 0` | numerator |
| `pending_district_cities` | `int` | `null` until the district step runs; `0` ⇒ complete |
| `sync_complete` | `boolean` | |
| `attempt_count` | `int NOT NULL DEFAULT 0` | bumped on each claim |
| `last_error` | `text` | |
| `started_at` / `heartbeat_at` / `finished_at` | `timestamptz` | |
| `created_by` | `uuid` | auth uid, nullable (null for cron) |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | **`updated_at` is mandatory (F4)** |

Constraints / indexes:

```sql
-- Single-flight: one active run per (subscriber, provider, env).
CREATE UNIQUE INDEX thirdplil_coverage_sync_runs_one_active_idx
    ON thirdpl_il.thirdplil_coverage_sync_runs (subscriber_id, provider_slug, env)
    WHERE status IN ('queued', 'running');

-- Worker claim scan + monitor listing.
CREATE INDEX thirdplil_coverage_sync_runs_status_idx
    ON thirdpl_il.thirdplil_coverage_sync_runs (status, created_at);

CREATE TRIGGER trg_coverage_sync_runs_mod
    BEFORE UPDATE ON thirdpl_il.thirdplil_coverage_sync_runs
    FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');
```

Grants: `REVOKE ALL … FROM anon, authenticated, PUBLIC;` + `GRANT SELECT ON … TO service_role;` (writes go through the RPCs below).

### 2.2 RPCs (all `SECURITY DEFINER`, `service_role`-only)

| RPC | Purpose |
| --- | --- |
| `thirdpl_il.thirdplil_coverage_sync_run_create_rpc(p_subscriber_id, p_provider_slug, p_env, p_trigger_source DEFAULT 'manual', p_created_by DEFAULT NULL)` | Resolves `provider_id`; if an active run already exists for the key it is **returned as-is** (`reused: true`); otherwise inserts a `queued` run. Returns `{run_id, status, reused}`. Idempotent per env. |
| `thirdpl_il.thirdplil_coverage_sync_run_claim_rpc(p_stale_seconds DEFAULT 120)` | Atomically claims the oldest claimable run: `status='queued'` **OR** (`status='running'` AND `heartbeat_at < now() - p_stale_seconds`) → sets `status='running'`, `started_at=coalesce(started_at, now())`, `heartbeat_at=now()`, `attempt_count=attempt_count+1`. `ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`. Returns the row or `NULL`. |
| `thirdpl_il.thirdplil_coverage_sync_run_heartbeat_rpc(p_run_id, p_current_step, p_steps_completed, p_row_counts, p_total_cities, p_processed_cities, p_pending_district_cities, p_status DEFAULT 'running')` | Writes mid-batch progress; `heartbeat_at=now()`. Pass `p_status='queued'` when the worker yields with work remaining (see §3.2). |
| `thirdpl_il.thirdplil_coverage_sync_run_finish_rpc(p_run_id, p_status, p_row_counts, p_pending_district_cities, p_sync_complete, p_last_error DEFAULT NULL)` | Terminal write: `status`, `finished_at=now()`, `sync_complete`. |

A read RPC is **not** needed — the Edge fn reads the table directly via `service_role` (`adminClient.schema('thirdpl_il')`), exactly like it does for `thirdplil_coverage_areas` today.

### 2.3 Worker lifecycle contract

```
create → queued
tick  → claim → running → [heartbeat] → (work remains) → queued   ← yields, next tick re-claims
                                       → (pending=0)     → completed
                                       → (error)         → failed (+last_error)
```

`claim` also re-claims a `running` run whose `heartbeat_at` is older than `p_stale_seconds` (default **120 s**, comfortably above the ~40 s district budget) — that is the crash-recovery path.

---

## 3. Part 2 — Backend: cron job + Edge functions

### 3.1 Fourth HTTP cron job

Migration `supabase/migrations/20261104140000_thirdplil_cron_apply_settings_add_coverage_worker.sql` — `CREATE OR REPLACE FUNCTION thirdplil_private.il_cron_apply_settings()` (full re-declaration; the fn body is the source of truth, see [20261031140000_thirdplil_cron_settings.sql#L57-L232](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/migrations/20261031140000_thirdplil_cron_settings.sql#L57-L232)).

Changes vs. today:

1. Add `'thirdplil_coverage_sync_worker_every_60s'` to the **unschedule** `IN (…)` list.
2. Add a new block:

```sql
-- ---- 2.4 Durable coverage-sync worker — every 60 s --------------------------------
-- Edge-Function-only: no in-database fallback (the legacy Pattern-B path stays
-- synchronous via sync_coverage_full_nightly).
IF _use_http THEN
    _url := rtrim(_edge_base_url, '/') || '/functions/v1/thirdplil-coverage-sync-worker';
    PERFORM cron.schedule(
        'thirdplil_coverage_sync_worker_every_60s',
        '* * * * *',
        format(
            $$
                SELECT net.http_post(
                    url := %L,
                    params := '{}'::jsonb,
                    body := jsonb_build_object('trigger', 'pg_cron'),
                    headers := jsonb_build_object(
                        'Authorization', 'Bearer ' || %L,
                        'Content-Type', 'application/json',
                        'apikey', %L,
                        'X-ThirdPLIL-Job-Name', 'thirdplil_coverage_sync_worker_every_60s'
                    ),
                    timeout_milliseconds := 55000
                );
            $$,
            _url, _service_role_api_key, _service_role_api_key
        )
    );
ELSE
    RAISE NOTICE
        'thirdplil_coverage_sync_worker_every_60s NOT scheduled: fill thirdplil_private.il_cron_settings (or the GUCs).';
END IF;
```

3. **Repoint the nightly job from "run now" to "enqueue"** (locked). In the `_use_http` branch, 2.1 becomes a POST to `/functions/v1/thirdplil-admin-coverage-sync/sync/runs?env=production` with body `{"trigger_source":"nightly"}`; the durable worker then drains it. The Pattern-B branch (in-database `CALL sync_coverage_full_nightly`) is **unchanged** — no worker exists off-HTTP.

> Pattern-B branch for job 2.4 is intentionally a `RAISE NOTICE`, matching the fan-out worker (2.3), since an Edge worker has no in-database equivalent.

### 3.2 New Edge function `thirdplil-coverage-sync-worker`

`supabase/functions/thirdplil-coverage-sync-worker/index.ts`

- Accepts `GET|POST`, `OPTIONS` preflight. Auth: `service_role` bearer (cron) **or** a subscriber JWT (manual "run now"). No Path B API key.
- Body: `claim = run_claim_rpc()`.
  - none → `200 {claimed: 0}` (nothing to do).
  - claimed → loop with `heartbeat` per step, reusing the helpers already in the admin fn (`upsertCoverageLevel`, `loadAreaIdByCode`, `loadParentAreaIdsWithChildren`, `upsertCourierServices`, `mapWithConcurrency`, `chunkArray`, `delay`).
- Uses the run's `env` to resolve the credential (`fetchSubscriberCredential(adminClient, run.subscriber_id, 'kiriminaja', env==='sandbox')`).
- District step honours `COVERAGE_SYNC_DISTRICT_BUDGET_MS` (default `40 000`).
- End of batch:
  - `pending_district_cities > 0` → `heartbeat_rpc(..., p_status: 'queued')` → return `202 {run_id, status:'queued', pending}`.
  - `pending_district_cities === 0` (and courier done) → `finish_rpc(status:'completed', sync_complete:true)`.
  - uncaught error → `finish_rpc(status:'failed', last_error: …)`.

The provider/step logic is shared with the admin fn → **extract the step helpers into `_shared/thirdplil/coverageSync.ts`** so both fns call one implementation (avoids drift).

### 3.3 `thirdplil-admin-coverage-sync` — new routes

| Method + path | Behaviour |
| --- | --- |
| `GET /stats` | `{cache_counts, env_nullable, active_run, last_completed_run, credentials_present}` — one call for both pages (L4). |
| `GET /coverage?level=&parent_id=&q=&limit=` | Existing lookup, **moved to an explicit path** (the bare `GET /?level=` stays as an alias). |
| `POST /sync/runs?env=` | `create_rpc(...)` → **`202`** `{run_id, status, reused}` (idempotent per env — a second click while one is active returns the same `run_id`). |
| `GET /sync/runs?env=&limit=` | Recent runs list (monitor page). |
| `GET /sync/runs/:run_id` | Single run (monitor detail). |
| `POST /sync` | **Kept, unchanged** — legacy synchronous one-shot. |
| `POST /sync/courier-services`, `POST /sync/subdistricts` | Kept, unchanged. |

Dispatch extends [index.ts#L323-L324](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/functions/thirdplil-admin-coverage-sync/index.ts#L323-L324); auth/role gate ([#L343-L363](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/functions/thirdplil-admin-coverage-sync/index.ts#L343-L363)) is unchanged for all new routes.

---

## 4. Part 3 — Frontend: two pages

### 4.1 Wiring

| File | Change |
| --- | --- |
| [types.ts](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/types.ts#L1-L15) | Add `'kiriminaja-coverage'` and `'kiriminaja-coverage-sync-monitor'` to `AppView`. |
| [app-routes.ts](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/app-routes.ts) | `{ view: 'kiriminaja-coverage', path: '/admin/coverage', navGroup: 'thirdplil', layoutMode: 'wide' }` and `{ view: 'kiriminaja-coverage-sync-monitor', path: '/admin/coverage/sync', navGroup: 'thirdplil', layoutMode: 'wide' }`. |
| [App.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/App.tsx) | Two `lazy()` imports; two ThirdPLIL nav children (icons `MapPinned` and `Activity`); two `renderView` cases. |
| [permission-context.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/permission-context.tsx) | Map both views → `thirdplil.webhook.view` (same admin permission as cron/webhook views). |

### 4.2 `CoverageView` — `/admin/coverage`

`src/views/thirdplil/CoverageView.tsx`

- **Header controls**: provider selector (only `kiriminaja` today, provider-agnostic scaffolding) + env toggle (`sandbox│production`) + a **Start Sync** button.
- **Stats strip** (from `GET /stats`): coverage rows, courier-service rows, active-run badge (click-through to the monitor page), last completed run (`finished_at`, `row_counts`, `pending_district_cities`).
- **Cache browser**: reuse [SubdistrictCoverageLookup.tsx](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/components/thirdplil/SubdistrictCoverageLookup.tsx)'s 4-level cascade (province→city→district→subdistrict) as the main body; it already drives `GET …?level=&parent_id=&q=&limit=50`.
- **Start Sync** → `POST /sync/runs?env=`:
  - `202 {run_id, reused:false}` → toast "Sync dimulai" + navigate to `/admin/coverage/sync`.
  - `202 {reused:true}` → toast "Sync sudah berjalan (#run_id)" + navigate (does not start a second run).
  - `422 credential_missing` → inline hint pointing at the credentials page.

### 4.3 `CoverageSyncMonitorView` — `/admin/coverage/sync`

`src/views/thirdplil/CoverageSyncMonitorView.tsx`

- Polls `GET /sync/runs?env=&limit=20` **every 5 s** (toggle Auto-refresh on/off; pause while a row is expanded to avoid layout jitter).
- **Active-run card**: progress bar `processed_cities / total_cities`, `current_step`, per-level `row_counts` chips, `pending_district_cities`, `attempt_count`, "heartbeat N s ago".
- **History table**: `run_id`, `status` pill, `trigger_source`, `env`, `started_at`, `finished_at`, `last_error` (truncated + expandable).
- Empty state links back to `/admin/coverage`.

---

## 5. Part 4 — Credit-default for shipment creation (L1)

### 5.1 Backend — `thirdplil-shipments`

File [thirdplil-shipments/index.ts](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/functions/thirdplil-shipments/index.ts#L486-L514), shared create handler (serves **both** Path A JWT and Path B API key):

- After `const paymentMethod = asStr(cleaned.payment_method);` → treat omission as credit:

  ```ts
  const effectivePaymentMethod = paymentMethod ?? 'ka_credit';
  ```

- Use `effectivePaymentMethod` in the `=== 'ka_credit'` branch, and write it back (`cleaned.payment_method = effectivePaymentMethod`) so both the RPC input and the provider request carry it.
- **Fail loud**: the existing `422 ka_credit_pin_missing` path ([#L502-L511](file:///home/calvin/WebstoreGroup/WebstoreSupabase/supabase/functions/thirdplil-shipments/index.ts#L502-L511)) is reused verbatim — no cash fallback, no silent degradation.
- Explicit `payment_method` values (incl. `'cash'`) are honoured unchanged — the default only applies when the field is **absent**.

### 5.2 Frontend — wizard default

[ShipmentCreateWizardView.tsx#L156](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/ShipmentCreateWizardView.tsx#L156):

```ts
const [paymentMethod, setPaymentMethod] = useState<'ka_credit' | 'postpaid' | 'cod'>('ka_credit');
```

The wizard already gates on the PIN when `ka_credit` is selected and sends `ka_credit_pin` ([#L430-L431](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/ShipmentCreateWizardView.tsx#L430-L431)); with `ka_credit` pre-selected the operator either types the PIN or relies on the stored-PIN fallback.

---

## 6. Build Order & Gates

| Phase | Deliverable | Gate |
| --- | --- | --- |
| **1** | Migration `20261104130000` (table + indexes + trigger + 4 RPCs). | Apply locally; `\d` shape check; `updated_at` column **present**; partial index rejects a 2nd active run; RPC grants service_role-only. |
| **2** | Migration `20261104140000` (re-declared `il_cron_apply_settings()` + job 2.4 + nightly→enqueue). | `SELECT jobname, schedule, command FROM cron.job` shows **4** ThirdPLIL jobs, all `net.http_post`; job 2.4 fires on the next tick. |
| **3** | `_shared/thirdplil/coverageSync.ts` extraction; admin fn new routes; new worker fn. | `GET /stats`, `POST /sync/runs` → 202, worker claims → runs one batch → re-queues/completes; two concurrent `POST /sync/runs` return one `run_id`. |
| **4** | Credit default (backend + wizard). | Omit `payment_method` → booking is `ka_credit`/`paid`; credential without stored PIN → **422**; explicit `cash` still `unpaid`. |
| **5** | Frontend wiring + both pages. | `tsc` clean; route resolves; Start Sync → monitor page shows live progress; poll stops when terminal. |
| **6** | Docs + changelogs. | r030 entry in both changelogs + this plan doc marked IMPLEMENTED. |

> **Build log (2026-11-04, r030) — all phases implemented.** Phases 1–2 (migrations `20261104130000` + `20261104140000`, plus the earlier `20261104120000` DO-wrapper fix) applied to the local `InezWebstoreSupabase` stack; `cron.job` shows **4** ThirdPLIL jobs. Phase 3 (`coverageSync.ts` + `thirdplil-admin-coverage-sync` routes + `thirdplil-coverage-sync-worker`) verified live: worker idle tick `200 {claimed:0}`, `POST /sync/runs` `202`, claim→batch→yield (`attempt_count` 1→2). Phases 4–5 (credit default + two pages) coded; `npx tsc --noEmit` clean on the frontend, `deno check` clean on the Edge side.
>
> **Operational note:** the local edge-runtime container bakes the served-function list at creation, so a newly added function dir is `404` until the container is **recreated** (not restarted).

## 7. Test Checklist

- [x] T1 — `POST /sync/runs` twice quickly → same `run_id`, `reused:true`, no duplicate row. *(verified live)*
- [x] T2 — Worker tick claims, processes one batch, and re-queues while `pending_district_cities > 0`. *(verified live — `row_counts.district=8`, `pending_district_cities=506`, returns `202`)*
- [ ] T3 — Simulate a crash (kill mid-batch) → after `stale_seconds` the next tick re-claims with `attempt_count+1`. *(not exercised)*
- [ ] T4 — Full run reaches `completed` with `sync_complete:true` and `pending_district_cities=0`. *(not reached end-to-end — a full drain is ~1 h wall-clock under the sandbox 7 s limiter)*
- [x] T5 — `GET /stats` numbers match `thirdplil_coverage_areas` / `thirdplil_courier_services_cache` counts. *(verified live — `200`, `cache_counts {coverage_areas:629, courier_services:50}`)*
- [x] T6 — Nightly job enqueues (does not run inline) and the worker drains it. *(verified for the worker half — the `pg_cron` worker auto-drained a run, `attempt_count` 1→2; the 02:00 UTC nightly enqueue itself not yet observed)*
- [x] T7 — Create shipment with no `payment_method` → `ka_credit`, `payment_status:"paid"`, KA status simulation succeeds. *(verified live — shipment 11, omitted `payment_method`, `X-ThirdPLIL-Credential-Id: 1`: `200`, `payment_status:"paid"`, KA issued `pickup_number EPR-5692159719`, status auto-advanced to `awb_assigned` (a live package — the precondition the simulator requires))*
- [x] T8 — Create shipment with no `payment_method` against a credential with **no** stored PIN → `422 ka_credit_pin_missing`. *(verified live — temp credential with `ka_credit_pin_encrypted IS NULL`: `422 {code:"ka_credit_pin_missing"}`; temp row deleted after)*
- [x] T9 — Create shipment with explicit `payment_method:"cash"` → unchanged `unpaid` behaviour. *(verified live — shipment 12, `payment_method:"cash"`: `200`, `payment_status:"unpaid"`, status stayed `provider_submitted`)*
- [x] T10 — Monitor page shows live heartbeat/progress and stops polling on terminal state. *(verified 2026-11-04 against the monitor's data contract — see note below; no browser-automation tooling available, so not a pixel-level click-through)*

> **T10 note (2026-11-04).** The monitor consumes `GET thirdplil-admin-coverage-sync/sync/runs?env=&limit=`. Driven against the local `InezWebstoreSupabase` stack, the live run **#4** (`running`, `sandbox`) was sampled on the UI's 5 s cadence and it advanced: `processed_cities 173→181`, `pending_district_cities 342→334`, `attempt_count 34→35`, `heartbeat_at 08:21:00→08:21:49→08:22:00Z`, with `status` alternating `running`/`queued` between worker ticks. This is exactly the "live heartbeat/progress" the page shows. Poll-stop is the client predicate `activeRun = runs.find(r => r.status === 'queued' || r.status === 'running')` — `shouldPoll = autoRefresh && activeRun != null && expandedRunId == null` ([CoverageSyncMonitorView.tsx L89-L101](file:///home/calvin/WebstoreGroup/LOVAIntegrationLayerFrontend/src/views/thirdplil/CoverageSyncMonitorView.tsx#L89-L101)) — so the 5 s interval is cleared as soon as no row is `queued`/`running`. The API returns the terminal `status` verbatim, so the predicate flips cleanly on completion. To complete the visual click-through, open `/admin/coverage/sync` in a browser while a run is active (then let it finish).
