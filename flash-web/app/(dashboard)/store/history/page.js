'use client';
import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, ArrowLeft, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

function formatDayLabel(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const RANGES = [7, 14, 30];

export default function StoreHistoryPage() {
  const [store, setStore] = useState(null);
  const [history, setHistory] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/store/my-store').then(res => setStore(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchHistory(days);
  }, [days]);

  const fetchHistory = async (d) => {
    setLoading(true);
    try {
      const res = await api.get(`/store/daily-history?days=${d}`);
      setHistory(res.data.data);
    } catch {
      setHistory(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/store/dashboard"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-text-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Earnings &amp; History</h1>
          <p className="text-text-muted text-sm mt-0.5">Your lifetime totals and day-by-day breakdown.</p>
        </div>
      </div>

      {/* Lifetime totals */}
      <div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">All Time</p>
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-white">{store?.totalSales || 0}</p>
                <p className="text-xs text-text-muted">Total Sales</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-white">{formatCurrency(store?.totalEarnings || 0)}</p>
                <p className="text-xs text-text-muted">Total Earnings</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-white">{formatCurrency(store?.pendingBalance || 0)}</p>
                <p className="text-xs text-text-muted">Pending Balance</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Daily breakdown */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-white">Daily Sales History</h2>
            <p className="text-xs text-text-muted mt-0.5">Last {days} days &middot; resets at midnight</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-1">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setDays(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                    days === r ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-white'
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
            <button onClick={() => fetchHistory(days)} disabled={loading} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
        {loading && !history ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
        ) : !history ? (
          <p className="text-text-muted text-sm text-center py-12">No history yet.</p>
        ) : (
          <>
            {/* Period summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 mb-4 border-b border-white/[0.04]">
              <div>
                <p className="text-[10px] text-text-muted">Sales ({days}d)</p>
                <p className="text-lg font-extrabold text-white">{history.weekTotal.salesCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted">Revenue ({days}d)</p>
                <p className="text-lg font-extrabold text-white">{formatCurrency(history.weekTotal.revenue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted">Profit ({days}d)</p>
                <p className="text-lg font-extrabold text-success">{formatCurrency(history.weekTotal.profit)}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted">Failed</p>
                <p className="text-lg font-extrabold text-error">{history.weekTotal.failedCount}</p>
              </div>
            </div>
            {/* Daily rows */}
            <div className="space-y-2">
              {history.days.map(day => (
                <div key={day.date} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="font-bold text-white text-sm">{formatDayLabel(day.date)}</p>
                    <p className="text-[10px] text-text-muted">
                      {day.salesCount} {day.salesCount === 1 ? 'sale' : 'sales'}
                      {day.failedCount > 0 ? ` · ${day.failedCount} failed` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{formatCurrency(day.revenue)}</p>
                    <p className="text-[10px] font-semibold text-success">
                      Profit: {formatCurrency(day.profit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
