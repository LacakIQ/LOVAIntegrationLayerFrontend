import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { STYLES, Badge } from '../../components/ui/STYLES';
import SubTabs from '../../components/SubTabs';
import { callPgilInternalUI } from '../../utils/pgilApi';
import type { BannerState, ConsumerWebhook, PagedListResponse, WebhookEvent } from '../../types/pgil';

const DIRECTION_TONE: Record<string, 'info' | 'success'> = {
  inbound_provider: 'info',
  outbound_consumer: 'success',
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'neutral',
  retrying: 'warning',
  delivered: 'success',
  permanent_failed: 'danger',
};

export default function WebhooksView() {
  const [tab, setTab] = useState<'events' | 'dlq' | 'consumers'>('events');
  const [banner, setBanner] = useState<BannerState>(null);

  // Events
  const [evtPage, setEvtPage] = useState(1);
  const [evtPerPage] = useState(25);
  const [evtDir, setEvtDir] = useState<'all' | 'inbound_provider' | 'outbound_consumer'>('all');
  const [evtLoading, setEvtLoading] = useState(false);
  const [evtRows, setEvtRows] = useState<WebhookEvent[]>([]);
  const [evtTotal, setEvtTotal] = useState(0);
  const [evtTotalPages, setEvtTotalPages] = useState(1);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [replayId, setReplayId] = useState<number | null>(null);

  // DLQ
  const [dlqPage, setDlqPage] = useState(1);
  const [dlqLoading, setDlqLoading] = useState(false);
  const [dlqRows, setDlqRows] = useState<(WebhookEvent & { dlq_reason?: string })[]>([]);
  const [dlqTotal, setDlqTotal] = useState(0);

  // Consumers
  const [consumers, setConsumers] = useState<ConsumerWebhook[]>([]);
  const [consumersLoading, setConsumersLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newConsumer, setNewConsumer] = useState({ description: '', target_url: '', is_active: true });
  const [newSecret, setNewSecret] = useState<{ secret: string; consumer_slug: string } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (tab === 'events') void loadEvents();
    if (tab === 'dlq') void loadDlq();
    if (tab === 'consumers') void loadConsumers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, evtPage, evtDir, dlqPage]);

  async function loadEvents() {
    setEvtLoading(true);
    const q: Record<string, string> = { page: String(evtPage), per_page: String(evtPerPage) };
    if (evtDir !== 'all') q.direction = evtDir;
    const res = await callPgilInternalUI<PagedListResponse<WebhookEvent>>('pgil-admin-webhooks/events', { method: 'GET', query: q });
    setEvtLoading(false);
    if (res.ok) {
      setEvtRows(res.data.rows ?? []);
      setEvtTotal(res.data.total_rows ?? 0);
      setEvtTotalPages(res.data.total_pages ?? 1);
      if (res.data.banner) setBanner(res.data.banner);
    } else setBanner(res.banner);
  }

  async function loadDlq() {
    setDlqLoading(true);
    const res = await callPgilInternalUI<PagedListResponse<WebhookEvent>>('pgil-admin-webhooks/dlq', {
      method: 'GET', query: { page: String(dlqPage), per_page: String(evtPerPage) },
    });
    setDlqLoading(false);
    if (res.ok) {
      setDlqRows(res.data.rows ?? []);
      setDlqTotal(res.data.total_rows ?? 0);
    } else setBanner(res.banner);
  }

  async function loadConsumers() {
    setConsumersLoading(true);
    const res = await callPgilInternalUI<PagedListResponse<ConsumerWebhook> | ConsumerWebhook[]>('pgil-admin-webhooks/consumers', { method: 'GET' });
    setConsumersLoading(false);
    if (res.ok) {
      const list: ConsumerWebhook[] = Array.isArray(res.data) ? res.data : (res.data as PagedListResponse<ConsumerWebhook>).rows ?? [];
      setConsumers(list);
    } else setBanner(res.banner);
  }

  async function replayEvent(id: number) {
    setReplayId(id);
    const res = await callPgilInternalUI<{ ok: boolean }>(`pgil-admin-webhooks/events/${id}/replay`, { method: 'POST', isMutation: true });
    setReplayId(null);
    if (res.ok) {
      setBanner({ tone: 'success', title: 'Event replayed' });
      await loadEvents();
    } else setBanner(res.banner);
  }

  async function createConsumer() {
    if (!newConsumer.target_url) {
      setBanner({ tone: 'warning', title: 'Target URL required' });
      return;
    }
    const res = await callPgilInternalUI<{ consumer: ConsumerWebhook; secret?: string }>('pgil-admin-webhooks/consumers', {
      method: 'POST', isMutation: true, body: newConsumer,
    });
    if (res.ok) {
      if (res.data.secret) {
        setNewSecret({ secret: res.data.secret, consumer_slug: res.data.consumer.consumer_slug });
      }
      setAddOpen(false);
      setNewConsumer({ description: '', target_url: '', is_active: true });
      setBanner({ tone: 'success', title: 'Consumer webhook created', body: 'HMAC secret shown once — save it.' });
      await loadConsumers();
    } else setBanner(res.banner);
  }

  async function toggleConsumer(id: number, isActive: boolean) {
    const res = await callPgilInternalUI<{ consumer: ConsumerWebhook }>(`pgil-admin-webhooks/consumers/${id}`, {
      method: 'PATCH', isMutation: true, body: { is_active: isActive },
    });
    if (res.ok) await loadConsumers();
    else setBanner(res.banner);
  }

  async function deleteConsumer(id: number) {
    const res = await callPgilInternalUI<{ ok: boolean }>(`pgil-admin-webhooks/consumers/${id}`, {
      method: 'DELETE', isMutation: true,
    });
    setDeleteId(null);
    if (res.ok) { setBanner({ tone: 'success', title: 'Consumer deleted' }); await loadConsumers(); }
    else setBanner(res.banner);
  }

  return (
    <div className="space-y-4">
      <div className={STYLES.pageCard + ' p-6'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Payment Gateway</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">Webhook Administration</h2>
            <p className="mt-1 text-sm text-gray-500">Inbound Midtrans events, outbound consumer delivery, and dead-letter queue.</p>
          </div>
        </div>

        {banner && (
          <div className={'mt-4 p-4 rounded-2xl border ' + (
            banner.tone === 'success' ? STYLES.bannerSuccess :
            banner.tone === 'warning' ? STYLES.bannerWarning :
            banner.tone === 'danger' ? STYLES.bannerDanger : STYLES.bannerInfo
          )}>
            <p className="font-semibold">{banner.title}</p>
            {banner.body && <p className="mt-1 text-sm opacity-90 whitespace-pre-wrap">{banner.body}</p>}
          </div>
        )}

        <div className="mt-4">
          <SubTabs
            tabs={[
              { id: 'events', label: 'Events' },
              { id: 'dlq', label: `DLQ${dlqTotal ? ` (${dlqTotal})` : ''}` },
              { id: 'consumers', label: 'Consumers' },
            ]}
            active={tab}
            setActive={(t) => setTab(t as typeof tab)}
          />
        </div>

        {/* EVENTS TAB */}
        {tab === 'events' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'inbound_provider', 'outbound_consumer'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => { setEvtDir(d); setEvtPage(1); }}
                  className={(evtDir === d ? STYLES.buttonPrimary : STYLES.buttonSecondary) + ' !py-1.5 !text-xs'}
                >
                  {d === 'all' ? 'All' : d.replace('_', ' ')}
                </button>
              ))}
              <button onClick={() => void loadEvents()} className={STYLES.buttonGhost + ' !py-1.5 !text-xs ml-auto'}>
                <RefreshCw size={14} className="mr-1 inline align-text-top" /> Refresh
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Direction</th>
                    <th className="px-4 py-3 font-medium">Event Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Attempts</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {evtLoading ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center"><Loader2 size={20} className="mx-auto animate-spin text-blue-600" /></td></tr>
                  ) : evtRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No events.</td></tr>
                  ) : evtRows.map((e) => (
                    <Fragment key={e.event_id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3"><Badge tone={DIRECTION_TONE[e.direction] ?? 'neutral'} label={e.direction.replace('_', ' ')} /></td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{e.outbound_event_type ?? e.provider_event_id ?? '—'}</td>
                        <td className="px-4 py-3"><Badge tone={STATUS_TONE[e.status] ?? 'neutral'} label={e.status.replace('_', ' ')} /></td>
                        <td className="px-4 py-3 text-gray-700">{e.attempt_count}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setExpandedEvent(expandedEvent === e.event_id ? null : e.event_id)} className={STYLES.buttonGhost + ' !py-1 !text-xs'}>
                            {expandedEvent === e.event_id ? <ChevronUp size={14} className="inline" /> : <ChevronDown size={14} className="inline" />}
                          </button>
                          {e.direction === 'outbound_consumer' && e.status === 'permanent_failed' && (
                            <button onClick={() => void replayEvent(e.event_id)} disabled={replayId === e.event_id} className={STYLES.buttonSecondary + ' !py-1 !text-xs ml-2'}>
                              {replayId === e.event_id ? <Loader2 size={14} className="inline animate-spin" /> : <RefreshCw size={14} className="inline" />} Replay
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedEvent === e.event_id && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-gray-50">
                            <pre className="overflow-x-auto rounded-xl bg-gray-900 p-3 text-xs text-green-300">
                              {JSON.stringify(e.raw_payload, null, 2)}
                            </pre>
                            {e.last_error && <p className="mt-2 text-xs text-red-600">Last error: {e.last_error}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {evtTotalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-gray-500">{evtTotal} total · page {evtPage} of {evtTotalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setEvtPage((p) => Math.max(1, p - 1))} disabled={evtPage <= 1} className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}>Prev</button>
                  <button onClick={() => setEvtPage((p) => Math.min(evtTotalPages, p + 1))} disabled={evtPage >= evtTotalPages} className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}>Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DLQ TAB */}
        {tab === 'dlq' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Events that exceeded max retry attempts (5). Replay to re-queue.</p>
              <button onClick={() => void loadDlq()} className={STYLES.buttonGhost + ' !py-1.5 !text-xs'}>
                <RefreshCw size={14} className="mr-1 inline align-text-top" /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Event ID</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium">Last Error</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dlqLoading ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 size={20} className="mx-auto animate-spin text-blue-600" /></td></tr>
                  ) : dlqRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">Dead-letter queue is empty.</td></tr>
                  ) : dlqRows.map((e) => (
                    <tr key={e.event_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">#{e.event_id}</td>
                      <td className="px-4 py-3 text-gray-700">{e.outbound_event_type ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 truncate max-w-[200px]">{e.target_url ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-red-600">{e.last_error ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => void replayEvent(e.event_id)} disabled={replayId === e.event_id} className={STYLES.buttonPrimary + ' !py-1 !text-xs'}>
                          {replayId === e.event_id ? <Loader2 size={14} className="inline animate-spin" /> : <RefreshCw size={14} className="inline" />} Replay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONSUMERS TAB */}
        {tab === 'consumers' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Outbound webhook consumer endpoints. Events are HMAC-SHA256 signed.</p>
              <button onClick={() => setAddOpen(true)} className={STYLES.buttonPrimary + ' !py-2 !text-xs'}>
                <Plus size={14} className="mr-1 inline align-text-top" /> Add Consumer
              </button>
            </div>

            {newSecret && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">HMAC Secret — shown once. Save it now!</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-sm text-amber-900">{newSecret.secret}</code>
                  <button onClick={() => { navigator.clipboard?.writeText(newSecret.secret); }} className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}>
                    <Copy size={14} className="mr-1 inline align-text-top" /> Copy
                  </button>
                  <button onClick={() => setNewSecret(null)} className={STYLES.buttonGhost + ' !py-1.5 !text-xs'}><X size={14} /></button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Slug</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Target URL</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consumersLoading ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 size={20} className="mx-auto animate-spin text-blue-600" /></td></tr>
                  ) : consumers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No consumer webhooks.</td></tr>
                  ) : consumers.map((c) => (
                    <tr key={c.wh_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{c.consumer_slug}</td>
                      <td className="px-4 py-3 text-gray-700">{c.display_name ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 truncate max-w-[240px]">{c.target_url}</td>
                      <td className="px-4 py-3"><Badge tone={c.is_active ? 'success' : 'neutral'} label={c.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => void toggleConsumer(c.wh_id, !c.is_active)} className={STYLES.buttonGhost + ' !py-1 !text-xs mr-1'}>
                          {c.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => setDeleteId(c.wh_id)} className="!bg-red-50 hover:!bg-red-100 text-red-700 rounded-xl px-2 py-1 text-xs border border-red-200">
                          <Trash2 size={12} className="inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add consumer modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add Consumer Webhook</h3>
              <button onClick={() => setAddOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700 mb-1">Target URL *</span>
                <input className={STYLES.input} placeholder="https://your-server.com/webhook" value={newConsumer.target_url} onChange={(e) => setNewConsumer({ ...newConsumer, target_url: e.target.value })} />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700 mb-1">Description</span>
                <input className={STYLES.input} placeholder="Optional label" value={newConsumer.description} onChange={(e) => setNewConsumer({ ...newConsumer, description: e.target.value })} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newConsumer.is_active} onChange={(e) => setNewConsumer({ ...newConsumer, is_active: e.target.checked })} />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className={STYLES.buttonGhost}>Cancel</button>
              <button onClick={() => void createConsumer()} className={STYLES.buttonPrimary}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900">Delete consumer webhook?</h3>
            <p className="mt-1 text-sm text-gray-500">This cannot be undone. Events will no longer be delivered to this endpoint.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className={STYLES.buttonGhost}>Cancel</button>
              <button onClick={() => void deleteConsumer(deleteId)} className={STYLES.buttonDanger}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
