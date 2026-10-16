// =============================================================================
// PGIL Internal UI API helper — Path A (JWT) calls to PGIL admin edge functions
// =============================================================================

import type { BannerState, StandardEnvelope } from '../types/pgil.ts';
import { supabase } from './supabase.ts';

export type PgilApiCallVerb = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface CallPgilInternalUIOptions {
  method?: PgilApiCallVerb;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  transactionId?: string | null;
  isMutation?: boolean;
  timeoutMs?: number;
}

export type PgilCallResult<T> =
  | {
      ok: true;
      data: T;
      warnings?: string[];
      banner?: BannerState;
      httpStatus: number;
    }
  | {
      ok: false;
      banner: BannerState;
      httpStatus: number;
      fieldErrors?: Record<string, string[]>;
    };

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

export async function callPgilInternalUI<T>(
  functionName: string,
  opts: CallPgilInternalUIOptions = {}
): Promise<PgilCallResult<T>> {
  const urlBase = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
  if (!urlBase) {
    return {
      ok: false,
      httpStatus: 500,
      banner: {
        tone: 'danger',
        title: 'Konfigurasi Supabase belum lengkap',
        body: 'Set VITE_SUPABASE_URL di file .env sebelum memanggil PGIL API.',
      },
    };
  }

  const method: PgilApiCallVerb = (opts.method ?? (opts.body ? 'POST' : 'GET')) as PgilApiCallVerb;
  const isMutation = opts.isMutation ?? method !== 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '') as string,
  };

  try {
    const { data } = await supabase.auth.getSession();
    const jwt = data?.session?.access_token ?? null;
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
  } catch {
    // ignore
  }

  if (isMutation) {
    headers['X-PGIL-Transaction-ID'] =
      (opts.transactionId && opts.transactionId.length > 0) ? opts.transactionId : uuidv4();
  }

  const url = new URL(`${urlBase.replace(/\/$/, '')}/functions/v1/${functionName.replace(/^\/+/, '')}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v == null || v === undefined || v === '') continue;
      url.searchParams.append(k, String(v));
    }
  }

  const init: RequestInit = { method, headers };
  if (method !== 'GET' && opts.body !== undefined && opts.body !== null) {
    init.body = JSON.stringify(opts.body);
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
          : 'Cek koneksi internet atau coba lagi.',
      },
    };
  } finally {
    clearTimeout(timer);
  }

  const httpStatus = resp.status;
  const rawText = await resp.text().catch(() => '');
  let envelope: StandardEnvelope<T> | null = null;
  try {
    if (rawText.length > 0) envelope = JSON.parse(rawText) as StandardEnvelope<T>;
  } catch {
    envelope = null;
  }

  if (httpStatus >= 200 && httpStatus < 300 && (!envelope || envelope.success !== false)) {
    return {
      ok: true,
      data: (envelope?.data ?? (rawText ? (JSON.parse(rawText) as T) : (null as unknown as T))),
      warnings: envelope?.warnings ?? undefined,
      banner: envelope?.banner ?? null,
      httpStatus,
    };
  }

  const envelopeErrors = envelope?.errors ?? [];
  const fieldErrors = groupFieldErrors(envelopeErrors ?? []);

  if (httpStatus === 401) {
    return {
      ok: false,
      httpStatus,
      banner: {
        tone: 'danger',
        title: 'Sesi habis (401)',
        body: 'Silakan login kembali untuk melanjutkan.',
      },
    };
  }
  if (httpStatus === 403) {
    return {
      ok: false,
      httpStatus,
      banner: {
        tone: 'danger',
        title: 'Akses dilarang (403)',
        body: 'Akun Anda tidak memiliki permission code yang dibutuhkan untuk PGIL.',
      },
    };
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return {
      ok: false,
      httpStatus,
      fieldErrors,
      banner: {
        tone: 'danger',
        title: 'Permintaan tidak valid',
        body: envelopeErrors?.[0]?.message ?? `HTTP ${httpStatus}`,
      },
    };
  }
  if (httpStatus >= 500) {
    return {
      ok: false,
      httpStatus,
      banner: {
        tone: 'danger',
        title: `Kesalahan server (${httpStatus})`,
        body: envelopeErrors?.[0]?.message ?? 'Internal server error.',
      },
    };
  }

  return {
    ok: false,
    httpStatus,
    banner: {
      tone: 'danger',
      title: 'Response tidak terduga',
      body: `Status ${httpStatus} tidak masuk ke dalam banner mapping.`,
    },
  };
}
