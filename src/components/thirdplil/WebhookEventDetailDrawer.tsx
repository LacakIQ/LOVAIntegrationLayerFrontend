import { useEffect, useState } from 'react';
import { Check, Copy, Webhook as WebhookIcon } from 'lucide-react';
import { STYLES, Section, Badge } from '../ui/STYLES.tsx';

export interface WebhookEventDetailDrawerProps {
  open: boolean;
  /** The raw event/queue row as returned by GET /events or GET /dlq. */
  row: Record<string, unknown> | null;
  onClose: () => void;
}

const LABELS: Record<string, string> = {
  id: 'ID',
  event_id: 'Event ID',
  queue_id: 'Queue ID',
  direction: 'Direction',
  event_name: 'Event name',
  event_type: 'Event type',
  provider_event_id: 'Provider event ID',
  provider_event_type: 'Provider event type',
  provider_shipment_ref: 'Provider shipment ref',
  our_shipment_id: 'Shipment ID',
  shipment_id: 'Shipment ID',
  consumer_id: 'Consumer ID',
  registration_id: 'Registration ID',
  provider_id: 'Provider ID',
  credential_id: 'Credential ID',
  subscriber_id: 'Subscriber ID',
  mapped_status: 'Mapped status',
  mapped_event_type: 'Mapped event type',
  processed_successfully: 'Processed OK',
  processing_error: 'Processing error',
  duplicate_of_event_id: 'Duplicate of event',
  delivery_status: 'Delivery status',
  attempts_count: 'Attempts',
  attempt_count: 'Attempts',
  attempts: 'Attempts',
  max_attempts: 'Max attempts',
  last_http_status: 'Last HTTP status',
  delivery_http_status: 'Delivery HTTP status',
  last_error_code: 'Last error code',
  last_error_message: 'Last error message',
  next_retry_at: 'Next retry',
  occurred_at: 'Occurred at',
  received_at: 'Received at',
  created_at: 'Created at',
  processed_at: 'Processed at',
  dlqed_at: 'DLQ at',
  last_delivery_at: 'Last delivery',
  idempotency_key: 'Idempotency key',
  event_idempotency_key: 'Idempotency key',
  inbound_event_id: 'Inbound event ID',
  inbound_webhook_event_id: 'Inbound event ID',
  sort_at: 'Sort at',
};

// Keys rendered as dedicated JSON/text blocks rather than grid scalars.
const JSON_KEYS = new Set([
  'payload',
  'payload_jsonb',
  'parsed_body',
  'raw_headers',
  'raw_query_params',
  'registration',
  'transition_reason',
  'last_response_body',
  'last_response_text',
  'raw_body',
]);

const BLOCK_LABELS: Record<string, string> = {
  raw_body: 'Raw body (as received)',
  parsed_body: 'Parsed body (JSON)',
  raw_headers: 'Raw headers (JSON)',
  raw_query_params: 'Raw query params (JSON)',
  payload: 'Outbound payload',
  payload_jsonb: 'Outbound payload',
  registration: 'Registration target',
  transition_reason: 'Transition reason',
  last_response_body: 'Consumer response body',
  last_response_text: 'Consumer response body',
};

function labelFor(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isTimestampKey(key: string): boolean {
  return /_at$/.test(key);
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} WIB`;
}

function looksJson(s: string): boolean {
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

function pretty(value: unknown): string {
  if (typeof value === 'string') {
    if (looksJson(value)) {
      try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
    }
    return value;
  }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={STYLES.buttonGhost + ' !px-2 !py-1 !text-[11px]'}
    >
      {copied ? <><Check size={12} className="mr-1 inline align-text-top text-green-600" />Copied</> : <><Copy size={12} className="mr-1 inline align-text-top" />Copy</>}
    </button>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const text = pretty(value);
  if (text === '' || value == null) return null;
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <CopyButton text={text} />
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-gray-800 whitespace-pre-wrap break-all max-h-80 overflow-auto bg-white">{text}</pre>
    </div>
  );
}

function scalarTone(value: unknown): 'success' | 'danger' | 'neutral' {
  if (value === true) return 'success';
  if (value === false) return 'danger';
  return 'neutral';
}

function scalarText(key: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && isTimestampKey(key)) return formatTs(value);
  return String(value);
}

export default function WebhookEventDetailDrawer({ open, row, onClose }: WebhookEventDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open || !row) return null;

  const direction = (row.direction as string) || (row.queue_id != null ? 'outbound' : 'inbound');
  const status = (row.delivery_status as string) || (row.processed_successfully === true ? 'processed' : null);
  const eventName = (row.event_name ?? row.event_type ?? row.provider_event_type ?? '—') as string;
  const rowId = (row.id ?? row.event_id ?? row.queue_id ?? '—') as string | number;

  const entries = Object.entries(row).filter(([, v]) => v !== undefined);
  const jsonEntries = entries.filter(([k, v]) => JSON_KEYS.has(k) || (v !== null && typeof v === 'object') || (typeof v === 'string' && looksJson(v)));
  const scalarEntries = entries.filter(([k, v]) => !jsonEntries.some(([jk]) => jk === k));

  const statusTone: 'info' | 'success' | 'warning' | 'danger' | 'neutral' =
    status === 'sent' || status === 'succeeded' || status === 'processed' || status === 'dedup' ? 'success' :
    status === 'queued' || status === 'replayed' ? 'info' :
    status === 'dead_letter' || status === 'dlq' ? 'danger' :
    status === 'failed' ? 'warning' : 'neutral';

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-3xl h-full bg-white shadow-2xl overflow-y-auto border-l border-gray-200 animate-[slideInRight_0.25s_ease-out]">
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={direction === 'inbound' ? 'info' : 'warning'} label={direction} />
              {status && <Badge tone={statusTone} label={status} />}
              {row.last_http_status != null && (
                <Badge tone={Number(row.last_http_status) >= 200 && Number(row.last_http_status) < 300 ? 'success' : 'danger'} label={`HTTP ${row.last_http_status}`} />
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold text-gray-900 flex items-center gap-2 break-words">
              <WebhookIcon size={20} className="text-blue-600 flex-shrink-0" />
              {eventName}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5 font-mono">#{String(rowId)}</p>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton text={pretty(row)} />
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100 text-gray-500" aria-label="Close">✕</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          <Section kicker="Event · Fields" title="Event metadata" subtitle="Full row as returned by the admin webhooks API (select *). Timestamps shown in WIB (Asia/Jakarta).">
            <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {scalarEntries.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 border-b border-gray-100 py-1.5">
                  <span className="text-xs text-gray-500">{labelFor(k)}</span>
                  {typeof v === 'boolean' ? (
                    <Badge tone={scalarTone(v)} label={v ? 'Yes' : 'No'} />
                  ) : (
                    <span className={'font-mono text-xs text-right break-all ' + (v == null ? 'text-gray-300' : 'text-gray-800')}>{scalarText(k, v)}</span>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {jsonEntries.length > 0 && (
            <Section kicker="Event · Payload" title="Bodies, headers & response" subtitle="Raw provider body, parsed body, headers, and the consumer's last response body — pretty-printed.">
              <div className="space-y-4">
                {jsonEntries.map(([k, v]) => (
                  <JsonBlock key={k} label={BLOCK_LABELS[k] ?? labelFor(k)} value={v} />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
