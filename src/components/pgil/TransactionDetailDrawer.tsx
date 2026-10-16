import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { STYLES, Badge } from '../ui/STYLES';
import TransactionStatusBadge from './TransactionStatusBadge';
import { callPgilInternalUI } from '../../utils/pgilApi';
import type { BannerState, Refund, Transaction, TransactionStatusHistory } from '../../types/pgil';

function idr(n: number | string | null | undefined): string {
  const val = typeof n === 'string' ? parseFloat(n.replace(/[^0-9.]/g, '')) || 0 : Number(n ?? 0);
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(val));
}

export default function TransactionDetailDrawer({
  transaction,
  onClose,
  onRefresh,
}: {
  transaction: Transaction;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [history, setHistory] = useState<TransactionStatusHistory[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const loadDetail = async () => {
    setLoadingDetail(true);
    setBanner(null);
    const res = await callPgilInternalUI<{ transaction: Transaction; status_history: TransactionStatusHistory[]; refunds: Refund[] }>(
      `pgil-admin-transactions/${transaction.transaction_id}`,
      { method: 'GET' }
    );
    setLoadingDetail(false);
    if (res.ok) {
      setHistory(res.data.status_history ?? []);
      setRefunds(res.data.refunds ?? []);
      if (res.banner) setBanner(res.banner);
    } else {
      setBanner(res.banner);
    }
  };

  // auto-load on mount
  useEffect(() => { void loadDetail(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRefunded = refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
  const remaining = transaction.gross_amount - totalRefunded;
  const canRefund = ['capture', 'settlement'].includes(transaction.status) && remaining > 0;

  const submitRefund = async () => {
    const amt = parseFloat(refundAmount.replace(/[^0-9.]/g, ''));
    if (!amt || amt <= 0) {
      setBanner({ tone: 'warning', title: 'Invalid amount', body: 'Enter a valid refund amount greater than 0.' });
      return;
    }
    if (amt > remaining) {
      setBanner({ tone: 'warning', title: 'Amount exceeds remaining', body: `Max refundable: ${idr(remaining)}` });
      return;
    }
    setRefundLoading(true);
    const res = await callPgilInternalUI<{ refund: Refund }>(
      `pgil-admin-transactions/${transaction.transaction_id}/refund`,
      { method: 'POST', isMutation: true, body: { amount: amt, reason: refundReason || null } }
    );
    setRefundLoading(false);
    if (res.ok) {
      setBanner({ tone: 'success', title: 'Refund submitted' });
      setRefundOpen(false);
      setRefundAmount('');
      setRefundReason('');
      await loadDetail();
      onRefresh();
    } else {
      setBanner(res.banner);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Transaction Detail</p>
            <h3 className="mt-1 truncate text-lg font-bold text-gray-900">
              {transaction.external_order_ref}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TransactionStatusBadge status={transaction.status} />
              {transaction.payment_channel && <Badge tone="neutral" label={transaction.payment_channel} />}
              {transaction.fraud_status && <Badge tone="warning" label={`fraud: ${transaction.fraud_status}`} />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadDetail()} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Refresh">
              {loadingDetail ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            </button>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {banner && (
            <div className={
              banner.tone === 'success' ? STYLES.bannerSuccess :
              banner.tone === 'warning' ? STYLES.bannerWarning :
              banner.tone === 'danger' ? STYLES.bannerDanger : STYLES.bannerInfo
            }>
              <p className="font-semibold">{banner.title}</p>
              {banner.body && <p className="mt-1 text-sm opacity-90">{banner.body}</p>}
            </div>
          )}

          {/* Amount summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Gross Amount</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{idr(transaction.gross_amount)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Refunded</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{idr(totalRefunded)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Remaining</p>
              <p className="mt-1 text-xl font-bold text-green-700">{idr(remaining)}</p>
            </div>
          </div>

          {/* Customer */}
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-900">{transaction.customer_name ?? '—'}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="font-medium text-gray-900">{transaction.customer_email ?? '—'}</span></div>
              <div><span className="text-gray-500">Phone:</span> <span className="font-medium text-gray-900">{transaction.customer_phone ?? '—'}</span></div>
              <div><span className="text-gray-500">Currency:</span> <span className="font-medium text-gray-900">{transaction.currency}</span></div>
            </div>
          </div>

          {/* Items */}
          {transaction.item_details_json && transaction.item_details_json.length > 0 && (
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Items</p>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-2 font-medium">Name</th>
                    <th className="py-1 pr-2 font-medium">Qty</th>
                    <th className="py-1 pr-2 font-medium">Price</th>
                    <th className="py-1 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.item_details_json.map((it, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1.5 pr-2 font-medium text-gray-900">{it.name}</td>
                      <td className="py-1.5 pr-2 text-gray-700">{it.qty}</td>
                      <td className="py-1.5 pr-2 text-gray-700">{idr(it.price)}</td>
                      <td className="py-1.5 text-right text-gray-900">{idr(it.price * it.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Snap token / payment URL */}
          {(transaction.snap_token || transaction.payment_url) && (
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Snap Payment</p>
              {transaction.snap_token && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Snap Token</p>
                  <code className="mt-0.5 block break-all font-mono text-xs text-gray-700">{transaction.snap_token}</code>
                </div>
              )}
              {transaction.payment_url && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Payment URL</p>
                  <a href={transaction.payment_url} target="_blank" rel="noreferrer" className="mt-0.5 block break-all font-mono text-xs text-blue-600 hover:underline">
                    {transaction.payment_url}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Refund action */}
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 p-4">
            <div>
              <p className="font-semibold text-gray-900">Issue Refund</p>
              <p className="text-xs text-gray-500">Full or partial refund via Midtrans refund API.</p>
            </div>
            <button
              onClick={() => setRefundOpen(true)}
              disabled={!canRefund}
              className={STYLES.buttonPrimary + ' !py-2 !text-xs'}
            >
              Refund
            </button>
          </div>

          {/* Status history */}
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status History</p>
            <div className="mt-3 space-y-3">
              {loadingDetail ? (
                <p className="text-sm text-gray-500">Loading history...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-500">No history recorded.</p>
              ) : (
                history.map((h) => (
                  <div key={h.history_id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900">{h.previous_status ?? '—'}</span>
                        <span className="text-gray-400">→</span>
                        <TransactionStatusBadge status={h.new_status} />
                      </div>
                      {h.transition_reason && <p className="mt-0.5 text-xs text-gray-500">{h.transition_reason}</p>}
                      <p className="mt-0.5 text-xs text-gray-400">
                        {h.actor ?? 'system'} · {new Date(h.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Refunds list */}
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Refunds</p>
            {refunds.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No refunds.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1 pr-2 font-medium">Amount</th>
                    <th className="py-1 pr-2 font-medium">Status</th>
                    <th className="py-1 pr-2 font-medium">Reason</th>
                    <th className="py-1 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.refund_id} className="border-t border-gray-100">
                      <td className="py-1.5 pr-2 font-medium text-gray-900">{idr(r.amount)}</td>
                      <td className="py-1.5 pr-2"><Badge tone="info" label={r.status} /></td>
                      <td className="py-1.5 pr-2 text-gray-700">{r.reason ?? '—'}</td>
                      <td className="py-1.5 text-right text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Refund modal */}
      {refundOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Issue Refund</h3>
            <p className="mt-1 text-sm text-gray-500">Remaining refundable: <span className="font-bold text-green-700">{idr(remaining)}</span></p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700 mb-1">Amount (IDR) *</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={STYLES.input}
                  placeholder="e.g. 50000"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700 mb-1">Reason</span>
                <input
                  className={STYLES.input}
                  placeholder="Optional reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRefundOpen(false)} className={STYLES.buttonGhost}>Cancel</button>
              <button onClick={() => void submitRefund()} disabled={refundLoading} className={STYLES.buttonPrimary}>
                {refundLoading ? <Loader2 size={15} className="mr-2 inline animate-spin align-text-top" /> : null}
                Submit Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
