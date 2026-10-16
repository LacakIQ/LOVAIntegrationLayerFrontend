import { useEffect, useState } from 'react';
import { Copy, KeyRound, Loader2, Plus, Trash2, X } from 'lucide-react';
import { STYLES, Badge } from '../../components/ui/STYLES';
import { callPgilInternalUI } from '../../utils/pgilApi';
import type { BannerState, ConsumerApiKey } from '../../types/pgil';

export default function ApiKeysView() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ConsumerApiKey[]>([]);
  const [banner, setBanner] = useState<BannerState>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeySandbox, setNewKeySandbox] = useState(true);
  const [creating, setCreating] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await callPgilInternalUI<ConsumerApiKey[]>('pgil-admin-consumer-keys', { method: 'GET' });
    setLoading(false);
    if (res.ok) setKeys(res.data ?? []);
    else setBanner(res.banner);
  };

  useEffect(() => { void loadData(); }, []);

  const createKey = async () => {
    if (!newKeyLabel.trim()) {
      setBanner({ tone: 'warning', title: 'Label required' });
      return;
    }
    setCreating(true);
    const res = await callPgilInternalUI<{ api_key: ConsumerApiKey; raw_key_once: string }>('pgil-admin-consumer-keys', {
      method: 'POST', isMutation: true, body: { label: newKeyLabel.trim(), is_sandbox: newKeySandbox },
    });
    setCreating(false);
    if (res.ok) {
      setRawKey(res.data.raw_key_once);
      setNewKeyLabel('');
      setAddOpen(false);
      setBanner({ tone: 'success', title: 'API key generated', body: 'The raw key is shown only once. Save it securely.' });
      await loadData();
    } else {
      setBanner(res.banner);
    }
  };

  const revokeKey = async (id: number) => {
    const res = await callPgilInternalUI<{ ok: boolean }>(`pgil-admin-consumer-keys/${id}/revoke`, {
      method: 'POST', isMutation: true,
    });
    setRevokeId(null);
    if (res.ok) { setBanner({ tone: 'success', title: 'API key revoked' }); await loadData(); }
    else setBanner(res.banner);
  };

  return (
    <div className={STYLES.pageCard + ' p-6 space-y-6'}>
      <div className={STYLES.bannerInfo}>
        <div className="flex items-start gap-3">
          <KeyRound size={18} className="mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Consumer API Keys (Path B)</p>
            <p className="mt-1 text-sm opacity-90">
              Secret keys used by the Webstore backend to call PGIL consumer APIs (<code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs">X-PGIL-API-Key</code>).
              Raw keys are shown only once — store them in a secret manager. Revoked keys immediately lose access.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Payment Gateway</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">API Keys</h2>
        </div>
        <button onClick={() => setAddOpen(true)} className={STYLES.buttonPrimary + ' !py-2 !text-xs'}>
          <Plus size={14} className="mr-1 inline align-text-top" /> Generate Key
        </button>
      </div>

      {banner && (
        <div className={'p-4 rounded-2xl border ' + (
          banner.tone === 'success' ? STYLES.bannerSuccess :
          banner.tone === 'warning' ? STYLES.bannerWarning :
          banner.tone === 'danger' ? STYLES.bannerDanger : STYLES.bannerInfo
        )}>
          <p className="font-semibold">{banner.title}</p>
          {banner.body && <p className="mt-1 text-sm opacity-90">{banner.body}</p>}
        </div>
      )}

      {rawKey && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            API Key — shown once. Copy and store securely!
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all font-mono text-sm text-amber-900">{rawKey}</code>
            <button onClick={() => { navigator.clipboard?.writeText(rawKey); setBanner({ tone: 'success', title: 'Key copied to clipboard' }); }} className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}>
              <Copy size={14} className="mr-1 inline align-text-top" /> Copy
            </button>
            <button onClick={() => setRawKey(null)} className={STYLES.buttonGhost + ' !py-1.5 !text-xs'}><X size={14} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 p-10 text-center">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Loading API keys...</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="font-semibold text-gray-700">No API keys yet</p>
          <p className="mt-1 text-sm text-gray-500">Generate a key to authenticate Webstore backend calls to PGIL.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Prefix</th>
                <th className="px-4 py-3 font-medium">Environment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Used</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => {
                const isSandbox = k.key_prefix.includes('sandbox');
                return (
                <tr key={k.key_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{k.label ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{k.key_prefix}…</td>
                  <td className="px-4 py-3"><Badge tone={isSandbox ? 'warning' : 'success'} label={isSandbox ? 'SANDBOX' : 'LIVE'} /></td>
                  <td className="px-4 py-3">
                    {k.is_active
                      ? <Badge tone="success" label="ACTIVE" />
                      : <Badge tone="neutral" label="REVOKED" />}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(k.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button onClick={() => setRevokeId(k.key_id)} className="!bg-red-50 hover:!bg-red-100 text-red-700 rounded-xl px-2 py-1 text-xs border border-red-200">
                        <Trash2 size={12} className="inline" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-gray-900">Generate API Key</h3>
              <button onClick={() => setAddOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700 mb-1">Label *</span>
                <input className={STYLES.input} placeholder="e.g. Webstore Backend" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} />
              </label>
              <div>
                <span className="block text-xs font-semibold text-gray-700 mb-1">Environment</span>
                <div className="flex gap-2">
                  <button onClick={() => setNewKeySandbox(true)} className={(newKeySandbox ? STYLES.buttonPrimary : STYLES.buttonSecondary) + ' !py-2 !text-xs flex-1'}>Sandbox</button>
                  <button onClick={() => setNewKeySandbox(false)} className={(!newKeySandbox ? STYLES.buttonPrimary : STYLES.buttonSecondary) + ' !py-2 !text-xs flex-1'}>Live</button>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className={STYLES.buttonGhost}>Cancel</button>
              <button onClick={() => void createKey()} disabled={creating} className={STYLES.buttonPrimary}>
                {creating ? <Loader2 size={15} className="mr-2 inline animate-spin align-text-top" /> : null}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirm */}
      {revokeId !== null && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900">Revoke API key?</h3>
            <p className="mt-1 text-sm text-gray-500">This key will immediately stop working. Any calls using it will be rejected. This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRevokeId(null)} className={STYLES.buttonGhost}>Cancel</button>
              <button onClick={() => void revokeKey(revokeId)} className={STYLES.buttonDanger}>Revoke</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
