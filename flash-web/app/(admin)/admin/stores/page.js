'use client';
import { useState, useEffect } from 'react';
import { Store, ExternalLink, Loader2, RefreshCw, ShoppingBag, TrendingUp, Wallet, X, CalendarDays, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function AdminStoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null); // { store, sales, todayRevenue, todayProfit, count }
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/admin/stores');
      setStores(res.data.data || []);
    } catch {
      toast.error('Failed to load stores');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openStoreDetail = async (storeId) => {
    setLoadingDetail(true);
    setSelectedStore({ loading: true });
    try {
      const res = await api.get(`/admin/stores/${storeId}/daily-sales`);
      setSelectedStore(res.data.data);
    } catch {
      toast.error('Failed to load store detail');
      setSelectedStore(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const activeCount = stores.filter(s => s.isActive).length;
  const todayRevenue = stores.reduce((s, st) => s + (st.todayRevenue || 0), 0);
  const todayProfit = stores.reduce((s, st) => s + (st.todayProfit || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Agent Stores</h1>
          <p className="text-text-muted text-sm mt-1">All activated agent stores. Click a row to see today&apos;s sales.</p>
        </div>
        <button
          onClick={fetchStores}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{stores.length}</p>
              <p className="text-xs text-text-muted">Activated</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{activeCount}</p>
              <p className="text-xs text-text-muted">Active</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(todayRevenue)}</p>
              <p className="text-xs text-text-muted">Today&apos;s Revenue</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(todayProfit)}</p>
              <p className="text-xs text-text-muted">Today&apos;s Agent Profit</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Stores list */}
      <Card>
        {stores.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">No agent stores activated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Store</th>
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Agent</th>
                  <th className="text-left py-2 text-text-muted font-semibold text-xs">Activated</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Today</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">All Time</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Pending</th>
                  <th className="text-right py-2 text-text-muted font-semibold text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr
                    key={s._id}
                    onClick={() => openStoreDetail(s._id)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="py-3">
                      <div>
                        <p className="font-bold text-white">{s.storeName}</p>
                        <a
                          href={`/shop/${s.storeSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80"
                        >
                          /{s.storeSlug} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="text-white text-xs">{s.agent?.name || '—'}</p>
                      <p className="text-text-muted text-[10px]">{s.agent?.email || ''}</p>
                    </td>
                    <td className="py-3 text-xs text-text-muted">{formatDate(s.activatedAt)}</td>
                    <td className="py-3 text-right">
                      <p className="font-bold text-white text-xs">{formatCurrency(s.todayRevenue)}</p>
                      <p className="text-[10px] text-text-muted">{s.todaySales} sale{s.todaySales === 1 ? '' : 's'}</p>
                    </td>
                    <td className="py-3 text-right">
                      <p className="text-xs text-white">{formatCurrency(s.totalEarnings)}</p>
                      <p className="text-[10px] text-text-muted">{s.totalSales} total</p>
                    </td>
                    <td className="py-3 text-right text-xs text-accent font-semibold">
                      {formatCurrency(s.pendingBalance)}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                      }`}>
                        {s.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Store detail modal */}
      {selectedStore && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedStore(null)}>
          <div
            className="bg-card border border-white/[0.06] rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="font-extrabold text-white">
                  {loadingDetail || selectedStore.loading ? 'Loading…' : selectedStore.store?.storeName}
                </h3>
                {!selectedStore.loading && selectedStore.store && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {selectedStore.store.agent?.name} &middot; {selectedStore.store.agent?.email}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedStore(null)} className="text-text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail || selectedStore.loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <div className="overflow-y-auto p-5 space-y-5">
                {/* Today summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-lg font-extrabold text-white">{selectedStore.count || 0}</p>
                        <p className="text-[10px] text-text-muted">Today&apos;s Sales</p>
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-accent" />
                      <div>
                        <p className="text-lg font-extrabold text-white">{formatCurrency(selectedStore.todayRevenue || 0)}</p>
                        <p className="text-[10px] text-text-muted">Today&apos;s Revenue</p>
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-success" />
                      <div>
                        <p className="text-lg font-extrabold text-white">{formatCurrency(selectedStore.todayProfit || 0)}</p>
                        <p className="text-[10px] text-text-muted">Today&apos;s Profit</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Lifetime */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <p className="text-base font-extrabold text-white">{selectedStore.store?.totalSales || 0}</p>
                    <p className="text-[10px] text-text-muted">Total Sales</p>
                  </Card>
                  <Card>
                    <p className="text-base font-extrabold text-white">{formatCurrency(selectedStore.store?.totalEarnings || 0)}</p>
                    <p className="text-[10px] text-text-muted">Total Earnings</p>
                  </Card>
                  <Card>
                    <p className="text-base font-extrabold text-white">{formatCurrency(selectedStore.store?.pendingBalance || 0)}</p>
                    <p className="text-[10px] text-text-muted">Pending Balance</p>
                  </Card>
                </div>

                {/* Sales list */}
                <div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Today&apos;s Sales</p>
                  {!selectedStore.sales?.length ? (
                    <p className="text-text-muted text-sm text-center py-6">No sales today.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {selectedStore.sales.map((sale, i) => (
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
                              sale.status === 'refunded' ? 'bg-text-muted/10 text-text-muted' :
                              'bg-accent/10 text-accent'
                            }`}>{sale.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
