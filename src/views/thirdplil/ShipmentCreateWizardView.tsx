import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Info, Lock, Loader2, Package as PackageIcon, Save, Search as SearchIcon } from 'lucide-react';
import { STYLES, Section, Badge } from '../../components/ui/STYLES.tsx';
import { getPathForView } from '../../app-routes.ts';
import SubTabs from '../../components/SubTabs.tsx';
import SubdistrictCoverageLookup from '../../components/thirdplil/SubdistrictCoverageLookup.tsx';
import RateResultsTable from '../../components/thirdplil/RateResultsTable.tsx';
import type {
  BannerState,
  CreateShipmentRequest,
  PackageItemRow,
  PackageWithItems,
  PickupWindowOption,
  RateQuote,
  ShipmentDetail,
  ThirdPLILCoverageArea,
} from '../../types/thirdplil.ts';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi.ts';

type StepId = 1 | 2 | 3 | 4 | 5;

interface ContactBlock {
  contact_name: string;
  contact_phone: string;
  contact_email?: string;
  address_line: string;
  subdistrict: ThirdPLILCoverageArea | null;
}

function emptyContact(): ContactBlock {
  return { contact_name: '', contact_phone: '', contact_email: '', address_line: '', subdistrict: null };
}

function emptyPackage(seq: number): PackageWithItems {
  return {
    package_seq_no: seq,
    actual_weight_g: 0,
    length_cm: 0,
    width_cm: 0,
    height_cm: 0,
    volumetric_weight_g: 0,
    billed_weight_g: 0,
    description: '',
    items: [
      { sku: '', name: '', qty: 1, unit_value_idr: '0', line_value_idr: '0', is_fragile: false },
    ],
  };
}

function tomorrowLocalISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatIDR(s: string | number | null | undefined): string {
  const n = typeof s === 'number' ? s : parseFloat(String(s ?? '0'));
  if (!Number.isFinite(n)) return 'Rp 0';
  try { return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n * 100) / 100); }
  catch { return 'Rp ' + String(n); }
}

