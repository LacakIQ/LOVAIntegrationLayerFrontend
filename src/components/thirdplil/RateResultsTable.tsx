import { useState } from 'react';
import { ChevronDown, CheckCircle2, Clock, Flame, Info, Truck } from 'lucide-react';
import { STYLES, Section, Badge } from '../ui/STYLES.tsx';
import type { CourierServiceTier, RateQuote } from '../../types/thirdplil.ts';

export interface RateResultsTableProps {
  quotes: RateQuote[];
  onSelectQuote?: (quote: RateQuote) => void;
  selectedServiceCode?: string | null;
  showSurchargeBreakdown?: boolean;
}

function toneForTier(tier: CourierServiceTier) {
  switch (tier) {
    case 'same_day': return { tone: 'danger' as const, label: 'Same Day', ico: <Flame size={12} className="inline mr-1 align-text-top" /> };
    case 'next_day': return { tone: 'warning' as const, label: 'Next Day', ico: <Clock size={12} className="inline mr-1 align-text-top" /> };
    case 'express': return { tone: 'success' as const, label: 'Express', ico: <Truck size={12} className="inline mr-1 align-text-top" /> };
    case 'regular': return { tone: 'info' as const, label: 'Reguler', ico: null };
    case 'economy': return { tone: 'neutral' as const, label: 'Economy', ico: null };
    case 'cargo': return { tone: 'warning' as const, label: 'Cargo', ico: null };
    case 'international': return { tone: 'info' as const, label: 'Intl', ico: null };
    default: return { tone: 'neutral' as const, label: tier, ico: null };
  }
}

function idr(s: string | null | undefined): string {
  if (!s) return 'Rp 0';
  const n = typeof s === 'string' ? parseFloat(s.replace(/[^0-9.]/g, '')) || 0 : Number(s);
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
}

