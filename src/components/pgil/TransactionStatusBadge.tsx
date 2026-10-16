import type { TransactionStatus } from '../../types/pgil';

const STATUS_CONFIG: Record<TransactionStatus, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  created: { label: 'Created', tone: 'neutral' },
  awaiting_payment: { label: 'Awaiting Payment', tone: 'warning' },
  capture: { label: 'Captured', tone: 'info' },
  settlement: { label: 'Settled', tone: 'success' },
  partial_refund: { label: 'Partial Refund', tone: 'info' },
  refunded: { label: 'Refunded', tone: 'info' },
  deny: { label: 'Denied', tone: 'danger' },
  cancel: { label: 'Cancelled', tone: 'neutral' },
  expire: { label: 'Expired', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
};

const TONE_CLASSES: Record<string, string> = {
  neutral: 'border-gray-200 bg-gray-50 text-gray-700',
  success: 'border-green-200 bg-green-100 text-green-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
};

export default function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, tone: 'neutral' as const };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[cfg.tone]}`}>
      {cfg.label}
    </span>
  );
}
