'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, ShoppingBag, CalendarDays, DollarSign, ArrowLeft, Clock, Search, GraduationCap } from 'lucide-react';
import Copyable from '@/components/ui/Copyable';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

const CHECKER_STATUS_CLS = {
  completed: 'bg-green-500/10 text-green-400',
  refunded: 'bg-red-500/10 text-red-400',
  failed: 'bg-red-500/10 text-red-400',
  pending: 'bg-yellow-500/10 text-yellow-400',
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

export default function SubAgentSalesPage() {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (!token) {
      router.push('/subagent/login');
      return;
    }
    fetchSales(date);
  }, [date]);

  const fetchSales = async (d) => {
    setLoading(true);
    try {
      const res = await api.get(`/subagent/my-daily-sales?date=${d}`);
      setData(res.data.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/subagent/login');
        return;
      }
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
      const res = await api.get(`/subagent/checker-sales?phone=${encodeURIComponent(trimmed)}`);
      setSearchResults(res.data.data.purchases);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/subagent/login');
        return;
      }
      setSearchError(err.response?.data?.message || 'Search failed. Please try again.');
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  };

  const isToday = date === todayStr();

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/subagent/dashboard"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold text-white">Sales</h1>
            <p className="text-xs text-gray-500">Find any sale by date.</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Date filter */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Pick a date</label>
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 [color-scheme:dark]"
              />
            </div>

            <button
              onClick={() => setDate(shiftDate(date, 1))}
              disabled={isToday}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday && (
              <button
                onClick={() => setDate(todayStr())}
                className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => fetchSales(date)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Showing sales for <span className="font-bold text-white">{dayLabel(date)}</span>
          </p>
        </div>

        {/* Day summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{data?.count ?? 0}</p>
                <p className="text-xs text-gray-500">Sales</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{formatCurrency(data?.todayRevenue || 0)}</p>
                <p className="text-xs text-gray-500">Revenue</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{formatCurrency(data?.todayProfit || 0)}</p>
                <p className="text-xs text-gray-500">Profit</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sales list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="mb-4">
            <h2 className="font-bold text-white">Sales on {dayLabel(date)}</h2>
            {data?.checkerCount > 0 && (
              <p className="text-xs text-amber-400 font-semibold mt-1 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                +{data.checkerCount} checker sale{data.checkerCount !== 1 ? 's' : ''} &middot; {formatCurrency(data.checkerRevenue)} revenue
              </p>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-amber-400 animate-spin" /></div>
          ) : !data?.sales?.length ? (
            <p className="text-gray-500 text-sm text-center py-12">No sales on this day.</p>
          ) : (
            <div className="space-y-3">
              {data.sales.map((sale) => {
                const profit = sale.storeDetails?.subAgentProfit || 0;
                const statusLabel = sale.status === 'completed' ? 'Completed'
                  : sale.status === 'failed' ? 'Failed'
                  : sale.status === 'processing' ? 'Processing'
                  : sale.status === 'refunded' ? 'Refunded'
                  : 'Pending';
                return (
                  <div key={sale._id} className="py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          sale.status === 'completed' ? 'bg-green-400' :
                          sale.status === 'failed' || sale.status === 'refunded' ? 'bg-red-400' : 'bg-yellow-400'
                        }`} />
                        <div>
                          <p className="font-semibold text-sm text-white">{sale.network} {sale.capacity}GB</p>
                          <p className="text-xs text-gray-500">{sale.phoneNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-white">{formatCurrency(sale.price)}</p>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          sale.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                          sale.status === 'failed' || sale.status === 'refunded' ? 'bg-red-500/10 text-red-400' :
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

        {/* Result checker sale lookup */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="font-bold text-white mb-1">Find a Result Checker Sale</h2>
          <p className="text-xs text-gray-500 mb-4">
            Look up a customer's serial number and PIN by phone number, in case they lost their screenshot. Searches your full sales history, not just {dayLabel(date)}.
          </p>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Last 8-9 digits of the customer's phone number"
                className="w-full pl-9 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
              />
              {searchError && <p className="text-xs text-red-400 mt-1">{searchError}</p>}
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-bold hover:bg-amber-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {searching && <Loader2 className="w-4 h-4 animate-spin" />} Search
            </button>
          </form>

          {searchResults && (
            <div className="mt-4 space-y-3">
              {searchResults.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No matching checker sales.</p>
              ) : (
                searchResults.map((purchase) => (
                  <div key={purchase._id} className="border border-gray-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-amber-400" />
                        <p className="font-semibold text-sm text-white">{purchase.checkerType}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CHECKER_STATUS_CLS[purchase.status] || CHECKER_STATUS_CLS.pending}`}>
                          {purchase.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500">{formatDate(purchase.createdAt)}</p>
                    </div>
                    <p className="text-xs text-gray-500">{purchase.phoneNumber} &middot; <span className="font-mono">{purchase.reference}</span></p>
                    {purchase.status === 'completed' && purchase.serialNumber ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Copyable label="Serial Number" value={purchase.serialNumber} accentClass="bg-amber-500/10 text-amber-400" />
                        <Copyable label="PIN" value={purchase.pin} accentClass="bg-amber-500/10 text-amber-400" />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No serial/PIN yet — sale is {purchase.status}.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