export default function ShipmentCreateWizardView() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>(1);
  const [banner, setBanner] = useState<BannerState>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [sender, setSender] = useState<ContactBlock>(emptyContact());
  const [receiver, setReceiver] = useState<ContactBlock>(emptyContact());

  // Step 2
  const [packages, setPackages] = useState<PackageWithItems[]>(() => [emptyPackage(1)]);

  // Step 3
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotes, setQuotes] = useState<RateQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<RateQuote | null>(null);
  const [codEnabled, setCodEnabled] = useState(false);
  const [codAmountIDR, setCodAmountIDR] = useState<string>('');
  const [insuranceEnabled, setInsuranceEnabled] = useState(true);

  // Step 4
  const [pickupDate, setPickupDate] = useState<string>(tomorrowLocalISO());
  const [pickupWindows, setPickupWindows] = useState<PickupWindowOption[]>([]);
  const [pickupWindowsLoading, setPickupWindowsLoading] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [driverNote, setDriverNote] = useState<string>('');

  // Step 5
  const [kaPIN, setKaPIN] = useState<string>('');
  const [kaPINWasUsed, setKaPINWasUsed] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'ka_credit' | 'postpaid' | 'cod'>('postpaid');

  // Prefill from URL query params (navigation from RateCalculator onSelectQuote)
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    if (qp.get('origin_subdistrict_id')) {
      const oid = parseInt(qp.get('origin_subdistrict_id') || '0', 10);
      if (oid > 0) setSender((s) => ({ ...s, subdistrict: s.subdistrict ?? { id: oid, level: 'subdistrict', name: '', parent_id: null, code: 'PREFILL' } }));
    }
    if (qp.get('destination_subdistrict_id')) {
      const did = parseInt(qp.get('destination_subdistrict_id') || '0', 10);
      if (did > 0) setReceiver((r) => ({ ...r, subdistrict: r.subdistrict ?? { id: did, level: 'subdistrict', name: '', parent_id: null, code: 'PREFILL' } }));
    }
    if (qp.get('courier_service_code')) setSelectedQuote((old) => old ?? { courier_service_code: qp.get('courier_service_code') as string } as RateQuote);
    if (qp.get('insurance_enabled') === '1') setInsuranceEnabled(true);
    if (qp.get('cod_amount_idr')) { setCodEnabled(true); setCodAmountIDR(qp.get('cod_amount_idr') as string); }
    if (qp.get('declared_total_value_idr')) {
      // distributes declared into first package first item unit
      setPackages((ps) => {
        if (ps.length === 0) return ps;
        const first = ps[0];
        if (!first.items || first.items.length === 0) return ps;
        const firstItem = first.items[0];
        const copy = [...ps];
        const pkgCopy = { ...first, items: first.items.map((it, i) => i === 0 ? { ...firstItem, unit_value_idr: qp.get('declared_total_value_idr') as string, line_value_idr: qp.get('declared_total_value_idr') as string } : it) };
        copy[0] = pkgCopy;
        return copy;
      });
    }
    const tw = parseInt(qp.get('total_actual_weight_g') || '0', 10);
    if (tw > 0) setPackages((ps) => ps.map((p, i) => i === 0 ? { ...p, actual_weight_g: tw } : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PIN ephemeral discipline — always clear on unload
  useEffect(() => {
    const clear = () => { setKaPIN(''); };
    window.addEventListener('beforeunload', clear);
    return () => { window.removeEventListener('beforeunload', clear); clear(); };
  }, []);

  const steps = [
    { id: 1, title: 'Sender + Recipient', subtitle: 'Contact details · Subdistrict drill-down' },
    { id: 2, title: 'Packages + Items', subtitle: 'Dims/weight · Item line list · Value' },
    { id: 3, title: 'Rate Quote Selection', subtitle: 'Fetch live rates · Pick courier' },
    { id: 4, title: 'Pickup Schedule', subtitle: 'Date/time window · Driver notes' },
    { id: 5, title: 'Review + Submit', subtitle: 'Payment method · PIN (if KA Credit)' },
  ];

  // Validation helpers
  const step1Valid = useMemo(() => (
    !!sender.subdistrict?.id && sender.subdistrict.level === 'subdistrict'
    && !!receiver.subdistrict?.id && receiver.subdistrict.level === 'subdistrict'
    && sender.contact_name.trim().length >= 2 && /\d/.test(sender.contact_phone)
    && receiver.contact_name.trim().length >= 2 && /\d/.test(receiver.contact_phone)
    && sender.address_line.trim().length >= 5 && receiver.address_line.trim().length >= 5
  ), [sender, receiver]);

  const totalActualG = useMemo(() => packages.reduce((s, p) => s + (Number.isFinite(Number(p.actual_weight_g)) ? Number(p.actual_weight_g) : 0), 0), [packages]);
  const declaredSumIDR = useMemo(() => packages.reduce((s, p) => s + (p.items ?? []).reduce((acc, it) => {
    const unit = Number.parseFloat(String(it.unit_value_idr ?? '0')) || 0;
    const qty = Number.isFinite(Number(it.qty)) ? Number(it.qty) : 1;
    return acc + unit * qty;
  }, 0), 0), [packages]);
  const totalItems = useMemo(() => packages.reduce((s, p) => s + (p.items?.length ?? 0), 0), [packages]);
  const step2Valid = useMemo(() => (
    packages.length >= 1 && packages.length <= 20
    && totalActualG >= 10
    && totalItems >= 1 && totalItems <= 50
    && declaredSumIDR > 0
  ), [packages.length, totalActualG, totalItems, declaredSumIDR]);

  const step3Valid = useMemo(() => !!selectedQuote?.courier_service_code, [selectedQuote]);
  const step4Valid = useMemo(() => !!selectedWindowId && /^\d{4}-\d{2}-\d{2}$/.test(pickupDate), [selectedWindowId, pickupDate]);

  const step5Valid = useMemo(() => {
    if (!step1Valid || !step2Valid || !step3Valid || !step4Valid) return false;
    if (paymentMethod === 'ka_credit') {
      if (!/^\d{4,8}$/.test(kaPIN)) return false;
    }
    if (paymentMethod === 'cod') {
      if (!codEnabled || !(Number.parseFloat(codAmountIDR) > 0)) return false;
    }
    return true;
  }, [step1Valid, step2Valid, step3Valid, step4Valid, paymentMethod, kaPIN, codEnabled, codAmountIDR]);

  // Step 3 side-effect: fetch rates when entering step 3 (and data is ready)
  useEffect(() => {
    if (step !== 3) return;
    if (!step1Valid || !step2Valid) {
      setBanner({ tone: 'warning', title: 'Lengkapi Step 1 & Step 2 dulu', body: 'Origin/destination harus level subdistrict, packages minimal 1, weight minimal 10g.' });
      return;
    }
    (async () => {
      setLoadingQuotes(true);
      setBanner(null);
      const originSid = Number(sender.subdistrict?.id ?? 0);
      const destSid = Number(receiver.subdistrict?.id ?? 0);
      const p0 = packages[0];
      const res = await callThirdPLILInternalUI<RateQuote[]>('thirdplil-rates', {
        method: 'GET',
        isMutation: false,
        timeoutMs: 30000,
        query: {
          origin_subdistrict_id: String(originSid),
          destination_subdistrict_id: String(destSid),
          weight_g: String(totalActualG),
          length_cm: String(p0?.length_cm ?? 0),
          width_cm: String(p0?.width_cm ?? 0),
          height_cm: String(p0?.height_cm ?? 0),
          declared_value_idr: String(declaredSumIDR),
          is_insurance_enabled: insuranceEnabled ? '1' : '0',
          cod_amount_idr: codEnabled && declaredSumIDR > 0 ? codAmountIDR || String(declaredSumIDR) : '0',
        },
      });
      setLoadingQuotes(false);
      if (!res.ok) { setBanner(res.banner); return; }
      const arr = Array.isArray(res.data) ? res.data as RateQuote[] : [];
      setQuotes(arr);
      if (arr.length === 0) setBanner({ tone: 'warning', title: 'Rate quotes tidak tersedia untuk route ini', body: 'Coba ubah origin/destination atau cek coverage area via Coverage sync.' });
      else if (res.banner) setBanner(res.banner);
      else if (selectedQuote?.courier_service_code) {
        const match = arr.find((q) => q.courier_service_code === selectedQuote.courier_service_code);
        if (match) setSelectedQuote(match);
        else setBanner({ tone: 'info', title: 'Rate quotes loaded', body: `Pilih salah satu dari ${arr.length} opsi kurir. Quote yang dipilih sebelumnya (${selectedQuote.courier_service_code}) tidak tersedia di route ini.` });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, step1Valid, step2Valid]);

  // Step 4 fetch pickup windows
  useEffect(() => {
    if (step !== 4) return;
    if (!step1Valid) { setBanner({ tone: 'warning', title: 'Isi Step 1 dulu', body: 'Perlu origin subdistrict untuk cari jadwal pickup.' }); return; }
    (async () => {
      setPickupWindowsLoading(true);
      setBanner(null);
      const originSid = Number(sender.subdistrict?.id ?? 0);
      const res = await callThirdPLILInternalUI<PickupWindowOption[]>('thirdplil-schedules/pickup', {
        method: 'GET',
        isMutation: false,
        timeoutMs: 25000,
        query: { origin_subdistrict_id: String(originSid), date_local: pickupDate },
      });
      setPickupWindowsLoading(false);
      if (!res.ok) { setBanner(res.banner); setPickupWindows([]); return; }
      const arr = Array.isArray(res.data) ? res.data as PickupWindowOption[] : [];
      setPickupWindows(arr);
      if (arr.length === 0) setBanner({ tone: 'warning', title: 'Tidak ada jadwal pickup untuk tanggal ini', body: 'Coba ganti tanggal atau hubungkan support KiriminAja / cek libur nasional.' });
      else if (res.banner) setBanner(res.banner);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pickupDate, step1Valid]);

  // Step 2 helpers
  function addPackage() {
    if (packages.length >= 20) { setBanner({ tone: 'danger', title: 'Max 20 packages per shipment', body: 'Kurangi jumlah package atau pisah ke 2 shipment.' }); return; }
    setPackages((ps) => [...ps, emptyPackage(ps.length + 1)]);
  }
  function deletePackage(idx: number) {
    if (packages.length <= 1) { setBanner({ tone: 'warning', title: 'Minimal 1 package', body: '' }); return; }
    setPackages((ps) => ps.filter((_, i) => i !== idx).map((p, i) => ({ ...p, package_seq_no: i + 1 })));
  }
  function updatePackage(idx: number, patch: Partial<PackageWithItems>) {
    setPackages((ps) => ps.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }
  function addItem(pkgIdx: number) {
    setPackages((ps) => ps.map((p, i) => i === pkgIdx ? { ...p, items: [...(p.items ?? []), { name: '', qty: 1, unit_value_idr: '0', line_value_idr: '0', is_fragile: false } as PackageItemRow] } : p));
  }
  function removeItem(pkgIdx: number, itemIdx: number) {
    setPackages((ps) => ps.map((p, i) => i === pkgIdx ? { ...p, items: (p.items ?? []).filter((_, j) => j !== itemIdx) } : p));
  }
  function updateItem(pkgIdx: number, itemIdx: number, patch: Partial<PackageItemRow>) {
    setPackages((ps) => ps.map((p, i) => {
      if (i !== pkgIdx) return p;
      const items = (p.items ?? []).map((it, j) => {
        if (j !== itemIdx) return it;
        const merged = { ...it, ...patch };
        const qty = Number.isFinite(Number(merged.qty)) ? Number(merged.qty) : 1;
        const unit = Number.parseFloat(String(merged.unit_value_idr ?? '0')) || 0;
        merged.line_value_idr = String(qty * unit);
        return merged;
      });
      return { ...p, items };
    }));
  }

  // Step 5 submit
  async function submitCreate() {
    if (!step5Valid) {
      setBanner({ tone: 'warning', title: 'Lengkapi field yang belum', body: 'Semua field wajib kecuali email, hs_code, dan PIN (PIN wajib hanya jika payment=KA Credit).' });
      return;
    }
    setSubmitting(true);
    try {
      const originSid = Number(sender.subdistrict?.id ?? 0);
      const destSid = Number(receiver.subdistrict?.id ?? 0);
      const selectedWin = pickupWindows.find((w) => w.window_id === selectedWindowId) ?? null;
      const payload: CreateShipmentRequest = {
        transaction_id: '',
        credential_id: null,
        provider_slug: 'kiriminaja',
        is_sandbox: false,
        origin_subdistrict_id: originSid,
        destination_subdistrict_id: destSid,
        origin_address_line: sender.address_line,
        origin_contact_name: sender.contact_name,
        origin_contact_phone: sender.contact_phone,
        origin_contact_email: sender.contact_email ?? null,
        destination_address_line: receiver.address_line,
        destination_contact_name: receiver.contact_name,
        destination_contact_phone: receiver.contact_phone,
        destination_contact_email: receiver.contact_email ?? null,
        selected_courier_service_code: selectedQuote!.courier_service_code,
        packages: packages.map((p) => {
          const billed = Math.max(Number(p.actual_weight_g ?? 0), Number(p.volumetric_weight_g ?? 0));
          return {
            package_seq_no: p.package_seq_no,
            actual_weight_g: Number(p.actual_weight_g) || 0,
            length_cm: Number(p.length_cm) || 0,
            width_cm: Number(p.width_cm) || 0,
            height_cm: Number(p.height_cm) || 0,
            volumetric_weight_g: Number(p.volumetric_weight_g) || 0,
            billed_weight_g: Number(p.billed_weight_g) || billed,
            description: p.description ?? null,
            items: (p.items ?? []).map((it) => ({
              sku: it.sku ?? null,
              name: it.name || '(Tanpa nama barang)',
              qty: Number.isFinite(Number(it.qty)) ? Number(it.qty) : 1,
              unit_value_idr: String(it.unit_value_idr ?? '0'),
              line_value_idr: String(it.line_value_idr ?? it.unit_value_idr ?? '0'),
              hs_code: it.hs_code ?? null,
              is_fragile: !!it.is_fragile,
            })),
          };
        }),
        payment_method: paymentMethod,
        ka_credit_pin: paymentMethod === 'ka_credit' ? kaPIN : null,
        is_insurance_enabled: !!insuranceEnabled,
        cod_amount_idr: codEnabled ? codAmountIDR : null,
        declared_value_total_idr: String(declaredSumIDR),
        pickup_window_id: selectedWin?.window_id ?? null,
        pickup_date_local: pickupDate,
        pickup_start_time: selectedWin?.start_time ?? null,
        pickup_end_time: selectedWin?.end_time ?? null,
        pickup_driver_note: driverNote?.trim()?.slice(0, 200) ?? null,
      };
      // remove recursive null PIN just to be safe (already filtered above, belt+suspender)
      if (paymentMethod !== 'ka_credit') {
        delete (payload as unknown as Record<string, unknown>).ka_credit_pin;
      }
      const res = await callThirdPLILInternalUI<{ shipment: ShipmentDetail; is_duplicate: boolean; duplicate_of_id?: number | null }>('thirdplil-shipments', {
        method: 'POST',
        isMutation: true,
        timeoutMs: 60000,
        body: payload as never,
      });
      setBanner(res.banner);
      if (res.ok) {
        const cast = res.data as { shipment: ShipmentDetail; is_duplicate: boolean; duplicate_of_id?: number | null } | null;
        const id = cast?.shipment?.id ?? cast?.duplicate_of_id ?? null;
        const dash = getPathForView('kiriminaja-shipments-dashboard');
        const hash = id ? `#drawer-open-id=${id}` : '';
        setTimeout(() => navigate(dash + (hash ? hash : '')), 800);
        setBanner({
          tone: (cast?.is_duplicate) ? 'info' : 'success',
          title: cast?.is_duplicate ? 'Shipment sudah pernah dibuat (dedup OK)' : 'Shipment berhasil dibuat!',
          body: id ? `ID shipment: ${id}. AWB akan diisi otomatis ketika provider create berhasil. Kamu akan diarahkan ke Dashboard...` : 'Berhasil, mengarahkan ke dashboard...',
        });
      }
    } finally {
      setKaPIN(''); // EPHEMERAL always clear
      setKaPINWasUsed(kaPIN.length >= 4);
      setSubmitting(false);
    }
  }

  function next() {
    if (step === 1 && !step1Valid) { setBanner({ tone: 'warning', title: 'Lengkapi Step 1', body: 'Origin & Destination keduanya harus diisi ke level Subdistrict. Nama, telepon, alamat wajib.' }); return; }
    if (step === 2 && !step2Valid) { setBanner({ tone: 'warning', title: 'Lengkapi Step 2', body: 'Minimal 1 package (weight >= 10g), 1 item, declared total > 0. Max 20 packages / 50 items.' }); return; }
    if (step === 3 && !step3Valid) { setBanner({ tone: 'warning', title: 'Pilih 1 rate quote', body: 'Klik "Pilih" di kolom Action salah satu row rate result table.' }); return; }
    if (step === 4 && !step4Valid) { setBanner({ tone: 'warning', title: 'Pilih jadwal pickup', body: 'Pilih salah satu window pickup (tanggal + waktu) yang available.' }); return; }
    setStep((s) => Math.min(5, s + 1) as StepId);
  }
  function back() { setStep((s) => Math.max(1, s - 1) as StepId); }

  const isStep = (id: StepId) => step === id;
  const isStepDone = (id: StepId) => (id === 1 && step1Valid && step > 1) || (id === 2 && step2Valid && step > 2) || (id === 3 && step3Valid && step > 3) || (id === 4 && step4Valid && step > 4);

  return (
    <div className={STYLES.pageCard}>
      <div className="p-6 space-y-6">
        {banner && (
          <div className={'p-4 rounded-2xl border ' + (
            banner.tone === 'danger' ? STYLES.bannerDanger :
            banner.tone === 'warning' ? STYLES.bannerWarning :
            banner.tone === 'success' ? STYLES.bannerSuccess : STYLES.bannerInfo
          )}>
            <p className="font-semibold text-sm">{banner.title}</p>
            {banner.body && <p className="mt-1 text-xs opacity-90">{banner.body}</p>}
          </div>
        )}

        <nav className="text-xs text-gray-500">
          <Link to={getPathForView('dashboard')} className="hover:text-gray-700 hover:underline">Dashboard</Link>
          <span className="mx-2">›</span>
          <Link to={getPathForView('kiriminaja-shipments-dashboard')} className="hover:text-gray-700 hover:underline">ThirdPLIL / Shipments</Link>
          <span className="mx-2">›</span>
          <span className="font-semibold text-gray-900">Create New Shipment</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Operations · 5-step Wizard</p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">
              <PackageIcon size={20} className="mr-2 inline align-text-bottom" />
              Create New Shipment
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Atomic RPC wrapper: <code className="rounded bg-gray-100 px-1.5 py-0.5">thirdplil_shipment_create_rpc</code> — header + N packages + N items + FSM history in ONE transaction (Strategy-1 dedup).
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={getPathForView('kiriminaja-shipments-dashboard')} className={STYLES.buttonGhost}>
              <ArrowLeft size={14} className="mr-2 inline align-text-top" />
              Cancel
            </Link>
          </div>
        </div>

        {/* Stepper */}
        <ol className="grid gap-4 md:grid-cols-5">
          {steps.map((s) => {
            const id = s.id as StepId;
            const active = isStep(id);
            const done = isStepDone(id);
            return (
              <li key={id} className={
                'rounded-2xl border p-4 cursor-pointer transition ' +
                (active ? 'border-blue-300 bg-blue-50 shadow-sm shadow-blue-100' :
                  done ? 'border-green-200 bg-green-50/40' :
                    'border-gray-200 bg-gray-50')
              } onClick={() => setStep(id)}>
                <div className="flex items-center gap-3">
                  <span className={
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                    (active ? 'bg-blue-600 text-white' :
                      done ? 'bg-green-500 text-white' :
                        'bg-gray-200 text-gray-500')
                  }>
                    {done ? <Check size={14} /> : id}
                  </span>
                  <div className="min-w-0">
                    <p className={'font-semibold text-sm ' + (active ? 'text-blue-900' : done ? 'text-green-800' : 'text-gray-600')}>{s.title}</p>
                    <p className={'text-xs mt-0.5 ' + (active ? 'text-blue-600/90' : 'text-gray-500')}>{s.subtitle}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Step 1 */}
        {isStep(1) && (
          <Section kicker="Step 1 of 5 · Sender and Recipient" title="Enter Address Details" subtitle="All fields required. Subdistrict uses the 4-level cascading drill-down (Province → City → District → Subdistrict).">
            <div className="grid gap-6 lg:grid-cols-2">
              {[
                { who: 'Sender (Origin)', tone: 'info' as const, color: 'blue', data: sender, setData: setSender },
                { who: 'Receiver (Destination)', tone: 'success' as const, color: 'green', data: receiver, setData: setReceiver },
              ].map((side) => (
                <div key={side.who} className={
                  'rounded-2xl border p-5 space-y-4 ' +
                  (side.color === 'blue' ? 'border-blue-200 bg-blue-50/40' : 'border-green-200 bg-green-50/40')
                }>
                  <p className={
                    'text-xs font-semibold uppercase tracking-[0.2em] ' +
                    (side.color === 'blue' ? 'text-blue-600' : 'text-green-600')
                  }>{side.who}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2 md:row-start-1">
                      <label className={STYLES.label}>Full Name <span className="text-red-500">*</span></label>
                      <input className={STYLES.input} placeholder={`${side.who} full name`} value={side.data.contact_name} onChange={(e) => side.setData({ ...side.data, contact_name: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 md:row-start-2">
                      <label className={STYLES.label}>Phone / WhatsApp <span className="text-red-500">*</span></label>
                      <input className={STYLES.input} placeholder="+62 8xx xxxx xxxx" value={side.data.contact_phone} onChange={(e) => side.setData({ ...side.data, contact_phone: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 md:row-start-3">
                      <label className={STYLES.label}>Email (opsional)</label>
                      <input className={STYLES.input} placeholder="email@example.com" value={side.data.contact_email ?? ''} onChange={(e) => side.setData({ ...side.data, contact_email: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 md:row-start-4">
                      <label className={STYLES.label}>Subdistrict (Kecamatan / Kelurahan) <span className="text-red-500">*</span></label>
                      <SubdistrictCoverageLookup
                        level="subdistrict"
                        selectedIds={side.data.subdistrict
                          ? {
                            subdistrict: Number(side.data.subdistrict.id) || null,
                          }
                          : undefined}
                        onSelect={(area) => side.setData({ ...side.data, subdistrict: area })}
                      />
                    </div>
                    <div className="md:col-span-2 md:row-start-5">
                      <label className={STYLES.label}>Street Address <span className="text-red-500">*</span></label>
                      <textarea rows={3} className={STYLES.input} placeholder="Full address (RT/RW, building, unit if any)..." value={side.data.address_line} onChange={(e) => side.setData({ ...side.data, address_line: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div />
              <div className="flex gap-2">
                <button className={STYLES.buttonGhost} disabled onClick={back}><ArrowLeft size={14} className="mr-2 inline align-text-top" />Back (disabled, step 1)</button>
                <button className={STYLES.buttonPrimary} disabled={!step1Valid} onClick={next}>
                  Continue to Packages <ArrowRight size={14} className="ml-2 inline align-text-top" />
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* Step 2 */}
        {isStep(2) && (
          <Section kicker="Step 2 of 5 · Packages & Items" title={`Packages (${packages.length} / 20) · Items (${totalItems} / 50)`} subtitle="Per-package actual/volumetric/billed; per-item declared value auto sum = declared_total_value_idr; fragile flag affects insurance minimum fee. Nilai final dihitung server di shipment_create_rpc (preview disini hanya estimasi client).">
            <div className="grid gap-3 md:grid-cols-3 mb-5">
              <div className={'p-4 rounded-2xl border ' + STYLES.bannerInfo}>
                <Badge tone="info" label="Total Actual Weight" />
                <p className="mt-2 text-2xl font-bold text-blue-700 text-right">{(totalActualG / 1000).toFixed(2)} kg</p>
              </div>
              <div className={'p-4 rounded-2xl border ' + STYLES.bannerWarning}>
                <Badge tone="warning" label="Declared Total (IDR)" />
                <p className="mt-2 text-2xl font-bold text-amber-700 text-right">{formatIDR(declaredSumIDR)}</p>
              </div>
              <div className={'p-4 rounded-2xl border ' + STYLES.bannerSuccess}>
                <Badge tone="success" label="Validation" />
                <p className={'mt-2 text-2xl font-bold text-right ' + (step2Valid ? 'text-green-700' : 'text-red-600')}>{step2Valid ? '✓ PASS' : '✗ LENGKAPI'}</p>
              </div>
            </div>

            <div className="space-y-5">
              {packages.map((pkg, idx) => (
                <div key={pkg.package_seq_no ?? idx} className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-blue-200 bg-blue-100 text-blue-700 px-2 py-1 text-xs inline-flex items-center justify-center"><PackageIcon size={16} /></span>
                      <div>
                        <p className="font-semibold text-gray-900">Package #{pkg.package_seq_no ?? (idx + 1)}</p>
                        <input className="mt-0.5 text-xs text-gray-500 bg-transparent outline-none w-full" placeholder="Description (opsional, e.g. Parcel kosmetik 2 botol)" value={pkg.description ?? ''} onChange={(e) => updatePackage(idx, { description: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge tone="info" label={`Actual ${((pkg.actual_weight_g ?? 0) / 1000).toFixed(2)} kg`} />
                      <input type="number" min={0} className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs" placeholder="weight(g)" value={pkg.actual_weight_g ?? ''} onChange={(e) => updatePackage(idx, { actual_weight_g: Number(e.target.value) || 0 })} />
                      <div className="grid grid-cols-3 gap-1 w-40">
                        {(['length_cm', 'width_cm', 'height_cm'] as const).map((k) => (
                          <input key={k} type="number" min={0} className="rounded border border-gray-200 bg-white px-1.5 py-1 text-[11px]" placeholder={k.slice(0, 1).toUpperCase()} value={(pkg as PackageWithItems)[k] ?? ''} onChange={(e) => updatePackage(idx, { [k]: Number(e.target.value) || 0 } as Partial<PackageWithItems>)} />
                        ))}
                      </div>
                      <button className={STYLES.buttonGhost + ' !px-3 !py-1.5'} onClick={() => deletePackage(idx)}>Delete</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['SKU', 'Nama Barang', 'Qty', 'Unit (IDR)', 'Line (IDR)', 'HS Code', 'Fragile', 'Actions'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(!pkg.items || pkg.items.length === 0) && (
                          <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">Belum ada items. Klik Add Item.</td></tr>
                        )}
                        {(pkg.items ?? []).map((it, iIdx) => (
                          <tr key={iIdx} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2">
                              <input className="w-full text-xs font-mono bg-white rounded border border-gray-200 px-2 py-1" placeholder="SKU-000..." value={it.sku ?? ''} onChange={(e) => updateItem(idx, iIdx, { sku: e.target.value })} />
                            </td>
                            <td className="px-4 py-2">
                              <input className="w-full bg-white rounded border border-gray-200 px-2 py-1" placeholder="Nama barang..." value={it.name} onChange={(e) => updateItem(idx, iIdx, { name: e.target.value })} />
                            </td>
                            <td className="px-4 py-2 w-20">
                              <input type="number" min={1} className="w-full bg-white rounded border border-gray-200 px-2 py-1 text-right" placeholder="1" value={it.qty ?? ''} onChange={(e) => updateItem(idx, iIdx, { qty: Number(e.target.value) || 1 })} />
                            </td>
                            <td className="px-4 py-2 w-36">
                              <input type="number" min={0} className="w-full font-mono bg-white rounded border border-gray-200 px-2 py-1 text-right" placeholder="0" value={it.unit_value_idr ?? ''} onChange={(e) => updateItem(idx, iIdx, { unit_value_idr: e.target.value })} />
                            </td>
                            <td className="px-4 py-2 w-40">
                              <p className="text-right font-mono text-blue-600 font-semibold pr-2">{formatIDR(it.line_value_idr ?? Number.parseFloat(String(it.unit_value_idr ?? '0')) * (Number.isFinite(Number(it.qty)) ? Number(it.qty) : 1))}</p>
                            </td>
                            <td className="px-4 py-2 w-28">
                              <input className="w-full font-mono text-xs bg-white rounded border border-gray-200 px-2 py-1" placeholder="6110.10" value={it.hs_code ?? ''} onChange={(e) => updateItem(idx, iIdx, { hs_code: e.target.value })} />
                            </td>
                            <td className="px-4 py-2 w-20">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={!!it.is_fragile} onChange={(e) => updateItem(idx, iIdx, { is_fragile: e.target.checked })} />
                                <span className={`text-xs ${it.is_fragile ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{it.is_fragile ? 'YES' : 'No'}</span>
                              </label>
                            </td>
                            <td className="px-4 py-2 w-20">
                              <button className={STYLES.buttonGhost + ' !px-2 !py-1 !text-xs'} onClick={() => removeItem(idx, iIdx)}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button className={STYLES.buttonSecondary} onClick={() => addItem(idx)}>+ Add Item</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button className={STYLES.buttonSecondary} disabled={packages.length >= 20} onClick={addPackage}>+ Add Package</button>
              <div className="flex gap-2">
                <button className={STYLES.buttonGhost} onClick={back}><ArrowLeft size={14} className="mr-2 inline align-text-top" />Back</button>
                <button className={STYLES.buttonPrimary} disabled={!step2Valid} onClick={next}>Continue to Rate Quotes <ArrowRight size={14} className="ml-2 inline align-text-top" /></button>
              </div>
            </div>
          </Section>
        )}

        {/* Step 3 */}
        {isStep(3) && (
          <Section kicker="Step 3 of 5 · Rate Quote Selection" title="Courier & Service Selection" subtitle={`Prefilled from URL: ${selectedQuote?.courier_service_code ?? '(none)'} — origin subdistrict=${Number(sender.subdistrict?.id ?? 0)}, dest=${Number(receiver.subdistrict?.id ?? 0)}, totalActual=${totalActualG}g.`}>
            <div className="grid gap-6 md:grid-cols-3 mb-6">
              <div className="md:col-span-2 space-y-4">
                {(!step1Valid || !step2Valid) && (
                  <div className={'p-4 rounded-2xl border ' + STYLES.bannerWarning}>
                    <p className="font-semibold text-sm flex items-center gap-2"><SearchIcon size={16} /> Lengkapi Step 1 & 2 terlebih dahulu.</p>
                    <p className="mt-1 text-xs opacity-90">Kembali ke Step 1 (origin/dest subdistrict) & Step 2 (packages weight & items declared value).</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className={STYLES.label}>COD enabled?</label>
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <input type="checkbox" checked={codEnabled} onChange={(e) => setCodEnabled(e.target.checked)} />
                      <span className="text-sm">Enable COD</span>
                    </label>
                  </div>
                  {codEnabled && (
                    <div>
                      <label className={STYLES.label}>COD amount (IDR)</label>
                      <input type="number" min={0} className={STYLES.input} placeholder="0" value={codAmountIDR || declaredSumIDR || ''} onChange={(e) => setCodAmountIDR(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label className={STYLES.label}>Insurance?</label>
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <input type="checkbox" checked={insuranceEnabled} onChange={(e) => setInsuranceEnabled(e.target.checked)} />
                      <span className="text-sm">{insuranceEnabled ? 'Aktif (fee IDR via courier)' : 'Tidak aktif'}</span>
                    </label>
                  </div>
                  <button className={STYLES.buttonSecondary} onClick={() => setStep(3)} disabled={loadingQuotes || !step1Valid || !step2Valid}>
                    {loadingQuotes ? <><Loader2 size={14} className="inline animate-spin mr-2 align-text-top" />Loading…</> : <><Info size={14} className="inline mr-2 align-text-top" />Refresh Rates</>}
                  </button>
                </div>
                <RateResultsTable
                  quotes={quotes}
                  selectedServiceCode={selectedQuote?.courier_service_code ?? null}
                  onSelectQuote={(q) => setSelectedQuote(q)}
                  showSurchargeBreakdown
                />
              </div>
              <div className="space-y-5">
                <div className={'rounded-2xl border p-5 ' + STYLES.bannerInfo}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Selection</p>
                  {selectedQuote && (
                    <>
                      <h3 className="mt-2 text-lg font-bold text-gray-900">{selectedQuote.courier_service_name || selectedQuote.courier_service_code}</h3>
                      <p className="mt-1 text-xs text-gray-500">Courier service code: <code className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-900">{selectedQuote.courier_service_code}</code></p>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Base fee:</span><span className="font-mono">{formatIDR(selectedQuote.base_fee_idr ?? 0)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Insurance:</span><span className="font-mono">{formatIDR(selectedQuote.insurance_fee_idr ?? 0)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">COD admin fee:</span><span className="font-mono">{formatIDR(selectedQuote.cod_fee_idr ?? 0)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Platform fee:</span><span className="font-mono">{formatIDR(selectedQuote.platform_service_fee_idr ?? 0)}</span></div>
                        <div className="border-t border-gray-200 my-2" />
                        <div className="flex justify-between items-center"><span className="font-bold text-gray-900">GRAND TOTAL:</span><span className="text-xl font-bold text-green-700 font-mono">{formatIDR(selectedQuote.grand_total_idr ?? 0)}</span></div>
                        {(selectedQuote.etd_days_min !== undefined && selectedQuote.etd_days_max !== undefined) && (
                          <div className="flex justify-between"><span className="text-gray-500">ETA:</span><span className="font-semibold text-sm">{selectedQuote.etd_days_min} — {selectedQuote.etd_days_max} hari</span></div>
                        )}
                      </div>
                      <div className="mt-5 flex gap-2">
                        <Link to={getPathForView('kiriminaja-rate-calculator')} className={STYLES.buttonGhost} target="_blank" rel="noopener noreferrer">
                          ↗ Open RateCalc for full comparison
                        </Link>
                      </div>
                    </>
                  )}
                  {!selectedQuote && (
                    <p className="mt-4 text-sm text-gray-500">Pilih salah satu row di table Rate Results (klik Action → Pilih).</p>
                  )}
                </div>
                <div className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500">
                  <p className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Declared</p>
                  <div className="flex justify-between"><span>Total Actual:</span><span className="font-mono font-semibold">{(totalActualG / 1000).toFixed(2)} kg</span></div>
                  <div className="flex justify-between"><span>Declared value:</span><span className="font-mono font-semibold">{formatIDR(declaredSumIDR)}</span></div>
                  <div className="flex justify-between"><span>COD amount:</span><span className="font-mono font-semibold">{codEnabled ? formatIDR(codAmountIDR || declaredSumIDR) : '(tidak aktif)'}</span></div>
                  <div className="flex justify-between"><span>Insurance:</span><span className="font-semibold">{insuranceEnabled ? '✓' : '—'}</span></div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div />
              <div className="flex gap-2">
                <button className={STYLES.buttonGhost} onClick={back}><ArrowLeft size={14} className="mr-2 inline align-text-top" />Back</button>
                <button className={STYLES.buttonPrimary} disabled={!step3Valid} onClick={next}>Continue to Pickup Schedule <ArrowRight size={14} className="ml-2 inline align-text-top" /></button>
              </div>
            </div>
          </Section>
        )}

        {/* Step 4 */}
        {isStep(4) && (
          <Section kicker="Step 4 of 5 · Pickup Schedule" title={`Pickup window for ${pickupDate}`} subtitle="Window availability depends on origin subdistrict & calendar. CUT OFF times display per window — past cut off = otomatis disabled gray.">
            <div className="mb-5 grid gap-4 md:grid-cols-3">
              <div>
                <label className={STYLES.label}>Pickup Date</label>
                <input type="date" min={tomorrowLocalISO()} className={STYLES.input} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
              </div>
              <div>
                <label className={STYLES.label}>Driver note (opsional, ≤200 karakter)</label>
                <input className={STYLES.input} placeholder="Contoh: Gate belakang, tanya security Pak Dayat" maxLength={200} value={driverNote} onChange={(e) => setDriverNote(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button className={STYLES.buttonSecondary} onClick={() => { setStep(4); setPickupWindows([]); }} disabled={pickupWindowsLoading}>
                  {pickupWindowsLoading ? <><Loader2 size={14} className="inline animate-spin mr-2 align-text-top" />Loading…</> : <>↻ Refresh jadwal</>}
                </button>
              </div>
            </div>

            {pickupWindowsLoading && (
              <div className={'p-4 rounded-2xl border mb-4 ' + STYLES.bannerInfo}>
                <p className="font-semibold text-sm flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Memuat jadwal pickup dari KiriminAja / Edge endpoint thirdplil-schedules/pickup...</p>
              </div>
            )}

            {pickupWindows.length > 0 && (
              <SubTabs
                tabs={[
                  { id: 'grid', label: `Grid Available (${pickupWindows.filter(w => w.status === 'available').length})` },
                  { id: 'all', label: `All Windows (${pickupWindows.length})` },
                ]}
                active="grid"
                setActive={() => {}}
              />
            )}
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(window.location.hash.includes('all=true') ? pickupWindows : pickupWindows.filter((w) => w.status === 'available').length > 0 ? pickupWindows.filter((w) => w.status === 'available') : pickupWindows).map((w) => {
                const disabled = w.status !== 'available';
                const selected = w.window_id === selectedWindowId;
                return (
                  <label key={w.window_id} className={
                    'block rounded-2xl border p-4 cursor-pointer transition ' +
                    (disabled ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' :
                      selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' :
                        'border-gray-200 bg-white hover:bg-gray-50/60')
                  }>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-900">{w.start_time} – {w.end_time}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Window ID: <code className="font-mono text-gray-600 bg-gray-100 rounded px-1">{w.window_id.slice(0, 16)}{w.window_id.length > 16 ? '…' : ''}</code></p>
                      </div>
                      <Badge tone={disabled ? 'neutral' : (selected ? 'info' : 'success')} label={disabled ? w.status : (selected ? 'Selected' : 'Available')} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {w.cut_off_time_local && <Badge tone="warning" label={`Cut-off: ${w.cut_off_time_local}`} />}
                      {w.capacity_remaining_pct !== null && w.capacity_remaining_pct !== undefined && (
                        <Badge tone={Number(w.capacity_remaining_pct) < 20 ? 'danger' : 'info'} label={`Sisa slot ${w.capacity_remaining_pct}%`} />
                      )}
                      {w.fee_idr && <Badge tone="success" label={`Fee ${formatIDR(w.fee_idr)}`} />}
                      {w.driver_note_max_chars !== null && w.driver_note_max_chars !== undefined && (
                        <Badge tone="neutral" label={`Note max ${w.driver_note_max_chars} karakter`} />
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div />
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="pickup" disabled={disabled} checked={selected} onChange={() => setSelectedWindowId(w.window_id)} />
                        <span className="text-xs text-gray-700">{disabled ? 'Tidak available' : (selected ? 'Dipilih ✓' : 'Pilih window ini')}</span>
                      </label>
                    </div>
                  </label>
                );
              })}
            </div>
            {!pickupWindowsLoading && pickupWindows.length === 0 && (
              <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
                <SearchIcon size={28} className="mx-auto mb-3 opacity-60" />
                Tidak ada jadwal untuk tanggal ini. Coba ganti tanggal / cek sync coverage credentials di menu Admin Coverage Sync.
              </div>
            )}

            <div className="mt-10 flex items-center justify-between">
              <div />
              <div className="flex gap-2">
                <button className={STYLES.buttonGhost} onClick={back}><ArrowLeft size={14} className="mr-2 inline align-text-top" />Back</button>
                <button className={STYLES.buttonPrimary} disabled={!step4Valid} onClick={next}>Continue to Review & Submit <ArrowRight size={14} className="ml-2 inline align-text-top" /></button>
              </div>
            </div>
          </Section>
        )}

        {/* Step 5 */}
        {isStep(5) && (
          <Section kicker="Step 5 of 5 · Review & Submit" title="Final validation before atomic RPC create" subtitle="Payment method: Postpaid (invoiced weekly), KA Credit (PIN 6 digit ephemeral), COD (cash on delivery to buyer). PIN ephemeral — state cleared immediately on submit success/fail or tab close.">
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              {[
                { title: 'Origin · Sender', tone: 'info' as const, block: sender },
                { title: 'Destination · Receiver', tone: 'success' as const, block: receiver },
              ].map((card) => (
                <div key={card.title} className={'rounded-2xl border p-5 ' + (card.tone === 'info' ? 'border-blue-200 bg-blue-50/40' : 'border-green-200 bg-green-50/40')}>
                  <Badge tone={card.tone} label={card.title} />
                  <p className="mt-2 font-semibold text-gray-900">{card.block.contact_name || '(Name empty)'}</p>
                  <p className="mt-0.5 text-xs text-gray-500">📱 {card.block.contact_phone || '—'}{card.block.contact_email ? ` · ✉ ${card.block.contact_email}` : ''}</p>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{card.block.address_line || '(Alamat empty)'}</p>
                  <p className="mt-2 text-xs text-gray-500">Subdistrict ID: {card.block.subdistrict?.id ?? '(belum dipilih)'}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className={'rounded-2xl border p-5 ' + STYLES.bannerInfo}>
                <Badge tone="info" label="Packages" />
                <p className="mt-2 text-2xl font-bold text-right text-blue-700">{packages.length}</p>
                <p className="mt-1 text-xs text-gray-500 text-right">{totalItems} items total · Actual {(totalActualG / 1000).toFixed(2)} kg</p>
              </div>
              <div className={'rounded-2xl border p-5 ' + STYLES.bannerWarning}>
                <Badge tone="warning" label="Declared / COD" />
                <p className="mt-2 text-xl font-bold text-right text-amber-700">{formatIDR(declaredSumIDR)}</p>
                <p className="mt-1 text-xs text-gray-500 text-right">{codEnabled ? `COD amount: ${formatIDR(codAmountIDR || declaredSumIDR)}` : 'COD tidak aktif'}</p>
              </div>
              <div className={'rounded-2xl border p-5 ' + STYLES.bannerSuccess}>
                <Badge tone="success" label="Selected Quote" />
                <p className="mt-2 text-lg font-bold text-right text-green-700">{selectedQuote?.courier_service_code ?? '(none)'}</p>
                <p className="mt-1 text-xs text-gray-500 text-right truncate">{selectedQuote?.courier_service_name ?? ''}</p>
                <p className="mt-1 text-right text-sm font-mono font-semibold">{formatIDR(selectedQuote?.grand_total_idr ?? 0)}</p>
              </div>
              <div className={'rounded-2xl border p-5 ' + STYLES.bannerInfo}>
                <Badge tone="info" label="Pickup" />
                <p className="mt-2 text-lg font-bold text-right text-gray-900">{pickupDate}</p>
                <p className="mt-1 text-xs text-gray-500 text-right">
                  {pickupWindows.find((w) => w.window_id === selectedWindowId)
                    ? `${pickupWindows.find((w) => w.window_id === selectedWindowId)!.start_time} – ${pickupWindows.find((w) => w.window_id === selectedWindowId)!.end_time}`
                    : '(window not chosen)'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 space-y-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">Payment Method</p>
              <SubTabs tabs={[
                { id: 'postpaid', label: 'Postpaid (invoice mingguan)' },
                { id: 'ka_credit', label: 'KA Credit (PIN)' },
                { id: 'cod', label: 'COD (tunai ke pembeli)' },
              ]} active={paymentMethod} setActive={(id) => setPaymentMethod(id as 'postpaid' | 'ka_credit' | 'cod')} />

              {paymentMethod === 'ka_credit' && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Lock size={18} className="mt-0.5 flex-shrink-0 text-purple-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-purple-900">Masukkan KA Credit PIN (6 digit, EPHEMERAL)</p>
                      <p className="mt-1 text-xs text-purple-800 opacity-90">PIN TIDAK PERNAH disimpan di database / tidak pernah di-log. Dihapus dari React state di finally block setelah API call return (success/failure), dan dihapus ketika user menutup tab window.</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <label className={STYLES.label}>PIN (4-8 digit) <span className="text-red-500">*</span></label>
                      <input type="password" maxLength={8} pattern="[0-9]*" inputMode="numeric" className={STYLES.input} placeholder="••••••" value={kaPIN} onChange={(e) => setKaPIN(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                    </div>
                    <div className="flex items-end">
                      <button
                        className={STYLES.buttonSecondary}
                        onClick={async () => {
                          const res = await callThirdPLILInternalUI<{ ok: boolean; balance_after_idr?: string | null }>('thirdplil-admin-ka-credit/validate-pin', { method: 'POST', isMutation: true, body: { ka_credit_pin: kaPIN, env: 'production' } });
                          setBanner(res.banner);
                        }}
                        disabled={!/^\d{4,8}$/.test(kaPIN)}
                      >↻ Test PIN (opsional)</button>
                    </div>
                  </div>
                  {kaPINWasUsed && (
                    <p className="text-xs text-green-700 font-semibold">✓ PIN berhasil diverifikasi — hanya boolean flag ka_pin_was_used yang disimpan di audit.</p>
                  )}
                </div>
              )}

              {paymentMethod === 'cod' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-2">
                  <p className="font-semibold text-sm text-amber-900">COD amount & declaration</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className={STYLES.label}>Amount (IDR) <span className="text-red-500">*</span></label>
                      <input type="number" className={STYLES.input} value={codAmountIDR || declaredSumIDR} onChange={(e) => setCodAmountIDR(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs text-gray-600">Kurir mengumpulkan uang ini dari pembeli saat delivery. Declared total: <span className="font-mono font-semibold">{formatIDR(declaredSumIDR)}</span>.</p>
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'postpaid' && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="font-semibold text-sm text-gray-900">Invoice mingguan KiriminAja (Postpaid)</p>
                  <p className="mt-1 text-xs text-gray-600">Total biaya shipment akan ditagihkan otomatis ke email KA credit setiap Minggu pagi WIB. Pastikan credit balance mencukupi di akhir minggu. PIN tidak dibutuhkan di mode ini.</p>
                </div>
              )}
            </div>

            <div className="mt-10 flex items-center justify-between border-t border-gray-200 pt-5 sticky bottom-0 bg-white z-10">
              <div className="text-sm text-gray-500">
                Step state: <code className="rounded bg-gray-100 px-1.5 py-0.5">{step}/5</code> · Validation: <code className="rounded bg-gray-100 px-1.5 py-0.5">{step5Valid ? '✓ VALID' : '✗ INVALID'}</code>
              </div>
              <div className="flex gap-2">
                <button className={STYLES.buttonGhost} onClick={back} disabled={submitting}><ArrowLeft size={14} className="mr-2 inline align-text-top" />Back</button>
                <button className={STYLES.buttonPrimary} disabled={!step5Valid || submitting} onClick={submitCreate}>
                  {submitting ? <><Loader2 size={14} className="inline animate-spin mr-2 align-text-top" />Processing…</> : <><Save size={14} className="inline mr-2 align-text-top" />Submit & Create Shipment</>}
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* PIN reminder banner (sticky bottom if ka_credit not yet cleared) */}
        <div className="h-10" />
      </div>
    </div>
  );
}
