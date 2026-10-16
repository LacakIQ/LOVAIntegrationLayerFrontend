import { useEffect, useState } from 'react';
import { Check, Clock, KeyRound, Loader2, Plus as PlusIcon, RefreshCw, Save, ServerCrash as ServerCrashIcon, Webhook as WebhookIcon, X } from 'lucide-react';
import { STYLES, Section, Badge } from '../../components/ui/STYLES.tsx';
import SubTabs from '../../components/SubTabs.tsx';
import type {
  AdminWebhookDLQEntry,
  AdminWebhookEvent,
  BannerState,
  ConsumerWebhookRegistration,
  PagedListResponse,
} from '../../types/thirdplil.ts';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi.ts';

type TabId = 'inbound' | 'dlq' | 'consumers';

function bannerClass(tone: BannerState['tone']) {
  return 'p-4 rounded-2xl border ' + (
    tone === 'danger' ? STYLES.bannerDanger :
    tone === 'warning' ? STYLES.bannerWarning :
    tone === 'success' ? STYLES.bannerSuccess : STYLES.bannerInfo
  );
}

function idr(s: string | number | null | undefined) {
  const n = typeof s === 'number' ? s : parseFloat(String(s ?? '0'));
  if (!Number.isFinite(n)) return 'Rp 0';
  try { return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n * 100) / 100); }
  catch { return 'Rp ' + String(n); }
}

