import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, MapPin, Search as SearchIcon } from 'lucide-react';
import { STYLES, Section, Badge } from '../ui/STYLES.tsx';
import SubTabs from '../SubTabs.tsx';
import type { CoverageAreaLevel, EnvToggle, ThirdPLILCoverageArea } from '../../types/thirdplil.ts';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi.ts';

export interface SubdistrictCoverageLookupProps {
  level: CoverageAreaLevel;
  parentId?: number | null;
  env?: EnvToggle;
  onSelect?: (area: ThirdPLILCoverageArea) => void;
  selectedIds?: { province?: number | null; city?: number | null; district?: number | null; subdistrict?: number | null };
  showSearchBar?: boolean;
}

export default function SubdistrictCoverageLookup({
  parentId,
  env = 'production',
  showSearchBar = true,
  selectedIds = { province: null, city: null, district: null, subdistrict: null },
  onSelect,
}: SubdistrictCoverageLookupProps) {
  const [tab, setTab] = useState<'province' | 'city' | 'district' | 'subdistrict'>('province');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ThirdPLILCoverageArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [pathIds, setPathIds] = useState<{ province?: number | null; city?: number | null; district?: number | null; subdistrict?: number | null }>(selectedIds);

  const levels: Array<{ id: 'province' | 'city' | 'district' | 'subdistrict'; label: string }> = [
    { id: 'province', label: '① Provinsi' },
    { id: 'city', label: '② Kota / Kab' },
    { id: 'district', label: '③ Kecamatan' },
    { id: 'subdistrict', label: '④ Kelurahan (opsional)' },
  ];

  useEffect(() => {
    setPathIds((prev) => ({ ...prev, ...selectedIds }));
  }, [selectedIds]);

  const parentIdForTab = useMemo(() => {
    if (tab === 'city') return pathIds.province ?? parentId ?? null;
    if (tab === 'district') return pathIds.city ?? parentId ?? null;
    if (tab === 'subdistrict') return pathIds.district ?? parentId ?? null;
    return null;
  }, [parentId, pathIds, tab]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (tab !== 'province' && !(parentIdForTab && parentIdForTab > 0)) {
        setRows([]);
        setWarning(
          tab === 'city'
            ? 'Pilih provinsi dulu untuk memuat kota/kabupaten.'
            : tab === 'district'
              ? 'Pilih kota/kabupaten dulu untuk memuat kecamatan.'
              : 'Pilih kecamatan dulu untuk memuat kelurahan.'
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setWarning(null);
      const res = await callThirdPLILInternalUI<ThirdPLILCoverageArea[]>('thirdplil-admin-coverage-sync', {
        method: 'GET',
        query: {
          env,
          level: tab,
          parent_id: tab === 'province' ? undefined : parentIdForTab,
          q: q || undefined,
          limit: 50,
        },
      });
      if (cancelled) return;
      if (res.ok && Array.isArray(res.data)) {
        setRows(res.data);
        setWarning(
          res.warnings?.[0]
          ?? (res.data.length === 0
            ? `Belum ada cache ${tab} untuk query ini. Jalankan Coverage sync lalu coba lagi.`
            : null)
        );
      } else {
        setRows([]);
        setWarning(res.banner.body || 'Coverage cache lookup gagal. Periksa credential, auth, atau jalankan sync ulang.');
      }
      setLoading(false);
    };
    void run();
    return () => { cancelled = true; };
  }, [env, parentIdForTab, q, tab]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 p-4 bg-white shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Shared Component · Coverage Cache
            </p>
            <h3 className="mt-1 text-lg font-bold text-gray-900">
              <MapPin size={18} className="mr-2 inline align-text-bottom" />
              Pilih Area (4-Level Cascading)
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Provinsi → Kota → Kecamatan (kelurahan opsional). Rows come from the subscriber cache, so zipcode and geo fields are only filled when the backend has real values.
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
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Memuat coverage {tab}...
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const area: ThirdPLILCoverageArea = row;
                // Both kecamatan and kelurahan rows are valid final selections; deeper
                // levels are optional. Selecting a district keeps the same emitted shape.
                const selectable = tab === 'subdistrict' || tab === 'district';
                const selectArea = (a: ThirdPLILCoverageArea) => {
                  setPathIds((prev) => tab === 'district'
                    ? { ...prev, district: a.id, subdistrict: null }
                    : { ...prev, subdistrict: a.id });
                  onSelect?.(a);
                };
                return (
                  <tr
                    key={row.id}
                    className={selectable ? 'hover:bg-blue-50/60 cursor-pointer transition' : 'hover:bg-gray-50'}
                    onClick={() => { if (selectable) selectArea(area); }}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.id}</td>
                    <td className="px-4 py-3"><Badge tone="neutral" label={tab} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.code}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.full_path ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {tab === 'subdistrict' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); selectArea(area); }}
                            className={STYLES.buttonPrimary + ' !py-1.5 !text-xs'}
                          >
                            Pilih Kelurahan ini
                            <ChevronRight size={14} className="ml-1 inline align-text-top" />
                          </button>
                        )}
                        {tab === 'district' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); selectArea(area); }}
                            className={STYLES.buttonPrimary + ' !py-1.5 !text-xs'}
                          >
                            Pilih Kecamatan ini
                            <ChevronRight size={14} className="ml-1 inline align-text-top" />
                          </button>
                        )}
                        {tab !== 'subdistrict' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPathIds((prev) => {
                                if (tab === 'province') return { province: area.id, city: null, district: null, subdistrict: null };
                                if (tab === 'city') return { ...prev, city: area.id, district: null, subdistrict: null };
                                return { ...prev, district: area.id, subdistrict: null };
                              });
                              setTab(levels[levels.findIndex((l) => l.id === tab) + 1]?.id ?? tab);
                            }}
                            className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}
                          >
                            {tab === 'district' ? 'Kelurahan (opsional)' : 'Lanjut'}
                            <ChevronRight size={14} className="ml-1 inline align-text-top" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {warning ?? `Tidak ada area untuk pencarian "${q}".`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={'mt-4 p-4 rounded-xl ' + STYLES.bannerInfo}>
          <p className="font-semibold text-sm">Coverage cache lookup</p>
          <p className="mt-1 text-xs opacity-90">
            {warning ?? 'Rows di-load dari subscriber-scoped coverage cache. Jika zipcode atau lat/lng masih kosong, backend memang belum berhasil mengisi field tersebut dari source yang tersedia.'}
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
  level: CoverageAreaLevel;                 // target selection level
  parentId?: number | null;                  // cascade parent
  onSelect?: (area: ThirdPLILCoverageArea) => void;  // emitted only at subdistrict
  selectedIds?: { province? city? district? subdistrict? }; // badge display
  env?: EnvToggle;                           // default production
  showSearchBar?: boolean;                   // default true
}`}
        </pre>
      </Section>
    </div>
  );
}
