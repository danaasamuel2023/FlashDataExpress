'use client';
import { useState, useEffect } from 'react';
import { Clock, Search, Loader2, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

const SOURCE_LABELS = {
  direct_purchase: 'Direct purchase',
  momo_purchase: 'MoMo purchase',
  wallet_deposit: 'Wallet deposit',
  store_activation: 'Store activation',
  store_purchase: 'Store purchase',
  sub_agent_purchase: 'Sub-agent purchase',
  guest_purchase: 'Guest purchase',
  auto_refund: 'Auto refund',
  referral: 'Referral',
  withdrawal: 'Withdrawal',
};

function formatDayLabel(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [view, setView] = useState('daily'); // 'list' | 'daily'
  const [daily, setDaily] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => {
    fetchTransactions();
    fetchDaily();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/admin/transactions');
      setTransactions(res.data.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const fetchDaily = async () => {
    setLoadingDaily(true);
    try {
      const res = await api.get('/admin/daily-history?days=7');
      setDaily(res.data.data);
    } catch {
      // silently fail
    } finally {
      setLoadingDaily(false);
    }
  };

  const filtered = transactions.filter(tx => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (sourceFilter !== 'all' && tx.metadata?.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return tx.reference?.toLowerCase().includes(q) ||
             tx.userId?.name?.toLowerCase().includes(q) ||
             tx.description?.toLowerCase().includes(q);
    }
    return true;
  });

  // Collect unique sources from transactions for the filter dropdown
  const availableSources = Array.from(new Set(
    transactions.map(tx => tx.metadata?.source).filter(Boolean)
  ));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Transactions</h1>
        <p className="text-text-muted text-sm mt-1">All platform transactions.</p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('daily')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            view === 'daily' ? 'bg-primary text-white' : 'bg-surface-light text-text-muted hover:bg-white/5'
          }`}
        >
          <CalendarDays className="w-4 h-4" /> Daily (last 7 days)
        </button>
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            view === 'list' ? 'bg-primary text-white' : 'bg-surface-light text-text-muted hover:bg-white/5'
          }`}
        >
          <Clock className="w-4 h-4" /> All transactions
        </button>
      </div>

      {view === 'daily' ? (
        loadingDaily ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : !daily ? (
          <Card><p className="text-text-muted text-sm text-center py-8">No history yet.</p></Card>
        ) : (
          <div className="space-y-4">
            {/* Week summary */}
            <Card>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Last 7 days</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-text-muted">Deposits received</p>
                  <p className="text-lg font-extrabold text-success">{formatCurrency(daily.weekTotal.deposits)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Order revenue</p>
                  <p className="text-lg font-extrabold text-white">{formatCurrency(daily.weekTotal.orderRevenue)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Profit</p>
                  <p className="text-lg font-extrabold text-accent">{formatCurrency(daily.weekTotal.profit)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Refunds paid</p>
                  <p className="text-lg font-extrabold text-blue-500">{formatCurrency(daily.weekTotal.refunds)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Orders</p>
                  <p className="text-lg font-extrabold text-white">{daily.weekTotal.orderCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Failed orders</p>
                  <p className="text-lg font-extrabold text-error">{daily.weekTotal.failedOrders}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Withdrawals</p>
                  <p className="text-lg font-extrabold text-error">{formatCurrency(daily.weekTotal.withdrawals)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Net (rev - refunds)</p>
                  <p className="text-lg font-extrabold text-white">
                    {formatCurrency(daily.weekTotal.orderRevenue - daily.weekTotal.refunds)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Daily breakdown */}
            {daily.days.map(day => {
              const isOpen = expandedDay === day.date;
              const profit = day.profit;
              return (
                <Card key={day.date}>
                  <button
                    onClick={() => setExpandedDay(isOpen ? null : day.date)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="font-bold text-white text-sm">{formatDayLabel(day.date)}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {day.orderCount} {day.orderCount === 1 ? 'order' : 'orders'} &middot; {day.failedOrders} failed
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{formatCurrency(day.orderRevenue)}</p>
                        <p className={`text-xs font-semibold ${profit > 0 ? 'text-success' : 'text-text-muted'}`}>
                          Profit: {formatCurrency(profit)}
                        </p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-4 border-t border-white/[0.04] pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-text-muted">Deposits</p>
                        <p className="font-bold text-success">{formatCurrency(day.deposits)}</p>
                        <p className="text-[10px] text-text-muted">{day.depositCount} txns</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Purchases</p>
                        <p className="font-bold text-white">{formatCurrency(day.purchases)}</p>
                        <p className="text-[10px] text-text-muted">{day.purchaseCount} txns</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Refunds</p>
                        <p className="font-bold text-blue-500">{formatCurrency(day.refunds)}</p>
                        <p className="text-[10px] text-text-muted">{day.refundCount} txns</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Withdrawals</p>
                        <p className="font-bold text-error">{formatCurrency(day.withdrawals)}</p>
                        <p className="text-[10px] text-text-muted">{day.withdrawalCount} txns</p>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input icon={Search} placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['all', 'deposit', 'purchase', 'refund', 'withdrawal'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    filter === f ? 'bg-primary text-white' : 'bg-white/[0.04] text-text-muted'
                  }`}
                >
                  {f === 'all' ? 'All types' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {availableSources.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSourceFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  sourceFilter === 'all' ? 'bg-accent text-white' : 'bg-white/[0.04] text-text-muted'
                }`}
              >
                All sources
              </button>
              {availableSources.map(src => (
                <button
                  key={src}
                  onClick={() => setSourceFilter(src)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    sourceFilter === src ? 'bg-accent text-white' : 'bg-white/[0.04] text-text-muted'
                  }`}
                >
                  {SOURCE_LABELS[src] || src}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">User</th>
                      <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Type</th>
                      <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Source</th>
                      <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Amount</th>
                      <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(tx => (
                      <tr key={tx._id} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-sm text-white">{tx.userId?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-text-muted">{tx.reference}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold text-text-muted">{tx.type}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold text-accent">
                            {SOURCE_LABELS[tx.metadata?.source] || tx.metadata?.source || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-sm text-white">{formatCurrency(tx.amount)}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            tx.status === 'completed' ? 'bg-success/10 text-success' :
                            tx.status === 'pending' ? 'bg-accent/10 text-accent' :
                            'bg-error/10 text-error'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-text-muted">{formatDate(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
