'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, ArrowLeft, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
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

export default function SubAgentHistoryPage() {
  const router = useRouter();
  const [subAgent, setSubAgent] = useState(null);
  const [history, setHistory] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (!token) {
      router.push('/subagent/login');
      return;
    }
    try {
      const sa = JSON.parse(localStorage.getItem('ds_subagent') || 'null');
      if (sa) setSubAgent(sa);
    } catch {
      // ignore
    }
    api.get('/subagent/my-dashboard')
      .then(res => setSubAgent(res.data.data.subAgent))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchHistory(days);
  }, [days]);

  const fetchHistory = async (d) => {
    setLoading(true);
    try {
      const res = await api.get(`/subagent/my-daily-history?days=${d}`);
      setHistory(res.data.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/subagent/login');
        return;
      }
      setHistory(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/subagent/dashboard"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold text-white">Daily Sales &amp; Earnings</h1>
            <p className="text-xs text-gray-500">Your day-by-day breakdown.</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Lifetime totals */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">All Time</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">{subAgent?.totalSales || 0}</p>
                  <p className="text-xs text-gray-500">Total Sales</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">{formatCurrency(subAgent?.totalEarnings || 0)}</p>
                  <p className="text-xs text-gray-500">Total Earnings</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">{formatCurrency(subAgent?.pendingBalance || 0)}</p>
                  <p className="text-xs text-gray-500">Pending Balance</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-white">Daily Sales History</h2>
              <p className="text-xs text-gray-500 mt-0.5">Last {days} days &middot; resets at midnight</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                {RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => setDays(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      days === r ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {r}d
                  </button>
                ))}
              </div>
              <button onClick={() => fetchHistory(days)} disabled={loading} className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>
          {loading && !history ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-amber-400 animate-spin" /></div>
          ) : !history ? (
            <p className="text-gray-500 text-sm text-center py-12">No history yet.</p>
          ) : (
            <>
              {/* Period summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 mb-4 border-b border-gray-800">
                <div>
                  <p className="text-[10px] text-gray-500">Sales ({days}d)</p>
                  <p className="text-lg font-extrabold text-white">{history.weekTotal.salesCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Revenue ({days}d)</p>
                  <p className="text-lg font-extrabold text-white">{formatCurrency(history.weekTotal.revenue)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Profit ({days}d)</p>
                  <p className="text-lg font-extrabold text-green-400">{formatCurrency(history.weekTotal.profit)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Failed</p>
                  <p className="text-lg font-extrabold text-red-400">{history.weekTotal.failedCount}</p>
                </div>
              </div>
              {/* Daily rows */}
              <div className="space-y-2">
                {history.days.map(day => (
                  <div key={day.date} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="font-bold text-white text-sm">{formatDayLabel(day.date)}</p>
                      <p className="text-[10px] text-gray-500">
                        {day.salesCount} {day.salesCount === 1 ? 'sale' : 'sales'}
                        {day.failedCount > 0 ? ` · ${day.failedCount} failed` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatCurrency(day.revenue)}</p>
                      <p className="text-[10px] font-semibold text-green-400">
                        Profit: {formatCurrency(day.profit)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
