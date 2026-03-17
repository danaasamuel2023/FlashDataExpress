'use client';
import { useState, useEffect } from 'react';
import { Clock, Search, Loader2, ArrowDownLeft, ArrowUpRight, ShoppingBag } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTransactions();
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

  const filtered = transactions.filter(tx => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return tx.reference?.toLowerCase().includes(q) || tx.userId?.name?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Transactions</h1>
        <p className="text-text-muted text-sm mt-1">All platform transactions.</p>
      </div>

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
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

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
    </div>
  );
}
