'use client';
import { useState, useEffect } from 'react';
import { Store, TrendingUp, Wallet, ShoppingBag, ExternalLink, Loader2, Copy, Check, Users, MessageCircle, Phone, DollarSign, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';
import AnnouncementBoard from '@/components/shared/AnnouncementBoard';
import StoreTutorial from '@/components/shared/StoreTutorial';

export default function StoreDashboardPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [agentSupport, setAgentSupport] = useState({ phone: '', whatsapp: '' });
  const [dailySales, setDailySales] = useState(null);

  useEffect(() => {
    fetchStore();
    fetchDailySales();
    api.get('/auth/agent-support')
      .then(res => setAgentSupport(res.data.data || { phone: '', whatsapp: '' }))
      .catch(() => {});
  }, []);

  const fetchDailySales = async () => {
    try {
      const res = await api.get('/store/daily-sales');
      setDailySales(res.data.data);
    } catch {
      // ignore if no store yet
    }
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
      <div className="max-w-2xl mx-auto py-12 space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Store className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Start your data store</h1>
          <p className="text-text-muted mt-2 mb-2 max-w-sm mx-auto">
            Create your own branded data store, set custom prices, and earn profit on every sale.
          </p>
          <p className="text-primary font-semibold text-sm mb-6">One-time activation: GH₵50</p>
          <Link href="/store/setup">
            <Button size="lg">
              <Store className="w-4 h-4" /> Create Store
            </Button>
          </Link>
        </div>

        {/* How the Agent Store works — animated walkthrough */}
        <StoreTutorial />
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

      {/* Announcements — admin updates agents can copy & forward */}
      <AnnouncementBoard endpoint="/store/announcements" />

      {/* How the Agent Store works — animated walkthrough */}
      <StoreTutorial />

      {/* Today's stats — reset at midnight */}
      <div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Today</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/store/sales">
            <Card hover>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xl font-extrabold text-white">{dailySales?.count ?? 0}</p>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    Today&apos;s Sales <CalendarDays className="w-3 h-3" />
                  </p>
                </div>
              </div>
            </Card>
          </Link>
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

      {/* All Time earnings & history — opens dedicated page */}
      <Link href="/store/history" className="block">
        <Card hover>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm">Earnings &amp; History</p>
              <p className="text-xs text-text-muted mt-0.5">Total sales, earnings, pending balance and the day-by-day breakdown.</p>
            </div>
            <ExternalLink className="w-4 h-4 text-success flex-shrink-0" />
          </div>
        </Card>
      </Link>

      {/* Today's Sales — opens the full filterable Sales page */}
      {store && (
        <Link href="/store/sales" className="block">
          <Card hover>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">View Sales</p>
                <p className="text-xs text-text-muted mt-0.5">See every sale and filter by any date.</p>
              </div>
              <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
            </div>
          </Card>
        </Link>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Link href="/store/sales">
          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Sales</p>
                <p className="text-xs text-text-muted">View by date</p>
              </div>
              <CalendarDays className="w-5 h-5 text-white/20" />
            </div>
          </Card>
        </Link>
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
