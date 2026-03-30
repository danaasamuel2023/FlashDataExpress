'use client';
import { useState, useEffect } from 'react';
import { Users, TrendingUp, Wallet, ShoppingBag, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

export default function SubAgentDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/subagent/my-dashboard');
      setData(res.data.data);
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.error('Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/shop/${data.subAgent.storeId.storeSlug}?ref=${data.subAgent.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Users className="w-10 h-10 text-text-muted" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Not a Subagent</h1>
        <p className="text-text-muted mt-2 max-w-sm mx-auto">
          You are not currently a subagent of any store. Ask an agent to add you.
        </p>
      </div>
    );
  }

  const { subAgent, sales } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Subagent Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">
            Selling for <span className="text-white font-semibold">{subAgent.storeId.storeName}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'My Link'}
          </Button>
          <Link href={`/shop/${subAgent.storeId.storeSlug}?ref=${subAgent.referralCode}`} target="_blank">
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4" /> Visit Store
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{subAgent.totalSales || 0}</p>
              <p className="text-xs text-text-muted">My Sales</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(subAgent.totalEarnings || 0)}</p>
              <p className="text-xs text-text-muted">Total Earned</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(subAgent.pendingBalance || 0)}</p>
              <p className="text-xs text-text-muted">Pending Balance</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{subAgent.commissionPercent}%</p>
              <p className="text-xs text-text-muted">My Commission</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Referral code card */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted font-medium">Your Referral Code</p>
            <p className="text-lg font-extrabold text-primary mt-0.5">{subAgent.referralCode}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </Card>

      {/* Recent sales */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3">Recent Sales</h2>
        {sales.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-text-muted text-sm">No sales yet. Share your referral link to start earning!</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {sales.map(sale => (
              <Card key={sale._id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{sale.capacity}GB {sale.network}</p>
                    <p className="text-xs text-text-muted">
                      {sale.phoneNumber} &middot; {new Date(sale.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-success">
                      +{formatCurrency(sale.storeDetails?.subAgentProfit || 0)}
                    </p>
                    <p className={`text-xs font-medium ${
                      sale.status === 'completed' ? 'text-success' : sale.status === 'failed' ? 'text-error' : 'text-text-muted'
                    }`}>
                      {sale.status}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
