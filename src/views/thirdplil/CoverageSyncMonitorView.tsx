import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ChevronDown, Clock3, Loader2, RefreshCw } from 'lucide-react';
import { Badge, Section, STYLES } from '../../components/ui/STYLES';
import { getPathForView } from '../../app-routes';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi';
import type {
  BannerState,
  CoverageSyncRun,
  EnvToggle,
} from '../../types/thirdplil';

const POLL_MS = 5_000;
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

function relativeSeconds(value?: string | null) {
  if (!value) return '—';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
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

const STEP_LABEL: Record<string, string> = {
  province: 'Provinsi',
  city: 'Kota / Kab',
  district: 'Kecamatan',
  courier_services: 'Courier services',
};

export default function CoverageSyncMonitorView() {
  const [env, setEnv] = useState<EnvToggle>('sandbox');
  const [runs, setRuns] = useState<CoverageSyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [banner, setBanner] = useState<BannerState>(null);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const inFlight = useRef(false);

  const fetchRuns = useCallback(async (silent: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setLoading(true);
    const res = await callThirdPLILInternalUI<CoverageSyncRun[]>(
      'thirdplil-admin-coverage-sync/sync/runs',
      { method: 'GET', query: { env, limit: 20 }, timeoutMs: 20_000 },
    );
    inFlight.current = false;
    if (!silent) setLoading(false);

    if (!res.ok) {
      if (!silent) setBanner(res.banner);
      return;
    }
    setRuns(res.data ?? []);
    if (!silent) setBanner(null);
  }, [env]);

  // Initial + env-change load.
  useEffect(() => {
    void fetchRuns(false);
  }, [fetchRuns]);

  const activeRun = useMemo(
    () => runs.find((run) => run.status === 'queued' || run.status === 'running') ?? null,
    [runs],
  );

  const shouldPoll = autoRefresh && activeRun != null && expandedRunId == null;

  // Poll every 5 s while a non-terminal run exists; stop once terminal (T10).
  useEffect(() => {
    if (!shouldPoll) return;
    const timer = setInterval(() => { void fetchRuns(true); }, POLL_MS);
    return () => clearInterval(timer);
  }, [shouldPoll, fetchRuns]);

  function renderActiveCard(run: CoverageSyncRun) {
    const total = run.total_cities ?? 0;
    const processed = run.processed_cities ?? 0;
    const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Activity size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-gray-900">Run #{run.run_id}</p>
                <Badge tone={statusTone(run.status)} label={run.status} />
                <Badge tone="neutral" label={run.trigger_source} />
                <Badge tone="neutral" label={run.env} />
              </div>
              <p className="mt-0.5 text-sm text-gray-600">
                Step: {STEP_LABEL[run.current_step ?? ''] ?? run.current_step ?? '—'}
                {' · '}attempt {run.attempt_count}
                {' · '}heartbeat {relativeSeconds(run.heartbeat_at)}
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>{processed} / {total} cities</p>
            <p className="text-xs text-gray-500">pending cities {run.pending_district_cities ?? '—'}</p>
          </div>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {LEVEL_CHIPS.map((level) => (
            <Badge key={level} tone="neutral" label={`${level}: ${run.row_counts?.[level] ?? 0}`} />
          ))}
        </div>
        {run.last_error && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {run.last_error}
          </p>
        )}
      </div>
    );
  }

  function renderRunsTable(rows: CoverageSyncRun[]) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Run</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Trigger</th>
              <th className="px-4 py-3 font-medium">Env</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Finished</th>
              <th className="px-4 py-3 font-medium">Pending cities</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((run) => {
              const expanded = expandedRunId === run.run_id;
              return (
                <Fragment key={run.run_id}>
                  <tr className="align-top hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-700">#{run.run_id}</span>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => setExpandedRunId(expanded ? null : run.run_id)}
                          aria-label={expanded ? 'Collapse run detail' : 'Expand run detail'}
                        >
                          <ChevronDown size={16} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                      </div>
                      {run.attempt_count > 1 && (
                        <p className="mt-1 text-xs text-amber-700">attempt {run.attempt_count}</p>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge tone={statusTone(run.status)} label={run.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{run.trigger_source}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{run.env}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{formatDate(run.started_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{formatDate(run.finished_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{run.pending_district_cities ?? '—'}</td>
                  </tr>
                  {expanded && (
                    <tr key={`${run.run_id}-detail`} className="bg-gray-50/60">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {LEVEL_CHIPS.map((level) => (
                              <Badge key={level} tone="neutral" label={`${level}: ${run.row_counts?.[level] ?? 0}`} />
                            ))}
                          </div>
                          <p className="text-xs text-gray-600">
                            Heartbeat {formatDate(run.heartbeat_at)} · created {formatDate(run.created_at)}
                          </p>
                          {run.last_error && (
                            <pre className="overflow-x-auto rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 whitespace-pre-wrap">
                              {run.last_error}
                            </pre>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={STYLES.pageCard + ' p-6'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Admin · Operations</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">
              <Activity size={20} className="mr-2 inline align-text-bottom" />
              Coverage Sync Monitor
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Polling setiap {POLL_MS / 1000}s selama ada run aktif; berhenti otomatis saat run selesai/gagal.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <select
              className={STYLES.input + ' !w-auto'}
              value={env}
              onChange={(e) => setEnv(e.target.value as EnvToggle)}
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
            <button onClick={() => void fetchRuns(false)} className={STYLES.buttonSecondary} disabled={loading}>
              {loading
                ? <Loader2 size={16} className="mr-2 inline animate-spin align-text-top" />
                : <RefreshCw size={16} className="mr-2 inline align-text-top" />}
              Refresh
            </button>
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

        {activeRun && (
          <div className="mt-4">
            {renderActiveCard(activeRun)}
          </div>
        )}
      </div>

      <Section
        kicker="History"
        title="Recent coverage sync runs"
        subtitle="20 run terakhir untuk provider kiriminaja pada env terpilih."
      >
        {runs.length === 0 && !loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center">
            <Clock3 size={22} className="mx-auto text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">Belum ada run untuk env ini.</p>
            <Link
              to={getPathForView('kiriminaja-coverage')}
              className={STYLES.buttonPrimary + ' mt-4 inline-flex'}
            >
              Buka halaman Coverage
            </Link>
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
            Memuat run...
          </div>
        ) : (
          renderRunsTable(runs)
        )}
      </Section>
    </div>
  );
}
