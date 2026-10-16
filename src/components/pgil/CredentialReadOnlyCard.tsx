import { CheckCircle2, Info, Lock, RefreshCw, X } from 'lucide-react';
import { STYLES, Badge } from '../ui/STYLES';
import type { SubscriberCredential } from '../../types/pgil';

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  } catch {
    return iso.slice(0, 10);
  }
}

export default function CredentialReadOnlyCard({
  credential,
  onTest,
  testing,
}: {
  credential: SubscriberCredential;
  onTest: (id: number) => void;
  testing: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-gray-900">{credential.account_label ?? credential.external_credential_ref}</p>
            {credential.is_default && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800">DEFAULT</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={credential.is_sandbox ? 'warning' : 'success'} label={credential.is_sandbox ? 'SANDBOX' : 'PRODUCTION'} />
            <Badge tone="info" label={credential.provider_slug} />
            {credential.is_active ? (
              <Badge tone="success" label="ACTIVE" />
            ) : (
              <Badge tone="danger" label="INACTIVE" />
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
          <Lock size={11} /> ENCRYPTED
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-gray-400">Server Key</p>
          <p className="mt-0.5 font-mono text-gray-700">{credential.server_key_masked}</p>
        </div>
        <div>
          <p className="text-gray-400">Client Key</p>
          <p className="mt-0.5 font-mono text-gray-700">{credential.client_key_masked}</p>
        </div>
        <div>
          <p className="text-gray-400">External Ref</p>
          <p className="mt-0.5 font-mono truncate text-gray-700" title={credential.external_credential_ref}>
            {credential.external_credential_ref}
          </p>
        </div>
        <div>
          <p className="text-gray-400">Last Synced</p>
          <p className="mt-0.5 text-gray-700">{relTime(credential.synced_at)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={() => onTest(credential.credential_id)}
          disabled={testing}
          className={STYLES.buttonGhost + ' !py-1.5 !text-xs flex-1'}
        >
          {testing ? (
            <RefreshCw size={14} className="mr-1.5 inline animate-spin align-text-top" />
          ) : (
            <CheckCircle2 size={14} className="mr-1.5 inline align-text-top" />
          )}
          Test Connection
        </button>
        {credential.last_test_conn_at && (
          <span className="text-xs text-gray-500">
            {credential.last_test_conn_ok ? (
              <span className="text-green-700">OK {relTime(credential.last_test_conn_at)}</span>
            ) : (
              <span className="text-red-600 inline-flex items-center gap-1"><X size={11} />FAIL</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
