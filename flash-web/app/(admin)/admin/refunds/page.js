'use client';
import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Search, Calendar, Undo2, AlertTriangle, Globe, Store as StoreIcon, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

const NETWORK_LABELS = { YELLO: 'MTN', TELECEL: 'Telecel', AT_PREMIUM: 'AirtelTigo' };

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function AdminRefundsPage() {
  const [tab, setTab] = useState('refunded'); // 'refunded' | 'awaiting'
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const [from, setFrom] = useState(daysAgoStr(7));
  const [to, setTo] = useState(todayStr());
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all'); // 'all' | 'portal' | 'store'

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchRows = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search.trim()) params.set('search', search.trim());
      if (source !== 'all') params.set('source', source);

      const url = tab === 'refunded'
        ? `/admin/refunds?${params.toString()}`
        : `/admin/orders/awaiting-refund?${params.toString()}`;
      const res = await api.get(url);
      const list = tab === 'refunded'
        ? (res.data.data.refunds || [])
        : (res.data.data.orders || []);
      setRows(list);
      setCount(res.data.data.count || 0);
      setTotalAmount(res.data.data.totalAmount || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const reverseRefund = async (purchase) => {
    const userName = purchase.userId?.name || purchase.userId?.email || 'this user';
    const msg =
      `Reverse refund for ${userName}?\n\n` +
      `Order: ${purchase.capacity}GB ${NETWORK_LABELS[purchase.network] || purchase.network} → ${purchase.phoneNumber}\n` +
      `Amount to debit: ${formatCurrency(purchase.price)}\n\n` +
      `The user's wallet will be debited by this amount. It may go negative — that's OK.`;
    if (!confirm(msg)) return;

    setActingId(purchase._id);
    try {
      const res = await api.post(`/admin/refunds/${purchase._id}/reverse`);
      const newBalance = res.data.data?.userWalletBalance;
      const balanceMsg = newBalance != null
        ? ` New wallet balance: ${formatCurrency(newBalance)}.`
        : '';
      toast.success(`Refund reversed.${balanceMsg}`);
      setRows(prev => prev.filter(r => r._id !== purchase._id));
      setCount(prev => Math.max(0, prev - 1));
      setTotalAmount(prev => Math.max(0, prev - (purchase.price || 0)));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reverse refund');
    } finally {
      setActingId(null);
    }
  };

  const issueRefund = async (purchase) => {
    const userName = purchase.userId?.name || purchase.userId?.email || 'this user';
    const msg =
      `Refund ${userName}?\n\n` +
      `Order: ${purchase.capacity}GB ${NETWORK_LABELS[purchase.network] || purchase.network} → ${purchase.phoneNumber}\n` +
      `Amount to credit: ${formatCurrency(purchase.price)}\n\n` +
      `Make sure this order really wasn't delivered.`;
    if (!confirm(msg)) return;

    setActingId(purchase._id);
    try {
      await api.post(`/admin/orders/${purchase._id}/refund`);
      toast.success(`Refund issued: ${formatCurrency(purchase.price)}`);
      setRows(prev => prev.filter(r => r._id !== purchase._id));
      setCount(prev => Math.max(0, prev - 1));
      setTotalAmount(prev => Math.max(0, prev - (purchase.price || 0)));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refund');
    } finally {
      setActingId(null);
    }
  };

  const isRefundedTab = tab === 'refunded';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Refunds</h1>
        <p className="text-text-muted text-sm mt-1">
          Auto-refunds are off. Issue refunds for failed orders and reverse refunds that were given by mistake.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-light rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('refunded')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-colors ${
            isRefundedTab ? 'bg-primary text-white' : 'text-text-muted hover:text-white'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refunded
        </button>
        <button
          onClick={() => setTab('awaiting')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-colors ${
            !isRefundedTab ? 'bg-primary text-white' : 'text-text-muted hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Awaiting refund
        </button>
      </div>

      {/* Filter form */}
      <Card>
        <form onSubmit={fetchRows} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">From</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-light border border-white/10 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">To</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-light border border-white/10 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Search (phone or reference)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="024XXXXXXX or PUR-..."
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-light border border-white/10 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Source</label>
              <div className="flex bg-surface-light rounded-lg p-0.5 border border-white/10">
                {[
                  { v: 'all', label: 'All' },
                  { v: 'portal', label: 'Portal', icon: Globe },
                  { v: 'store', label: 'Store', icon: StoreIcon },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = source === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setSource(opt.v)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
                        active ? 'bg-primary text-white' : 'text-text-muted hover:text-white'
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3" />} {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setFrom(todayStr()); setTo(todayStr()); }}
                className="text-[11px] font-bold text-text-muted hover:text-primary px-3 py-1.5 bg-surface-light rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => { setFrom(daysAgoStr(7)); setTo(todayStr()); }}
                className="text-[11px] font-bold text-text-muted hover:text-primary px-3 py-1.5 bg-surface-light rounded-lg transition-colors"
              >
                Last 7 days
              </button>
              <button
                type="button"
                onClick={() => { setFrom(daysAgoStr(30)); setTo(todayStr()); }}
                className="text-[11px] font-bold text-text-muted hover:text-primary px-3 py-1.5 bg-surface-light rounded-lg transition-colors"
              >
                Last 30 days
              </button>
              <button
                type="button"
                onClick={() => { setFrom(''); setTo(''); }}
                className="text-[11px] font-bold text-text-muted hover:text-primary px-3 py-1.5 bg-surface-light rounded-lg transition-colors"
              >
                All time
              </button>
            </div>
            <Button type="submit" size="sm" loading={loading}>
              <RefreshCw className="w-3.5 h-3.5" /> Apply filters
            </Button>
          </div>
        </form>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-text-muted">{isRefundedTab ? 'Refunds in range' : 'Failed orders awaiting refund'}</p>
          <p className="text-2xl font-extrabold text-white">{count}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">{isRefundedTab ? 'Total refunded' : 'Total at-risk amount'}</p>
          <p className="text-2xl font-extrabold text-white">{formatCurrency(totalAmount)}</p>
        </Card>
      </div>

      {/* Tab-specific notice */}
      {isRefundedTab ? (
        <Card className="!border-accent/30 bg-accent/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Reversing a refund debits the user&apos;s wallet</p>
              <p className="text-text-muted text-xs mt-1">
                Use this only when the order was actually delivered but had been refunded.
                The user&apos;s wallet is allowed to go negative — they&apos;ll need to top up before their next purchase.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="!border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Auto-refunds are disabled</p>
              <p className="text-text-muted text-xs mt-1">
                Failed orders stay failed until you refund them here. Verify the order really wasn&apos;t delivered before issuing a refund.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Rows table */}
      <Card>
        {loading && !rows.length ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : !rows.length ? (
          <p className="text-text-muted text-sm text-center py-12">
            {isRefundedTab ? 'No refunds match your filters.' : 'No failed orders awaiting refund.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">User</th>
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Order</th>
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">{isRefundedTab ? 'Refunded' : 'Failed'}</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Amount</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-3">
                      <p className="text-white text-xs font-semibold">
                        {r.userId?.name || r.guestEmail || '—'}
                      </p>
                      <p className="text-text-muted text-[10px]">{r.userId?.email || r.guestEmail || ''}</p>
                      {r.userId?.phone && (
                        <p className="text-text-muted text-[10px]">{r.userId.phone}</p>
                      )}
                    </td>
                    <td className="py-3">
                      <p className="text-white text-xs font-semibold">
                        {r.capacity}GB {NETWORK_LABELS[r.network] || r.network} → {r.phoneNumber}
                        {r.purchaseSource === 'guest' && <span className="ml-1 text-primary">(Guest)</span>}
                        {r.purchaseSource === 'store' && <span className="ml-1 text-accent">(Store)</span>}
                      </p>
                      <p className="text-text-muted text-[10px]">Ref: {r.reference}</p>
                      {r.failureReason && (
                        <p className="text-text-muted text-[10px] italic mt-0.5">
                          Reason: {r.failureReason}
                        </p>
                      )}
                    </td>
                    <td className="py-3">
                      <p className="text-white text-xs">
                        {formatDate(isRefundedTab ? (r.refundedAt || r.createdAt) : r.createdAt)}
                      </p>
                      {isRefundedTab && (
                        <p className="text-text-muted text-[10px]">Placed {formatDate(r.createdAt)}</p>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <p className="font-bold text-white">{formatCurrency(r.price)}</p>
                    </td>
                    <td className="py-3 text-right">
                      {isRefundedTab ? (
                        <button
                          onClick={() => reverseRefund(r)}
                          disabled={actingId === r._id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {actingId === r._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Undo2 className="w-3.5 h-3.5" />
                          )}
                          Reverse
                        </button>
                      ) : (
                        <button
                          onClick={() => issueRefund(r)}
                          disabled={actingId === r._id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 text-success rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {actingId === r._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
