'use client';
import Link from 'next/link';
import { ShoppingBag, TrendingUp, Clock, Gift, ArrowRight, Wallet } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import NetworkIcon from '@/components/shared/NetworkIcon';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/constants';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Hey, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-text-muted text-sm mt-1">What would you like to do today?</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(user?.walletBalance || 0)}</p>
              <p className="text-xs text-text-muted">Balance</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">0</p>
              <p className="text-xs text-text-muted">Orders</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Gift className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">0</p>
              <p className="text-xs text-text-muted">Referrals</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{formatCurrency(0)}</p>
              <p className="text-xs text-text-muted">This Month</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Buy */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg text-white">Quick Buy</h2>
              <p className="text-xs text-text-muted mt-0.5">Choose a network to get started</p>
            </div>
            <Link href="/buy">
              <Button variant="ghost" size="sm">View all <ArrowRight className="w-3.5 h-3.5" /></Button>
            </Link>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { net: 'YELLO', label: 'MTN', popular: ['2GB — GH₵9', '5GB — GH₵23', '10GB — GH₵42'] },
              { net: 'TELECEL', label: 'Telecel', popular: ['10GB — GH₵38', '15GB — GH₵55', '25GB — GH₵92'] },
              { net: 'AT_PREMIUM', label: 'AirtelTigo', popular: ['2GB — GH₵8.5', '5GB — GH₵20', '10GB — GH₵39'] }
            ].map(({ net, label, popular }) => (
              <Link key={net} href={`/buy?network=${net}`}>
                <div className="p-4 rounded-2xl border-2 border-white/[0.04] hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all text-center group cursor-pointer">
                  <div className="flex justify-center mb-3">
                    <NetworkIcon network={net} size={48} />
                  </div>
                  <p className="font-bold text-sm text-white">{label}</p>
                  <div className="mt-2 space-y-1">
                    {popular.map((p, i) => (
                      <p key={i} className="text-[11px] text-text-muted">{p}</p>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    Buy now →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {/* Referral banner */}
      <div className="bg-gradient-to-r from-secondary to-secondary-light rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-lg">Earn with referrals</h3>
          <p className="text-white/40 text-sm mt-1">Share your code <span className="text-primary font-bold">{user?.referralCode}</span> and earn on every purchase</p>
        </div>
        <Link href="/referrals">
          <Button variant="accent" size="sm">Start earning</Button>
        </Link>
      </div>
    </div>
  );
}