const sampleQuotes: RateQuote[] = [
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'jne', courier_service_code: 'jne:REG', courier_service_name: 'JNE Reguler', service_tier: 'regular', etd_days_min: 2, etd_days_max: 4, billed_weight_g: 1200, base_fee_idr: '12000', insurance_fee_idr: '3500', cod_fee_idr: '2000', grand_total_idr: '17500', supports_cod: true, supports_insurance: true, can_pickup_today: true },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'jne', courier_service_code: 'jne:YES', courier_service_name: 'JNE Yakin Esok Sampai', service_tier: 'express', etd_days_min: 1, etd_days_max: 1, billed_weight_g: 1200, base_fee_idr: '18500', insurance_fee_idr: '3500', cod_fee_idr: '2000', grand_total_idr: '24000', supports_cod: true, supports_insurance: true, can_pickup_today: false },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'jnt', courier_service_code: 'jnt:REG', courier_service_name: 'J&T Reguler', service_tier: 'regular', etd_days_min: 2, etd_days_max: 3, billed_weight_g: 1200, base_fee_idr: '12500', insurance_fee_idr: '3500', cod_fee_idr: '2000', grand_total_idr: '18000', supports_cod: true, supports_insurance: true, can_pickup_today: true },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'sicepat', courier_service_code: 'sicepat:EKONOMI', courier_service_name: 'SiCepat Ekonomi', service_tier: 'economy', etd_days_min: 3, etd_days_max: 6, billed_weight_g: 1200, base_fee_idr: '9500', insurance_fee_idr: '3000', cod_fee_idr: '2000', grand_total_idr: '14500', supports_cod: true, supports_insurance: true, can_pickup_today: true },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'sicepat', courier_service_code: 'sicepat:SIUNTUNG', courier_service_name: 'SiCepat SiUntung (Next-Day)', service_tier: 'next_day', etd_days_min: 1, etd_days_max: 1, billed_weight_g: 1200, base_fee_idr: '19000', insurance_fee_idr: '3500', cod_fee_idr: '2000', grand_total_idr: '24500', supports_cod: true, supports_insurance: true, can_pickup_today: false },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'gojek', courier_service_code: 'gojek:SAMEDAY', courier_service_name: 'GoSend Sameday Instant', service_tier: 'same_day', etd_days_min: 0, etd_days_max: 0, billed_weight_g: 1200, base_fee_idr: '32000', insurance_fee_idr: '4000', cod_fee_idr: '3000', grand_total_idr: '39000', supports_cod: true, supports_insurance: true, can_pickup_today: true },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'anteraja', courier_service_code: 'anteraja:SD', courier_service_name: 'AnterAja Sameday', service_tier: 'same_day', etd_days_min: 0, etd_days_max: 0, billed_weight_g: 1200, base_fee_idr: '28500', insurance_fee_idr: '4000', cod_fee_idr: '3000', grand_total_idr: '35500', supports_cod: true, supports_insurance: true, can_pickup_today: true },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'wahana', courier_service_code: 'wahana:REG', courier_service_name: 'Wahana Prestasi Logistik Reg', service_tier: 'regular', etd_days_min: 3, etd_days_max: 5, billed_weight_g: 1200, base_fee_idr: '11000', insurance_fee_idr: '3000', cod_fee_idr: '1800', grand_total_idr: '15800', supports_cod: true, supports_insurance: true, can_pickup_today: true },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'sap', courier_service_code: 'sap:EXPRESS', courier_service_name: 'SAP Express', service_tier: 'express', etd_days_min: 1, etd_days_max: 2, billed_weight_g: 1200, base_fee_idr: '19500', insurance_fee_idr: '3500', cod_fee_idr: '2000', grand_total_idr: '25000', supports_cod: true, supports_insurance: true, can_pickup_today: false },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'jne', courier_service_code: 'jne:OKE', courier_service_name: 'JNE Oke (Ongkos Kirim Ekonomis)', service_tier: 'economy', etd_days_min: 4, etd_days_max: 7, billed_weight_g: 1200, base_fee_idr: '9000', insurance_fee_idr: '3000', cod_fee_idr: '1800', grand_total_idr: '13800', supports_cod: true, supports_insurance: true, can_pickup_today: true },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'ninja', courier_service_code: 'ninja:STD', courier_service_name: 'Ninja Xpress Standard', service_tier: 'regular', etd_days_min: 2, etd_days_max: 4, billed_weight_g: 1200, base_fee_idr: '12200', insurance_fee_idr: '3500', cod_fee_idr: '2000', grand_total_idr: '17700', supports_cod: true, supports_insurance: true, can_pickup_today: true },
  { provider_slug: 'kiriminaja', provider_credential_id: 1, courier_code: 'idl', courier_service_code: 'idl:REG', courier_service_name: 'ID Express Reguler', service_tier: 'regular', etd_days_min: 3, etd_days_max: 5, billed_weight_g: 1200, base_fee_idr: '11500', insurance_fee_idr: '3200', cod_fee_idr: '1800', grand_total_idr: '16500', supports_cod: true, supports_insurance: true, can_pickup_today: true },
];

