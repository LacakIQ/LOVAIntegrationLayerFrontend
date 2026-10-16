import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Loader2, Search } from 'lucide-react';
import { STYLES } from '../../components/ui/STYLES';
import TransactionStatusBadge from '../../components/pgil/TransactionStatusBadge';
import TransactionDetailDrawer from '../../components/pgil/TransactionDetailDrawer';
import { callPgilInternalUI } from '../../utils/pgilApi';
import type { BannerState, PagedListResponse, Transaction, TransactionStatus } from '../../types/pgil';

const STATUS_FILTERS: (TransactionStatus | 'all')[] = [
  'all', 'awaiting_payment', 'capture', 'settlement', 'partial_refund', 'refunded', 'deny', 'cancel', 'expire', 'failed',
];

function idr(n: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
}

export default function TransactionsView() {
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [banner, setBanner] = useState<BannerState>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const loadData = async () => {
    setLoading(true);
    setBanner(null);
    const q: Record<string, string> = { page: String(page), per_page: String(perPage) };
    if (statusFilter !== 'all') q.status = statusFilter;
    if (search.trim()) q.q = search.trim();
    const res = await callPgilInternalUI<PagedListResponse<Transaction>>('pgil-admin-transactions', { method: 'GET', query: q });
    setLoading(false);
    if (res.ok) {
      setRows(res.data.rows ?? []);
      setTotalRows(res.data.total_rows ?? 0);
      setTotalPages(res.data.total_pages ?? 1);
      if (res.data.banner) setBanner(res.data.banner);
    } else {
      setBanner(res.banner);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: totalRows };
    rows.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
    return counts;
  }, [rows, totalRows]);

  return (
    <div className="space-y-4">
      <div className={STYLES.pageCard + ' p-6'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Payment Gateway</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">Transactions</h2>
            <p className="mt-1 text-sm text-gray-500">All Midtrans Snap transactions for this subscriber.</p>
          </div>
        </div>

        {banner && (
          <div className={'mt-4 p-4 rounded-2xl border ' + (
            banner.tone === 'success' ? STYLES.bannerSuccess :
            banner.tone === 'warning' ? STYLES.bannerWarning :
            banner.tone === 'danger' ? STYLES.bannerDanger : STYLES.bannerInfo
          )}>
            <p className="font-semibold">{banner.title}</p>
            {banner.body && <p className="mt-1 text-sm opacity-90">{banner.body}</p>}
          </div>
        )}

        {/* Search */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search order ref / customer..."
              className="w-64 bg-transparent text-sm outline-none"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Status filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={
                (statusFilter === s ? STYLES.buttonPrimary : STYLES.buttonSecondary) +
                ' !py-1.5 !text-xs'
              }
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
              <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold">
                {statusCounts[s] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Order Ref</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  <Loader2 size={20} className="mx-auto mb-2 animate-spin text-blue-600" /> Loading...
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No transactions found.</td></tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.transaction_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-medium text-gray-900">{t.external_order_ref}</p>
                      {t.provider_order_id && <p className="font-mono text-xs text-gray-400">{t.provider_order_id}</p>}
                    </td>
                    <td className="px-4 py-3"><TransactionStatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-gray-700">{t.payment_channel ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{t.customer_name ?? '—'}</p>
                      {t.customer_email && <p className="text-xs text-gray-500">{t.customer_email}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{idr(t.gross_amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelected(t)}
                        className={STYLES.buttonGhost + ' !py-1.5 !text-xs'}
                      >
                        <Eye size={14} className="mr-1 inline align-text-top" /> Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-gray-500">{totalRows} total · page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}
              >
                <ChevronLeft size={14} className="inline align-text-top" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={STYLES.buttonSecondary + ' !py-1.5 !text-xs'}
              >
                Next <ChevronRight size={14} className="inline align-text-top" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <TransactionDetailDrawer
          transaction={selected}
          onClose={() => setSelected(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
