'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, Globe, Store as StoreIcon, ArrowLeft, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';
import Card from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialSource = searchParams.get('source') === 'store' ? 'store' : 'portal';
  const [salesSource, setSalesSource] = useState(initialSource);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, [salesSource]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/daily-sales?source=${salesSource}`);
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const switchSource = (next) => {
    setSalesSource(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('source', next);
    router.replace(`/admin/orders?${params.toString()}`);
  };

  const sales = data?.sales || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Today&apos;s Orders</h1>
          <p className="text-text-muted text-sm mt-1">Detailed view of today&apos;s orders with profit.</p>
        </div>
      </div>

      {/* Source toggle */}
      <div className="flex items-center gap-2">
        <div className="flex bg-surface-light rounded-lg p-0.5">
          <button
            onClick={() => switchSource('portal')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
              salesSource === 'portal' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" /> Main Portal
          </button>
          <button
            onClick={() => switchSource('store')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
              salesSource === 'store' ? 'bg-blue-500 text-white' : 'text-text-muted hover:text-white'
            }`}
          >
            <StoreIcon className="w-4 h-4" /> Agent Stores
          </button>
        </div>
        <button
          onClick={fetchSales}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50 ml-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-white">{data?.count ?? 0}</p>
              <p className="text-xs text-text-muted">Orders</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-white">{formatCurrency(data?.totalRevenue || 0)}</p>
              <p className="text-xs text-text-muted">Revenue</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-white">{formatCurrency(data?.totalProfit || 0)}</p>
              <p className="text-xs text-text-muted">{salesSource === 'store' ? 'Platform Margin' : 'Profit'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Orders list */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : !sales.length ? (
          <p className="text-text-muted text-sm text-center py-16">No orders today yet.</p>
        ) : (
          <div className="space-y-3">
            {sales.map((order, i) => {
              const profit = (order.price || 0) - (order.costPrice || 0);
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="font-semibold text-sm text-white">{order.phoneNumber}</p>
                    <p className="text-xs text-text-muted">
                      {order.network} &middot; {order.capacity}GB
                      {order.purchaseSource === 'guest' && <span className="ml-1 text-primary">(Guest)</span>}
                      {order.purchaseSource === 'store' && <span className="ml-1 text-accent">(Store)</span>}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">{formatDate(order.createdAt)} &middot; {order.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-white">{formatCurrency(order.price)}</p>
                    <p className={`text-[10px] font-semibold ${profit > 0 ? 'text-success' : 'text-text-muted'}`}>
                      Profit: {formatCurrency(profit)}
                    </p>
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
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
