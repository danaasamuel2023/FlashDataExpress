'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, DollarSign, ShoppingBag, Package, Copy, Check, ExternalLink, LogOut, Loader2, Clock, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function SubAgentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ds_token');
    if (!token) {
      router.push('/subagent/login');
      return;
    }
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/subagent/my-dashboard');
      setDashboard(res.data.data);

      // Update local storage
      const sa = res.data.data.subAgent;
      localStorage.setItem('ds_subagent', JSON.stringify(sa));
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

  const handleCopyLink = () => {
    const link = `${window.location.origin}/subshop/${dashboard.subAgent.storeSlug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Agent Store link copied!');
    setTimeout(() => setCopied(false), 2000);
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
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{subAgent.totalSales || 0}</p>
                <p className="text-xs text-gray-500">Total Sales</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{formatCurrency(subAgent.totalEarnings || 0)}</p>
                <p className="text-xs text-gray-500">Total Earnings</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-white">{formatCurrency(subAgent.pendingBalance || 0)}</p>
                <p className="text-xs text-gray-500">Pending Balance</p>
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

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/subagent/products"
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors group"
          >
            <Package className="w-6 h-6 text-amber-400 mb-2" />
            <p className="font-bold text-white text-sm">Manage Products</p>
            <p className="text-xs text-gray-500 mt-1">Set your selling prices</p>
          </Link>
          <a
            href={`/subshop/${subAgent.storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-amber-500/30 transition-colors group"
          >
            <ExternalLink className="w-6 h-6 text-amber-400 mb-2" />
            <p className="font-bold text-white text-sm">View Agent Store</p>
            <p className="text-xs text-gray-500 mt-1">See what customers see</p>
          </a>
        </div>

        {/* WhatsApp Support */}
        {subAgent.parentWhatsapp && (
          <a
            href={`https://wa.me/${subAgent.parentWhatsapp.replace(/\D/g, '').replace(/^0/, '233')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4 hover:bg-green-500/20 transition-colors"
          >
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">WhatsApp Support</p>
              <p className="text-xs text-gray-400">Contact your parent agent ({subAgent.parentStoreName}) for help</p>
            </div>
          </a>
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
              {sales.map(sale => (
                <div key={sale._id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
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
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(sale.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
