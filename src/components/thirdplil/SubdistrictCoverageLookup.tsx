import { useState } from 'react';
import { ChevronRight, MapPin, Search as SearchIcon } from 'lucide-react';
import { STYLES, Section, Badge } from '../ui/STYLES.tsx';
import SubTabs from '../SubTabs.tsx';
import type { CoverageAreaLevel, ThirdPLILCoverageArea } from '../../types/thirdplil.ts';

export interface SubdistrictCoverageLookupProps {
  level: CoverageAreaLevel;
  parentId?: number | null;
  onSelect?: (area: ThirdPLILCoverageArea) => void;
  selectedIds?: { province?: number | null; city?: number | null; district?: number | null; subdistrict?: number | null };
  showSearchBar?: boolean;
}

const sampleRows: Record<CoverageAreaLevel, Array<{ id: number; name: string; parent_id: number | null; code: string; full?: string }>> = {
  province: [
    { id: 1, parent_id: null, code: 'JK', name: 'DKI Jakarta', full: 'Provinsi DKI Jakarta' },
    { id: 2, parent_id: null, code: 'JB', name: 'Jawa Barat', full: 'Provinsi Jawa Barat' },
    { id: 3, parent_id: null, code: 'JT', name: 'Jawa Tengah', full: 'Provinsi Jawa Tengah' },
    { id: 4, parent_id: null, code: 'JI', name: 'Jawa Timur', full: 'Provinsi Jawa Timur' },
  ],
  city: [
    { id: 101, parent_id: 1, code: 'JKP', name: 'Kota Jakarta Pusat', full: 'DKI Jakarta › Kota Jakarta Pusat' },
    { id: 102, parent_id: 1, code: 'JKU', name: 'Kota Jakarta Utara', full: 'DKI Jakarta › Kota Jakarta Utara' },
    { id: 201, parent_id: 2, code: 'BDG', name: 'Kota Bandung', full: 'Jawa Barat › Kota Bandung' },
    { id: 202, parent_id: 2, code: 'BGR', name: 'Kota Bogor', full: 'Jawa Barat › Kota Bogor' },
  ],
  district: [
    { id: 10101, parent_id: 101, code: 'MEN', name: 'Menteng', full: 'DKI Jakarta › Kota Jakarta Pusat › Menteng' },
    { id: 10102, parent_id: 101, code: 'GMB', name: 'Gambir', full: 'DKI Jakarta › Kota Jakarta Pusat › Gambir' },
    { id: 20101, parent_id: 201, code: 'SUK', name: 'Sukajadi', full: 'Jawa Barat › Kota Bandung › Sukajadi' },
    { id: 20102, parent_id: 201, code: 'AND', name: 'Andir', full: 'Jawa Barat › Kota Bandung › Andir' },
  ],
  subdistrict: [
    { id: 1010101, parent_id: 10101, code: 'MDA', name: 'Menteng Dalam', full: 'DKI Jakarta › Kota Jakarta Pusat › Menteng › Menteng Dalam' },
    { id: 1010102, parent_id: 10101, code: 'PEG', name: 'Pegangsaan', full: 'DKI Jakarta › Kota Jakarta Pusat › Menteng › Pegangsaan' },
    { id: 1010201, parent_id: 10102, code: 'PET', name: 'Petojo Selatan', full: 'DKI Jakarta › Kota Jakarta Pusat › Gambir › Petojo Selatan' },
    { id: 2010101, parent_id: 20101, code: 'SKJ', name: 'Sukajadi', full: 'Jawa Barat › Kota Bandung › Sukajadi › Sukajadi' },
  ],
};

