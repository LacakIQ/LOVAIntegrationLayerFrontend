import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, DatabaseZap, Loader2, RefreshCw, Webhook } from 'lucide-react';
import { Badge, Section, STYLES } from '../../components/ui/STYLES';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi';
import type {
  BannerState,
  CronMonitorOverview,
  CronMonitorPgCronJob,
  CronMonitorScheduledWorker,
  IntegrationLayerModule,
} from '../../types/thirdplil';

const JOB_META: Record<string, { title: string; purpose: string }> = {
  thirdplil_coverage_nightly_sync_0200utc: {
    title: 'Coverage Nightly Sync',
    purpose: 'Refreshes ThirdPLIL coverage cache from KiriminAja every day.',
  },
  thirdplil_courier_cache_weekly_monday_0330utc: {
    title: 'Courier Cache Weekly Refresh',
    purpose: 'Refreshes ThirdPLIL courier service cache every Monday.',
  },
  thirdplil_pg_cron_job_details_retention_14d_0400utc: {
    title: 'pg_cron Run Details Retention',
    purpose: 'Deletes old cron.job_run_details rows older than 14 days.',
  },
  pgil_webhook_events_retention_14d_0415utc: {
    title: 'Webhook Events Retention',
    purpose: 'Deletes old PGIL webhook events that are already terminal.',
  },
  pgil_provider_call_log_retention_14d_0420utc: {
    title: 'Provider Call Log Retention',
    purpose: 'Deletes old PGIL provider call logs older than 14 days.',
  },
  pgil_pg_cron_job_details_retention_14d_0430utc: {
    title: 'pg_cron Run Details Retention',
    purpose: 'Deletes old cron.job_run_details rows older than 14 days.',
  },
};

function toneForRunStatus(status?: string | null) {
  if (!status) return 'neutral' as const;
  const normalized = status.toLowerCase();
  if (normalized.includes('succeed') || normalized === 'success') return 'success' as const;
  if (normalized.includes('fail') || normalized.includes('error')) return 'danger' as const;
  if (normalized.includes('run') || normalized.includes('start')) return 'info' as const;
  return 'neutral' as const;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function ModuleSummaryCard({
  module,
  pgCronJobs,
  scheduledWorkers,
}: {
  module: IntegrationLayerModule;
  pgCronJobs: CronMonitorPgCronJob[];
  scheduledWorkers: CronMonitorScheduledWorker[];
}) {
  const activePgCron = pgCronJobs.filter((job) => job.active).length;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{module === 'thirdplil' ? 'ThirdPLIL' : 'PGIL'}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Activity size={20} />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{pgCronJobs.length + scheduledWorkers.length} scheduled jobs</p>
          <p className="text-sm text-gray-500">{activePgCron} active pg_cron job(s) + {scheduledWorkers.length} scheduled edge worker(s)</p>
        </div>
      </div>
    </div>
  );
}

