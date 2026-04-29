'use client';
import { useState, useEffect } from 'react';
import { Store, TrendingUp, Wallet, ShoppingBag, ExternalLink, Loader2, Copy, Check, Users, MessageCircle, Phone, Clock, DollarSign, CalendarDays, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/constants';
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

export default function StoreDashboardPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [agentSupport, setAgentSupport] = useState({ phone: '', whatsapp: '' });
  const [dailySales, setDailySales] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchStore();
    fetchDailySales();
    api.get('/auth/agent-support')
      .then(res => setAgentSupport(res.data.data || { phone: '', whatsapp: '' }))
      .catch(() => {});
  }, []);

  const fetchDailySales = async () => {
    setLoadingDaily(true);
    try {
      const res = await api.get('/store/daily-sales');
      setDailySales(res.data.data);
    } catch {
      // ignore if no store yet
    } finally {
      setLoadingDaily(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/store/daily-history?days=7');
      setHistory(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && !history) fetchHistory();
  };

  const fetchStore = async () => {
    try {
      const res = await api.get('/store/my-store');
      setStore(res.data.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setStore(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/shop/${store.storeSlug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Store link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Store className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Start your data store</h1>
        <p className="text-text-muted mt-2 mb-2 max-w-sm mx-auto">
          Create your own branded data store, set custom prices, and earn profit on every sale.
        </p>
        <p className="text-primary font-semibold text-sm mb-8">One-time activation: GH₵50</p>
        <Link href="/store/setup">
          <Button size="lg">
            <Store className="w-4 h-4" /> Create Store
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{store.storeName}</h1>
          <p className="text-text-muted text-sm mt-1">Manage your data store.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Link href={`/shop/${store.storeSlug}`} target="_blank">
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4" /> Visit
            </Button>
          </Link>
        </div>
      </div>

      {/* Today's stats — reset at midnight */}
      <div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Today</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{dailySales?.count ?? 0}</p>
                <p className="text-xs text-text-muted">Today&apos;s Sales</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{formatCurrency(dailySales?.todayRevenue || 0)}</p>
                <p className="text-xs text-text-muted">Today&apos;s Revenue</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{formatCurrency(dailySales?.todayProfit || 0)}</p>
                <p className="text-xs text-text-muted">Today&apos;s Profit</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Store className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{store.isActive ? 'Active' : 'Inactive'}</p>
                <p className="text-xs text-text-muted">Store Status</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Lifetime totals — Total Sales / Total Earnings open the daily breakdown */}
      <div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">All Time</p>
        <div className="grid grid-cols-3 gap-4">
          <button onClick={toggleHistory} className="text-left">
            <Card hover>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-white">{store.totalSales || 0}</p>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    Total Sales <CalendarDays className="w-3 h-3" />
                  </p>
                </div>
                {historyOpen ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </div>
            </Card>
          </button>
          <button onClick={toggleHistory} className="text-left">
            <Card hover>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-white">{formatCurrency(store.totalEarnings || 0)}</p>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    Total Earnings <CalendarDays className="w-3 h-3" />
                  </p>
                </div>
                {historyOpen ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </div>
            </Card>
          </button>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-white">{formatCurrency(store.pendingBalance || 0)}</p>
                <p className="text-xs text-text-muted">Pending Balance</p>
              </div>
            </div>
          </Card>
        </div>
        <p className="text-[10px] text-text-muted mt-2">
          Click <span className="font-semibold">Total Sales</span> or <span className="font-semibold">Total Earnings</span> to see a day-by-day breakdown for the week.
        </p>
      </div>

      {/* 7-day breakdown panel */}
      {historyOpen && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-white">Daily Sales History</h2>
              <p className="text-xs text-text-muted mt-0.5">Last 7 days &middot; resets at midnight</p>
            </div>
            <button onClick={fetchHistory} disabled={loadingHistory} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          {loadingHistory && !history ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
          ) : !history ? (
            <p className="text-text-muted text-sm text-center py-6">No history yet.</p>
          ) : (
            <>
              {/* Week summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 mb-4 border-b border-white/[0.04]">
                <div>
                  <p className="text-[10px] text-text-muted">Sales (week)</p>
                  <p className="text-lg font-extrabold text-white">{history.weekTotal.salesCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Revenue (week)</p>
                  <p className="text-lg font-extrabold text-white">{formatCurrency(history.weekTotal.revenue)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted">Profit (week)</p>
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
      )}

      {/* Today's Sales History */}
      {store && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Today&apos;s Sales</h2>
            <button onClick={fetchDailySales} disabled={loadingDaily} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDaily ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          {loadingDaily ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
          ) : !dailySales?.sales?.length ? (
            <p className="text-text-muted text-sm text-center py-8">No store sales today yet. Share your store link to start selling!</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {dailySales.sales.map((sale, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="font-semibold text-sm text-white">{sale.network} {sale.capacity}GB</p>
                    <p className="text-xs text-text-muted">{sale.phoneNumber}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{formatDate(sale.createdAt)} &middot; {sale.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-white">{formatCurrency(sale.price)}</p>
                    <p className="text-[10px] font-semibold text-success">
                      Profit: {formatCurrency(sale.storeDetails?.agentProfit || 0)}
                    </p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      sale.status === 'completed' ? 'bg-success/10 text-success' :
                      sale.status === 'failed' ? 'bg-error/10 text-error' :
                      'bg-accent/10 text-accent'
                    }`}>{sale.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Admin support contact */}
      {(agentSupport.whatsapp || agentSupport.phone) && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Need help? Contact support</p>
                <p className="text-xs text-text-muted">Reach our team if you have any issues with your store.</p>
              </div>
            </div>
            <div className="flex gap-2">
              {agentSupport.whatsapp && (
                <a
                  href={`https://wa.me/${agentSupport.whatsapp.replace(/\D/g, '').replace(/^0/, '233')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}
              {agentSupport.phone && (
                <a
                  href={`tel:${agentSupport.phone}`}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Phone className="w-4 h-4" /> Call
                </a>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link href="/store/products">
          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Products</p>
                <p className="text-xs text-text-muted">Set your prices</p>
              </div>
              <ShoppingBag className="w-5 h-5 text-white/20" />
            </div>
          </Card>
        </Link>
        <Link href="/store/subagents">
          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Subagents</p>
                <p className="text-xs text-text-muted">Manage sellers</p>
              </div>
              <Users className="w-5 h-5 text-white/20" />
            </div>
          </Card>
        </Link>
        <Link href="/store/withdrawals">
          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Withdrawals</p>
                <p className="text-xs text-text-muted">Cash out earnings</p>
              </div>
              <Wallet className="w-5 h-5 text-white/20" />
            </div>
          </Card>
        </Link>
        <Link href="/store/settings">
          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Settings</p>
                <p className="text-xs text-text-muted">Store config</p>
              </div>
              <Store className="w-5 h-5 text-white/20" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
