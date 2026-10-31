import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, Delete, Info, KeyRound, Loader2, Pencil, PlusCircle, RefreshCw, Save, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import { STYLES, Section, Badge } from '../../components/ui/STYLES.tsx';
import { getPathForView } from '../../app-routes.ts';
import { callThirdPLILInternalUI } from '../../utils/thirdplilApi.ts';
import type { BannerMessage, SubscriberCredential } from '../../types/thirdplil.ts';

type EnvFilter = 'all' | 'production' | 'sandbox';

export default function CredentialsKiriminAjaView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubscriberCredential[]>([]);
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [envFilter, setEnvFilter] = useState<EnvFilter>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCred, setNewCred] = useState({
    account_label: '',
    provider_slug: 'kiriminaja' as const,
    is_sandbox: true,
    api_user: '',
    api_key: '',
    api_url_base: '',
    order_id_prefix: 'LVA',
  });
  const [editCred, setEditCred] = useState<{ id: number; account_label: string; order_id_prefix: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<{ [k: string]: boolean | undefined }>({});
  const [showRawKeyOnce, setShowRawKeyOnce] = useState<string | null>(null);
  const [showWebhookUrlOnce, setShowWebhookUrlOnce] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [pinModalId, setPinModalId] = useState<number | null>(null);
  const [pinInput, setPinInput] = useState('');

  const loadData = async (env: EnvFilter = envFilter) => {
    setLoading(true);
    setBanner(null);
    const r = await callThirdPLILInternalUI<SubscriberCredential[]>('thirdplil-admin-credentials', {
      method: 'GET',
      query: { env },
    });
    setLoading(false);
    if (r.ok) {
      setData((r.data ?? []) as SubscriberCredential[]);
      if (r.banner) setBanner(r.banner);
    } else {
      setBanner(r.banner);
    }
  };

  useEffect(() => {
    void loadData(envFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envFilter]);

  const idr = (s: string | number | null | undefined): string => {
    const n = typeof s === 'string' ? parseFloat(s.replace(/[^0-9.]/g, '')) || 0 : Number(s ?? 0);
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
  };
  const relTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.round(diff / 60000);
      if (mins < 1) return 'baru saja';
      if (mins < 60) return `${mins}m lalu`;
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return `${hrs}h lalu`;
      return `${Math.round(hrs / 24)}d lalu`;
    } catch { return iso.slice(0, 10); }
  };

  const setDefault = async (id: number) => {
    setActionLoading((p) => ({ ...p, [`default_${id}`]: true }));
    const r = await callThirdPLILInternalUI<{ ok: boolean; previous_default_id: number | null; new_default_id: number | null }>(`thirdplil-admin-credentials/credentials/${id}/set-default`, { method: 'POST', isMutation: true });
    setActionLoading((p) => ({ ...p, [`default_${id}`]: false }));
    if (!r.ok) { setBanner(r.banner); return; }
    setBanner({ tone: 'success', title: 'Credential di-set sebagai Default.', body: r.warnings ? r.warnings.join('; ') : 'Semua pemanggilan Edge untuk grup yang sama tanpa override X-ThirdPLIL-Credential-Id akan menggunakan credential ini.' });
    await loadData(envFilter);
  };

  const testConnection = async (id: number) => {
    setActionLoading((p) => ({ ...p, [`test_${id}`]: true }));
    const r = await callThirdPLILInternalUI<{ ok: boolean; ping_ms: number; message?: string | null }>(`thirdplil-admin-credentials/credentials/${id}/test-connection`, { method: 'POST', isMutation: false });
    setActionLoading((p) => ({ ...p, [`test_${id}`]: false }));
    if (r.ok) {
      const d = r.data as { ping_ms?: number; ok?: boolean; message?: string | null };
      setBanner({ tone: d.ok !== false ? 'success' : 'warning', title: d.ok !== false ? `Ping OK · ${String(d.ping_ms ?? '?')}ms` : 'Ping timeout / gagal.', body: d.message ?? null });
    } else setBanner(r.banner);
    await loadData(envFilter);
  };

  const registerCallback = async (id: number) => {
    setActionLoading((p) => ({ ...p, [`callback_${id}`]: true }));
    const r = await callThirdPLILInternalUI<{ callback_url: string; provider_text?: string | null; registered_at?: string | null }>(
      `thirdplil-admin-credentials/credentials/${id}/register-callback`,
      { method: 'POST', isMutation: true }
    );
    setActionLoading((p) => ({ ...p, [`callback_${id}`]: false }));
    if (!r.ok) { setBanner(r.banner); return; }
    const d = r.data as { callback_url?: string | null; provider_text?: string | null };
    setBanner({
      tone: 'success',
      title: 'Callback berhasil diregistrasikan ke KiriminAja.',
      body: [d.callback_url ? `URL: ${d.callback_url}` : null, d.provider_text ?? null].filter(Boolean).join('\n'),
    });
    await loadData(envFilter);
  };

  const setKaCreditPin = async (id: number) => {
    const pin = pinInput.trim();
    if (!/^\d{4,12}$/.test(pin)) {
      setBanner({ tone: 'warning', title: 'PIN harus 4–12 digit angka.' });
      return;
    }
    setActionLoading((p) => ({ ...p, [`pin_${id}`]: true }));
    const r = await callThirdPLILInternalUI<{ credential_id: number; has_ka_credit_pin: boolean; ka_credit_pin_set_at: string | null }>(
      `thirdplil-admin-credentials/credentials/${id}/set-ka-credit-pin`,
      { method: 'POST', isMutation: true, body: { pin } }
    );
    setActionLoading((p) => ({ ...p, [`pin_${id}`]: false }));
    // Ephemeral handling: drop the PIN from React state regardless of outcome.
    setPinInput('');
    setPinModalId(null);
    if (!r.ok) { setBanner(r.banner); return; }
    setBanner({
      tone: 'success',
      title: 'KA Credit PIN tersimpan (terenkripsi).',
      body: 'Booking dengan payment_method=ka_credit tidak lagi memerlukan PIN dari consumer.',
    });
    await loadData(envFilter);
  };

  const clearKaCreditPin = async (id: number) => {
    setActionLoading((p) => ({ ...p, [`pinclr_${id}`]: true }));
    const r = await callThirdPLILInternalUI<{ credential_id: number; has_ka_credit_pin: boolean }>(
      `thirdplil-admin-credentials/credentials/${id}/clear-ka-credit-pin`,
      { method: 'POST', isMutation: true }
    );
    setActionLoading((p) => ({ ...p, [`pinclr_${id}`]: false }));
    if (!r.ok) { setBanner(r.banner); return; }
    setBanner({
      tone: 'success',
      title: 'KA Credit PIN dihapus.',
      body: 'Booking ka_credit sekarang memerlukan PIN di body request.',
    });
    await loadData(envFilter);
  };

  const deleteCred = async (id: number, isDefault: boolean, nInEnv: number) => {
    if (isDefault && nInEnv > 1) {
      setBanner({ tone: 'danger', title: 'Tidak bisa menghapus credential default.', body: `Pilih credential lain sebagai DEFAULT terlebih dahulu (ada ${nInEnv} credential aktif dalam grup ENV yang sama). Hapus dibatalkan.` });
      setDeleteConfirmId(null);
      return;
    }
    setActionLoading((p) => ({ ...p, [`del_${id}`]: true }));
    const r = await callThirdPLILInternalUI<{ ok: boolean; removed_rows: number }>(`thirdplil-admin-credentials/credentials/${id}`, { method: 'DELETE', isMutation: true });
    setActionLoading((p) => ({ ...p, [`del_${id}`]: false }));
    setDeleteConfirmId(null);
    if (!r.ok) { setBanner(r.banner); return; }
    setBanner({ tone: 'success', title: 'Credential dihapus.' });
    await loadData(envFilter);
  };

  const submitNew = async () => {
    if (!newCred.account_label || !newCred.api_key) {
      setBanner({ tone: 'warning', title: 'Mohon lengkapi field wajib: Account Label dan API Key.' });
      return;
    }
    setActionLoading((p) => ({ ...p, add: true }));
    const r = await callThirdPLILInternalUI<{ raw_key_once?: string | null; callback_url?: string | null; legacy_webhook_url?: string | null; credential: SubscriberCredential }>('thirdplil-admin-credentials/credentials', {
      method: 'POST',
      isMutation: true,
      body: newCred,
    });
    setActionLoading((p) => ({ ...p, add: false }));
    if (!r.ok) { setBanner(r.banner); return; }
    const d = r.data as { raw_key_once?: string | null; callback_url?: string | null; legacy_webhook_url?: string | null };
    setShowRawKeyOnce(d.raw_key_once ?? null);
    setShowWebhookUrlOnce(d.callback_url ?? null);
    setNewCred({ account_label: '', provider_slug: 'kiriminaja', is_sandbox: true, api_user: '', api_key: '', api_url_base: '', order_id_prefix: 'LVA' });
    setAddModalOpen(false);
    setBanner({
      tone: 'success',
      title: 'Credential berhasil ditambahkan.',
      body: [
        d.callback_url ? 'Langkah berikutnya: klik "Register Callback" pada card credential agar ThirdPLIL memanggil KA set_callback().' : null,
        d.raw_key_once ? 'Legacy wh_secret fallback masih tersedia sementara selama masa cutover.' : null,
      ].filter(Boolean).join(' '),
    });
    await loadData(envFilter);
  };

  const saveEdit = async () => {
    if (!editCred) return;
    if (!editCred.account_label || editCred.account_label.trim().length < 2) {
      setBanner({ tone: 'warning', title: 'Account Label minimal 2 karakter.' });
      return;
    }
    if (!/^[A-Za-z0-9]{2,10}$/.test(editCred.order_id_prefix.trim())) {
      setBanner({ tone: 'warning', title: 'Order ID Prefix harus alfanumerik 2–10 karakter (mis. LVA).' });
      return;
    }
    setActionLoading((p) => ({ ...p, edit: true }));
    const r = await callThirdPLILInternalUI<SubscriberCredential>(`thirdplil-admin-credentials/credentials/${editCred.id}`, {
      method: 'PATCH',
      isMutation: true,
      body: { account_label: editCred.account_label.trim(), order_id_prefix: editCred.order_id_prefix.trim() },
    });
    setActionLoading((p) => ({ ...p, edit: false }));
    if (!r.ok) { setBanner(r.banner); return; }
    setEditCred(null);
    setBanner({ tone: 'success', title: 'Credential diperbarui.' });
    await loadData(envFilter);
  };

  const filtered = data.filter((c) => envFilter === 'all' ? true : (c.is_sandbox ? 'sandbox' : 'production') === envFilter);
  const counts = {
    all: data.length,
    production: data.filter((c) => !c.is_sandbox).length,
    sandbox: data.filter((c) => c.is_sandbox).length,
  };

  return (
    <div className={STYLES.pageCard}>
      <div className="p-6 space-y-6">
        <div className={STYLES.bannerInfo}>
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">View LIVE · ThirdPLIL Credentials Admin (Path A JWT)</p>
              <p className="mt-1 text-sm opacity-90">
                Full implementation — List / Add / Set Default / Test Connection / Delete dengan real call ke <code className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900 text-xs">callThirdPLILInternalUI</code>. See full wiring: <code className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900 text-xs">thirdplil-admin-credentials</code> Edge Function.
              </p>
            </div>
          </div>
        </div>

        <nav className="text-xs text-gray-500">
          <Link to={getPathForView('dashboard')} className="hover:text-gray-700 hover:underline">Dashboard</Link>
          <span className="mx-2">›</span>
          <span className="font-semibold text-gray-700">Settings</span>
          <span className="mx-2">›</span>
          <span className="font-semibold text-gray-900">Credentials · Logistics (KiriminAja)</span>
        </nav>

        {banner && (
          <div className={
            banner.tone === 'success' ? STYLES.bannerSuccess :
            banner.tone === 'warning' ? STYLES.bannerWarning :
            banner.tone === 'danger'  ? STYLES.bannerDanger :
            STYLES.bannerInfo
          }>
            <div className="flex items-start gap-3">
              {banner.tone === 'success' ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" /> : <Info size={18} className="mt-0.5 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{banner.title}</p>
                {banner.body && <p className="mt-1 text-sm opacity-90 whitespace-pre-wrap">{banner.body}</p>}
                {(showRawKeyOnce || showWebhookUrlOnce) && (
                  <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm space-y-3">
                    {showWebhookUrlOnce && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                          <ShieldCheck size={16} /> Callback URL utama — target untuk registrasi `set_callback` KiriminAja:
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <code className="flex-1 min-w-[200px] font-mono text-xs break-all rounded-xl bg-white border border-amber-200 p-2 text-amber-900">{showWebhookUrlOnce}</code>
                          <button onClick={() => { navigator.clipboard?.writeText(showWebhookUrlOnce); setBanner({ tone: 'success', title: 'Webhook URL disalin ke clipboard 👍' }); }} className={STYLES.buttonSecondary}>
                            <Copy size={14} className="mr-1.5 inline align-text-top" /> Copy URL
                          </button>
                        </div>
                      </div>
                    )}
                    {showRawKeyOnce && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                          <ShieldCheck size={16} /> Legacy webhook secret fallback — tidak bisa diambil ulang dari DB (hanya sha256 hash tersimpan):
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <code className="flex-1 min-w-[200px] font-mono text-sm break-all rounded-xl bg-white border border-amber-200 p-2 text-amber-900">{showRawKeyOnce}</code>
                          <button onClick={() => { navigator.clipboard?.writeText(showRawKeyOnce); setBanner({ tone: 'success', title: 'Webhook secret disalin ke clipboard 👍' }); }} className={STYLES.buttonSecondary}>
                            <Copy size={14} className="mr-1.5 inline align-text-top" /> Copy Secret
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button onClick={() => { setShowRawKeyOnce(null); setShowWebhookUrlOnce(null); }} className={STYLES.buttonGhost}>
                        <X size={14} className="mr-1.5 inline align-text-top" /> Hide
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Settings · Logistics</p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">
              <ShieldCheck size={20} className="mr-2 inline align-text-bottom" />
              Subscriber Credentials
            </h2>
            <p className="mt-1 text-sm text-gray-500">Kelola akun provider per subscriber, termasuk registrasi callback KiriminAja via `set_callback(url)` dari card credential.</p>
          </div>
          <button onClick={() => { setAddModalOpen(true); }} className={STYLES.buttonPrimary}>
            <PlusCircle size={16} className="mr-2 inline align-text-top" /> Add New Credential
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'production', 'sandbox'] as EnvFilter[]).map((k) => (
            <button
              key={k}
              onClick={() => setEnvFilter(k)}
              className={
                (envFilter === k
                  ? STYLES.buttonPrimary
                  : STYLES.buttonSecondary) + ' !py-1.5 !text-xs'
              }
            >
              {k === 'all' ? 'All Environments' : k === 'production' ? 'Production' : 'Sandbox'}
              <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold">{counts[k]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 p-10 text-center">
            <Loader2 size={24} className="mx-auto mb-3 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Loading credentials...</p>
          </div>
        ) : (
          <Section kicker="Credential Grid" title="Account Cards (2/3/4-col responsive)" subtitle="Hover card → menampilkan 3 action: Set Default, Test Connection, Delete. ⭐ = default grup.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((c) => {
                const nInSameEnv = data.filter((x) => x.provider_slug === c.provider_slug && x.is_sandbox === c.is_sandbox).length;
                return (
                  <div key={c.id} className="group relative rounded-2xl border border-gray-200 p-5 bg-white hover:bg-gray-50 transition shadow-sm hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-900">{c.account_label}</p>
                          {c.is_default && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800 inline-flex items-center gap-1"><Star size={10} fill="currentColor" /> DEFAULT</span>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                          <Badge tone={c.is_sandbox ? 'warning' : 'success'} label={c.is_sandbox ? 'SANDBOX' : 'PRODUCTION'} />
                          <Badge tone="info" label={String(c.provider_slug)} />
                          <Badge
                            tone={c.ka_callback_register_ok ? 'success' : (c.ka_callback_registered_at ? 'warning' : 'neutral')}
                            label={c.ka_callback_register_ok ? 'CALLBACK READY' : (c.ka_callback_registered_at ? 'CALLBACK FAILED' : 'CALLBACK PENDING')}
                          />
                          <Badge
                            tone={c.has_ka_credit_pin ? 'success' : 'neutral'}
                            label={c.has_ka_credit_pin ? 'KA CREDIT PIN SET' : 'KA CREDIT PIN UNSET'}
                          />
                        </div>
                      </div>
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 inline-flex items-center gap-1">
                        <ShieldCheck size={11} /> ENCRYPTED
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">API Email</p>
                        <p className="mt-0.5 font-mono truncate text-gray-700" title={c.api_user ?? ''}>{c.api_user ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">ID</p>
                        <p className="mt-0.5 font-mono text-gray-700">#{c.id}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Order ID Prefix</p>
                        <p className="mt-0.5 font-mono text-gray-700" title="Prefix order_id KiriminAja (Dashboard → Integrasi)">{c.order_id_prefix || 'LVA'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-400">Callback URL</p>
                        <div className="mt-0.5 flex items-start gap-2">
                          <p className="min-w-0 flex-1 truncate font-mono text-gray-700" title={c.callback_url ?? ''}>{c.callback_url ?? '—'}</p>
                          {c.callback_url && (
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard?.writeText(c.callback_url ?? ''); setBanner({ tone: 'success', title: 'Callback URL disalin.' }); }}
                              className={STYLES.buttonGhost + ' !px-2 !py-1 !text-[10px]'}
                            >
                              <Copy size={12} className="mr-1 inline align-text-top" /> Copy
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400">Credit Balance</p>
                        <p className="mt-0.5 font-bold text-green-700">{idr(c.credit_balance_idr ?? '0')}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Update · {relTime(c.credit_updated_at)}</p>
                        <p className="mt-0.5 text-gray-500">
                          {c.last_test_conn_at
                            ? (c.last_test_conn_ok ? <span className="text-green-700 inline-flex items-center gap-1"><CheckCircle2 size={11} />OK {relTime(c.last_test_conn_at)}</span>
                              : <span className="text-red-600 inline-flex items-center gap-1"><X size={11} />FAIL {relTime(c.last_test_conn_at)}</span>)
                            : 'Never'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-400">Callback Register</p>
                        <p className="mt-0.5 text-gray-500">
                          {c.ka_callback_registered_at
                            ? (c.ka_callback_register_ok
                                ? <span className="text-green-700 inline-flex items-center gap-1"><CheckCircle2 size={11} />OK {relTime(c.ka_callback_registered_at)}</span>
                                : <span className="text-amber-700 inline-flex items-center gap-1"><Info size={11} />FAIL {relTime(c.ka_callback_registered_at)}</span>)
                            : 'Belum pernah diregistrasikan'}
                        </p>
                        {c.ka_callback_register_message && (
                          <p className="mt-1 text-[11px] text-gray-400 line-clamp-2" title={c.ka_callback_register_message}>{c.ka_callback_register_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => void setDefault(c.id)}
                        disabled={c.is_default || !!actionLoading[`default_${c.id}`]}
                        className={STYLES.buttonSecondary + ' !py-1.5 !text-xs flex-1'}
                      >
                        {actionLoading[`default_${c.id}`] ? <Loader2 size={14} className="mr-1.5 inline align-text-top animate-spin" /> : <Star size={14} className="mr-1.5 inline align-text-top" />}
                        {c.is_default ? 'Sudah Default' : 'Set Default'}
                      </button>
                      <button
                        onClick={() => void testConnection(c.id)}
                        disabled={!!actionLoading[`test_${c.id}`]}
                        className={STYLES.buttonGhost + ' !py-1.5 !text-xs flex-1'}
                      >
                        {actionLoading[`test_${c.id}`] ? <Loader2 size={14} className="mr-1.5 inline align-text-top animate-spin" /> : <RefreshCw size={14} className="mr-1.5 inline align-text-top" />}
                        Test Ping
                      </button>
                      <button
                        onClick={() => void registerCallback(c.id)}
                        disabled={!!actionLoading[`callback_${c.id}`]}
                        className={STYLES.buttonSecondary + ' !py-1.5 !text-xs flex-1'}
                      >
                        {actionLoading[`callback_${c.id}`] ? <Loader2 size={14} className="mr-1.5 inline align-text-top animate-spin" /> : <ShieldCheck size={14} className="mr-1.5 inline align-text-top" />}
                        {c.ka_callback_register_ok ? 'Re-register Callback' : 'Register Callback'}
                      </button>
                      <button
                        onClick={() => { setPinInput(''); setPinModalId(c.id); }}
                        disabled={!!actionLoading[`pin_${c.id}`]}
                        className={STYLES.buttonSecondary + ' !py-1.5 !text-xs flex-1'}
                      >
                        {actionLoading[`pin_${c.id}`] ? <Loader2 size={14} className="mr-1.5 inline align-text-top animate-spin" /> : <KeyRound size={14} className="mr-1.5 inline align-text-top" />}
                        {c.has_ka_credit_pin ? 'Update KA PIN' : 'Set KA PIN'}
                      </button>
                      {c.has_ka_credit_pin && (
                        <button
                          onClick={() => void clearKaCreditPin(c.id)}
                          disabled={!!actionLoading[`pinclr_${c.id}`]}
                          className={STYLES.buttonGhost + ' !py-1.5 !text-xs flex-1'}
                        >
                          {actionLoading[`pinclr_${c.id}`] ? <Loader2 size={14} className="mr-1.5 inline align-text-top animate-spin" /> : <X size={14} className="mr-1.5 inline align-text-top" />}
                          Clear KA PIN
                        </button>
                      )}
                      <button
                        onClick={() => setEditCred({ id: c.id, account_label: c.account_label, order_id_prefix: c.order_id_prefix || 'LVA' })}
                        className={STYLES.buttonGhost + ' !py-1.5 !text-xs flex-1'}
                      >
                        <Pencil size={14} className="mr-1.5 inline align-text-top" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(c.id)}
                        disabled={!!actionLoading[`del_${c.id}`]}
                        className="!bg-red-50 hover:!bg-red-100 text-red-700 rounded-xl px-2 py-1.5 text-xs border border-red-200 transition disabled:opacity-50"
                      >
                        {actionLoading[`del_${c.id}`] ? <Loader2 size={14} className="inline align-text-top animate-spin" /> : <Trash2 size={14} className="inline align-text-top" />}
                      </button>
                    </div>
                    {pinModalId === c.id && (
                      <div className="absolute inset-0 z-10 bg-white/95 rounded-2xl border-2 border-purple-200 p-4 flex flex-col justify-center">
                        <p className="font-bold text-purple-900 text-sm inline-flex items-center gap-1.5"><KeyRound size={14} /> KA Credit PIN</p>
                        <p className="mt-1 text-[11px] text-gray-600">Disimpan terenkripsi (AES-GCM) dan tidak pernah ditampilkan kembali. Setelah tersimpan, booking <span className="font-mono">payment_method=ka_credit</span> memakai PIN ini tanpa perlu dikirim consumer.</p>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={12}
                          autoFocus
                          className={STYLES.input + ' mt-2'}
                          placeholder="••••••"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => void setKaCreditPin(c.id)}
                            disabled={!!actionLoading[`pin_${c.id}`]}
                            className="!bg-purple-600 hover:!bg-purple-700 text-white rounded-xl px-3 py-1.5 text-xs flex-1 font-semibold disabled:opacity-50"
                          >
                            {actionLoading[`pin_${c.id}`] ? <Loader2 size={13} className="mr-1 inline align-text-top animate-spin" /> : <Save size={13} className="mr-1 inline align-text-top" />} Simpan PIN
                          </button>
                          <button
                            onClick={() => { setPinInput(''); setPinModalId(null); }}
                            className={STYLES.buttonGhost + ' !py-1.5 !text-xs flex-1'}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {deleteConfirmId === c.id && (
                      <div className="absolute inset-0 z-10 bg-white/95 rounded-2xl border-2 border-red-200 p-4 flex flex-col justify-center">
                        <p className="font-bold text-red-700 text-sm">Confirm Hapus Credential?</p>
                        <p className="mt-1 text-xs text-gray-600">Action ini akan menghapus row credential #{c.id}. {c.is_default && <span className="text-red-600 font-semibold">INI ADALAH DEFAULT dalam grup {nInSameEnv} row ENV yang sama — hanya bisa dihapus jika jumlah credential = 1.</span>}</p>
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => void deleteCred(c.id, c.is_default, nInSameEnv)} className="!bg-red-600 hover:!bg-red-700 text-white rounded-xl px-3 py-1.5 text-xs flex-1 font-semibold disabled:opacity-50" disabled={!!actionLoading[`del_${c.id}`]}>
                            {actionLoading[`del_${c.id}`] ? <Loader2 size={13} className="mr-1 inline align-text-top animate-spin" /> : <Delete size={13} className="mr-1 inline align-text-top" />} Ya, Hapus Permanen
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)} className={STYLES.buttonGhost + ' !py-1.5 !text-xs flex-1'}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => setAddModalOpen(true)}
                className="rounded-2xl border-2 border-dashed border-gray-300 p-5 flex flex-col items-center justify-center gap-3 min-h-[220px] hover:border-blue-400 hover:bg-blue-50/60 transition text-center"
              >
                <div className="rounded-full border-2 border-dashed border-gray-300 w-12 h-12 flex items-center justify-center text-gray-400"><PlusCircle size={22} /></div>
                <div>
                  <p className="font-semibold text-gray-700">Add New Credential</p>
                  <p className="mt-0.5 text-xs text-gray-400">Dukung multi-account KA per subscriber.</p>
                </div>
              </button>
            </div>
          </Section>
        )}

        {addModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
              <div className="px-6 pt-5 pb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Modal · Add Credential</p>
                  <h3 className="mt-1 text-lg font-bold text-gray-900 flex items-center gap-2"><PlusCircle size={18} /> Tambah Akun KiriminAja</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Field API Key & Email di-enkripsi at-rest sebelum INSERT. Raw key (bila consumer-access) ditampilkan 1x setelah submit.</p>
                  <p className="mt-1 text-[11px] text-gray-500">Sesudah save, lakukan langkah kedua: Register Callback. Itu yang memanggil KiriminAja `set_callback(url)`.</p>
                </div>
                <button onClick={() => setAddModalOpen(false)} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-500" aria-label="Close"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block md:col-span-2">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Account Label *</span>
                    <input className={STYLES.input} placeholder="Contoh: Toko Utama - Production" value={newCred.account_label} onChange={(e) => setNewCred({ ...newCred, account_label: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Provider</span>
                    <select disabled className={STYLES.input}>
                      <option value="kiriminaja">KiriminAja (default)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Environment</span>
                    <div className="flex gap-2 mt-1">
                      <button type="button" onClick={() => setNewCred({ ...newCred, is_sandbox: true })} className={newCred.is_sandbox ? STYLES.buttonPrimary + ' !py-2 !text-xs flex-1' : STYLES.buttonSecondary + ' !py-2 !text-xs flex-1'}>SANDBOX</button>
                      <button type="button" onClick={() => setNewCred({ ...newCred, is_sandbox: false })} className={!newCred.is_sandbox ? STYLES.buttonPrimary + ' !py-2 !text-xs flex-1' : STYLES.buttonSecondary + ' !py-2 !text-xs flex-1'}>PRODUCTION</button>
                    </div>
                  </label>
                  <label className="block md:col-span-2">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">API Email (api_user) · opsional metadata</span>
                    <input type="email" className={STYLES.input} placeholder="toko@example.com" value={newCred.api_user} onChange={(e) => setNewCred({ ...newCred, api_user: e.target.value })} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">API Key (raw) *</span>
                    <input type="password" className={STYLES.input} placeholder="*****************" value={newCred.api_key} onChange={(e) => setNewCred({ ...newCred, api_key: e.target.value })} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Base URL Override (opsional)</span>
                    <input className={STYLES.input} placeholder="https://custom-endpoint.example (biarkan kosong = default prod/sandbox KA)" value={newCred.api_url_base} onChange={(e) => setNewCred({ ...newCred, api_url_base: e.target.value })} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Order ID Prefix (Format Order ID KA)</span>
                    <input className={STYLES.input} placeholder="LVA" value={newCred.order_id_prefix} onChange={(e) => setNewCred({ ...newCred, order_id_prefix: e.target.value })} />
                    <span className="mt-1 block text-[11px] text-gray-500">Harus sama dengan prefix yang terdaftar di dashboard KiriminAja → Integrasi. Alfanumerik 2–10 karakter; order_id menjadi {'{prefix}-{subscriber_id}-{ref}-{seq}'}.</span>
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2 justify-end">
                <button onClick={() => setAddModalOpen(false)} className={STYLES.buttonGhost}>Cancel</button>
                <button onClick={() => void submitNew()} disabled={!!actionLoading.add} className={STYLES.buttonPrimary}>
                  {actionLoading.add ? <Loader2 size={15} className="mr-2 inline align-text-top animate-spin" /> : <Save size={15} className="mr-2 inline align-text-top" />}
                  Save Credential
                </button>
              </div>
            </div>
          </div>
        )}

        {editCred && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
              <div className="px-6 pt-5 pb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Modal · Edit Credential</p>
                  <h3 className="mt-1 text-lg font-bold text-gray-900 flex items-center gap-2"><Pencil size={18} /> Edit Akun KiriminAja #{editCred.id}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">API Key & Email hanya bisa diubah dengan membuat credential baru. Di sini hanya label dan prefix order_id.</p>
                </div>
                <button onClick={() => setEditCred(null)} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-500" aria-label="Close"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block md:col-span-2">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Account Label *</span>
                    <input className={STYLES.input} placeholder="Contoh: Toko Utama - Production" value={editCred.account_label} onChange={(e) => setEditCred({ ...editCred, account_label: e.target.value })} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">Order ID Prefix (Format Order ID KA)</span>
                    <input className={STYLES.input} placeholder="LVA" value={editCred.order_id_prefix} onChange={(e) => setEditCred({ ...editCred, order_id_prefix: e.target.value })} />
                    <span className="mt-1 block text-[11px] text-gray-500">Harus sama dengan prefix yang terdaftar di dashboard KiriminAja → Integrasi. Alfanumerik 2–10 karakter; order_id menjadi {'{prefix}-{subscriber_id}-{ref}-{seq}'}.</span>
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2 justify-end">
                <button onClick={() => setEditCred(null)} className={STYLES.buttonGhost}>Cancel</button>
                <button onClick={() => void saveEdit()} disabled={!!actionLoading.edit} className={STYLES.buttonPrimary}>
                  {actionLoading.edit ? <Loader2 size={15} className="mr-2 inline align-text-top animate-spin" /> : <Save size={15} className="mr-2 inline align-text-top" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