export default function CronMonitorView() {
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BannerState>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [overview, setOverview] = useState<CronMonitorOverview | null>(null);

  async function loadCronOverview() {
    setLoading(true);
    const res = await callThirdPLILInternalUI<CronMonitorOverview>('thirdplil-admin-crons', {
      method: 'GET',
      timeoutMs: 20_000,
    });
    setLoading(false);

    if (!res.ok) {
      setBanner(res.banner);
      return;
    }

    setOverview(res.data);
    setWarnings(res.warnings ?? []);
    setBanner({
      tone: 'info',
      title: 'Cron monitor loaded',
      body: `Snapshot generated at ${formatDate(res.data.generated_at)}.`,
    });
  }

  useEffect(() => {
    void loadCronOverview();
  }, []);

  const thirdplilPgCron = useMemo(
    () => overview?.pg_cron_jobs.filter((job) => job.module === 'thirdplil') ?? [],
    [overview],
  );
  const pgilPgCron = useMemo(
    () => overview?.pg_cron_jobs.filter((job) => job.module === 'pgil') ?? [],
    [overview],
  );
  const thirdplilWorkers = useMemo(
    () => overview?.scheduled_edge_workers.filter((job) => job.module === 'thirdplil') ?? [],
    [overview],
  );
  const pgilWorkers = useMemo(
    () => overview?.scheduled_edge_workers.filter((job) => job.module === 'pgil') ?? [],
    [overview],
  );

  function renderPgCronTable(rows: CronMonitorPgCronJob[]) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Schedule</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Last run</th>
              <th className="px-4 py-3 font-medium">Last start</th>
              <th className="px-4 py-3 font-medium">Last finish</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                  No pg_cron jobs found for this module.
                </td>
              </tr>
            ) : rows.map((row) => {
              const meta = JOB_META[row.job_name];
              return (
                <tr key={`${row.module}-${row.job_id}`} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{meta?.title ?? row.job_name}</div>
                    <div className="mt-1 font-mono text-xs text-gray-500">{row.job_name}</div>
                    <p className="mt-2 text-xs text-gray-600">{meta?.purpose ?? row.command}</p>
                    {row.last_return_message && (
                      <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Last return message: {row.last_return_message}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-gray-700">{row.schedule}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={row.active ? 'success' : 'warning'} label={row.active ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={toneForRunStatus(row.last_run_status)} label={row.last_run_status ?? 'never'} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.last_started_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.last_finished_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderScheduledWorkers(rows: CronMonitorScheduledWorker[]) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Function</th>
              <th className="px-4 py-3 font-medium">Expected schedule</th>
              <th className="px-4 py-3 font-medium">Status source</th>
              <th className="px-4 py-3 font-medium">Monitor note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                  No scheduled edge workers defined for this module.
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={`${row.module}-${row.function_name}`} className="align-top hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900">{row.function_name}</div>
                  <p className="mt-1 text-xs text-gray-600">{row.description}</p>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-700">{row.expected_schedule}</td>
                <td className="px-4 py-3"><Badge tone="info" label="scheduled edge function" /></td>
                <td className="px-4 py-3 text-xs text-gray-600">{row.monitor_note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={STYLES.pageCard + ' p-6'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Admin · Operations</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">Cron Monitor</h2>
            <p className="mt-1 text-sm text-gray-500">
              Live pg_cron status for ThirdPLIL and PGIL, plus the scheduled fanout workers that run outside the database.
            </p>
          </div>
          <button onClick={() => void loadCronOverview()} className={STYLES.buttonSecondary} disabled={loading}>
            {loading ? <Loader2 size={16} className="mr-2 inline animate-spin align-text-top" /> : <RefreshCw size={16} className="mr-2 inline align-text-top" />}
            Refresh
          </button>
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

        {warnings.length > 0 && (
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ModuleSummaryCard module="thirdplil" pgCronJobs={thirdplilPgCron} scheduledWorkers={thirdplilWorkers} />
          <ModuleSummaryCard module="pgil" pgCronJobs={pgilPgCron} scheduledWorkers={pgilWorkers} />
        </div>
      </div>

      <Section
        kicker="ThirdPLIL"
        title="Scheduled jobs"
        subtitle="ThirdPLIL has three pg_cron jobs in the database plus one scheduled Edge Function for webhook fanout."
      >
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <DatabaseZap size={16} className="text-blue-600" />
          <span>pg_cron jobs</span>
        </div>
        {renderPgCronTable(thirdplilPgCron)}

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Webhook size={16} className="text-blue-600" />
          <span>Scheduled edge workers</span>
        </div>
        {renderScheduledWorkers(thirdplilWorkers)}
      </Section>

      <Section
        kicker="Payment Gateway"
        title="PGIL scheduled jobs"
        subtitle="PGIL has three pg_cron retention jobs in the database plus one scheduled Edge Function for webhook fanout."
      >
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <DatabaseZap size={16} className="text-blue-600" />
          <span>pg_cron jobs</span>
        </div>
        {renderPgCronTable(pgilPgCron)}

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock3 size={16} className="text-blue-600" />
          <span>Scheduled edge workers</span>
        </div>
        {renderScheduledWorkers(pgilWorkers)}
      </Section>
    </div>
  );
}
