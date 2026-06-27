'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, DollarSign, ShoppingBag, Package, Copy, Check, ExternalLink, LogOut, Loader2, MessageCircle, Save, CalendarDays, Wallet, TrendingUp, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';
import DeliveryTracker from '@/components/shared/DeliveryTracker';
import AnnouncementBoard from '@/components/shared/AnnouncementBoard';

export default function SubAgentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [copied, setCopied] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [dailySales, setDailySales] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (!token) {
      router.push('/subagent/login');
      return;
    }
    fetchDashboard();
    fetchDailySales();
  }, []);

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
    try {
      const res = await api.get('/subagent/my-daily-sales');
      setDailySales(res.data.data);
    } catch {
      // ignore
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

  const { subAgent } = dashboard;

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
        {/* Delivery system — live status of orders placed through your store */}
        <DeliveryTracker endpoint="/subagent/delivery-tracker" />

        {/* Announcements — admin updates sub-agents can copy & forward */}
        <AnnouncementBoard endpoint="/subagent/announcements" variant="subagent" />

        {/* Today's stats — reset at midnight */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Today</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/subagent/sales" className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white">{dailySales?.count ?? 0}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    Today&apos;s Sales <CalendarDays className="w-3 h-3" />
                  </p>
                </div>
              </div>
            </Link>
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

        {/* Lifetime totals */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">All Time</p>
          <div className="grid grid-cols-3 gap-4">
            <Link href="/subagent/history" className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-white">{subAgent.totalSales || 0}</p>
                  <p className="text-xs text-gray-500">Total Sales</p>
                </div>
              </div>
            </Link>
            <Link href="/subagent/history" className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-extrabold text-white">{formatCurrency(subAgent.totalEarnings || 0)}</p>
                  <p className="text-xs text-gray-500">Total Earnings</p>
                </div>
              </div>
            </Link>
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
        </div>

        {/* Find an order — opens the date-filterable Sales page */}
        <Link href="/subagent/sales" className="block">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">View Sales</p>
                <p className="text-xs text-gray-500 mt-0.5">See every sale and filter by any date — quickly find an order a customer is asking about.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-400 flex-shrink-0" />
            </div>
          </div>
        </Link>

        {/* Daily sales & earnings — opens the day-by-day breakdown page */}
        <Link href="/subagent/history" className="block">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Daily Sales &amp; Earnings</p>
                <p className="text-xs text-gray-500 mt-0.5">Your totals and the day-by-day breakdown of sales, revenue and profit.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-green-400 flex-shrink-0" />
            </div>
          </div>
        </Link>

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
      </div>
    </div>
  );
}
