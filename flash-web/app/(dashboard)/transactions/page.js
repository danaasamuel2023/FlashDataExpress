'use client';
import { useState, useEffect } from 'react';
import { Clock, ArrowDownLeft, ArrowUpRight, ShoppingBag, Gift, Loader2, Search } from 'lucide-react';
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTransactions();
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
    </div>
  );
}
