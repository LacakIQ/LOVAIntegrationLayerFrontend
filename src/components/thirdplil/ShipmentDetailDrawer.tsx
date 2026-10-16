import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, Clock, Download, ExternalLink, FileText, Loader2, MapPin, Package as PackageIcon, Search as SearchIcon, XCircle } from 'lucide-react';
import { STYLES, Section, Badge } from '../ui/STYLES.tsx';
import SubTabs from '../SubTabs.tsx';
import type { BannerState, PackageItemRow, PackageWithItems, ShipmentDetail, ShipmentStatus } from '../../types/thirdplil.ts';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi.ts';

export interface ShipmentDetailDrawerProps {
  open: boolean;
  shipmentId: bigint | number | null;
  onClose: () => void;
}

interface ShipmentStatusHistoryRow {
  id: number;
  shipment_id: number;
  prior_status: ShipmentStatus | null;
  new_status: ShipmentStatus;
  reason?: string | null;
  triggered_by?: 'ui_user' | 'consumer_api' | 'provider_webhook' | 'cron_worker' | 'system' | string | null;
  actor_profile_id?: number | null;
  provider_event_ref?: string | null;
  note_jsonb?: Record<string, unknown> | null;
  occurred_at: string;
  created_at?: string | null;
}

function statusDotColor(s: ShipmentStatus) {
  switch (s) {
    case 'delivered': return 'bg-green-500 text-white';
    case 'paid':
    case 'pickup_completed':
    case 'received_at_origin':
    case 'received_at_destination':
    case 'in_transit':
    case 'out_for_delivery':
      return 'bg-blue-500 text-white';
    case 'problem_pending':
    case 'lost':
    case 'damaged':
      return 'bg-red-500 text-white';
    case 'canceled':
    case 'returned':
      return 'bg-gray-500 text-white';
    case 'draft':
    case 'quoted':
    case 'awaiting_payment':
    case 'pickup_scheduled':
      return 'bg-amber-500 text-white';
    default: return 'bg-gray-300 text-gray-700';
  }
}

function triggerLabel(t?: string | null): string {
  switch (t) {
    case 'ui_user': return 'UI Dashboard';
    case 'consumer_api': return 'Consumer API (Path B)';
    case 'provider_webhook': return 'Inbound Webhook Provider';
    case 'cron_worker': return 'Cron Worker';
    case 'system': return 'System RPC';
    default: return t ?? 'unknown';
  }
}

