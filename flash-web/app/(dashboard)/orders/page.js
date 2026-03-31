'use client';
import { useState, useEffect } from 'react';
import { Package, Loader2, Search, RefreshCw, CheckCircle2, Clock, AlertCircle, RotateCcw, Cpu } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import NetworkIcon from '@/components/shared/NetworkIcon';
import { formatCurrency, formatDate, NETWORKS } from '@/lib/constants';
import api from '@/lib/api';

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'text-accent', bg: 'bg-accent/10' },
  processing: { label: 'Processing', icon: Cpu, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'text-error', bg: 'bg-error/10' },
  refunded: { label: 'Refunded', icon: RotateCcw, color: 'text-text-muted', bg: 'bg-white/5' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/purchase/history');
      setOrders(res.data.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filtered = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (networkFilter !== 'all' && order.network !== networkFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        order.reference?.toLowerCase().includes(q) ||
        order.phoneNumber?.includes(q)
      );
    }
    return true;
  });

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">My Orders</h1>
          <p className="text-text-muted text-sm mt-1">Track all your data purchases and their status.</p>
        </div>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl bg-surface-light hover:bg-white/5 text-text-muted hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4.5 h-4.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status summary */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const count = statusCounts[key] || 0;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  statusFilter === key
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-white/[0.04] bg-surface hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span className="text-white font-extrabold text-lg">{count}</span>
                </div>
                <p className="text-text-muted text-xs mt-0.5">{config.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon={Search}
            placeholder="Search by reference or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', 'YELLO', 'TELECEL', 'AT_PREMIUM'].map(f => (
            <button
              key={f}
              onClick={() => setNetworkFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                networkFilter === f
                  ? 'bg-primary text-white'
                  : 'bg-surface-light text-text-muted hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'All Networks' : (
                <>
                  <NetworkIcon network={f} size={16} />
                  {NETWORKS[f]?.label}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="font-bold text-white">
              {orders.length === 0 ? 'No orders yet' : 'No matching orders'}
            </p>
            <p className="text-text-muted text-sm mt-1">
              {orders.length === 0
                ? 'Your data purchases will appear here once you make an order.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            return (
              <Card key={order._id} className="!p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <NetworkIcon network={order.network} size={40} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-text truncate">
                        {order.capacity}GB {NETWORKS[order.network]?.label || order.network}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      To: <span className="text-text">{order.phoneNumber}</span>
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatDate(order.createdAt)} &middot; {order.reference}
                    </p>
                    {order.status === 'failed' && order.failureReason && (
                      <p className="text-xs text-error/80 mt-1">
                        {order.failureReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-sm text-white">
                      {formatCurrency(order.price)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
