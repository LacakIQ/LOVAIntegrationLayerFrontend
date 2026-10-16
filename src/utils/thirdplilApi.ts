import type { BannerMessage, StandardEnvelope } from '../types/thirdplil.ts';
import { supabase } from './supabase.ts';

export const PIN_FIELD_PATHS: string[] = [
  'payment.pin',
  'payment.ka_pin',
  'ka_credit_pin',
  'shipment.payment.pin',
];

export type ThirdPLILApiCallVerb = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface CallThirdPLILInternalUIOptions {
  method?: ThirdPLILApiCallVerb;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  transactionId?: string | null;
  credentialId?: number | null;
  excludeFromLog?: string[];
  isMutation?: boolean;
  timeoutMs?: number;
}

export type CallResult<T> =
  | {
      ok: true;
      data: T;
      isDuplicate: false;
      duplicateOfId?: never;
      warnings?: string[];
      banner?: BannerMessage | null;
      httpStatus: number;
    }
  | {
      ok: true;
      data: T | null;
      isDuplicate: true;
      duplicateOfId?: number | string | null;
      warnings?: string[];
      banner?: BannerMessage | null;
      httpStatus: number;
    }
  | {
      ok: false;
      banner: BannerMessage;
      envelopeErrors?: StandardEnvelope<never>['errors'];
      httpStatus: number;
      fieldErrors?: Record<string, string[]>;
    };

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const h = (n: number) => (n === 8 ? 'xxxxxxxx' : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx');
  const pattern = h(0);
  return pattern.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function filterByPaths<T = unknown>(obj: T, paths: string[]): T {
  if (!obj || !Array.isArray(paths) || paths.length === 0) return obj;
  if (typeof obj !== 'object') return obj;
  const rec = obj as Record<string, unknown>;
  const clone = Array.isArray(rec) ? [...(rec as unknown[])] : { ...rec };
  for (const p of paths) {
    if (!p) continue;
    const parts = p.split('.');
    let cur: Record<string, unknown> | unknown[] = clone as Record<string, unknown>;
    for (let i = 0; i < parts.length; i++) {
      const k = parts[i];
      if (cur == null || typeof cur !== 'object') break;
      if (i === parts.length - 1) {
        if (Array.isArray(cur)) {
          const idx = parseInt(k, 10);
          if (!Number.isNaN(idx) && idx >= 0 && idx < cur.length) cur[idx] = undefined as unknown;
        } else {
          (cur as Record<string, unknown>)[k] = undefined;
        }
      } else {
        if (Array.isArray(cur)) {
          const idx = parseInt(k, 10);
          if (!Number.isNaN(idx) && idx >= 0 && idx < cur.length) cur = cur[idx] as Record<string, unknown>;
          else break;
        } else {
          cur = (cur as Record<string, unknown>)[k] as Record<string, unknown>;
        }
      }
    }
  }
  return clone as T;
}

function groupFieldErrors(errors: NonNullable<StandardEnvelope<never>['errors']>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of errors) {
    if (!e.field) continue;
    if (!out[e.field]) out[e.field] = [];
    out[e.field].push(e.message);
  }
  return out;
}