function formatTsLocal(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} WIB`;
  } catch {
    return iso;
  }
}

const FALLBACK_PACKAGES: PackageWithItems[] = [];

export default function ShipmentDetailDrawer({ open, shipmentId, onClose }: ShipmentDetailDrawerProps) {
  const [tab, setTab] = useState<'summary' | 'packages' | 'pickup' | 'timeline'>('summary');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [history, setHistory] = useState<ShipmentStatusHistoryRow[]>([]);
  const [banner, setBanner] = useState<BannerState>(null);
  const [lastFetchKey, setLastFetchKey] = useState<string>('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!open) {
      return;
    }
    if (!shipmentId) {
      setBanner({ tone: 'warning', title: 'Shipment ID tidak tersedia', body: 'Drawer dibuka tanpa shipment_id yang valid.' });
      return;
    }
    const key = `${String(shipmentId)}::${open ? '1' : '0'}`;
    if (key === lastFetchKey) return;
    setLastFetchKey(key);

    let cancelled = false;
    (async () => {
      setLoading(true);
      setBanner(null);
      const res = await callThirdPLILInternalUI<{
        shipment: ShipmentDetail;
        history: ShipmentStatusHistoryRow[];
      }>(`thirdplil-shipments/${encodeURIComponent(String(shipmentId))}`, {
        method: 'GET',
        isMutation: false,
        timeoutMs: 30000,
      });
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setBanner(res.banner);
        return;
      }
      if (res.banner) setBanner(res.banner);
      const payload = res.data as { shipment: ShipmentDetail; history: ShipmentStatusHistoryRow[] } | null;
      if (!payload) {
        setBanner({ tone: 'warning', title: 'Data shipment kosong', body: 'Endpoint mengembalikan null payload.' });
        return;
      }
      setShipment(payload.shipment);
      setHistory(Array.isArray(payload.history) ? payload.history : []);
    })();

    return () => { cancelled = true; };
  }, [mounted, open, shipmentId, lastFetchKey]);

  useEffect(() => {
    if (!open) {
      setShipment(null);
      setHistory([]);
      setBanner(null);
      setTab('summary');
    }
  }, [open]);

  if (!mounted) return null;
  if (!open) return null;

  const packages: PackageWithItems[] = shipment?.packages ?? FALLBACK_PACKAGES;
  const totalPackages = packages.length ?? shipment?.total_packages ?? 0;
  const timelineRows = history.length > 0
    ? history.slice().sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    : [];

  const tabs = [
    { id: 'summary', label: '① Summary' },
    { id: 'packages', label: `② Paket (${totalPackages})` },
    { id: 'pickup', label: '③ Pickup' },
    { id: 'timeline', label: `④ Timeline (${timelineRows.length})` },
  ];

  const statusToneFor = (s?: ShipmentStatus | null): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
    if (!s) return 'neutral';
    switch (s) {
      case 'delivered': return 'success';
      case 'paid':
      case 'pickup_completed':
      case 'received_at_origin':
      case 'received_at_destination':
      case 'in_transit':
      case 'out_for_delivery':
      case 'pickup_driver_assigned':
      case 'pickup_enroute':
        return 'info';
      case 'problem_pending':
      case 'lost':
      case 'damaged':
      case 'payment_failed':
        return 'danger';
      case 'canceled':
      case 'returned':
        return 'neutral';
      case 'draft':
      case 'quoted':
      case 'awaiting_payment':
      case 'pickup_scheduled':
        return 'warning';
      default: return 'neutral';
    }
  };

  const headerStatus = shipment?.status;
  const headerSandbox = !!shipment?.is_sandbox;
  const headerTxn = shipment?.transaction_id ?? '';
  const headerAwb = shipment?.awb_no;
  const headerService = shipment?.courier_service_name ?? '(courier belum ditentukan)';
  const headerId = shipment?.id ?? (typeof shipmentId === 'bigint' ? Number(shipmentId) : (shipmentId ?? 0));
  const headerCreatedAt = shipment?.created_at;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-full bg-white shadow-2xl overflow-y-auto border-l border-gray-200 animate-[slideInRight_0.25s_ease-out]">
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusToneFor(headerStatus)} label={`Status: ${headerStatus ?? 'unknown'}`} />
              <Badge tone={headerSandbox ? 'warning' : 'neutral'} label={headerSandbox ? 'SANDBOX' : 'PRODUCTION'} />
              {headerTxn && <Badge tone="info" label={`txn #…${headerTxn.slice(-8)}`} />}
              {loading && <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"><Loader2 size={12} className="animate-spin" /> Loading…</span>}
            </div>
            <h2 className="mt-2 text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Shipment Detail · AWB {headerAwb ?? '(belum ada AWB)'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {headerService} · ID #{String(headerId)}{headerCreatedAt ? ` · dibuat ${formatTsLocal(headerCreatedAt)}` : ''}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {shipment?.awb_label_storage ? (
              <a href={shipment.awb_label_storage.startsWith('http') ? shipment.awb_label_storage : '#'} target="_blank" rel="noopener noreferrer" className={STYLES.buttonSecondary}>
                <Download size={14} className="mr-2 inline align-text-top" />
                Download AWB Label
              </a>
            ) : (
              <button disabled className={STYLES.buttonSecondary + ' opacity-50 cursor-not-allowed'}>
                <Download size={14} className="mr-2 inline align-text-top" />
                (AWB belum tersedia)
              </button>
            )}
            <a href={shipment?.provider_slug === 'kiriminaja' ? (shipment?.is_sandbox ? 'https://tdev.kiriminaja.com/dashboard' : 'https://client.kiriminaja.com/dashboard') : '#'} target="_blank" rel="noopener noreferrer" className={STYLES.buttonGhost}>
              <ExternalLink size={14} className="mr-1 inline align-text-top" />
              Provider ({shipment?.provider_slug === 'kiriminaja' ? 'KA' : (shipment?.provider_slug ?? '—')})
            </a>
            <button onClick={onClose} className="ml-2 rounded-lg p-2 hover:bg-gray-100 text-gray-500" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {banner && (
            <div className={'mb-5 p-4 rounded-2xl border ' + (
              banner.tone === 'danger' ? STYLES.bannerDanger :
              banner.tone === 'warning' ? STYLES.bannerWarning :
              banner.tone === 'success' ? STYLES.bannerSuccess :
              STYLES.bannerInfo
            )}>
              <p className="font-semibold text-sm">{banner.title}</p>
              {banner.body && <p className="mt-1 text-xs opacity-90">{banner.body}</p>}
            </div>
          )}

          {loading && !shipment && (
            <div className={'mb-5 p-4 rounded-2xl border ' + STYLES.bannerInfo}>
              <p className="font-semibold text-sm flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Memuat data shipment…</p>
              <p className="mt-1 text-xs opacity-90">Menghubungi Edge Function thirdplil-shipments/:id untuk hydrate header + packages + items + timeline history.</p>
            </div>
          )}

          {!loading && !shipment && !banner && (
            <div className={'mb-5 p-4 rounded-2xl border ' + STYLES.bannerWarning}>
              <p className="font-semibold text-sm flex items-center gap-2"><SearchIcon size={16} /> Data shipment belum tersedia</p>
              <p className="mt-1 text-xs opacity-90">Draw berhasil dibuka, namun data shipment belum diterima. Tutup drawer dan buka kembali untuk retry.</p>
            </div>
          )}

          <SubTabs tabs={tabs} active={tab} setActive={(id) => setTab(id as typeof tab)} />
        </div>

        {tab === 'summary' && shipment && (
          <div className="px-6 pb-8 space-y-5">
            <Section kicker="Summary · Address Block" title="Origin → Destination Address & Contacts" subtitle="Origin always merchant (subscriber default pickup address). Destination always buyer (WMS / Webstore order shipping address row).">
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { title: 'Origin (Pengirim)', sub: `${shipment.origin_contact_name} · ${shipment.origin_contact_phone}`, body: shipment.origin_address_line, email: shipment.origin_contact_email, tone: 'info' as const },
                  { title: 'Destination (Penerima)', sub: `${shipment.destination_contact_name} · ${shipment.destination_contact_phone}`, body: shipment.destination_address_line, email: shipment.destination_contact_email, tone: 'success' as const },
                ].map((c) => (
                  <div key={c.title} className="rounded-2xl border border-gray-200 p-5 hover:bg-gray-50/60">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-gray-900 flex items-center gap-2"><MapPin size={16} /> {c.title}</p>
                      <Badge tone={c.tone} label={c.tone === 'info' ? 'Asal' : 'Tujuan'} />
                    </div>
                    <p className="text-xs text-gray-500">{c.sub}</p>
                    <p className="mt-2 text-sm text-gray-800 leading-relaxed">{c.body}</p>
                    {c.email && <p className="mt-2 text-xs text-gray-500">✉ {c.email}</p>}
                  </div>
                ))}
              </div>
            </Section>

            <Section kicker="Summary · Financials" title="Pricing Summary (IDR)" subtitle="Semua totals dihitung server-side di shipment_create_rpc — client never trusted. Per-package breakdown tab ② Packages.">
              <div className="grid md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Actual W', val: `${((shipment.total_actual_weight_g ?? 0) / 1000).toFixed(2)} kg`, tone: 'neutral' as const },
                  { label: 'Total Billed W', val: `${((shipment.total_billed_weight_g ?? 0) / 1000).toFixed(2)} kg`, tone: 'info' as const },
                  { label: shipment.is_insurance_enabled ? `Insurance (aktif)` : 'Insurance (tidak aktif)', val: shipment.insurance_fee_idr ? `Rp ${new Intl.NumberFormat('id-ID').format(parseFloat(shipment.insurance_fee_idr))}` : 'Rp 0', tone: shipment.is_insurance_enabled ? ('info' as const) : ('neutral' as const) },
                  { label: 'GRAND TOTAL', val: 'Rp ' + (shipment.grand_total_fee_idr ? new Intl.NumberFormat('id-ID').format(parseFloat(shipment.grand_total_fee_idr)) : '?'), tone: 'success' as const, highlight: true },
                ].map((r) => (
                  <div key={r.label} className={'rounded-2xl p-4 border ' + (r.highlight ? 'border-green-300 bg-green-50/50 ring-1 ring-inset ring-green-400/40' : 'border-gray-200 bg-white')}>
                    <Badge tone={r.tone} label={r.label} />
                    <p className={'mt-2 text-right ' + (r.highlight ? 'text-2xl font-bold text-green-700' : 'text-lg font-semibold text-gray-800')}>{r.val}</p>
                    {r.label.startsWith('Insurance') && shipment.platform_service_fee_idr && (
                      <p className="mt-1 text-right text-xs text-gray-400">Platform: Rp {new Intl.NumberFormat('id-ID').format(parseFloat(shipment.platform_service_fee_idr))}</p>
                    )}
                    {r.label === 'GRAND TOTAL' && shipment.cod_amount_idr && (
                      <p className="mt-1 text-right text-xs text-amber-600 font-semibold">COD: Rp {new Intl.NumberFormat('id-ID').format(parseFloat(shipment.cod_amount_idr))}</p>
                    )}
                    {r.label === 'GRAND TOTAL' && shipment.ka_pin_was_used && (
                      <p className="mt-1 text-right text-xs text-blue-500">✓ KA Credit (PIN 6-digit, tidak disimpan)</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {shipment.delivered_at && (
              <Section kicker="Summary · Delivery" title="Delivered Timestamp" subtitle="Diisi otomatis ketika status transition ke delivered (dari inbound webhook atau driver confirm delivery).">
                <div className="rounded-2xl border border-green-200 bg-green-50/40 p-5">
                  <p className="text-sm text-gray-500 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-600" /> Delivered at (local WIB)</p>
                  <p className="mt-1 text-2xl font-bold text-green-700">{formatTsLocal(shipment.delivered_at)}</p>
                </div>
              </Section>
            )}
          </div>
        )}

        {tab === 'summary' && !shipment && (
          <div className="px-6 pb-8">
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
              <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-60" />
              Summary akan tampil setelah data shipment berhasil dimuat.
            </div>
          </div>
        )}

        {tab === 'packages' && (
          <div className="px-6 pb-8 space-y-5">
            <Section kicker={`Tab ② · ${totalPackages} Packages`} title="Packages & Items (per-package breakdown)" subtitle="Per-package actual/volumetric/billed weights; per-item declared value auto summed = declared_value_total_idr; fragile flag affects insurance min fee.">
              {packages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
                  {loading ? <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-60" /> : null}
                  Belum ada item paket. Data packages di-hydrate dari RPC response thirdplil_shipment_create_rpc row.
                </div>
              ) : (
                <div className="space-y-4">
                  {packages.map((p, idx) => (
                    <div key={p.package_seq_no ?? idx} className="rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-blue-200 bg-blue-100 text-blue-700 px-2 py-1 text-xs inline-flex items-center justify-center"><PackageIcon size={16} /></span>
                          <p className="font-semibold text-gray-900">Package #{p.package_seq_no ?? (idx + 1)}{p.description ? ` · ${p.description}` : ''}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge tone="info" label={`Actual ${(p.actual_weight_g / 1000).toFixed(2)}kg`} />
                          {p.volumetric_weight_g ? <Badge tone="neutral" label={`Vol. ${(p.volumetric_weight_g / 1000).toFixed(2)}kg`} /> : null}
                          <Badge tone="success" label={`Billed ${(((p.billed_weight_g ?? p.actual_weight_g) ?? 0) / 1000).toFixed(2)}kg`} />
                          {p.length_cm && p.width_cm && p.height_cm ? <Badge tone="warning" label={`${p.length_cm} × ${p.width_cm} × ${p.height_cm} cm`} /> : null}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              {['SKU', 'Nama Barang', 'Qty', 'Unit (IDR)', 'Line (IDR)', 'HS Code', 'Fragile'].map((h) => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(p.items as PackageItemRow[]).length === 0 ? (
                              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Tidak ada item rows di package ini.</td></tr>
                            ) : (p.items as PackageItemRow[]).map((it, itemIdx) => (
                              <tr key={itemIdx} className="hover:bg-gray-50/60">
                                <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{it.sku ?? <span className="text-gray-300">—</span>}</td>
                                <td className="px-4 py-2.5 font-semibold text-gray-800">{it.name}</td>
                                <td className="px-4 py-2.5">{it.qty}</td>
                                <td className="px-4 py-2.5 text-right font-mono">Rp {new Intl.NumberFormat('id-ID').format(parseFloat(it.unit_value_idr || '0'))}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-blue-600 font-semibold">
                                  Rp {new Intl.NumberFormat('id-ID').format(parseFloat(it.line_value_idr ?? it.unit_value_idr ?? '0') * (it.qty || 1))}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{it.hs_code ?? <span className="text-gray-300">—</span>}</td>
                                <td className="px-4 py-2.5">{it.is_fragile ? <Badge tone="danger" label="Fragile" /> : <Badge tone="neutral" label="No" />}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {tab === 'pickup' && shipment && (
          <div className="px-6 pb-8 space-y-5">
            <Section kicker="Tab ③ · Pickup" title="Jadwal Pickup & Driver Info" subtitle="Window dipilih wizard Step 4; status changed events pickup.driver_assigned / pickup.enroute / pickup.completed dari inbound webhook.">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3"><CalendarClock size={18} className="text-blue-600" /><p className="font-semibold">Window Dijadwalkan</p></div>
                  {shipment.pickup_date_local || timelineRows.some((h) => h.new_status === 'pickup_scheduled') ? (
                    <>
                      <p className="text-2xl font-bold text-gray-900">
                        {shipment.pickup_date_local ?? formatTsLocal(timelineRows.find((h) => h.new_status === 'pickup_scheduled')?.occurred_at ?? '').split('·')[0]?.trim()}
                        {shipment.pickup_start_time && shipment.pickup_end_time ? ` · ${shipment.pickup_start_time} — ${shipment.pickup_end_time}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 flex items-center gap-2">
                        {timelineRows.some((h) => h.new_status === 'pickup_completed') ? (
                          <><Badge tone="success" label="Pickup Completed" /> driver arrived on-time.</>
                        ) : timelineRows.some((h) => h.new_status === 'pickup_driver_assigned' || h.new_status === 'pickup_enroute') ? (
                          <><Badge tone="info" label="Driver On Route" /> Driver sedang menuju lokasi pickup.</>
                        ) : (
                          <><Badge tone="warning" label="Pickup Scheduled" /> Menunggu window pickup dimulai.</>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-xl font-semibold text-gray-400">Belum dijadwalkan</p>
                  )}
                  {shipment.pickup_driver_note && (
                    <div className="mt-5 space-y-1.5 text-sm">
                      <p className="text-gray-600">Driver Note: <span className="font-medium text-gray-800">{shipment.pickup_driver_note}</span></p>
                    </div>
                  )}
                  {shipment.pickup_window_id && (
                    <div className="mt-2 space-y-1.5 text-sm">
                      <p className="text-gray-600">Window ID: <span className="font-mono text-xs text-gray-700">{shipment.pickup_window_id}</span></p>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3"><Clock size={18} className="text-green-600" /><p className="font-semibold">Driver Info (saat assigned)</p></div>
                  {(() => {
                    const assignRow = timelineRows.find((h) => h.new_status === 'pickup_driver_assigned');
                    const note = assignRow?.note_jsonb;
                    const driverName = note && typeof note === 'object' && 'driver_name' in note ? String((note as Record<string, unknown>).driver_name) : null;
                    const driverPhone = note && typeof note === 'object' && 'driver_phone' in note ? String((note as Record<string, unknown>).driver_phone) : null;
                    const vehicleNo = note && typeof note === 'object' && 'vehicle_no' in note ? String((note as Record<string, unknown>).vehicle_no) : null;
                    if (!driverName && !assignRow) {
                      return (
                        <>
                          <p className="text-xl font-semibold text-gray-400">Belum ada driver assigned</p>
                          <p className="mt-1 text-sm text-gray-500">Akan terisi ketika inbound webhook KA event pickup.driver_assigned masuk → transition_status_rpc.</p>
                        </>
                      );
                    }
                    return (
                      <>
                        <p className="text-xl font-bold text-gray-900">{driverName ?? '(Driver name not in note_jsonb)'}</p>
                        {(driverPhone || vehicleNo) && (
                          <p className="mt-1 text-sm text-gray-500">
                            {driverPhone ? `📱 ${driverPhone}` : ''}
                            {driverPhone && vehicleNo ? ' · ' : ''}
                            {vehicleNo ? `🚚 Plat nomor: ${vehicleNo}` : ''}
                          </p>
                        )}
                        {assignRow?.occurred_at && (
                          <p className="mt-4 text-xs text-gray-500">Assigned at: {formatTsLocal(assignRow.occurred_at)}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </Section>
          </div>
        )}

        {tab === 'pickup' && !shipment && (
          <div className="px-6 pb-8">
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
              Pickup info akan tampil setelah data shipment berhasil dimuat.
            </div>
          </div>
        )}

        {tab === 'timeline' && (
          <div className="px-6 pb-8 space-y-5">
            <Section kicker={`Tab ④ · Timeline (${timelineRows.length} FSM events)`} title="FSM Status Timeline (append-only history)" subtitle="Every row → thirdplil_shipment_status_history.id; status transition guarded by RPC #2 (FOR UPDATE root row lock + terminal skip guard + backward skip).">
              {timelineRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
                  {loading ? <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-60" /> : null}
                  Belum ada status history rows. Jika shipment ada, biasanya minimal 1 row (draft). Cek Edge Function response.
                </div>
              ) : (
                <ol className="relative border-l-2 border-gray-200 pl-6 space-y-6 ml-3">
                  {timelineRows.map((h, i) => {
                    const isLast = i === timelineRows.length - 1;
                    const prior = h.prior_status;
                    const arrowLabel = prior ? `${prior} → ${h.new_status}` : `init → ${h.new_status}`;
                    const noteStr = h.reason ?? (h.note_jsonb && typeof h.note_jsonb === 'object' ? JSON.stringify(h.note_jsonb) : null) ?? null;
                    return (
                      <li key={h.id} className="relative">
                        <span className={`absolute -left-[37px] top-1 flex items-center justify-center w-6 h-6 rounded-full ${statusDotColor(h.new_status)}`}>
                          {h.new_status === 'delivered' ? <CheckCircle2 size={12} /> : (h.new_status === 'canceled' || h.new_status === 'lost' || h.new_status === 'damaged' || h.new_status === 'payment_failed' ? <XCircle size={12} /> : (h.new_status === 'problem_pending' ? <AlertCircle size={12} /> : <ArrowRight size={12} />))}
                        </span>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className={'font-semibold ' + (isLast ? 'text-green-700' : 'text-gray-900')}>
                              {arrowLabel}{h.provider_event_ref ? ` · provider ref: ${h.provider_event_ref}` : ''}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">triggered_by: {triggerLabel(h.triggered_by)}{h.actor_profile_id ? ` · profile_id #${h.actor_profile_id}` : ''}</p>
                            {noteStr && <p className="mt-1 text-xs text-gray-600 italic">💡 {noteStr}</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-xs text-gray-400">{formatTsLocal(h.occurred_at)}</p>
                            <p className="mt-1"><Badge tone={statusToneFor(h.new_status)} label={h.new_status} /></p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>
          </div>
        )}

        <div className="h-16" />
      </div>
    </div>
  );
}
