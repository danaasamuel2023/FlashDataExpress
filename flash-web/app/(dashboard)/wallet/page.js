'use client';
import { useState } from 'react';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Loader2, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

export default function WalletPage() {
  const { user, refreshUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);

  const handleDeposit = async () => {
    const value = parseFloat(amount);
    if (!value || value < 1) {
      toast.error('Enter a valid amount (min GH₵1)');
      return;
    }

    setDepositing(true);
    try {
      const res = await api.post('/wallet/deposit', { amount: value });
      const { authorization_url } = res.data.data;
      window.location.href = authorization_url;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate deposit');
      setDepositing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Wallet</h1>
        <p className="text-text-muted text-sm mt-1">Manage your balance and make deposits.</p>
      </div>

      {/* Balance card */}
      <Card className="bg-card !text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-white/40 text-sm">Available Balance</p>
          <p className="text-3xl font-extrabold mt-1">{formatCurrency(user?.walletBalance || 0)}</p>
          <div className="flex gap-3 mt-5">
            <Button variant="accent" size="sm" onClick={() => setShowDeposit(!showDeposit)}>
              <Plus className="w-4 h-4" /> Deposit
            </Button>
            <Button variant="ghost" size="sm" className="!text-white/60 hover:!text-white" onClick={() => window.location.href = '/transactions'}>
              View history
            </Button>
          </div>
        </div>
      </Card>

      {/* Deposit section */}
      {showDeposit && (
        <Card>
          <h2 className="font-bold text-white mb-4">Deposit Funds</h2>
          <div className="space-y-4">
            <Input
              label="Amount (GH₵)"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => setAmount(String(a))}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    amount === String(a)
                      ? 'bg-primary text-white'
                      : 'bg-surface-light text-text-muted hover:bg-white/5'
                  }`}
                >
                  GH₵{a}
                </button>
              ))}
            </div>
            {amount && parseFloat(amount) >= 1 && (
              <div className="bg-surface-light rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Deposit amount</span>
                  <span className="text-white font-medium">GH₵{parseFloat(amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Processing fee (3%)</span>
                  <span className="text-white font-medium">GH₵{(parseFloat(amount) * 0.03).toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 pt-1 flex justify-between text-sm">
                  <span className="text-text-muted font-semibold">Total charge</span>
                  <span className="text-primary font-bold">GH₵{(parseFloat(amount) * 1.03).toFixed(2)}</span>
                </div>
              </div>
            )}
            <Button fullWidth size="lg" loading={depositing} onClick={handleDeposit}>
              <Wallet className="w-4 h-4" />
              {amount && parseFloat(amount) >= 1
                ? `Pay GH₵${(parseFloat(amount) * 1.03).toFixed(2)}`
                : 'Pay with Paystack'}
            </Button>
            <p className="text-xs text-text-muted text-center">
              A 3% processing fee applies. You&apos;ll be redirected to Paystack to complete your payment.
            </p>
          </div>
        </Card>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="font-bold text-white">Instant top-up</p>
              <p className="text-xs text-text-muted">Via Mobile Money or Card</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">Deposits are credited instantly after successful payment.</p>
        </Card>
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-white">Secure payments</p>
              <p className="text-xs text-text-muted">PCI-DSS compliant</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">All payments are processed securely through Paystack.</p>
        </Card>
      </div>
    </div>
  );
}
