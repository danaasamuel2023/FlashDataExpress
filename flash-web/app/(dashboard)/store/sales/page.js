'use client';
import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, ShoppingBag, CalendarDays, DollarSign, ArrowLeft, Search, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Copyable from '@/components/ui/Copyable';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

const CHECKER_STATUS_CLS = {
  completed: 'bg-success/10 text-success',
  refunded: 'bg-accent/10 text-accent',
  failed: 'bg-error/10 text-error',
  pending: 'bg-white/10 text-text-muted',
};

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function shiftDate(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

function dayLabel(dateStr) {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === shiftDate(today, -1)) return 'Yesterday';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function StoreSalesPage() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    fetchSales(date);
  }, [date]);

  const fetchSales = async (d) => {
    setLoading(true);
    try {
      const res = await api.get(`/store/daily-sales?date=${d}`);
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (trimmed.length < 3) {
      setSearchError('Enter at least 3 digits of the phone number');
      setSearchResults(null);
      return;
    }
    setSearchError('');
    setSearching(true);
    try {
      const res = await api.get(`/store/checker-sales?phone=${encodeURIComponent(trimmed)}`);
      setSearchResults(res.data.data.purchases);
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Search failed. Please try again.');
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  };

  const isToday = date === todayStr();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/store/dashboard"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-text-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Sales</h1>
          <p className="text-text-muted text-sm mt-0.5">View and filter your store sales by date.</p>
        </div>
      </div>

      {/* Date filter */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Pick a date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 [color-scheme:dark]"
            />
          </div>

          <button
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={isToday}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isToday && (
            <button
              onClick={() => setDate(todayStr())}
              className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={() => fetchSales(date)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-text-muted hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <p className="text-xs text-text-muted mt-3">
          Showing sales for <span className="font-bold text-white">{dayLabel(date)}</span>
        </p>
      </Card>

      {/* Day summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{data?.count ?? 0}</p>
              <p className="text-xs text-text-muted">Sales</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(data?.todayRevenue || 0)}</p>
              <p className="text-xs text-text-muted">Revenue</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(data?.todayProfit || 0)}</p>
              <p className="text-xs text-text-muted">Profit</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sales list */}
      <Card>
        <div className="mb-4">
          <h2 className="font-bold text-white">Sales on {dayLabel(date)}</h2>
          {data?.checkerCount > 0 && (
            <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              +{data.checkerCount} checker sale{data.checkerCount !== 1 ? 's' : ''} &middot; {formatCurrency(data.checkerRevenue)} revenue
            </p>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
        ) : !data?.sales?.length ? (
          <p className="text-text-muted text-sm text-center py-12">No store sales on this day.</p>
        ) : (
          <div className="space-y-3">
            {data.sales.map((sale, i) => {
              const sub = sale.storeDetails?.subAgentId;
              const subLabel = sub && typeof sub === 'object'
                ? (sub.storeName || sub.contactPhone || sub.contactWhatsapp)
                : null;
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="font-semibold text-sm text-white">{sale.network} {sale.capacity}GB</p>
                    <p className="text-xs text-text-muted">{sale.phoneNumber}</p>
                    {subLabel && (
                      <p className="text-[10px] font-semibold text-primary mt-0.5">
                        Sub-agent: {subLabel}
                        {sub.contactPhone && sub.storeName ? ` • ${sub.contactPhone}` : ''}
                      </p>
                    )}
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
              );
            })}
          </div>
        )}
      </Card>

      {/* Result checker sale lookup */}
      <Card>
        <h2 className="font-bold text-white mb-1">Find a Result Checker Sale</h2>
        <p className="text-xs text-text-muted mb-4">
          Look up a customer's serial number and PIN by phone number, in case they lost their screenshot. Searches your full sales history, not just {dayLabel(date)}.
        </p>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              icon={Search}
              type="text"
              placeholder="Last 8-9 digits of the customer's phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={searchError}
            />
          </div>
          <Button type="submit" loading={searching} disabled={searching}>
            Search
          </Button>
        </form>

        {searchResults && (
          <div className="mt-4 space-y-3">
            {searchResults.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-8">No matching checker sales.</p>
            ) : (
              searchResults.map((purchase) => {
                const sub = purchase.storeDetails?.subAgentId;
                const subLabel = sub && typeof sub === 'object'
                  ? (sub.storeName || sub.contactPhone || sub.contactWhatsapp)
                  : null;
                return (
                  <div key={purchase._id} className="border border-white/[0.06] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-emerald-400" />
                        <p className="font-semibold text-sm text-white">{purchase.checkerType}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHECKER_STATUS_CLS[purchase.status] || CHECKER_STATUS_CLS.pending}`}>
                          {purchase.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted">{formatDate(purchase.createdAt)}</p>
                    </div>
                    <p className="text-xs text-text-muted">{purchase.phoneNumber} &middot; {purchase.reference}</p>
                    {subLabel && (
                      <p className="text-[10px] font-semibold text-primary">
                        Sub-agent: {subLabel}
                        {sub.contactPhone && sub.storeName ? ` • ${sub.contactPhone}` : ''}
                      </p>
                    )}
                    {purchase.status === 'completed' && purchase.serialNumber ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Copyable label="Serial Number" value={purchase.serialNumber} />
                        <Copyable label="PIN" value={purchase.pin} />
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted italic">No serial/PIN yet — sale is {purchase.status}.</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
