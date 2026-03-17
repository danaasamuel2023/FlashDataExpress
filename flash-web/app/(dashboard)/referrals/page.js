'use client';
import { useState, useEffect } from 'react';
import { Gift, Users, TrendingUp, Copy, Check, Loader2, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

export default function ReferralsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/referral/dashboard');
      setDashboard(res.data.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/sign-up?ref=${user?.referralCode}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Flash Data Express',
        text: `Sign up on Flash Data Express with my referral code ${user?.referralCode} and get the cheapest data bundles!`,
        url: referralLink,
      });
    } else {
      handleCopy();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Referrals</h1>
        <p className="text-text-muted text-sm mt-1">Invite friends and earn on every purchase they make.</p>
      </div>

      {/* Referral code card */}
      <Card className="bg-gradient-to-r from-secondary to-secondary-light !text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/40 text-sm">Your referral code</p>
            <p className="text-2xl font-extrabold tracking-wider mt-1">{user?.referralCode}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="accent" size="sm" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <Button variant="ghost" size="sm" className="!text-white/60 hover:!text-white" onClick={handleShare}>
              <Share2 className="w-4 h-4" /> Share
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-center">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xl font-extrabold text-white">{dashboard?.totalReferred || 0}</p>
            <p className="text-xs text-text-muted mt-0.5">Friends joined</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-xl font-extrabold text-white">{formatCurrency(dashboard?.totalEarnings || 0)}</p>
            <p className="text-xs text-text-muted mt-0.5">Total earned</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Gift className="w-5 h-5 text-accent" />
            </div>
            <p className="text-xl font-extrabold text-white">{dashboard?.bonusDataEarned || '0GB'}</p>
            <p className="text-xs text-text-muted mt-0.5">Bonus data</p>
          </div>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <h2 className="font-bold text-white mb-4">How it works</h2>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Share your code', desc: 'Send your referral link to friends and family.' },
            { step: '2', title: 'They sign up', desc: 'When they create an account using your code, they become your referral.' },
            { step: '3', title: 'You earn!', desc: 'Every time they buy data, you earn a commission plus bonus data rewards.' },
          ].map(item => (
            <div key={item.step} className="flex gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-extrabold text-sm">{item.step}</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-text">{item.title}</p>
                <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Referred users */}
      {dashboard?.referredUsers?.length > 0 && (
        <Card>
          <h2 className="font-bold text-white mb-4">Your referrals</h2>
          <div className="space-y-3">
            {dashboard.referredUsers.map((ref, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div>
                  <p className="font-semibold text-sm text-text">{ref.name}</p>
                  <p className="text-xs text-text-muted">Joined {ref.joinedAt}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  ref.status === 'active' ? 'bg-success/10 text-success' : 'bg-surface-light text-text-muted'
                }`}>
                  {ref.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