export default function WebhookEventLogView() {
  const [tab, setTab] = useState<TabId>('inbound');
  const [banner, setBanner] = useState<BannerState>(null);

  // Inbound
  const [inPage, setInPage] = useState<number>(1);
  const [inPerPage] = useState<number>(25);
  const [inDir, setInDir] = useState<'all' | 'inbound' | 'outbound'>('inbound');
  const [inShipmentId, setInShipmentId] = useState<string>('');
  const [inLoading, setInLoading] = useState(false);
  const [inRows, setInRows] = useState<AdminWebhookEvent[]>([]);
  const [inTotalRows, setInTotalRows] = useState(0);
  const [inTotalPages, setInTotalPages] = useState(1);
  const [inReplayId, setInReplayId] = useState<number | null>(null);

  // DLQ
  const [dlqPage, setDlqPage] = useState(1);
  const [dlqPerPage] = useState(25);
  const [dlqLoading, setDlqLoading] = useState(false);
  const [dlqRows, setDlqRows] = useState<AdminWebhookDLQEntry[]>([]);
  const [dlqTotalRows, setDlqTotalRows] = useState(0);
  const [dlqTotalPages, setDlqTotalPages] = useState(1);
  const [dlqReplayId, setDlqReplayId] = useState<number | null>(null);

  // Consumers
  const [consumers, setConsumers] = useState<ConsumerWebhookRegistration[]>([]);
  const [consumersLoading, setConsumersLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newConsumer, setNewConsumer] = useState<{
    description: string;
    endpoint_url: string;
    subscribe_events: string;
    secret_override: string;
    is_active: boolean;
  }>({ description: '', endpoint_url: '', subscribe_events: 'shipment.*', secret_override: '', is_active: true });
  const [newSecretBanner, setNewSecretBanner] = useState<{ secret: string; id: number } | null>(null);
  const [pingLoading, setPingLoading] = useState<number | null>(null);
  const [pingResults, setPingResults] = useState<Record<number, { ok: boolean; http_status?: number | null; snippet?: string; banner?: BannerState }>>({});

  useEffect(() => {
    loadConsumers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'inbound') loadInbound();
    if (tab === 'dlq') loadDlq();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, inPage, inDir, inShipmentId, dlqPage]);

  async function loadConsumers() {
    setConsumersLoading(true);
    const res = await callThirdPLILInternalUI<PagedListResponse<ConsumerWebhookRegistration> | ConsumerWebhookRegistration[]>('thirdplil-admin-webhooks/consumers', { method: 'GET', isMutation: false, timeoutMs: 20000 });
    setConsumersLoading(false);
    if (!res.ok) { setBanner(res.banner); return; }
    const raw = res.data;
    const list: ConsumerWebhookRegistration[] = Array.isArray(raw)
      ? (raw as ConsumerWebhookRegistration[])
      : ((raw as PagedListResponse<ConsumerWebhookRegistration>)?.rows ?? []);
    setConsumers(list ?? []);
    const plr = raw as PagedListResponse<ConsumerWebhookRegistration> | undefined;
    if (plr?.banner || res.banner) setBanner(plr?.banner ?? res.banner ?? null);
  }

  async function loadInbound() {
    setInLoading(true);
    const q: Record<string, string> = { page: String(inPage), per_page: String(inPerPage) };
    if (inDir !== 'all') q.direction = inDir;
    if (inShipmentId.trim()) q.shipment_id = inShipmentId.trim();
    const res = await callThirdPLILInternalUI<PagedListResponse<AdminWebhookEvent>>('thirdplil-admin-webhooks/events', { method: 'GET', isMutation: false, timeoutMs: 20000, query: q });
    setInLoading(false);
    if (!res.ok) { setBanner(res.banner); return; }
    const d = res.data as PagedListResponse<AdminWebhookEvent>;
    setInRows(d?.rows ?? []);
    setInTotalRows(d?.total_rows ?? 0);
    setInTotalPages(d?.total_pages ?? 1);
    if (d?.banner || res.banner) setBanner(d?.banner ?? res.banner ?? null);
  }

  async function loadDlq() {
    setDlqLoading(true);
    const res = await callThirdPLILInternalUI<PagedListResponse<AdminWebhookDLQEntry>>('thirdplil-admin-webhooks/dlq', { method: 'GET', isMutation: false, timeoutMs: 20000, query: { page: String(dlqPage), per_page: String(dlqPerPage) } });
    setDlqLoading(false);
    if (!res.ok) { setBanner(res.banner); return; }
    const d = res.data as PagedListResponse<AdminWebhookDLQEntry>;
    setDlqRows(d?.rows ?? []);
    setDlqTotalRows(d?.total_rows ?? 0);
    setDlqTotalPages(d?.total_pages ?? 1);
    if (d?.banner || res.banner) setBanner(d?.banner ?? res.banner ?? null);
  }

  async function replayEvent(evId: number) {
    setInReplayId(evId);
    const res = await callThirdPLILInternalUI<null>(`thirdplil-admin-webhooks/events/${evId}/replay`, { method: 'POST', isMutation: true, timeoutMs: 30000 });
    setInReplayId(null);
    setBanner(res.banner);
    if (res.ok) loadInbound();
  }
  async function replayDLQ(id: number) {
    setDlqReplayId(id);
    const res = await callThirdPLILInternalUI<null>(`thirdplil-admin-webhooks/dlq/${id}/replay`, { method: 'POST', isMutation: true, timeoutMs: 30000 });
    setDlqReplayId(null);
    setBanner(res.banner);
    if (res.ok) loadDlq();
  }

  async function saveNewConsumer() {
    if (!newConsumer.endpoint_url.trim().startsWith('http')) { setBanner({ tone: 'danger', title: 'URL endpoint harus http(s)://...', body: 'Ketik URL yang valid (https wajib untuk production).' }); return; }
    const payload: Partial<ConsumerWebhookRegistration> & { subscribe_event_names?: ConsumerWebhookRegistration['subscribe_event_names'] } = {
      description: newConsumer.description?.trim() || null,
      endpoint_url: newConsumer.endpoint_url.trim(),
      subscribe_event_names: newConsumer.subscribe_events.split(/[\s,]+/).filter(Boolean),
      is_active: !!newConsumer.is_active,
    };
    if (newConsumer.secret_override?.trim()) {
      (payload as unknown as { hmac_secret_override?: string }).hmac_secret_override = newConsumer.secret_override.trim();
    }
    const res = await callThirdPLILInternalUI<ConsumerWebhookRegistration & { hmac_secret_64_hex_once?: string | null }>('thirdplil-admin-webhooks/consumers', { method: 'POST', isMutation: true, timeoutMs: 30000, body: payload as never });
    setBanner(res.banner);
    if (res.ok) {
      const d = res.data as ConsumerWebhookRegistration & { hmac_secret_64_hex_once?: string | null };
      if (d?.hmac_secret_64_hex_once) setNewSecretBanner({ secret: d.hmac_secret_64_hex_once, id: d.id });
      setNewConsumer({ description: '', endpoint_url: '', subscribe_events: 'shipment.*', secret_override: '', is_active: true });
      setAddOpen(false);
      loadConsumers();
    }
  }

  async function toggleActive(id: number, nextActive: boolean) {
    const res = await callThirdPLILInternalUI<ConsumerWebhookRegistration>(`thirdplil-admin-webhooks/consumers/${id}`, { method: 'PUT', isMutation: true, timeoutMs: 25000, body: { is_active: nextActive } });
    setBanner(res.banner);
    if (res.ok) loadConsumers();
  }
  async function deleteConsumer(id: number) {
    if (!confirm('Delete consumer registration? Event log history consumer tetap tersimpan (FK keep on).')) return;
    const res = await callThirdPLILInternalUI<null>(`thirdplil-admin-webhooks/consumers/${id}`, { method: 'DELETE', isMutation: true, timeoutMs: 20000 });
    setBanner(res.banner);
    if (res.ok) loadConsumers();
  }
  async function testPing(id: number) {
    setPingLoading(id);
    setPingResults((old) => ({ ...old, [id]: { ok: false, http_status: null, snippet: 'Loading…', banner: null } }));
    const res = await callThirdPLILInternalUI<{ ping_http_status?: number | null; response_snippet?: string | null; subscriber_consumer_id?: number | null; banner?: BannerState }>(`thirdplil-admin-webhooks/consumers/${id}/test-ping`, { method: 'POST', isMutation: true, timeoutMs: 15000 });
    setPingLoading(null);
    if (!res.ok) {
      setPingResults((old) => ({ ...old, [id]: { ok: false, http_status: null, snippet: (res.banner?.title || 'Error') + (res.banner?.body ? ' — ' + res.banner.body : ''), banner: res.banner } }));
      setBanner(res.banner);
      return;
    }
    const d = res.data as { ping_http_status?: number | null; response_snippet?: string | null; subscriber_consumer_id?: number | null; banner?: BannerState } | null;
    const statusOK = Number(d?.ping_http_status) >= 200 && Number(d?.ping_http_status) < 300;
    setPingResults((old) => ({ ...old, [id]: { ok: statusOK, http_status: d?.ping_http_status ?? null, snippet: d?.response_snippet ?? '', banner: d?.banner ?? res.banner ?? null } }));
    if (d?.banner || res.banner) setBanner(d?.banner ?? res.banner ?? null);
  }

  return (
    <div className={STYLES.pageCard}>
      <div className="p-6 space-y-6">
        <Section kicker="Admin · Webhooks" title="Webhook Event Log & Fanout Consumers" subtitle="Pipeline = inbound proxy → dedup → FSM transitions RPC; outbound fanout worker 5 retries (0s, 30s, 2m, 10m, 1h) with jitter. HMAC signature: X-ThirdPLIL-Signature t=<unix_ms>,v1=<hmac256(tms.body)> — exact compare; reject any unknown versions.">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className={'rounded-2xl border p-4 ' + STYLES.bannerInfo}>
              <Badge tone="info" label="Inbound/Outbound Events" />
              <p className="mt-2 text-2xl font-bold text-right text-blue-700">{inTotalRows || (inLoading ? '…' : '0')}</p>
              <p className="text-xs mt-1 text-gray-500 text-right">Page {inPage} / {inTotalPages || 1}</p>
            </div>
            <div className={'rounded-2xl border p-4 ' + STYLES.bannerDanger}>
              <Badge tone="danger" label="Dead-letter Queue (replay)" />
              <p className="mt-2 text-2xl font-bold text-right text-red-700">{dlqTotalRows || (dlqLoading ? '…' : '0')}</p>
              <p className="text-xs mt-1 text-gray-500 text-right">Replay = attempts=0, delivery_status='replayed', next_retry_at=NOW</p>
            </div>
            <div className={'rounded-2xl border p-4 ' + STYLES.bannerSuccess}>
              <Badge tone="success" label="Consumer Registrations" />
              <p className="mt-2 text-2xl font-bold text-right text-green-700">{consumers.length}</p>
              <p className="text-xs mt-1 text-gray-500 text-right">Secret hanya tampil SEKALI (only-once banner) saat create.</p>
            </div>
          </div>

          {banner && <div className={bannerClass(banner.tone)}><p className="font-semibold text-sm">{banner.title}</p>{banner.body && <p className="mt-1 text-xs opacity-90">{banner.body}</p>}</div>}

          <SubTabs
            tabs={[
              { id: 'inbound', label: 'Inbound / Outbound Events' },
              { id: 'dlq', label: 'DLQ (Failed deliveries)' },
              { id: 'consumers', label: 'Consumer Registrations' },
            ]}
            active={tab}
            setActive={(id) => setTab(id as TabId)}
          />
        </Section>

        {/* Inbound Events tab */}
        {tab === 'inbound' && (
          <Section kicker="Tab 1 · Events" title={`Event log · direction=${inDir} · page=${inPage}`} subtitle="Inbound = provider (KiriminAja) → ThirdPLIL proxy (always <2s 200-OK even if downstream busy). Outbound = ThirdPLIL → consumer via fan-out worker (5 retries, 4xx permanent = immediate DLQ).">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className={STYLES.label}>Direction</label>
                <select className={STYLES.input} value={inDir} onChange={(e) => { setInDir(e.target.value as 'all' | 'inbound' | 'outbound'); setInPage(1); }}>
                  <option value="inbound">Inbound only (from provider)</option>
                  <option value="outbound">Outbound only (to consumer)</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <label className={STYLES.label}>Filter shipment_id (opsional)</label>
                <input className={STYLES.input} placeholder="e.g. 123" value={inShipmentId} onChange={(e) => { setInShipmentId(e.target.value); setInPage(1); }} />
              </div>
              <button className={STYLES.buttonSecondary} disabled={inLoading} onClick={loadInbound}>
                {inLoading ? <><Loader2 size={14} className="inline animate-spin mr-2 align-text-top" />Loading…</> : <><RefreshCw size={14} className="inline mr-2 align-text-top" />Refresh</>}
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['ID', 'Dir', 'Event', 'Shipment', 'Consumer', 'Status', 'Attempts', 'HTTP', 'Received UTC', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inLoading ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center"><Loader2 size={22} className="mx-auto mb-2 animate-spin text-blue-600" /><p className="text-sm text-gray-500">Loading events…</p></td></tr>
                  ) : inRows.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-14 text-center text-sm text-gray-400 flex flex-col items-center gap-2 mx-auto"><WebhookIcon size={28} className="opacity-60" />Belum ada event. Jalankan Test-Ping consumer atau buat shipment demo untuk generate log.</td></tr>
                  ) : inRows.map((e) => (
                    <tr key={e.id} className="hover:bg-blue-50/40 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{e.id}</td>
                      <td className="px-4 py-3"><Badge tone={e.direction === 'inbound' ? 'info' : 'warning'} label={e.direction} /></td>
                      <td className="px-4 py-3 font-mono text-xs">{e.event_name}</td>
                      <td className="px-4 py-3">{e.shipment_id ? <code className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-900">{e.shipment_id}</code> : <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3">{e.consumer_id ? <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{e.consumer_id}</code> : <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const s = e.delivery_status;
                          const tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral' =
                            s === 'sent' || s === 'dedup' ? 'success' :
                            s === 'queued' || s === 'replayed' ? 'info' :
                            s === 'dead_letter' ? 'danger' :
                            s === 'failed' ? 'warning' : 'neutral';
                          return <Badge tone={tone} label={s ?? '—'} />;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-xs"><p className="font-mono">{e.attempts_count ?? 0}{e.max_attempts ? ` / ${e.max_attempts}` : ''}</p></td>
                      <td className="px-4 py-3">
                        {(() => {
                          const s = Number(e.last_http_status ?? e.delivery_http_status ?? 0);
                          if (!s) return <span className="text-gray-300 text-xs">—</span>;
                          return <code className={'rounded px-1.5 py-0.5 text-xs ' + (s >= 200 && s < 300 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>{s}</code>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{e.received_at ?? e.created_at ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button disabled={inReplayId === e.id} onClick={() => replayEvent(e.id)} className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}>
                          {inReplayId === e.id ? <><Loader2 size={13} className="inline align-text-top animate-spin mr-1" />Replay…</> : '↺ Replay enqueue'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
              <p>Menampilkan {inRows.length} rows · total_rows={inTotalRows} · total_pages={inTotalPages}</p>
              <div className="flex gap-1">
                <button disabled={inPage <= 1 || inLoading} className={STYLES.buttonGhost + ' !py-1.5 !px-3'} onClick={() => setInPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                <span className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold">Page {inPage}</span>
                <button disabled={inPage >= inTotalPages || inLoading} className={STYLES.buttonGhost + ' !py-1.5 !px-3'} onClick={() => setInPage((p) => Math.min(inTotalPages, p + 1))}>Next ›</button>
              </div>
            </div>
          </Section>
        )}

        {/* DLQ tab */}
        {tab === 'dlq' && (
          <Section kicker="Tab 2 · Dead-letter Queue" title="DLQ: permanent 4xx consumer / 5 retries exceeded" subtitle="Replay per row = POST /admin-webhooks/dlq/:id/replay → reset attempts=0, delivery_status='replayed', next_retry_at=NOW. Fan-out worker pick-up di tick berikutnya (seconds delay).">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div />
              <button className={STYLES.buttonSecondary} disabled={dlqLoading} onClick={loadDlq}>
                {dlqLoading ? <><Loader2 size={14} className="inline animate-spin mr-2 align-text-top" />Loading…</> : <><RefreshCw size={14} className="inline mr-2 align-text-top" />Refresh DLQ</>}
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['DLQ ID', 'Consumer', 'Shipment', 'Event', 'Last Error', 'Attempts', 'Last try UTC', 'HTTP', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dlqLoading ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center"><Loader2 size={22} className="mx-auto mb-2 animate-spin text-red-500" /><p className="text-sm text-gray-500">Loading DLQ…</p></td></tr>
                  ) : dlqRows.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-14 text-center text-sm text-gray-400 flex flex-col items-center gap-2 mx-auto"><Check size={28} className="opacity-50 text-green-500" />DLQ kosong — semua outbound deliveries sukses / pending (tidak fail).</td></tr>
                  ) : dlqRows.map((e) => (
                    <tr key={e.id} className="hover:bg-red-50/30 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{e.id}</td>
                      <td className="px-4 py-3"><code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">#{e.consumer_id}</code></td>
                      <td className="px-4 py-3">{e.shipment_id ? <code className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-900">{e.shipment_id}</code> : <span className="text-gray-300 text-xs">—</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs">{e.event_name}</td>
                      <td className="px-4 py-3"><span className="text-xs text-red-600 max-w-xs truncate block" title={e.last_error_message ?? e.error_reason ?? ''}>{e.last_error_message ?? e.error_reason ?? '(unknown)'}</span></td>
                      <td className="px-4 py-3"><Badge tone="danger" label={`${e.attempts_count ?? 0}${e.max_attempts ? ` / ${e.max_attempts}` : ''}`} /></td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{e.last_delivery_at ?? '—'}</td>
                      <td className="px-4 py-3">
                        {e.last_http_status ? <code className="rounded bg-red-50 text-red-700 px-1.5 py-0.5 text-xs">{e.last_http_status}</code> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button disabled={dlqReplayId === e.id} onClick={() => replayDLQ(e.id)} className={STYLES.buttonPrimary + ' !py-1.5 !text-xs'}>
                          {dlqReplayId === e.id ? <><Loader2 size={13} className="inline align-text-top animate-spin mr-1" />Replay…</> : '↺ Replay to fanout'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
              <p>Menampilkan {dlqRows.length} rows · total_rows={dlqTotalRows} · total_pages={dlqTotalPages}</p>
              <div className="flex gap-1">
                <button disabled={dlqPage <= 1 || dlqLoading} className={STYLES.buttonGhost + ' !py-1.5 !px-3'} onClick={() => setDlqPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                <span className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold">Page {dlqPage}</span>
                <button disabled={dlqPage >= dlqTotalPages || dlqLoading} className={STYLES.buttonGhost + ' !py-1.5 !px-3'} onClick={() => setDlqPage((p) => Math.min(dlqTotalPages, p + 1))}>Next ›</button>
              </div>
            </div>
          </Section>
        )}

        {/* Consumers tab */}
        {tab === 'consumers' && (
          <Section kicker="Tab 3 · Consumer Registrations" title={`${consumers.length} registered webhook consumers`} subtitle="POST /consumers → auto generate hmac_secret via crypto.getRandomValues(32) = 64 hex chars, returned ONLY ONCE. GET /consumers always mask: hmac_secret_masked = ****-<last8chars>. Test-ping signs payload = concat(unixms.body), HMAC-SHA256 key = raw hex secret, header X-ThirdPLIL-Signature t=<ms>,v1=<hex> exactly matching the outbound fanout worker validator (reject anything not v1).">
            {newSecretBanner && (
              <div className={'p-5 rounded-2xl border-2 mb-6 ' + STYLES.bannerWarning}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <KeyRound size={20} className="mt-0.5 flex-shrink-0 text-amber-600" />
                    <div className="min-w-0">
                      <p className="font-semibold text-amber-900">SECRET HANYA DITAMPILKAN SEKALI (hmac_secret_64_hex_once) — copy SEKARANG!</p>
                      <p className="mt-1 text-xs text-amber-800 opacity-90">Consumer #{newSecretBanner.id}. Simpan secret di password manager / env file consumer aplikasi kamu. Secret ini TIDAK AKAN PERNAH DITAMPILKAN LAGI (GET /consumers hanya menampilkan masked= ****-<span className="font-mono">last8</span>).</p>
                      <code className="mt-3 block font-mono text-sm bg-amber-50 rounded-lg p-3 text-amber-900 break-all select-all">{newSecretBanner.secret}</code>
                    </div>
                  </div>
                  <button className={STYLES.buttonGhost + ' !px-3 !py-1.5'} onClick={() => setNewSecretBanner(null)}><X size={14} className="inline align-text-top mr-1" />Saya sudah copy</button>
                </div>
              </div>
            )}

            <div className="mb-5 flex items-center justify-between gap-3">
              <div />
              <button className={STYLES.buttonPrimary} onClick={() => setAddOpen(true)}><PlusIcon size={14} className="inline mr-2 align-text-top" />Add Consumer Registration</button>
            </div>

            {addOpen && (
              <div className="mb-5 rounded-2xl border border-dashed border-gray-300 p-5 space-y-4 bg-gray-50/60">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">New Consumer (POST /consumers)</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={STYLES.label}>Endpoint URL (https required prod) <span className="text-red-500">*</span></label>
                    <input className={STYLES.input} placeholder="https://webhook.myshop.com/api/thirdplil" value={newConsumer.endpoint_url} onChange={(e) => setNewConsumer({ ...newConsumer, endpoint_url: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={STYLES.label}>Description (opsional)</label>
                    <input className={STYLES.input} placeholder="Contoh: My Shopify store — sync order fulfillment status" value={newConsumer.description} onChange={(e) => setNewConsumer({ ...newConsumer, description: e.target.value })} />
                  </div>
                  <div>
                    <label className={STYLES.label}>Subscribe events (comma / space-separated)</label>
                    <input className={STYLES.input + ' font-mono text-xs'} placeholder="shipment.*, pickup.scheduled, delivery.delivered" value={newConsumer.subscribe_events} onChange={(e) => setNewConsumer({ ...newConsumer, subscribe_events: e.target.value })} />
                    <p className="mt-1 text-[11px] text-gray-500"><code className="rounded bg-gray-100 px-1">shipment.*</code> = all shipment events · <code className="rounded bg-gray-100 px-1">*</code> = absolutely everything.</p>
                  </div>
                  <div>
                    <label className={STYLES.label}>Override secret (opsional — 64 hex)</label>
                    <input className={STYLES.input + ' font-mono text-xs'} placeholder="KOSONGKAN = auto crypto.random → 64 hex chars. Isi = pakai custom secret." value={newConsumer.secret_override} onChange={(e) => setNewConsumer({ ...newConsumer, secret_override: e.target.value })} />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <input type="checkbox" checked={newConsumer.is_active} onChange={(e) => setNewConsumer({ ...newConsumer, is_active: e.target.checked })} />
                      <span className="text-sm">Aktifkan immediately (fanout worker mulai deliver event)</span>
                    </label>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button className={STYLES.buttonGhost} onClick={() => { setAddOpen(false); setNewConsumer({ description: '', endpoint_url: '', subscribe_events: 'shipment.*', secret_override: '', is_active: true }); }}>Cancel</button>
                  <button className={STYLES.buttonPrimary} onClick={saveNewConsumer}><Save size={14} className="inline mr-2 align-text-top" />Save & Generate Secret (show once)</button>
                </div>
              </div>
            )}

            {consumersLoading && <p className="text-sm text-gray-500 py-6"><Loader2 size={14} className="inline animate-spin mr-2 align-text-top" />Loading consumer list…</p>}
            {!consumersLoading && (
              <div className="grid gap-4 md:grid-cols-2">
                {consumers.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-gray-200 p-5 space-y-4 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={c.is_active ? 'success' : 'neutral'} label={c.is_active ? 'ACTIVE' : 'INACTIVE'} />
                          <p className="text-xs font-mono text-gray-500">#{c.id}</p>
                        </div>
                        <h3 className="mt-2 font-bold text-gray-900 break-words">{c.description || '(untitled consumer)'}</h3>
                        <a href={c.endpoint_url} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs font-mono text-blue-600 break-all hover:underline block">{c.endpoint_url}</a>
                      </div>
                    </div>
                    <div className="grid gap-2 text-xs text-gray-600">
                      <div className="flex justify-between gap-2"><span className="text-gray-500">Subscribed events:</span><span className="font-mono max-w-[220px] truncate text-right" title={(c.subscribe_event_names ?? []).join(', ')}>{(c.subscribe_event_names ?? []).length ? c.subscribe_event_names!.join(', ') : '* (all)'}</span></div>
                      <div className="flex justify-between gap-2"><span className="text-gray-500">Last delivery:</span><span className="font-mono text-right">{c.last_delivery_at ?? '(never)'}</span></div>
                      <div className="flex justify-between gap-2"><span className="text-gray-500">Secret masked:</span><span className="font-mono text-right text-gray-700">{c.hmac_secret_masked ?? '****-????????'}</span></div>
                      <div className="flex justify-between gap-2"><span className="text-gray-500">Deliveries count:</span><span className="font-mono text-right">{c.total_deliveries ?? 0}</span></div>
                      <div className="flex justify-between gap-2"><span className="text-gray-500">Consecutive failures:</span><span className={'font-mono text-right ' + ((c.consecutive_failures ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold')}>{c.consecutive_failures ?? 0}</span></div>
                    </div>
                    {pingResults[c.id] && (
                      <div className={'rounded-xl border p-3 ' + bannerClass(pingResults[c.id].ok ? 'success' : 'danger').split(' p-4')[0]} style={{ padding: '12px' }}>
                        <p className="text-xs font-semibold">
                          {pingResults[c.id].ok ? <><Check size={12} className="inline align-text-top mr-1 text-green-600" />Test Ping OK</> : <><ServerCrashIcon size={12} className="inline align-text-top mr-1 text-red-600" />Ping FAILED</>}
                          {' '}HTTP <code className="font-mono text-[11px] bg-white/70 px-1 rounded">{pingResults[c.id].http_status ?? '(network err / no response)'}</code>
                        </p>
                        {pingResults[c.id].snippet && <pre className="mt-2 text-[11px] font-mono bg-white/70 p-2 rounded whitespace-pre-wrap break-all max-h-24 overflow-auto">{pingResults[c.id].snippet}</pre>}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                      <button className={STYLES.buttonGhost + ' !px-3 !py-1.5'} onClick={() => toggleActive(c.id, !c.is_active)}>{c.is_active ? '⏸ Deactivate' : '▶ Activate'}</button>
                      <div className="flex gap-2">
                        <button className={STYLES.buttonSecondary + ' !px-3 !py-1.5'} onClick={() => testPing(c.id)} disabled={pingLoading === c.id}>
                          {pingLoading === c.id ? <><Loader2 size={14} className="inline animate-spin mr-2 align-text-top" />Ping…</> : <><Clock size={14} className="inline mr-2 align-text-top" />Test Ping (signed HMAC)</>}
                        </button>
                        <button className={STYLES.buttonGhost + ' !px-3 !py-1.5'} onClick={() => deleteConsumer(c.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
                {consumers.length === 0 && (
                  <div className="md:col-span-2 rounded-2xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-500 flex flex-col items-center gap-3 bg-white/60">
                    <WebhookIcon size={32} className="opacity-50" />
                    <p>Belum ada consumer registration.</p>
                    <p className="text-xs opacity-80">Klik <code className="rounded bg-gray-100 px-1.5 py-0.5">Add Consumer Registration</code> untuk buat endpoint + HMAC secret (hanya ditampilkan PERTAMA KALI).</p>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

// silence unused idr lint
void idr;