export default function SubdistrictCoverageLookup({
  showSearchBar = true,
  selectedIds = { province: null, city: null, district: null, subdistrict: null },
  onSelect,
}: SubdistrictCoverageLookupProps) {
  const [tab, setTab] = useState<'province' | 'city' | 'district' | 'subdistrict'>('province');
  const [q, setQ] = useState('');

  const levels: Array<{ id: 'province' | 'city' | 'district' | 'subdistrict'; label: string }> = [
    { id: 'province', label: '① Provinsi' },
    { id: 'city', label: '② Kota / Kab' },
    { id: 'district', label: '③ Kecamatan' },
    { id: 'subdistrict', label: '④ Kelurahan' },
  ];

  const rows = (sampleRows[tab] ?? []).filter((r) => (q ? r.name.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 p-4 bg-white shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Shared Component · Coverage
            </p>
            <h3 className="mt-1 text-lg font-bold text-gray-900">
              <MapPin size={18} className="mr-2 inline align-text-bottom" />
              Pilih Area (4-Level Cascading)
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Provinsi → Kota → Kecamatan → Kelurahan (Subdistrict). Click Kelurahan to emit{' '}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">onSelect(area)</code> dengan full_path breadcrumb.
            </p>
          </div>
          {showSearchBar && (
            <div className="relative w-full md:w-80">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama/kode area (contoh: Menteng, BDG)..."
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {selectedIds && Object.values(selectedIds).some((x) => x != null) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-600">Terpilih:</span>
            {(['province', 'city', 'district', 'subdistrict'] as const).map((k) => {
              const id = (selectedIds as { province?: number | null; city?: number | null; district?: number | null; subdistrict?: number | null })[k];
              if (!id) return null;
              return (
                <Badge key={k} tone="info" label={`${k}: #${id}`} />
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <SubTabs tabs={levels} active={tab} setActive={(id) => setTab(id as typeof tab)} />
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID', 'Level', 'Kode', 'Nama Area', 'Full Path', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const area: ThirdPLILCoverageArea = {
                  id: row.id,
                  level: tab,
                  parent_id: row.parent_id,
                  code: row.code,
                  name: row.name,
                  full_path: row.full ?? null,
                };
                return (
                  <tr
                    key={row.id}
                    className={tab === 'subdistrict' ? 'hover:bg-blue-50/60 cursor-pointer transition' : 'hover:bg-gray-50'}
                    onClick={() => tab === 'subdistrict' && onSelect && onSelect(area)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.id}</td>
                    <td className="px-4 py-3"><Badge tone="neutral" label={tab} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.code}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.full}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tab === 'subdistrict' && onSelect) onSelect(area);
                          else setTab(levels[levels.findIndex((l) => l.id === tab) + 1]?.id ?? tab);
                        }}
                        className={
                          tab === 'subdistrict'
                            ? STYLES.buttonPrimary + ' !py-1.5 !text-xs'
                            : STYLES.buttonSecondary + ' !py-1.5 !text-xs'
                        }
                      >
                        {tab === 'subdistrict' ? 'Pilih Kelurahan ini' : 'Lanjut'}
                        <ChevronRight size={14} className="ml-1 inline align-text-top" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Tidak ada area untuk pencarian &quot;{q}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={'mt-4 p-4 rounded-xl ' + STYLES.bannerInfo}>
          <p className="font-semibold text-sm">Placeholder implementation — 16 sample rows per level</p>
          <p className="mt-1 text-xs opacity-90">
            Real r005 akan memanggil <code>callThirdPLILInternalUI('thirdplil-rates?level=…&parent_id=…&q=…')</code> dengan gin_trgm similarity search dari coverage_cache.
          </p>
        </div>
      </div>

      <Section
        kicker="Spec Contract"
        title="Props contract for parent views"
        subtitle="ShipmentCreateWizard uses 2 instances (Origin side-by-side with Destination). Rate Calculator uses 2 cascading lookups with rate refresh trigger."
      >
        <pre className="overflow-x-auto rounded-2xl bg-gray-900 p-4 text-xs text-green-300">
{`interface SubdistrictCoverageLookupProps {
  level: CoverageAreaLevel;                 // starting level hint
  parentId?: number | null;                  // cascade parent
  onSelect?: (area: ThirdPLILCoverageArea) => void;  // emitted only at subdistrict
  selectedIds?: { province? city? district? subdistrict? }; // badge display
  showSearchBar?: boolean;                   // default true
}`}
        </pre>
      </Section>
    </div>
  );
}