export default function RateResultsTable({
  quotes,
  onSelectQuote,
  selectedServiceCode = null,
  showSurchargeBreakdown = true,
}: RateResultsTableProps) {
  const data = quotes && quotes.length > 0 ? quotes : sampleQuotes;
  const [sort, setSort] = useState<'grand_total_asc' | 'etd_asc' | 'provider'>('grand_total_asc');
  const sorted = [...data].sort((a, b) => {
    if (sort === 'grand_total_asc') return parseFloat(a.grand_total_idr) - parseFloat(b.grand_total_idr);
    if (sort === 'etd_asc') return a.etd_days_min - b.etd_days_min || a.etd_days_max - b.etd_days_max;
    return a.courier_service_name.localeCompare(b.courier_service_name);
  });

  const selectedIdx = sorted.findIndex((q) => q.courier_service_code === selectedServiceCode);
  const isEmpty = sorted.length === 0;

  return (
    <div className="space-y-4">
      <Section
        kicker="Shared Component · Rates"
        title="Rate Quotes · 12 Sample Providers × Service Tiers"
        subtitle="Click baris untuk memilih service → wizard Step 3 Rate Quote terkunci, tombol Lanjut aktif. Surcharge columns hidden jika showSurchargeBreakdown=false."
      >
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSort('grand_total_asc')} className={sort === 'grand_total_asc' ? STYLES.buttonPrimary + ' !py-1.5 !text-xs' : STYLES.buttonGhost + ' !py-1.5 !text-xs'}>
              Urut Harga ↑ <ChevronDown size={14} className="inline align-text-top ml-1" />
            </button>
            <button onClick={() => setSort('etd_asc')} className={sort === 'etd_asc' ? STYLES.buttonPrimary + ' !py-1.5 !text-xs' : STYLES.buttonGhost + ' !py-1.5 !text-xs'}>
              Urut ETD ↑
            </button>
            <button onClick={() => setSort('provider')} className={sort === 'provider' ? STYLES.buttonPrimary + ' !py-1.5 !text-xs' : STYLES.buttonGhost + ' !py-1.5 !text-xs'}>
              Abjad A-Z
            </button>
          </div>
          <p className="text-xs text-gray-500">{sorted.length} quote ditemukan · klik Pilih Service untuk lanjut ke Pickup Schedule</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  '#',
                  'Kurir',
                  'Service Code',
                  'Tier',
                  'ETD',
                  'Billed Wt',
                  'Base (IDR)',
                  ...(showSurchargeBreakdown ? ['Insurance (IDR)', 'COD Fee (IDR)'] : []),
                  'Grand Total (IDR)',
                  'Feature Flags',
                  'Action',
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((q, i) => {
                const isSel = selectedServiceCode === q.courier_service_code || (selectedIdx < 0 && i === 0);
                const t = toneForTier(q.service_tier);
                return (
                  <tr
                    key={q.courier_service_code}
                    className={'transition cursor-pointer ' + (isSel ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-300/60' : 'hover:bg-gray-50')}
                    onClick={() => onSelectQuote && onSelectQuote(q)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{isSel ? <CheckCircle2 size={16} className="text-green-600" /> : (i + 1)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-blue-500" />
                        <span className="font-semibold text-gray-900">{q.courier_service_name.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{q.courier_service_code}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge tone={t.tone} label={(t.ico ?? '') + t.label as unknown as string} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {q.etd_days_min === 0 && q.etd_days_max === 0 ? 'H+0 (Sameday)' : `H+${q.etd_days_min} – H+${q.etd_days_max}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{(q.billed_weight_g / 1000).toFixed(1)} kg</td>
                    <td className="px-4 py-3 text-right font-mono">{idr(q.base_fee_idr)}</td>
                    {showSurchargeBreakdown && (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-gray-600">{q.supports_insurance ? idr(q.insurance_fee_idr) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600">{q.supports_cod ? idr(q.cod_fee_idr) : <span className="text-gray-300">—</span>}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{idr(q.grand_total_idr)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {q.can_pickup_today && <Badge tone="success" label="✅ Today" />}
                        {q.supports_insurance && <Badge tone="info" label="🛡 Insur" />}
                        {q.supports_cod && <Badge tone="warning" label="💵 COD" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className={isSel ? STYLES.buttonPrimary + ' !py-1.5 !text-xs' : STYLES.buttonSecondary + ' !py-1.5 !text-xs'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectQuote && onSelectQuote(q);
                        }}
                      >
                        {isSel ? <><CheckCircle2 size={14} className="mr-1 inline align-text-top" /> Terpilih</> : 'Pilih Service'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {isEmpty && (
                <tr>
                  <td colSpan={showSurchargeBreakdown ? 12 : 10} className="px-4 py-10 text-center text-gray-400">
                    <Info size={20} className="mx-auto mb-1 text-gray-300" />
                    Belum ada quote — pilih asal & tujuan kelurahan, isi dimensi paket, lalu klik Fetch Rates.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={'mt-4 p-4 rounded-xl ' + STYLES.bannerInfo}>
          <p className="font-semibold text-sm">Placeholder 12 sample rows (dummy data)</p>
          <p className="mt-1 text-xs opacity-90">
            Real impl r005: <code>callThirdPLILInternalUI('thirdplil-rates', {'{'} query: {'{'} origin_subdistrict_id, destination, weight_g, ... {'}'} {'}'})</code> → envelope normalize <code>data[]</code> → renders real rows. Billed Weight = server-side MAX(actual, volumetric) + round-up rule per courier divisor (courier_services_cache.volumetric_divisor_kgm3).
          </p>
        </div>
      </Section>
    </div>
  );
}
