import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { STYLES, Badge } from '../ui/STYLES.tsx';
import { getPathForView } from '../../app-routes.ts';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi.ts';
import type { ProviderSlug, SubscriberCredential } from '../../types/thirdplil.ts';

export type CredentialEnv = 'sandbox' | 'production' | 'all';

interface CredentialSelectorProps {
  value: number | null;
  onChange: (id: number | null) => void;
  /**
   * Fires whenever the resolved credential for `value` changes (or becomes null).
   * Lets callers read env/provider metadata of the current selection.
   */
  onResolve?: (cred: SubscriberCredential | null) => void;
  providerSlug?: ProviderSlug;
  env?: CredentialEnv;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  className?: string;
}

/**
 * Path A credential picker. Removed the old `is_default` mechanism (D1) — the admin
 * must now consciously choose the provider account + environment for every call.
 */
export default function CredentialSelector({
  value,
  onChange,
  onResolve,
  providerSlug = 'kiriminaja',
  env = 'all',
  disabled = false,
  required = false,
  label = 'Credential (Akun Provider)',
  className = '',
}: CredentialSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [creds, setCreds] = useState<SubscriberCredential[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      const r = await callThirdPLILInternalUI<SubscriberCredential[]>('thirdplil-admin-credentials', {
        method: 'GET',
        query: { env },
      });
      if (!alive) return;
      setLoading(false);
      if (r.ok) {
        setCreds((r.data ?? []) as SubscriberCredential[]);
      } else {
        setError(r.banner?.title ?? 'Gagal memuat daftar credential.');
      }
    })();
    return () => { alive = false; };
  }, [env]);

  const options = useMemo(
    () => creds.filter((c) => c.provider_slug === providerSlug),
    [creds, providerSlug]
  );

  // D4: no arbitrary pre-selection — auto-pick only when there is exactly one option.
  useEffect(() => {
    if (value == null && options.length === 1) onChange(options[0].id);
  }, [value, options, onChange]);

  // Report the resolved credential so callers can read env/provider metadata.
  useEffect(() => {
    onResolve?.(options.find((c) => c.id === value) ?? null);
  }, [value, options, onResolve]);

  const effectiveEnv = (c: SubscriberCredential): CredentialEnv => (c.is_sandbox ? 'sandbox' : 'production');

  return (
    <label className={'block ' + className}>
      <span className="block text-xs font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {loading ? (
        <div className={STYLES.input + ' flex items-center gap-2 text-gray-400'}>
          <Loader2 size={14} className="animate-spin" /> Memuat credential...
        </div>
      ) : options.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Belum ada credential {providerSlug} untuk environment ini. Buat dulu di{' '}
            <a className="font-semibold underline" href={getPathForView('kiriminaja-credentials')}>Credentials admin</a>.
          </span>
        </div>
      ) : (
        <select
          className={STYLES.input}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Pilih credential —</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.account_label} · #{c.id}
            </option>
          ))}
        </select>
      )}
      {!loading && options.length > 0 && value != null && (() => {
        const sel = options.find((c) => c.id === value);
        if (!sel) return null;
        return (
          <span className="mt-1.5 flex items-center gap-2">
            <Badge tone={sel.is_sandbox ? 'warning' : 'success'} label={effectiveEnv(sel) === 'sandbox' ? 'SANDBOX' : 'PRODUCTION'} />
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <ShieldCheck size={11} /> {sel.provider_slug} · #{sel.id}
            </span>
          </span>
        );
      })()}
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}