export async function callThirdPLILInternalUI<T>(
  functionName: string,
  opts: CallThirdPLILInternalUIOptions = {}
): Promise<CallResult<T>> {
  const urlBase = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
  if (!urlBase) {
    return {
      ok: false,
      banner: {
        tone: 'danger',
        title: 'Konfigurasi Supabase belum lengkap',
        body: 'Set VITE_SUPABASE_URL di file .env sebelum memanggil ThirdPLIL API.',
      },
      httpStatus: 500,
    };
  }

  const method: ThirdPLILApiCallVerb = (opts.method ?? (opts.body ? 'POST' : 'GET')) as ThirdPLILApiCallVerb;
  const isMutation = opts.isMutation ?? method !== 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '') as string,
  };

  try {
    const { data } = await supabase.auth.getSession();
    const jwt = data?.session?.access_token ?? null;
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
  } catch {
  }

  if (opts.credentialId && opts.credentialId > 0) {
    headers['X-ThirdPLIL-Credential-Id'] = String(opts.credentialId);
  }

  if (isMutation) {
    headers['X-ThirdPLIL-Transaction-ID'] =
      (opts.transactionId && opts.transactionId.length > 0) ? opts.transactionId : uuidv4();
  }

  const url = new URL(`${urlBase.replace(/\/$/, '')}/functions/v1/${functionName.replace(/^\/+/, '')}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v == null || v === undefined || v === '') continue;
      url.searchParams.append(k, String(v));
    }
  }

  let safeBody: unknown = opts.body;
  if (opts.body != null && Array.isArray(opts.excludeFromLog) && opts.excludeFromLog.length > 0) {
    safeBody = filterByPaths(opts.body, opts.excludeFromLog);
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && safeBody !== undefined && safeBody !== null) {
    init.body = JSON.stringify(safeBody);
  }

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(url.toString(), { ...init, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      httpStatus: 0,
      banner: {
        tone: 'danger',
        title: isAbort ? 'Permintaan melebihi batas waktu' : 'Koneksi ke server gagal',
        body: isAbort
          ? `Timeout setelah ${timeoutMs / 1000}s. Silakan coba beberapa saat lagi.`
          : 'Cek koneksi internet atau coba lagi. Detail: ' + (err instanceof Error ? err.message : String(err)),
      },
    };
  } finally {
    clearTimeout(timer);
  }

  const httpStatus = resp.status;
  let envelope: StandardEnvelope<T> | null = null;
  const rawText = await resp.text().catch(() => '');
  try {
    if (rawText.length > 0) envelope = JSON.parse(rawText) as StandardEnvelope<T>;
  } catch {
    envelope = null;
  }

  if (httpStatus === 409 || (envelope && envelope.is_duplicate === true)) {
    return {
      ok: true,
      isDuplicate: true,
      data: (envelope?.data ?? null) as T | null,
      duplicateOfId: envelope?.duplicate_of_id ?? null,
      warnings: envelope?.warnings ?? undefined,
      httpStatus,
      banner: {
        tone: 'info',
        title: 'Transaksi duplikat terdeteksi (idempotency key sama)',
        body: envelope?.duplicate_of_id
          ? `Shipment/record asli ID: ${String(envelope.duplicate_of_id)}. Gunakan record tersebut, bukan membuat baru.`
          : 'Permintaan dengan transaction_id ini sebelumnya sudah berhasil diproses. Tidak ada data baru yang ditulis.',
      },
    };
  }

  if (httpStatus >= 200 && httpStatus < 300 && (!envelope || envelope.success === true || envelope.success === undefined)) {
    return {
      ok: true,
      isDuplicate: false,
      data: (envelope?.data ?? null) as T,
      warnings: envelope?.warnings ?? undefined,
      httpStatus,
    };
  }

  const envelopeErrors = envelope?.errors ?? [];
  const fieldErrors = groupFieldErrors(envelopeErrors ?? []);
  const hasFields = Object.keys(fieldErrors).length > 0;

  if (httpStatus === 401) {
    return {
      ok: false,
      httpStatus,
      envelopeErrors,
      fieldErrors,
      banner: {
        tone: 'danger',
        title: 'Sesi habis (401)',
        body: 'Silakan login kembali untuk melanjutkan. JWT expired / missing.',
      },
    };
  }
  if (httpStatus === 403) {
    return {
      ok: false,
      httpStatus,
      envelopeErrors,
      fieldErrors,
      banner: {
        tone: 'danger',
        title: 'Akses dilarang (403)',
        body: 'Akun Anda tidak memiliki permission code yang dibutuhkan. Hubungan admin subscriber Anda untuk menambahkan role thirdplil.* yang sesuai.',
      },
    };
  }
  if (httpStatus === 422) {
    const firstMsgs = Object.entries(fieldErrors)
      .slice(0, 5)
      .map(([k, v]) => `• ${k}: ${v.join('; ')}`);
    return {
      ok: false,
      httpStatus,
      envelopeErrors,
      fieldErrors,
      banner: {
        tone: 'danger',
        title: 'Validasi gagal (422)',
        body: hasFields
          ? firstMsgs.length > 0
            ? firstMsgs.join('\n')
            : (envelopeErrors?.[0]?.message ?? 'Periksa kembali inputan Anda.')
          : (envelopeErrors?.[0]?.message ?? 'Kesalahan validasi input'),
      },
    };
  }
  if (httpStatus === 400 || (httpStatus >= 400 && httpStatus < 409)) {
    return {
      ok: false,
      httpStatus,
      envelopeErrors,
      fieldErrors,
      banner: {
        tone: 'danger',
        title: 'Permintaan tidak valid (4xx)',
        body: (envelopeErrors?.[0]?.message ?? `Kesalahan ${httpStatus}: cek parameter / field input Anda.`),
      },
    };
  }
  if (httpStatus === 503) {
    return {
      ok: false,
      httpStatus,
      envelopeErrors,
      fieldErrors,
      banner: {
        tone: 'warning',
        title: 'Provider KiriminAja sementara tidak dapat dihubungi (503)',
        body: 'Silakan coba lagi 2-5 menit kemudian, atau pilih provider lain jika tersedia.',
      },
    };
  }
  if (httpStatus >= 500) {
    return {
      ok: false,
      httpStatus,
      envelopeErrors,
      fieldErrors,
      banner: {
        tone: 'danger',
        title: `Kesalahan server (${httpStatus})`,
        body: (envelopeErrors?.[0]?.message ?? 'Internal server error. Team ThirdPLIL backend akan segera menanggapi. Error sudah tercatat otomatis via structured logger edge function.'),
      },
    };
  }

  return {
    ok: false,
    httpStatus,
    envelopeErrors,
    fieldErrors,
    banner: {
      tone: 'danger',
      title: 'Response tidak terduga',
      body: `Status ${httpStatus} tidak masuk ke dalam banner mapping yang diketahui. (silakan lapor bug ke FE team).`,
    },
  };
}
