'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ShoppingBag, TrendingUp, Loader2, RefreshCw, DollarSign, CalendarDays, Pause, Play, AlertTriangle, Store as StoreIcon, Globe, PackageX, PackageCheck, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import SourceBadge from '@/components/shared/SourceBadge';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const NETWORK_LABELS = { YELLO: 'MTN', TELECEL: 'Telecel', AT_PREMIUM: 'AirtelTigo' };

export default function AdminOverviewPage() {
  const [stats, setStats] = useState(null);
  const [providerPrices, setProviderPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [ordersPaused, setOrdersPaused] = useState(false);
  const [pauseMessage, setPauseMessage] = useState('');
  const [togglingPause, setTogglingPause] = useState(false);
  const [outOfStock, setOutOfStock] = useState([]);
  const [togglingStock, setTogglingStock] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchOrdersStatus();
  }, []);

  const fetchOrdersStatus = async () => {
    try {
      const res = await api.get('/admin/settings');
      setOrdersPaused(!!res.data.data?.ordersPaused);
      setPauseMessage(res.data.data?.ordersPausedMessage || '');
      setOutOfStock(res.data.data?.outOfStockNetworks || []);
    } catch {
      // silently fail
    }
  };

  const handleToggleStock = async (network) => {
    const isOut = outOfStock.includes(network);
    setTogglingStock(network);
    try {
      const res = await api.post('/admin/orders/out-of-stock', {
        network,
        outOfStock: !isOut,
      });
      setOutOfStock(res.data.data?.outOfStockNetworks || []);
      toast.success(isOut ? `${NETWORK_LABELS[network]} back in stock` : `${NETWORK_LABELS[network]} marked out of stock`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setTogglingStock(null);
    }
  };

  const handleTogglePause = async () => {
    setTogglingPause(true);
    const next = !ordersPaused;
    try {
      await api.post('/admin/orders/pause', { paused: next, message: pauseMessage });
      setOrdersPaused(next);
      toast.success(next ? 'Orders paused' : 'Orders resumed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setTogglingPause(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setStats(res.data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderPrices = async () => {
    setFetchingPrices(true);
    try {
      const res = await api.get('/admin/provider-prices');
      setProviderPrices(res.data.data);
    } catch {
      setProviderPrices(null);
    } finally {
      setFetchingPrices(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const portalToday = stats?.todayPortal || { orders: 0, revenue: 0, profit: 0 };
  const storeToday = stats?.todayStore || { orders: 0, revenue: 0, profit: 0 };
  const portalLifetime = stats?.lifetimePortal || { orders: 0, revenue: 0, profit: 0 };
  const storeLifetime = stats?.lifetimeStore || { orders: 0, revenue: 0, profit: 0 };

  // Build comparison table: network → capacity → { selling, base }
  const sellingPrices = stats?.sellingPrices || {};
  const basePrices = stats?.basePrices || {};
  const networks = [...new Set([...Object.keys(sellingPrices), ...Object.keys(basePrices)])];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Overview</h1>
        <p className="text-text-muted text-sm mt-1">Platform stats at a glance.</p>
      </div>

      {/* Orders pause control */}
      <Card className={ordersPaused ? '!border-error/40 !bg-error/5' : ''}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ordersPaused ? 'bg-error/10' : 'bg-success/10'}`}>
              {ordersPaused ? <AlertTriangle className="w-5 h-5 text-error" /> : <Play className="w-5 h-5 text-success" />}
            </div>
            <div className="flex-1">
              <p className="font-bold text-white">
                {ordersPaused ? 'Orders are PAUSED' : 'Orders are accepting normally'}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {ordersPaused
                  ? 'Customers cannot place new orders. Existing orders continue.'
                  : 'Pause to stop new orders (e.g., during DataMart issues).'}
              </p>
              {ordersPaused && (
                <input
                  value={pauseMessage}
                  onChange={(e) => setPauseMessage(e.target.value)}
                  placeholder="Message shown to customers (optional)"
                  className="mt-2 w-full px-3 py-2 bg-surface-light border border-white/10 rounded-lg text-white text-xs focus:border-primary focus:outline-none"
                />
              )}
            </div>
          </div>
          <button
            onClick={handleTogglePause}
            disabled={togglingPause}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 ${
              ordersPaused
                ? 'bg-success hover:bg-success/90 text-white'
                : 'bg-error hover:bg-error/90 text-white'
            }`}
          >
            {togglingPause ? <Loader2 className="w-4 h-4 animate-spin" /> : (ordersPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />)}
            {ordersPaused ? 'Resume orders' : 'Pause orders'}
          </button>
        </div>
      </Card>

      {/* Per-network out-of-stock control */}
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <PackageX className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="font-bold text-white">Network Stock</p>
            <p className="text-xs text-text-muted mt-0.5">
              Mark a network out of stock to block orders for that network only. Other networks keep working.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(NETWORK_LABELS).map(([net, label]) => {
            const isOut = outOfStock.includes(net);
            const isLoading = togglingStock === net;
            return (
              <button
                key={net}
                onClick={() => handleToggleStock(net)}
                disabled={isLoading}
                className={`flex items-center justify-between gap-2 px-4 py-3 rounded-lg border transition-colors disabled:opacity-50 ${
                  isOut
                    ? 'bg-error/10 border-error/30 hover:bg-error/15'
                    : 'bg-success/5 border-success/20 hover:bg-success/10'
                }`}
              >
                <div className="text-left">
                  <p className="font-bold text-sm text-white">{label}</p>
                  <p className={`text-[10px] font-semibold ${isOut ? 'text-error' : 'text-success'}`}>
                    {isOut ? 'OUT OF STOCK' : 'IN STOCK'}
                  </p>
                </div>
                {isLoading
                  ? <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                  : isOut
                    ? <PackageCheck className="w-4 h-4 text-success" />
                    : <PackageX className="w-4 h-4 text-error" />}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Today's stats — Main Portal */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider">Today &middot; Main Portal</h2>
          </div>
          <Link href="/admin/orders?source=portal" className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
            View orders <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/admin/orders?source=portal">
            <Card hover className="!border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white">{portalToday.orders}</p>
                  <p className="text-xs text-text-muted">Portal Orders</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin/orders?source=portal">
            <Card hover className="!border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white">{formatCurrency(portalToday.revenue)}</p>
                  <p className="text-xs text-text-muted">Portal Sales</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin/orders?source=portal">
            <Card hover className="!border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white">{formatCurrency(portalToday.profit)}</p>
                  <p className="text-xs text-text-muted">Portal Profit</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* Today's stats — Agent Stores */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StoreIcon className="w-4 h-4 text-blue-500" />
            <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider">Today &middot; Agent Stores</h2>
          </div>
          <Link href="/admin/orders?source=store" className="flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors">
            View orders <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/admin/orders?source=store">
            <Card hover className="!border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white">{storeToday.orders}</p>
                  <p className="text-xs text-text-muted">Store Orders</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin/orders?source=store">
            <Card hover className="!border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white">{formatCurrency(storeToday.revenue)}</p>
                  <p className="text-xs text-text-muted">Store Sales</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/admin/orders?source=store">
            <Card hover className="!border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white">{formatCurrency(storeToday.profit)}</p>
                  <p className="text-xs text-text-muted">Platform Margin</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* All-time — Main Portal (kept fully separate from store totals) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider">All Time &middot; Main Portal</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card className="!border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{portalLifetime.orders}</p>
                <p className="text-xs text-text-muted">Portal Orders</p>
              </div>
            </div>
          </Card>
          <Card className="!border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{formatCurrency(portalLifetime.revenue)}</p>
                <p className="text-xs text-text-muted">Portal Revenue</p>
              </div>
            </div>
          </Card>
          <Card className="!border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{formatCurrency(portalLifetime.profit)}</p>
                <p className="text-xs text-text-muted">Portal Profit</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* All-time — Agent Stores (separate; never combined with portal) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <StoreIcon className="w-4 h-4 text-blue-500" />
          <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider">All Time &middot; Agent Stores</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card className="!border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{storeLifetime.orders}</p>
                <p className="text-xs text-text-muted">Store Orders</p>
              </div>
            </div>
          </Card>
          <Card className="!border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{formatCurrency(storeLifetime.revenue)}</p>
                <p className="text-xs text-text-muted">Store Revenue</p>
              </div>
            </div>
          </Card>
          <Card className="!border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{formatCurrency(storeLifetime.profit)}</p>
                <p className="text-xs text-text-muted">Platform Margin</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Platform meta — users & store count */}
      <div>
        <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider mb-3">Platform</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{stats?.totalUsers || 0}</p>
                <p className="text-xs text-text-muted">Total Users</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <StoreIcon className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">{stats?.totalStoresActivated || 0}</p>
                <p className="text-xs text-text-muted">Stores Activated</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Price Comparison: Your Selling vs Base (Provider) */}
      {networks.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Price Comparison (Selling vs Cost)</h2>
            <button
              onClick={fetchProviderPrices}
              disabled={fetchingPrices}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchingPrices ? 'animate-spin' : ''}`} />
              {providerPrices ? 'Refresh' : 'Fetch'} Live Provider Prices
            </button>
          </div>
          <div className="space-y-6">
            {networks.map(net => {
              const selling = sellingPrices[net] || {};
              const base = basePrices[net] || {};
              const live = providerPrices?.[net] || {};
              const capacities = [...new Set([...Object.keys(selling), ...Object.keys(base), ...Object.keys(live)])]
                .sort((a, b) => parseFloat(a) - parseFloat(b));

              if (capacities.length === 0) return null;

              return (
                <div key={net}>
                  <h3 className="font-bold text-sm text-white mb-2">{NETWORK_LABELS[net] || net}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.04]">
                          <th className="text-left py-2 text-text-muted font-semibold text-xs">Capacity</th>
                          <th className="text-right py-2 text-text-muted font-semibold text-xs">Base (Saved)</th>
                          {providerPrices && <th className="text-right py-2 text-text-muted font-semibold text-xs">Live Provider</th>}
                          <th className="text-right py-2 text-text-muted font-semibold text-xs">Your Selling</th>
                          <th className="text-right py-2 text-text-muted font-semibold text-xs">Profit/Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capacities.map(cap => {
                          const sellingPrice = selling[cap] || 0;
                          const basePrice = base[cap] || 0;
                          const livePrice = live[cap];
                          const profit = sellingPrice - (basePrice || 0);

                          return (
                            <tr key={cap} className="border-b border-white/[0.04]">
                              <td className="py-2 font-semibold text-white">{cap}GB</td>
                              <td className="py-2 text-right text-text-muted">
                                {basePrice ? formatCurrency(basePrice) : '—'}
                              </td>
                              {providerPrices && (
                                <td className="py-2 text-right">
                                  {livePrice != null ? (
                                    <span className={livePrice !== basePrice ? 'text-red-500 font-bold' : 'text-text-muted'}>
                                      {formatCurrency(livePrice)}
                                      {livePrice !== basePrice && basePrice ? ' ⚠' : ''}
                                    </span>
                                  ) : '—'}
                                </td>
                              )}
                              <td className="py-2 text-right font-bold text-white">
                                {sellingPrice ? formatCurrency(sellingPrice) : '—'}
                              </td>
                              <td className={`py-2 text-right font-bold ${profit > 0 ? 'text-success' : profit < 0 ? 'text-red-500' : 'text-text-muted'}`}>
                                {sellingPrice && basePrice ? formatCurrency(profit) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent activity */}
      {stats?.recentOrders?.length > 0 && (
        <Card>
          <h2 className="font-bold text-white mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {stats.recentOrders.map((order, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-white">{order.phoneNumber}</p>
                    <SourceBadge source={order.purchaseSource} size="xs" />
                  </div>
                  <p className="text-xs text-text-muted">{order.network} &middot; {order.capacity}GB</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-white">{formatCurrency(order.price)}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    order.status === 'completed' ? 'bg-success/10 text-success' :
                    order.status === 'processing' ? 'bg-blue-500/10 text-blue-500' :
                    order.status === 'pending' ? 'bg-accent/10 text-accent' :
                    'bg-error/10 text-error'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
