import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calculator, ChevronRight, Info, Loader2, Package } from 'lucide-react';
import { STYLES, Section, Badge } from '../../components/ui/STYLES.tsx';
import { getPathForView } from '../../app-routes.ts';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi.ts';
import SubdistrictCoverageLookup from '../../components/thirdplil/SubdistrictCoverageLookup.tsx';
import RateResultsTable from '../../components/thirdplil/RateResultsTable.tsx';
import type { BannerMessage, RateQuote, ThirdPLILCoverageArea } from '../../types/thirdplil.ts';

export default function RateCalculatorView() {
  const navigate = useNavigate();
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [origin, setOrigin] = useState<ThirdPLILCoverageArea | null>(null);
  const [destination, setDestination] = useState<ThirdPLILCoverageArea | null>(null);
  const [weightKg, setWeightKg] = useState<number>(1);
  const [lengthCm, setLengthCm] = useState<number | null>(20);
  const [widthCm, setWidthCm] = useState<number | null>(15);
  const [heightCm, setHeightCm] = useState<number | null>(10);
  const [declaredValueJt, setDeclaredValueJt] = useState<number>(0.5);
  const [codAmountJt, setCodAmountJt] = useState<number>(0);
  const [useInsurance, setUseInsurance] = useState(true);
  const [useCod, setUseCod] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [quotes, setQuotes] = useState<RateQuote[]>([]);

  // Kecamatan (district) is a valid final level — kelurahan is optional. The backend
  // resolves either level to the provider kecamatan id, so both are accepted here.
  const isFinalLevel = (a: ThirdPLILCoverageArea | null) => a?.level === 'district' || a?.level === 'subdistrict';
  const canFetch = useMemo(
    () => !!origin && !!destination && isFinalLevel(origin) && isFinalLevel(destination) && weightKg >= 0.01,
    [origin, destination, weightKg]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('origin_subdistrict_id') && params.get('destination_subdistrict_id')) {
      const o = parseInt(params.get('origin_subdistrict_id')!, 10);
      const d = parseInt(params.get('destination_subdistrict_id')!, 10);
      if (!Number.isNaN(o)) setOrigin({ id: o, level: 'subdistrict', parent_id: null, code: 'ORI', name: params.get('origin_name') ?? `Origin #${o}`, full_path: null });
      if (!Number.isNaN(d)) setDestination({ id: d, level: 'subdistrict', parent_id: null, code: 'DES', name: params.get('destination_name') ?? `Destination #${d}`, full_path: null });
      const wt = parseFloat(params.get('weight_kg') ?? '');
      if (!Number.isNaN(wt)) setWeightKg(wt);
    }
  }, []);

  const fetchRates = async () => {
    if (!canFetch || !origin || !destination) return;
    setFetching(true);
    setBanner(null);
    const r = await callThirdPLILInternalUI<RateQuote[]>('thirdplil-rates', {
      method: 'GET',
      query: {
        origin_subdistrict_id: origin.id,
        destination_subdistrict_id: destination.id,
        weight_g: Math.max(1, Math.round(weightKg * 1000)),
        length_cm: lengthCm ?? null,
        width_cm: widthCm ?? null,
        height_cm: heightCm ?? null,
        declared_value_idr: Math.round(declaredValueJt * 1_000_000),
        cod_amount_idr: useCod ? Math.round(codAmountJt * 1_000_000) : 0,
      },
    });
    setFetching(false);
    if (r.ok) {
      const d = (r.data ?? []) as RateQuote[];
      setQuotes(d);
      setBanner({
        tone: r.isDuplicate ? 'info' : 'success',
        title: `${d.length} rate quotes received${r.isDuplicate ? ' (dedup response)' : ''}.`,
        body: d.length === 0
          ? 'Tidak ada quote untuk rute ini — periksa origin/destination kelurahan / coba dimensi lain.'
          : (r.warnings ?? []).join('\n') || `Klik Pilih Service → akan otomatis lanjut ke Wizard ShipmentCreate dengan ${origin.name} → ${destination.name} pre-filled.`,
      });
    } else {
      setBanner(r.banner);
    }
  };

  const onSelectQuote = (q: RateQuote) => {
    const params = new URLSearchParams({
      origin_subdistrict_id: String(origin?.id ?? ''),
      destination_subdistrict_id: String(destination?.id ?? ''),
      origin_level: origin?.level ?? '',
      destination_level: destination?.level ?? '',
      origin_name: origin?.name ?? '',
      destination_name: destination?.name ?? '',
      weight_kg: String(weightKg),
      length_cm: String(lengthCm ?? ''),
      width_cm: String(widthCm ?? ''),
      height_cm: String(heightCm ?? ''),
      declared_value_idr: String(Math.round(declaredValueJt * 1_000_000)),
      declared_total_value_idr: String(Math.round(declaredValueJt * 1_000_000)),
      cod_amount_idr: useCod ? String(Math.round(codAmountJt * 1_000_000)) : '',
      is_insurance_enabled: useInsurance ? '1' : '0',
      insurance_enabled: useInsurance ? '1' : '0',
      courier_service_code: q.courier_service_code,
      courier_service_name: q.courier_service_name,
      base_fee_idr: q.base_fee_idr,
      grand_total_idr: q.grand_total_idr,
      credential_id: String(q.provider_credential_id ?? q.credential_id ?? ''),
      is_sandbox: q.is_sandbox ? '1' : '0',
    });
    navigate(`${getPathForView('kiriminaja-shipments-create')}?${params.toString()}`);
  };

  return (
    <div className={STYLES.pageCard}>
      <div className="p-6 space-y-6">
        <div className={STYLES.bannerInfo}>
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">View LIVE · Rate Calculator (Both Paths A + B)</p>
              <p className="mt-1 text-sm opacity-90">
                Real call ke <code className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900 text-xs">thirdplil-rates</code> Edge → KA adapter <code className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900 text-xs">/rates/price</code>. Select quote → auto-jump Wizard dengan params pre-filled.
              </p>
            </div>
          </div>
        </div>

        <nav className="text-xs text-gray-500">
          <Link to={getPathForView('dashboard')} className="hover:text-gray-700 hover:underline">Dashboard</Link>
          <span className="mx-2">›</span>
          <span className="font-semibold text-gray-700">Tools</span>
          <span className="mx-2">›</span>
          <span className="font-semibold text-gray-900">Rate Calculator</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Tools · Logistics</p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">
              <Calculator size={20} className="mr-2 inline align-text-bottom" />
              Rate Calculator
            </h2>
            <p className="mt-1 text-sm text-gray-500">Pilih Origin & Destination (sampai Kelurahan level), isi dimensi paket → Fetch Rates.</p>
          </div>
          <button
            onClick={() => void fetchRates()}
            disabled={!canFetch || fetching}
            className={STYLES.buttonPrimary + ' disabled:opacity-60 disabled:cursor-not-allowed'}
          >
            {fetching ? <Loader2 size={15} className="mr-2 inline align-text-top animate-spin" /> : <Calculator size={15} className="mr-2 inline align-text-top" />}
            {fetching ? 'Fetching Quotes...' : 'Fetch Rates'}
          </button>
        </div>

        {banner && (
          <div className={
            banner.tone === 'success' ? STYLES.bannerSuccess :
            banner.tone === 'warning' ? STYLES.bannerWarning :
            banner.tone === 'danger' ? STYLES.bannerDanger : STYLES.bannerInfo
          }>
            <div className="flex items-start gap-3">
              <Info size={18} className="mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{banner.title}</p>
                {banner.body && <p className="mt-1 text-sm opacity-90 whitespace-pre-wrap">{banner.body}</p>}
              </div>
            </div>
          </div>
        )}

        <Section kicker="2-Column Layout" title="2/5 = Form Inputs · 3/5 = RateResultsTable" subtitle="Kedua column dapat scroll independen. Select quote lanjut ke Wizard ShipmentCreate.">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-gray-200 p-4 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold flex items-center gap-2 text-xs uppercase tracking-wider text-blue-700">📍 Origin (Pengirim) — Kecamatan/Kelurahan</p>
                  {origin && <Badge tone="info" label={(origin.name ?? '') + (origin.id ? ` #${origin.id}` : '')} />}
                </div>
                <SubdistrictCoverageLookup
                  level="subdistrict"
                  showSearchBar
                  selectedIds={origin ? { province: null, city: null, district: null, subdistrict: origin.id } : undefined}
                  onSelect={(a) => setOrigin(a)}
                />
              </div>
              <div className="rounded-2xl border border-gray-200 p-4 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold flex items-center gap-2 text-xs uppercase tracking-wider text-green-700">🎯 Destination (Penerima) — Kecamatan/Kelurahan</p>
                  {destination && <Badge tone="success" label={(destination.name ?? '') + (destination.id ? ` #${destination.id}` : '')} />}
                </div>
                <SubdistrictCoverageLookup
                  level="subdistrict"
                  showSearchBar
                  selectedIds={destination ? { province: null, city: null, district: null, subdistrict: destination.id } : undefined}
                  onSelect={(a) => setDestination(a)}
                />
              </div>

              <div className="rounded-2xl border border-gray-200 p-5 space-y-4">
                <p className="font-semibold flex items-center gap-2 text-gray-900"><Package size={16} /> Package Dimension & Fees</p>
                <div className="grid grid-cols-4 gap-3">
                  <label className="block col-span-4 sm:col-span-1">
                    <span className="block text-xs font-semibold text-gray-600 mb-1">Weight (kg)</span>
                    <input type="number" step="0.1" min="0.01" className={STYLES.input} value={weightKg} onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)} />
                  </label>
                  <label className="block col-span-1">
                    <span className="block text-xs font-semibold text-gray-600 mb-1">P (cm)</span>
                    <input type="number" className={STYLES.input} value={lengthCm ?? ''} onChange={(e) => setLengthCm(e.target.value ? parseFloat(e.target.value) : null)} />
                  </label>
                  <label className="block col-span-1">
                    <span className="block text-xs font-semibold text-gray-600 mb-1">L (cm)</span>
                    <input type="number" className={STYLES.input} value={widthCm ?? ''} onChange={(e) => setWidthCm(e.target.value ? parseFloat(e.target.value) : null)} />
                  </label>
                  <label className="block col-span-1">
                    <span className="block text-xs font-semibold text-gray-600 mb-1">T (cm)</span>
                    <input type="number" className={STYLES.input} value={heightCm ?? ''} onChange={(e) => setHeightCm(e.target.value ? parseFloat(e.target.value) : null)} />
                  </label>
                  <label className="block col-span-1">
                    <span className="block text-xs font-semibold text-gray-600 mb-1">Declared (Jt IDR)</span>
                    <input type="number" step="0.1" className={STYLES.input} value={declaredValueJt} onChange={(e) => setDeclaredValueJt(parseFloat(e.target.value) || 0)} />
                  </label>
                </div>
                <div className="grid md:grid-cols-2 gap-3 items-end">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={useInsurance} onChange={(e) => setUseInsurance(e.target.checked)} className="mt-1" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Enable Insurance</p>
                      <p className="text-xs text-gray-500">Persentase dari declared value + min fee per courier_services_cache.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={useCod} onChange={(e) => setUseCod(e.target.checked)} className="mt-1" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-700">Cash On Delivery</p>
                      <input type="number" step="0.1" disabled={!useCod} className={STYLES.input + ' mt-1 disabled:opacity-60'} placeholder="COD Amount (Jt IDR)" value={codAmountJt} onChange={(e) => setCodAmountJt(parseFloat(e.target.value) || 0)} />
                    </div>
                  </label>
                </div>
                <div className={'p-3 rounded-xl text-xs ' + STYLES.bannerInfo}>
                  <p className="font-semibold">💡 Credit / COD cutoff notes</p>
                  <p className="mt-1 opacity-90">KiriminAja: COD fee ~1–3% (tergantung courier). Gunakan Wizard Step 5 untuk input PIN 6 digit (ka_credit_pin EPHEMERAL, tidak tersimpan / tidak di-log).</p>
                </div>
                <button
                  onClick={() => void fetchRates()}
                  disabled={!canFetch || fetching}
                  className={STYLES.buttonPrimary + ' w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed'}
                >
                  {fetching ? <Loader2 size={15} className="mr-2 inline align-text-top animate-spin" /> : <Calculator size={15} className="mr-2 inline align-text-top" />}
                  {fetching ? 'Fetching...' : 'Get Rate Quotes'}
                  <ChevronRight size={16} className="ml-2 inline align-text-bottom" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              {fetching ? (
                <div className="rounded-2xl border border-gray-200 p-10 text-center">
                  <Loader2 size={24} className="mx-auto mb-3 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-500">Menghubungi provider KiriminAja...</p>
                </div>
              ) : (
                <RateResultsTable
                  quotes={quotes}
                  onSelectQuote={onSelectQuote}
                  showSurchargeBreakdown
                />
              )}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
