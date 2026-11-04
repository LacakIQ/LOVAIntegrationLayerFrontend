import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Layers, Loader2, MapPinned, RefreshCw, Truck } from 'lucide-react';
import { Badge, Section, STYLES } from '../../components/ui/STYLES';
import SubdistrictCoverageLookup from '../../components/thirdplil/SubdistrictCoverageLookup';
import { getPathForView } from '../../app-routes';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi';
import type {
  BannerState,
  CoverageStats,
  CoverageSyncRun,
  EnqueueCoverageSyncRunResponse,
  EnvToggle,
} from '../../types/thirdplil';

const LEVEL_CHIPS: Array<keyof CoverageSyncRun['row_counts']> = [
  'province',
  'city',
  'district',
  'subdistrict',
  'courier_services',
];

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusTone(status?: string | null) {
  switch (status) {
    case 'completed': return 'success' as const;
    case 'failed': return 'danger' as const;
    case 'running': return 'info' as const;
    case 'queued': return 'warning' as const;
    default: return 'neutral' as const;
  }
}

export default function CoverageView() {
  const navigate = useNavigate();
  const [env, setEnv] = useState<EnvToggle>('sandbox');
  const [loadingStats, setLoadingStats] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);

  async function fetchStats() {
    setLoadingStats(true);
    const res = await callThirdPLILInternalUI<CoverageStats>(
      'thirdplil-admin-coverage-sync/stats',
      { method: 'GET', timeoutMs: 20_000 },
    );
    setLoadingStats(false);
    if (!res.ok) {
      setBanner(res.banner);
      return;
    }
    setStats(res.data);
  }

  useEffect(() => {
    void fetchStats();
  }, []);

  async function handleStartSync() {
    setStarting(true);
    const res = await callThirdPLILInternalUI<EnqueueCoverageSyncRunResponse>(
      'thirdplil-admin-coverage-sync/sync/runs',
      { method: 'POST', query: { env }, body: {}, timeoutMs: 30_000 },
    );
    setStarting(false);

    if (!res.ok) {
      setBanner(res.banner);
      return;
    }
    const run = res.data;
    if (run?.reused) {
      setBanner({
        tone: 'info',
        title: `Sync sudah berjalan (#${run.run_id})`,
        body: 'Run aktif untuk env ini dipakai ulang — tidak ada run baru yang dibuat.',
      });
    } else {
      setBanner({
        tone: 'success',
        title: 'Sync dimulai',
        body: `Run #${run?.run_id ?? '—'} diantrikan. Worker cron akan memprosesnya per batch.`,
      });
    }
    navigate(getPathForView('kiriminaja-coverage-sync-monitor'));
  }

  const activeRun = stats?.active_run ?? null;
  const lastRun = stats?.last_completed_run ?? null;
  const credentialsPresent = stats?.credentials_present ?? { sandbox: false, production: false };

  return (
    <div className="space-y-4">
      <div className={STYLES.pageCard + ' p-6'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Admin · Coverage</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">
              <MapPinned size={20} className="mr-2 inline align-text-bottom" />
              Coverage Area
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Lihat cache coverage provider terpilih (provinsi → kota → kecamatan → kelurahan) dan mulai sync manual.
            </p>
          </div>
          <button onClick={() => void fetchStats()} className={STYLES.buttonSecondary} disabled={loadingStats}>
            {loadingStats
              ? <Loader2 size={16} className="mr-2 inline animate-spin align-text-top" />
              : <RefreshCw size={16} className="mr-2 inline align-text-top" />}
            Refresh
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div>
            <label className={STYLES.label}>Provider</label>
            <select className={STYLES.input + ' mt-1'} value="kiriminaja" disabled>
              <option value="kiriminaja">KiriminAja</option>
            </select>
          </div>
          <div>
            <label className={STYLES.label}>Environment</label>
            <select
              className={STYLES.input + ' mt-1'}
              value={env}
              onChange={(e) => setEnv(e.target.value as EnvToggle)}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div className="pb-0.5">
            <button
              className={STYLES.buttonPrimary}
              onClick={() => void handleStartSync()}
              disabled={starting || !credentialsPresent[env]}
            >
              {starting
                ? <Loader2 size={16} className="mr-2 inline animate-spin align-text-top" />
                : <RefreshCw size={16} className="mr-2 inline align-text-top" />}
              Start Sync
            </button>
            {!credentialsPresent[env] && (
              <p className="mt-2 text-xs text-amber-700">
                Belum ada credential {env}. Buat dulu di menu{' '}
                <a className="font-semibold underline" href={getPathForView('kiriminaja-credentials')}>
                  Credentials (Logistics)
                </a>.
              </p>
            )}
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
      </div>

      <Section
        kicker="Coverage Cache Stats"
        title="Ringkasan cache & sync"
        subtitle="Diambil dari GET /stats — satu panggilan untuk kedua halaman (cache browser + monitor)."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Layers size={20} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {stats ? stats.cache_counts.coverage_areas.toLocaleString() : '—'}
                </p>
                <p className="text-sm text-gray-500">Coverage area rows</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {stats ? stats.cache_counts.courier_services.toLocaleString() : '—'}
                </p>
                <p className="text-sm text-gray-500">Courier service rows</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Activity size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-gray-900">Active run</p>
                  {activeRun && <Badge tone={statusTone(activeRun.status)} label={activeRun.status} />}
                </div>
                {activeRun ? (
                  <button
                    type="button"
                    className="mt-1 text-sm font-semibold text-blue-600 underline"
                    onClick={() => navigate(getPathForView('kiriminaja-coverage-sync-monitor'))}
                  >
                    #{activeRun.run_id} — buka monitor
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">Tidak ada run aktif</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Last completed run</p>
          {lastRun ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                <Badge tone={statusTone(lastRun.status)} label={`#${lastRun.run_id} ${lastRun.status}`} />
                <span className="text-gray-500">finished {formatDate(lastRun.finished_at)}</span>
                <span className="text-gray-500">pending cities {lastRun.pending_district_cities ?? '—'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {LEVEL_CHIPS.map((level) => (
                  <Badge
                    key={level}
                    tone="neutral"
                    label={`${level}: ${lastRun.row_counts?.[level] ?? 0}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Belum ada run yang selesai.</p>
          )}
        </div>
      </Section>

      <Section
        kicker="Cache Browser"
        title="Jelajahi coverage area"
        subtitle="4-level cascade dari cache subscriber. Jalankan sync bila hasil kosong."
      >
        <SubdistrictCoverageLookup level="province" env={env} />
      </Section>
    </div>
  );
}
