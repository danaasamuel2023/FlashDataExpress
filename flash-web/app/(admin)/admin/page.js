'use client';
import { useState, useEffect } from 'react';
import { Users, ShoppingBag, Wallet, TrendingUp, Loader2, RefreshCw, DollarSign, CalendarDays } from 'lucide-react';
import Card from '@/components/ui/Card';
import { formatCurrency, NETWORKS } from '@/lib/constants';
import api from '@/lib/api';

const NETWORK_LABELS = { YELLO: 'MTN', TELECEL: 'Telecel', AT_PREMIUM: 'AirtelTigo' };

export default function AdminOverviewPage() {
  const [stats, setStats] = useState(null);
  const [providerPrices, setProviderPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingPrices, setFetchingPrices] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

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

  const allTimeCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'primary' },
    { label: 'Total Orders', value: stats?.totalOrders || 0, icon: ShoppingBag, color: 'success' },
    { label: 'Revenue', value: formatCurrency(stats?.totalRevenue || 0), icon: TrendingUp, color: 'accent' },
    { label: 'Deposits', value: formatCurrency(stats?.totalDeposits || 0), icon: Wallet, color: 'blue-500' },
  ];

  const todayCards = [
    { label: "Today's Orders", value: stats?.todayOrders || 0, icon: CalendarDays, color: 'primary' },
    { label: "Today's Sales", value: formatCurrency(stats?.todayRevenue || 0), icon: ShoppingBag, color: 'success' },
    { label: "Today's Profit", value: formatCurrency(stats?.todayProfit || 0), icon: DollarSign, color: 'accent' },
  ];

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

      {/* Today's stats */}
      <div>
        <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider mb-3">Today</h2>
        <div className="grid grid-cols-3 gap-4">
          {todayCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={i}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-${card.color}/10 rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${card.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-white">{card.value}</p>
                    <p className="text-xs text-text-muted">{card.label}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* All-time stats */}
      <div>
        <h2 className="font-bold text-sm text-text-muted uppercase tracking-wider mb-3">All Time</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {allTimeCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={i}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-${card.color}/10 rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${card.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-white">{card.value}</p>
                    <p className="text-xs text-text-muted">{card.label}</p>
                  </div>
                </div>
              </Card>
            );
          })}
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
                  <p className="font-semibold text-sm text-white">{order.phoneNumber}</p>
                  <p className="text-xs text-text-muted">
                    {order.network} &middot; {order.capacity}GB
                    {order.purchaseSource === 'guest' && <span className="ml-1 text-primary">(Guest)</span>}
                    {order.purchaseSource === 'store' && <span className="ml-1 text-accent">(Store)</span>}
                  </p>
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
