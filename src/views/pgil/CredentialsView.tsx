import { useEffect, useState } from 'react';
import { CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react';
import { STYLES, Badge } from '../../components/ui/STYLES';
import CredentialReadOnlyCard from '../../components/pgil/CredentialReadOnlyCard';
import { callPgilInternalUI } from '../../utils/pgilApi';
import type { BannerState, SubscriberCredential } from '../../types/pgil';

type EnvFilter = 'all' | 'production' | 'sandbox';

export default function CredentialsView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubscriberCredential[]>([]);
  const [banner, setBanner] = useState<BannerState>(null);
  const [envFilter, setEnvFilter] = useState<EnvFilter>('all');
  const [testingId, setTestingId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    setBanner(null);
    const res = await callPgilInternalUI<SubscriberCredential[]>('pgil-admin-credentials', { method: 'GET', query: { env: envFilter } });
    setLoading(false);
    if (res.ok) {
      setData(res.data ?? []);
      if (res.banner) setBanner(res.banner);
    } else {
      setBanner(res.banner);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envFilter]);

  const testConnection = async (id: number) => {
    setTestingId(id);
    const res = await callPgilInternalUI<{ ok: boolean; message?: string }>(
      `pgil-admin-credentials/${id}/test`,
      { method: 'POST', isMutation: false }
    );
    setTestingId(null);
    if (res.ok) {
      setBanner({
        tone: res.data.ok ? 'success' : 'warning',
        title: res.data.ok ? 'Connection OK' : 'Connection failed',
        body: res.data.message,
      });
    } else {
      setBanner(res.banner);
    }
    await loadData();
  };

  const counts = {
    all: data.length,
    production: data.filter((c) => !c.is_sandbox).length,
    sandbox: data.filter((c) => c.is_sandbox).length,
  };

  return (
    <div className={STYLES.pageCard + ' p-6 space-y-6'}>
      <div className={STYLES.bannerInfo}>
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Read-Only Credentials (Option C)</p>
            <p className="mt-1 text-sm opacity-90">
              Midtrans credentials are owned by Webstore and synced to PGIL. This view shows the synced credentials for verification and connection testing. To add or modify credentials, do it in the Webstore admin interface.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Payment Gateway</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Synced Credentials</h2>
          <p className="mt-1 text-sm text-gray-500">Credentials synced from Webstore via credential sync API.</p>
        </div>
        <button onClick={() => void loadData()} className={STYLES.buttonSecondary + ' !py-2 !text-xs'}>
          <RefreshCw size={14} className="mr-1.5 inline align-text-top" /> Refresh
        </button>
      </div>

      {banner && (
        <div className={'p-4 rounded-2xl border ' + (
          banner.tone === 'success' ? STYLES.bannerSuccess :
          banner.tone === 'warning' ? STYLES.bannerWarning :
          banner.tone === 'danger' ? STYLES.bannerDanger : STYLES.bannerInfo
        )}>
          <div className="flex items-start gap-3">
            {banner.tone === 'success' ? <CheckCircle2 size={18} className="mt-0.5" /> : <Info size={18} className="mt-0.5" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{banner.title}</p>
              {banner.body && <p className="mt-1 text-sm opacity-90">{banner.body}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'production', 'sandbox'] as EnvFilter[]).map((k) => (
          <button
            key={k}
            onClick={() => setEnvFilter(k)}
            className={(envFilter === k ? STYLES.buttonPrimary : STYLES.buttonSecondary) + ' !py-1.5 !text-xs'}
          >
            {k === 'all' ? 'All Environments' : k}
            <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold">{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 p-10 text-center">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Loading credentials...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="font-semibold text-gray-700">No synced credentials yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Credentials appear here after the Webstore backend syncs them via <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">POST /pgil-credentials/sync</code>.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((c) => (
            <CredentialReadOnlyCard
              key={c.credential_id}
              credential={c}
              onTest={testConnection}
              testing={testingId === c.credential_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
