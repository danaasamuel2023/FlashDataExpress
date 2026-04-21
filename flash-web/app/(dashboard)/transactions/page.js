'use client';
import { useState, useEffect } from 'react';
import { Clock, ArrowDownLeft, ArrowUpRight, ShoppingBag, Gift, Loader2, Search, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

const TYPE_CONFIG = {
  deposit: { label: 'Deposit', icon: ArrowDownLeft, color: 'text-success', bg: 'bg-success/10', sign: '+' },
  purchase: { label: 'Purchase', icon: ShoppingBag, color: 'text-primary', bg: 'bg-primary/10', sign: '-' },
  refund: { label: 'Refund', icon: ArrowDownLeft, color: 'text-blue-500', bg: 'bg-blue-500/10', sign: '+' },
  withdrawal: { label: 'Withdrawal', icon: ArrowUpRight, color: 'text-error', bg: 'bg-error/10', sign: '-' },
  referral_earning: { label: 'Referral', icon: Gift, color: 'text-accent', bg: 'bg-accent/10', sign: '+' },
};

const STATUS_COLORS = {
  completed: 'bg-success/10 text-success',
  pending: 'bg-accent/10 text-accent',
  failed: 'bg-error/10 text-error',
  processing: 'bg-blue-500/10 text-blue-500',
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
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
      const res = await api.get('/wallet/transactions');
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
      const res = await api.get('/wallet/daily-history?days=7');
      setDaily(res.data.data);
    } catch {
      // silently fail
    } finally {
      setLoadingDaily(false);
    }
  };

  const filtered = transactions.filter(tx => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        tx.reference?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Transactions</h1>
        <p className="text-text-muted text-sm mt-1">Your complete purchase and payment history.</p>
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
                  <p className="text-[10px] text-text-muted">Deposits</p>
                  <p className="text-lg font-extrabold text-success">{formatCurrency(daily.weekTotal.deposits)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Purchases</p>
                  <p className="text-lg font-extrabold text-white">{formatCurrency(daily.weekTotal.purchases)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Refunds</p>
                  <p className="text-lg font-extrabold text-blue-500">{formatCurrency(daily.weekTotal.refunds)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Withdrawals</p>
                  <p className="text-lg font-extrabold text-error">{formatCurrency(daily.weekTotal.withdrawals)}</p>
                </div>
              </div>
            </Card>

            {/* Daily breakdown */}
            {daily.days.map(day => {
              const isOpen = expandedDay === day.date;
              const hasActivity = day.transactions.length > 0;
              return (
                <Card key={day.date} className={!hasActivity ? 'opacity-60' : ''}>
                  <button
                    onClick={() => setExpandedDay(isOpen ? null : day.date)}
                    disabled={!hasActivity}
                    className="w-full flex items-center justify-between text-left disabled:cursor-default"
                  >
                    <div>
                      <p className="font-bold text-white text-sm">{formatDayLabel(day.date)}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {day.transactions.length} {day.transactions.length === 1 ? 'transaction' : 'transactions'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {day.deposits > 0 && <p className="text-xs text-success">+{formatCurrency(day.deposits)} deposits</p>}
                        {day.purchases > 0 && <p className="text-xs text-text-muted">-{formatCurrency(day.purchases)} purchases</p>}
                        {day.refunds > 0 && <p className="text-xs text-blue-500">+{formatCurrency(day.refunds)} refunds</p>}
                      </div>
                      {hasActivity && (isOpen ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />)}
                    </div>
                  </button>
                  {isOpen && hasActivity && (
                    <div className="mt-4 space-y-2 border-t border-white/[0.04] pt-4">
                      {day.transactions.map(tx => {
                        const config = TYPE_CONFIG[tx.type] || TYPE_CONFIG.purchase;
                        const Icon = config.icon;
                        return (
                          <div key={tx._id} className="flex items-center gap-3 py-2">
                            <div className={`w-8 h-8 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-4 h-4 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{tx.description || config.label}</p>
                              <p className="text-[10px] text-text-muted">{formatDate(tx.createdAt)} · {tx.reference}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-extrabold ${config.sign === '+' ? 'text-success' : 'text-text'}`}>
                                {config.sign}{formatCurrency(tx.amount)}
                              </p>
                              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[tx.status] || STATUS_COLORS.pending}`}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : (
      <>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon={Search}
            placeholder="Search by reference or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', 'deposit', 'purchase', 'refund', 'withdrawal', 'referral_earning'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-surface-light text-text-muted hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'All' : f === 'referral_earning' ? 'Referral' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="font-bold text-white">No transactions yet</p>
            <p className="text-text-muted text-sm mt-1">Your purchases and deposits will show up here.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(tx => {
            const config = TYPE_CONFIG[tx.type] || TYPE_CONFIG.purchase;
            const Icon = config.icon;
            return (
              <Card key={tx._id} className="!p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-text truncate">
                      {tx.description || config.label}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatDate(tx.createdAt)} &middot; {tx.reference}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-extrabold text-sm ${
                      config.sign === '+' ? 'text-success' : 'text-text'
                    }`}>
                      {config.sign}{formatCurrency(tx.amount)}
                    </p>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      STATUS_COLORS[tx.status] || STATUS_COLORS.pending
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}
