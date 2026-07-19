'use client';
import { useState, useEffect } from 'react';
import { UserPlus, ExternalLink, Loader2, RefreshCw, ShoppingBag, TrendingUp, X, CalendarDays, DollarSign, Users, Search, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function AdminSubAgentsPage() {
  const [subAgents, setSubAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null); // { subAgent, sales, todayRevenue, todayProfit, count }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [query, setQuery] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [crediting, setCrediting] = useState(false);

  useEffect(() => {
    fetchSubAgents();
  }, []);

  const fetchSubAgents = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/admin/sub-agents');
      setSubAgents(res.data.data || []);
    } catch {
      toast.error('Failed to load sub-agents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openDetail = async (id) => {
    setLoadingDetail(true);
    setSelected({ loading: true });
    setCreditAmount('');
    setCreditReason('');
    try {
      const res = await api.get(`/admin/sub-agents/${id}/daily-sales`);
      setSelected(res.data.data);
    } catch {
      toast.error('Failed to load sub-agent detail');
      setSelected(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const creditSubAgent = async () => {
    const sub = selected?.subAgent;
    if (!sub?._id) return;
    const amount = Number(creditAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter an amount greater than 0');
      return;
    }
    const name = sub.storeName || 'this sub-agent';
    if (!confirm(
      `Credit ${formatCurrency(amount)} to ${name}?\n\n` +
      `This adds to both the sub-agent's total earnings and withdrawable pending balance.`
    )) return;

    setCrediting(true);
    try {
      const res = await api.post(`/admin/sub-agents/${sub._id}/credit`, {
        amount,
        reason: creditReason.trim() || undefined,
      });
      const { totalEarnings, pendingBalance, totalSales } = res.data.data || {};
      toast.success(`Credited ${formatCurrency(amount)} to ${name}`);
      setSelected((prev) => prev && ({
        ...prev,
        subAgent: { ...prev.subAgent, totalEarnings, pendingBalance, totalSales },
      }));
      setCreditAmount('');
      setCreditReason('');
      setSubAgents((prev) => prev.map((s) => (
        s._id === sub._id ? { ...s, totalEarnings, pendingBalance, totalSales } : s
      )));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to credit sub-agent');
    } finally {
      setCrediting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const activeCount = subAgents.filter(s => s.isActive).length;
  const todayRevenue = subAgents.reduce((s, st) => s + (st.todayRevenue || 0), 0);
  const todayProfit = subAgents.reduce((s, st) => s + (st.todayProfit || 0), 0);

  const q = query.trim().toLowerCase();
  const filteredSubAgents = q
    ? subAgents.filter(s =>
        (s.storeName || '').toLowerCase().includes(q) ||
        (s.storeSlug || '').toLowerCase().includes(q) ||
        (s.parentStoreName || '').toLowerCase().includes(q) ||
        (s.parentAgent?.name || '').toLowerCase().includes(q) ||
        (s.parentAgent?.email || '').toLowerCase().includes(q)
      )
    : subAgents;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Sub-Agents</h1>
          <p className="text-text-muted text-sm mt-1">
            Each sub-agent&apos;s own sales &amp; profit — separate from their parent agent&apos;s. Click a row for today&apos;s detail.
          </p>
        </div>
        <button
          onClick={fetchSubAgents}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{subAgents.length}</p>
              <p className="text-xs text-text-muted">Sub-Agents</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{activeCount}</p>
              <p className="text-xs text-text-muted">Active</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(todayRevenue)}</p>
              <p className="text-xs text-text-muted">Today&apos;s Revenue</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(todayProfit)}</p>
              <p className="text-xs text-text-muted">Today&apos;s Sub-Agent Profit</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by sub-agent shop, slug, or parent agent…"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary/50"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sub-agents list */}
      <Card>
        {subAgents.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">No sub-agents yet.</p>
        ) : filteredSubAgents.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">No sub-agents match &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className="overflow-x-auto">
            {q && (
              <p className="text-[11px] text-text-muted mb-2">{filteredSubAgents.length} of {subAgents.length} sub-agents</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Sub-Agent Shop</th>
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Parent Agent</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Comm.</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Today</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">All Time</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Pending</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubAgents.map((s) => (
                  <tr
                    key={s._id}
                    onClick={() => openDetail(s._id)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="py-3">
                      <div>
                        <p className="font-bold text-white">{s.storeName}</p>
                        {s.storeSlug && (
                          <a
                            href={`/subshop/${s.storeSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80"
                          >
                            /{s.storeSlug} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="text-white text-xs">{s.parentAgent?.name || '—'}</p>
                      <p className="text-text-muted text-[10px]">{s.parentStoreName || s.parentAgent?.email || ''}</p>
                    </td>
                    <td className="py-3 text-right text-xs text-text-muted">{s.commissionPercent}%</td>
                    <td className="py-3 text-right">
                      <p className="font-bold text-success text-xs">{formatCurrency(s.todayProfit)}</p>
                      <p className="text-[10px] text-text-muted">{s.todaySales} sale{s.todaySales === 1 ? '' : 's'} &middot; {formatCurrency(s.todayRevenue)}</p>
                    </td>
                    <td className="py-3 text-right">
                      <p className="text-xs text-white">{formatCurrency(s.totalEarnings)}</p>
                      <p className="text-[10px] text-text-muted">{s.totalSales} total</p>
                    </td>
                    <td className="py-3 text-right text-xs text-accent font-semibold">
                      {formatCurrency(s.pendingBalance)}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                      }`}>
                        {s.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sub-agent detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-card border border-white/[0.06] rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="font-extrabold text-white">
                  {loadingDetail || selected.loading ? 'Loading…' : selected.subAgent?.storeName}
                </h3>
                {!selected.loading && selected.subAgent && (
                  <p className="text-xs text-text-muted mt-0.5">
                    Under {selected.subAgent.parentAgent?.name || '—'}
                    {selected.subAgent.parentStoreName ? ` · ${selected.subAgent.parentStoreName}` : ''}
                    {' · '}{selected.subAgent.commissionPercent}% commission
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail || selected.loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <div className="overflow-y-auto p-5 space-y-5">
                {/* Today summary */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-lg font-extrabold text-white">{selected.count || 0}</p>
                        <p className="text-[10px] text-text-muted">Today&apos;s Sales</p>
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-accent" />
                      <div>
                        <p className="text-lg font-extrabold text-white">{formatCurrency(selected.todayRevenue || 0)}</p>
                        <p className="text-[10px] text-text-muted">Today&apos;s Revenue</p>
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-success" />
                      <div>
                        <p className="text-lg font-extrabold text-white">{formatCurrency(selected.todayProfit || 0)}</p>
                        <p className="text-[10px] text-text-muted">Today&apos;s Profit</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Lifetime */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <p className="text-base font-extrabold text-white">{selected.subAgent?.totalSales || 0}</p>
                    <p className="text-[10px] text-text-muted">Total Sales</p>
                  </Card>
                  <Card>
                    <p className="text-base font-extrabold text-white">{formatCurrency(selected.subAgent?.totalEarnings || 0)}</p>
                    <p className="text-[10px] text-text-muted">Total Earnings</p>
                  </Card>
                  <Card>
                    <p className="text-base font-extrabold text-white">{formatCurrency(selected.subAgent?.pendingBalance || 0)}</p>
                    <p className="text-[10px] text-text-muted">Pending Balance</p>
                  </Card>
                </div>

                {/* Manual profit credit */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <PlusCircle className="w-4 h-4 text-success" />
                    <p className="text-xs font-bold text-white uppercase tracking-wider">Manually credit profit</p>
                  </div>
                  <p className="text-[11px] text-text-muted mb-3">
                    For a delivered order whose profit wasn&apos;t auto-credited. Adds to both total earnings and the withdrawable pending balance.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="Amount (GHS)"
                      className="w-full sm:w-40 bg-surface-light border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      value={creditReason}
                      onChange={(e) => setCreditReason(e.target.value)}
                      placeholder="Reason (optional) — e.g. stuck-pending order settled"
                      className="flex-1 bg-surface-light border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={creditSubAgent}
                      disabled={crediting || !creditAmount}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-success/10 hover:bg-success/20 text-success rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {crediting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                      Credit
                    </button>
                  </div>
                </div>

                {/* Sales list — profit shown is the SUB-AGENT's cut */}
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Today&apos;s Sales</p>
                  {!selected.sales?.length ? (
                    <p className="text-text-muted text-sm text-center py-6">No sales today.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {selected.sales.map((sale, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                          <div>
                            <p className="font-semibold text-sm text-white">{sale.network} {sale.capacity}GB</p>
                            <p className="text-xs text-text-muted">{sale.phoneNumber}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">{formatDate(sale.createdAt)} &middot; {sale.reference}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm text-white">{formatCurrency(sale.price)}</p>
                            <p className="text-[10px] font-semibold text-success">
                              Sub profit: {formatCurrency(sale.storeDetails?.subAgentProfit || 0)}
                            </p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              sale.status === 'completed' ? 'bg-success/10 text-success' :
                              sale.status === 'failed' ? 'bg-error/10 text-error' :
                              sale.status === 'refunded' ? 'bg-text-muted/10 text-text-muted' :
                              'bg-accent/10 text-accent'
                            }`}>{sale.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
