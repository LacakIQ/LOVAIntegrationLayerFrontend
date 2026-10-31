import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Info,
  Loader2,
  Package,
  PlusCircle,
  Search as SearchIcon,
  Table as TableIcon,
  Upload,
  FileSpreadsheet,
  FileDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { STYLES, Section, Badge } from '../../components/ui/STYLES.tsx';
import { getPathForView } from '../../app-routes.ts';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi.ts';
import ShipmentDetailDrawer from '../../components/thirdplil/ShipmentDetailDrawer.tsx';
import type { BannerMessage, ShipmentHeader, ShipmentStatus } from '../../types/thirdplil.ts';

function toneForStatus(s: ShipmentStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (s) {
    case 'delivered': return 'success';
    case 'problem_resolved':
    case 'awb_assigned':
    case 'pickup_requested':
    case 'pickup_scheduled':
    case 'courier_picked_up':
    case 'in_transit':
    case 'out_for_delivery':
      return 'info';
    case 'draft':
    case 'provider_submitted':
    case 'attempt_failed':
    case 'return_in_progress':
      return 'warning';
    case 'problem_pending':
    case 'lost':
    case 'damaged':
      return 'danger';
    case 'canceled':
    case 'returned':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function statusLabel(s: ShipmentStatus): string {
  const map: Record<ShipmentStatus, string> = {
    draft: 'Draft',
    provider_submitted: 'Provider Submitted',
    awb_assigned: 'AWB Assigned',
    pickup_requested: 'Pickup Requested',
    pickup_scheduled: 'Pickup Scheduled',
    courier_picked_up: 'Courier Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out For Delivery',
    attempt_failed: 'Attempt Failed',
    delivered: 'Delivered',
    return_in_progress: 'Return In Progress',
    returned: 'Returned to Sender',
    problem_pending: 'Problem Pending',
    problem_resolved: 'Problem Resolved',
    canceled: 'Canceled',
    lost: 'Lost',
    damaged: 'Damaged',
  };
  return map[s] ?? s;
}

const STATUS_ORDER: ShipmentStatus[] = [
  'draft', 'provider_submitted', 'awb_assigned', 'pickup_requested', 'pickup_scheduled',
  'courier_picked_up', 'in_transit', 'out_for_delivery', 'attempt_failed',
  'delivered', 'return_in_progress', 'returned', 'problem_pending', 'problem_resolved',
  'canceled', 'lost', 'damaged',
];

export default function ShipmentsDashboardView() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ShipmentHeader[]>([]);
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ShipmentStatus>('all');
  const [drawerShipmentId, setDrawerShipmentId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [downloadingAwbId, setDownloadingAwbId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setBanner(null);
    const r = await callThirdPLILInternalUI<ShipmentHeader[]>('thirdplil-shipments', { method: 'GET', query: { per_page: 20 } });
    setLoading(false);
    if (r.ok) {
      setRows((r.data ?? []) as ShipmentHeader[]);
      if (r.banner) setBanner(r.banner);
    } else {
      setBanner(r.banner);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return rows.filter((s) => {
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (!ql) return true;
      return [
          s.awb_no, s.transaction_id, String(s.shipment_id),
          s.sender_address, s.recipient_address,
          s.sender_name, s.recipient_name,
          s.sender_phone, s.recipient_phone,
        s.courier_service_code, s.courier_service_name,
      ].some((x) => x && String(x).toLowerCase().includes(ql));
    });
  }, [rows, q, filterStatus]);

  const cancelShipment = async (id: number) => {
    setCancellingId(id);
    const r = await callThirdPLILInternalUI<{ ok: boolean; skipped: boolean; new_status: ShipmentStatus }>(`thirdplil-shipments/${id}`, { method: 'DELETE', isMutation: true });
    setCancellingId(null);
    if (!r.ok) { setBanner(r.banner); return; }
    const d = (r.data ?? {}) as { ok?: boolean; skipped?: boolean; skip_reason?: string };
    setBanner({
      tone: r.isDuplicate ? 'info' : 'success',
      title: d.skipped ? 'Skip no-op: shipment sudah terminal / canceled.' : 'Berhasil: Shipment di-cancel.',
      body: r.isDuplicate ? 'Response dedup — tidak ada penulisan data baru.' : (d.skip_reason ?? undefined),
    });
    await load();
  };

  const downloadAwb = async (id: number) => {
    setDownloadingAwbId(id);
    const r = await callThirdPLILInternalUI<{ url?: string; awb_no?: string; provider?: string }>(`thirdplil-shipments/${id}/awb-label`, { method: 'GET', query: { redirect: 'false' } });
    setDownloadingAwbId(null);
    if (!r.ok) { setBanner(r.banner); return; }
    const d = (r.data ?? {}) as { url?: string };
    if (!d.url) {
      setBanner({ tone: 'warning', title: 'AWB label belum tersedia.', body: 'KiriminAja belum mengembalikan URL label. Tunggu webhook/polling sampai AWB tersedia, lalu coba lagi.' });
      return;
    }
    try {
      window.open(d.url, '_blank', 'noopener noreferrer');
    } catch {
      location.href = d.url;
    }
  };

  const idr = (s: string | number | null) => {
    const n = typeof s === 'string' ? parseFloat(s.replace(/[^0-9.]/g, '')) || 0 : Number(s ?? 0);
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
  };

  const counts = useMemo(() => {
    const map = new Map<ShipmentStatus | 'all', number>();
    map.set('all', rows.length);
    for (const r of rows) map.set(r.status, (map.get(r.status) ?? 0) + 1);
    return map;
  }, [rows]);

  return (
    <div className={STYLES.pageCard}>
      <div className="p-6 space-y-6">
        <div className={STYLES.bannerInfo}>
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">View LIVE · Shipments Dashboard (ThirdPLIL top-level nav)</p>
              <p className="mt-1 text-sm opacity-90">
                Full implementation: List real shipments via <code className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900 text-xs">thirdplil-shipments</code> Edge → RLS; click row opens <code className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900 text-xs">ShipmentDetailDrawer</code> (4 sub-tabs with real data).
              </p>
            </div>
          </div>
        </div>

        <nav className="text-xs text-gray-500">
          <Link to={getPathForView('dashboard')} className="hover:text-gray-700 hover:underline">Dashboard</Link>
          <span className="mx-2">›</span>
          <span className="font-semibold text-gray-700">ThirdPLIL</span>
          <span className="mx-2">›</span>
          <span className="font-semibold text-gray-900">Shipments Dashboard</span>
        </nav>

        {banner && (
          <div className={
            banner.tone === 'success' ? STYLES.bannerSuccess :
            banner.tone === 'warning' ? STYLES.bannerWarning :
            banner.tone === 'danger'  ? STYLES.bannerDanger  : STYLES.bannerInfo
          }>
            <div className="flex items-start gap-3">
              {banner.tone === 'success' ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" /> : banner.tone === 'danger' ? <XCircle size={18} className="mt-0.5 flex-shrink-0" /> : banner.tone === 'warning' ? <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" /> : <Info size={18} className="mt-0.5 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{banner.title}</p>
                {banner.body && <p className="mt-1 text-sm opacity-90 whitespace-pre-wrap">{banner.body}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 flex items-center gap-2">
              <TableIcon size={14} /> Dashboard · Semua Shipment
            </p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">
              <Package size={20} className="mr-2 inline align-text-bottom" />
              Semua Shipment Subscriber Anda
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Total: <span className="font-semibold text-gray-700">{rows.length}</span> row. Click row mana pun untuk buka drawer detail (4 SubTabs).
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            <button className={STYLES.buttonSecondary}>
              <Upload size={14} className="mr-1.5 inline align-text-top" /> Import CSV
            </button>
            <button className={STYLES.buttonSecondary}>
              <FileSpreadsheet size={14} className="mr-1.5 inline align-text-top" /> Export CSV
            </button>
            <button className={STYLES.buttonSecondary}>
              <FileDown size={14} className="mr-1.5 inline align-text-top" /> Batch Download AWB
            </button>
            <Link to={getPathForView('kiriminaja-shipments-create')} className={STYLES.buttonPrimary + ' inline-flex items-center no-underline'}>
              <PlusCircle size={15} className="mr-2 inline align-text-top" />
              Create Shipment
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto max-w-full">
            <button onClick={() => setFilterStatus('all')}
              className={(filterStatus === 'all' ? STYLES.buttonPrimary : STYLES.buttonGhost) + ' !py-1.5 !text-xs whitespace-nowrap'}>
              All<span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[10px]">{counts.get('all') ?? 0}</span>
            </button>
            {STATUS_ORDER.map((s) => (
              (counts.get(s) ?? 0) > 0 ? (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={(filterStatus === s ? STYLES.buttonPrimary : STYLES.buttonGhost) + ' !py-1.5 !text-xs whitespace-nowrap'}>
                  {statusLabel(s)}
                  <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[10px]">{counts.get(s)}</span>
                </button>
              ) : null
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari AWB / ID / nama / alamat..."
              className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <Section kicker="ServerDataTable (preview)" title="Shipment List · 9-col grid" subtitle="Full r005 will mount reusable ServerDataTable with pagination 50/per page, column sort, sticky right Actions column. Current r005: real Edge data via callThirdPLILInternalUI.">
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full min-w-[1300px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ID', 'AWB', 'Status', 'Created At', 'Kurir Service', 'Origin → Destination', 'Contact (Pengirim → Penerima)', 'Total (IDR)', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center">
                      <Loader2 size={22} className="mx-auto mb-2 animate-spin text-blue-600" />
                      <p className="text-sm text-gray-500">Loading shipments list...</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                      <Package size={22} className="mx-auto mb-2 text-gray-300" />
                      <p>Belum ada shipment{q || filterStatus !== 'all' ? ' yang match filter. Reset filter / search untuk lihat semua.' : ' — buat via Create Shipment button di atas.'}</p>
                    </td>
                  </tr>
                ) : (
                    filtered.map((s) => (
                      <tr key={s.shipment_id} onClick={() => setDrawerShipmentId(Number(s.shipment_id))} className="hover:bg-blue-50/50 cursor-pointer transition">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">#{s.shipment_id}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">{s.awb_no ?? <span className="text-gray-300 italic font-normal">pending</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge tone={toneForStatus(s.status)} label={statusLabel(s.status)} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.created_at ? new Date(s.created_at).toLocaleString('id-ID') : '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        <p className="font-semibold text-gray-800">{s.courier_service_name ?? '-'}</p>
                        <p className="font-mono text-gray-500">{s.courier_service_code ?? '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                          <p className="line-clamp-1"><span className="text-blue-600 font-semibold">📍</span> {s.sender_address}</p>
                          <p className="line-clamp-1 mt-0.5"><span className="text-green-600 font-semibold">🎯</span> {s.recipient_address}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                          <p className="font-semibold text-gray-700">{s.sender_name ?? s.sender_contact_name ?? '-'} → {s.recipient_name ?? s.recipient_contact_name ?? '-'}</p>
                          <p className="font-mono text-gray-400">{s.sender_phone ?? s.sender_contact_phone ?? '-'} → {s.recipient_phone ?? s.recipient_contact_phone ?? '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">{idr(s.grand_total_idr ?? s.grand_total_fee_idr ?? null)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1 justify-end">
                            <button onClick={() => setDrawerShipmentId(Number(s.shipment_id))} className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}>
                            Details
                          </button>
                            <button onClick={() => void downloadAwb(Number(s.shipment_id))} disabled={downloadingAwbId === Number(s.shipment_id) || !s.awb_no} className={STYLES.buttonSecondary + ' !py-1.5 !text-xs disabled:opacity-50'}>
                              {downloadingAwbId === Number(s.shipment_id) ? <Loader2 size={13} className="mr-1 inline align-text-top animate-spin" /> : <Download size={13} className="mr-1 inline align-text-top" />}
                            AWB
                          </button>
                            <button onClick={() => void cancelShipment(Number(s.shipment_id))} disabled={cancellingId === Number(s.shipment_id)} className="!bg-red-50 hover:!bg-red-100 text-red-700 border border-red-200 rounded-xl px-2 py-1.5 text-xs disabled:opacity-50 transition">
                              {cancellingId === Number(s.shipment_id) ? <Loader2 size={13} className="inline align-text-top animate-spin" /> : 'Cancel'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
            <p>Menampilkan {filtered.length} dari {rows.length} shipment · filter = <code className="rounded bg-gray-100 px-1">{filterStatus}</code></p>
            <p className="italic text-gray-400">Drawer 4 SubTabs: Summary / Packages / Pickup / Timeline — click row mana pun untuk open.</p>
          </div>
        </Section>

        <ShipmentDetailDrawer open={drawerShipmentId !== null} shipmentId={drawerShipmentId} onClose={() => setDrawerShipmentId(null)} />
      </div>
    </div>
  );
}
