'use client';
import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Search, Calendar, CheckCircle2, AlertTriangle, Clock3 } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SourceBadge from '@/components/shared/SourceBadge';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

const NETWORK_LABELS = { YELLO: 'MTN', TELECEL: 'Telecel', AT_PREMIUM: 'AirtelTigo' };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function AdminPendingOrdersPage() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalUncredited, setTotalUncredited] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRows = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get(`/admin/orders/pending?${params.toString()}`);
      setRows(res.data.data.orders || []);
      setCount(res.data.data.count || 0);
      setTotalAmount(res.data.data.totalAmount || 0);
      setTotalUncredited(res.data.data.totalUncredited || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const markDelivered = async (order) => {
    const profit = (order.storeDetails?.agentProfit || 0) + (order.storeDetails?.subAgentProfit || 0);
    const msg =
      `Mark this order as delivered?\n\n` +
      `Order: ${order.capacity}GB ${NETWORK_LABELS[order.network] || order.network} → ${order.phoneNumber}\n` +
      `Store: ${order.storeDetails?.storeName || '—'}\n` +
      `Profit to credit: ${formatCurrency(profit)}\n\n` +
      `Only do this if the order was actually delivered at the provider. ` +
      `Agent (and sub-agent) profit will be credited.`;
    if (!confirm(msg)) return;

    setActingId(order._id);
    try {
      // verify:true asks the API to re-check DataMart first and refuse if it reports failed.
      await api.post(`/admin/orders/${order._id}/complete`, { verify: true });
      toast.success(`Marked delivered. Profit credited: ${formatCurrency(profit)}`);
      setRows((prev) => prev.filter((r) => r._id !== order._id));
      setCount((prev) => Math.max(0, prev - 1));
      setTotalAmount((prev) => Math.max(0, prev - (order.price || 0)));
      setTotalUncredited((prev) => Math.max(0, prev - profit));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete order');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Pending Orders</h1>
        <p className="text-text-muted text-sm mt-1">
          Agent-store orders still pending or processing. Agent profit isn&apos;t credited until delivery —
          if an order actually delivered at the provider, mark it delivered here to credit the profit.
        </p>
      </div>

      {/* Filter form */}
      <Card>
        <form onSubmit={fetchRows} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
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
            <div>
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
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Clock3 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-white">{count}</p>
              <p className="text-xs text-text-muted">Pending orders</p>
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Order value</p>
          <p className="text-2xl font-extrabold text-white">{formatCurrency(totalAmount)}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Uncredited profit</p>
          <p className="text-2xl font-extrabold text-white">{formatCurrency(totalUncredited)}</p>
        </Card>
      </div>

      {/* Notice */}
      <Card className="!border-accent/30 bg-accent/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white text-sm">Mark delivered only when the order really delivered</p>
            <p className="text-text-muted text-xs mt-1">
              This credits the agent&apos;s (and any sub-agent&apos;s) profit and can&apos;t be undone from here.
              We re-check the provider first and refuse if it reports the order failed.
              If a provider check can&apos;t be reached, the completion still goes through — verify manually first.
            </p>
          </div>
        </div>
      </Card>

      {/* Rows table */}
      <Card>
        {loading && !rows.length ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : !rows.length ? (
          <p className="text-text-muted text-sm text-center py-12">No pending store orders match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Store / User</th>
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Order</th>
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Placed</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Profit</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Status</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const profit = (r.storeDetails?.agentProfit || 0) + (r.storeDetails?.subAgentProfit || 0);
                  return (
                    <tr key={r._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-3">
                        <p className="text-white text-xs font-semibold">{r.storeDetails?.storeName || '—'}</p>
                        <p className="text-text-muted text-[10px]">{r.userId?.name || r.userId?.email || ''}</p>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-xs font-semibold">
                            {r.capacity}GB {NETWORK_LABELS[r.network] || r.network} → {r.phoneNumber}
                          </p>
                          <SourceBadge source={r.purchaseSource} size="xs" />
                        </div>
                        <p className="text-text-muted text-[10px]">Ref: {r.reference}</p>
                        {r.datamartReference && (
                          <p className="text-text-muted text-[10px]">Provider: {r.datamartReference}</p>
                        )}
                      </td>
                      <td className="py-3">
                        <p className="text-white text-xs">{formatDate(r.createdAt)}</p>
                      </td>
                      <td className="py-3 text-right">
                        <p className="font-bold text-white">{formatCurrency(profit)}</p>
                        <p className="text-text-muted text-[10px]">of {formatCurrency(r.price)}</p>
                      </td>
                      <td className="py-3 text-right">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          r.status === 'processing' ? 'bg-blue-500/10 text-blue-500' : 'bg-accent/10 text-accent'
                        }`}>{r.status}</span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => markDelivered(r)}
                          disabled={actingId === r._id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 text-success rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {actingId === r._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Mark delivered
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
