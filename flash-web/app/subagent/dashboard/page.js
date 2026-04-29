'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, DollarSign, ShoppingBag, Package, Copy, Check, ExternalLink, LogOut, Loader2, Clock, MessageCircle, Save, CalendarDays, RefreshCw, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
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

export default function SubAgentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [copied, setCopied] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [dailySales, setDailySales] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (!token) {
      router.push('/subagent/login');
      return;
    }
    fetchDashboard();
    fetchDailySales();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/subagent/my-daily-history?days=7');
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

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/subagent/my-dashboard');
      setDashboard(res.data.data);

      // Update local storage
      const sa = res.data.data.subAgent;
      localStorage.setItem('ds_subagent', JSON.stringify(sa));
      setWhatsappInput(sa.contactWhatsapp || '');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/subagent/login');
      } else {
        toast.error('Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDailySales = async () => {
    setLoadingDaily(true);
    try {
      const res = await api.get('/subagent/my-daily-sales');
      setDailySales(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoadingDaily(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/subshop/${dashboard.subAgent.storeSlug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Agent Store link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveWhatsapp = async () => {
    setSavingWhatsapp(true);
    try {
      await api.put('/subagent/my-store', { contactWhatsapp: whatsappInput.trim() });
      toast.success('Support WhatsApp updated');
      setDashboard(prev => prev ? {
        ...prev,
        subAgent: { ...prev.subAgent, contactWhatsapp: whatsappInput.trim() },
      } : prev);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ds_token');
    localStorage.removeItem('ds_user');
    localStorage.removeItem('ds_subagent');
    localStorage.removeItem('ds_is_subagent');
    router.push('/subagent/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!dashboard) return null;

  const { subAgent, sales } = dashboard;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-white">{subAgent.storeName}</h1>
            <p className="text-xs text-gray-500">Sub-agent of {subAgent.parentStoreName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Agent Store'}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Today's stats — reset at midnight */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Today</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white">{dailySales?.count ?? 0}</p>
                  <p className="text-xs text-gray-500">Today&apos;s Sales</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white">{formatCurrency(dailySales?.todayRevenue || 0)}</p>
                  <p className="text-xs text-gray-500">Today&apos;s Revenue</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white">{formatCurrency(dailySales?.todayProfit || 0)}</p>
                  <p className="text-xs text-gray-500">Today&apos;s Profit</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white truncate">{subAgent.storeSlug}</p>
                  <p className="text-xs text-gray-500">Agent Store</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lifetime totals — Total Sales / Total Earnings open the daily breakdown */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">All Time</p>
          <div className="grid grid-cols-3 gap-4">
            <button onClick={toggleHistory} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-white">{subAgent.totalSales || 0}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    Total Sales <CalendarDays className="w-3 h-3" />
                  </p>
                </div>
                {historyOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </button>
            <button onClick={toggleHistory} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-white">{formatCurrency(subAgent.totalEarnings || 0)}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    Total Earnings <CalendarDays className="w-3 h-3" />
                  </p>
                </div>
                {historyOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </button>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">{formatCurrency(subAgent.pendingBalance || 0)}</p>
                  <p className="text-xs text-gray-500">Pending Balance</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            Tap <span className="font-semibold">Total Sales</span> or <span className="font-semibold">Total Earnings</span> for a day-by-day breakdown.
          </p>
        </div>

        {/* 7-day breakdown panel */}
        {historyOpen && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-white">Daily Sales History</h2>
                <p className="text-xs text-gray-500 mt-0.5">Last 7 days &middot; resets at midnight</p>
              </div>
              <button onClick={fetchHistory} disabled={loadingHistory} className="flex items-center gap-1 text-xs text-amber-400 font-bold disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            {loadingHistory && !history ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-amber-400 animate-spin" /></div>
            ) : !history ? (
              <p className="text-gray-500 text-sm text-center py-6">No history yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-4 mb-4 border-b border-gray-800">
                  <div>
                    <p className="text-[10px] text-gray-500">Sales (week)</p>
                    <p className="text-lg font-extrabold text-white">{history.weekTotal.salesCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Revenue (week)</p>
                    <p className="text-lg font-extrabold text-white">{formatCurrency(history.weekTotal.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Profit (week)</p>
                    <p className="text-lg font-extrabold text-green-400">{formatCurrency(history.weekTotal.profit)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Failed</p>
                    <p className="text-lg font-extrabold text-red-400">{history.weekTotal.failedCount}</p>
                  </div>
                </div>
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
        )}

        {/* Today's Sales List */}
        {dailySales?.sales?.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Today&apos;s Sales</h2>
              <button onClick={fetchDailySales} disabled={loadingDaily} className="flex items-center gap-1 text-xs text-amber-400 font-bold">
                <RefreshCw className={`w-3 h-3 ${loadingDaily ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            <div className="space-y-2">
              {dailySales.sales.map(sale => (
                <div key={sale._id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{sale.network} {sale.capacity}GB</p>
                    <p className="text-xs text-gray-500">{sale.phoneNumber}</p>
                    <p className="text-[10px] text-gray-600">{formatDate(sale.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{formatCurrency(sale.price)}</p>
                    <p className="text-[10px] font-semibold text-green-400">Profit: {formatCurrency(sale.storeDetails?.subAgentProfit || 0)}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      sale.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      sale.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>{sale.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-4">
          <Link
            href="/subagent/products"
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors group"
          >
            <Package className="w-6 h-6 text-amber-400 mb-2" />
            <p className="font-bold text-white text-sm">Products</p>
            <p className="text-xs text-gray-500 mt-1">Set prices</p>
          </Link>
          <Link
            href="/subagent/withdrawals"
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors group"
          >
            <Wallet className="w-6 h-6 text-amber-400 mb-2" />
            <p className="font-bold text-white text-sm">Withdraw</p>
            <p className="text-xs text-gray-500 mt-1">Cash out</p>
          </Link>
          <a
            href={`/subshop/${subAgent.storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors group"
          >
            <ExternalLink className="w-6 h-6 text-amber-400 mb-2" />
            <p className="font-bold text-white text-sm">My Store</p>
            <p className="text-xs text-gray-500 mt-1">View store</p>
          </a>
        </div>

        {/* Customer Support WhatsApp setting */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Your Customer Support WhatsApp</p>
              <p className="text-xs text-gray-400">Customers will see this number on your Agent Store for help</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="tel"
              value={whatsappInput}
              onChange={(e) => setWhatsappInput(e.target.value)}
              placeholder="024 XXX XXXX"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleSaveWhatsapp}
              disabled={savingWhatsapp}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {savingWhatsapp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        {/* Parent Agent Support */}
        {(subAgent.parentWhatsapp || subAgent.parentPhone) && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Agent Support ({subAgent.parentStoreName})</p>
                <p className="text-xs text-gray-400">Contact your parent agent for help</p>
              </div>
            </div>
            <div className="flex gap-2">
              {subAgent.parentWhatsapp && (
                <a
                  href={`https://wa.me/${subAgent.parentWhatsapp.replace(/\D/g, '').replace(/^0/, '233')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg text-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              {subAgent.parentPhone && (
                <a
                  href={`tel:${subAgent.parentPhone}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg text-sm transition-colors"
                >
                  Call
                </a>
              )}
            </div>
          </div>
        )}

        {/* Recent sales */}
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Recent Sales</h2>
          {sales.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <ShoppingBag className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No sales yet. Share your Agent Store link to start selling!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sales.map(sale => {
                const profit = sale.storeDetails?.subAgentProfit || 0;
                const statusLabel = sale.status === 'completed' ? 'Completed'
                  : sale.status === 'failed' ? 'Failed'
                  : sale.status === 'processing' ? 'Processing'
                  : 'Pending';
                return (
                  <div key={sale._id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          sale.status === 'completed' ? 'bg-green-400' :
                          sale.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {sale.network} {sale.capacity}GB
                          </p>
                          <p className="text-xs text-gray-500">{sale.phoneNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{formatCurrency(sale.price)}</p>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          sale.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                          sale.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-yellow-500/10 text-yellow-400'
                        }`}>{statusLabel}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(sale.createdAt)}
                      </div>
                      <span className="font-mono">{sale.reference}</span>
                    </div>
                    {profit > 0 && (
                      <div className="mt-1 text-xs text-green-400 font-semibold">
                        Profit: {formatCurrency(profit)}
                      </div>
                    )}
                    {sale.status === 'failed' && sale.failureReason && (
                      <p className="mt-1 text-xs text-red-400">{sale.failureReason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
