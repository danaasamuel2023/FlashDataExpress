'use client';
import { useState, useEffect } from 'react';
import { Wallet, ArrowUpRight, Loader2, Clock, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

const STATUS_COLORS = {
  completed: 'bg-success/10 text-success',
  pending: 'bg-accent/10 text-accent',
  processing: 'bg-blue-500/10 text-blue-500',
  rejected: 'bg-error/10 text-error',
};

export default function StoreWithdrawalsPage() {
  const [store, setStore] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [storeRes, withdrawalsRes] = await Promise.all([
        api.get('/store/my-store'),
        api.get('/withdrawal/history'),
      ]);
      setStore(storeRes.data.data);
      setWithdrawals(withdrawalsRes.data.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    const value = parseFloat(amount);
    if (!value || value < 1) {
      toast.error('Enter a valid amount');
      return;
    }

    setRequesting(true);
    try {
      await api.post('/withdrawal/request', { amount: value });
      toast.success('Withdrawal requested!');
      setAmount('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request withdrawal');
    } finally {
      setRequesting(false);
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
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Withdrawals</h1>
        <p className="text-text-muted text-sm mt-1">Withdraw your store earnings to MoMo.</p>
      </div>

      {/* Balance */}
      <Card className="bg-card !text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs">Available to withdraw</p>
            <p className="text-2xl font-extrabold">{formatCurrency(store?.pendingBalance || 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs">Total earned</p>
            <p className="text-lg font-bold">{formatCurrency(store?.totalEarnings || 0)}</p>
          </div>
        </div>
      </Card>

      {/* Request withdrawal */}
      <Card>
        <h2 className="font-bold text-white mb-4">Request Withdrawal</h2>
        <div className="space-y-4">
          <Input
            label="Amount (GH₵)"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {store?.momoDetails?.number && (
            <p className="text-xs text-text-muted">
              Sending to: <span className="font-semibold text-text-muted">{store.momoDetails.name} ({store.momoDetails.number})</span>
            </p>
          )}
          <Button fullWidth loading={requesting} onClick={handleRequest}>
            <ArrowUpRight className="w-4 h-4" /> Request Withdrawal
          </Button>
        </div>
      </Card>

      {/* History */}
      <div>
        <h2 className="font-bold text-white mb-3">Withdrawal History</h2>
        {withdrawals.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <Wallet className="w-10 h-10 text-white/10 mx-auto mb-2" />
              <p className="text-text-muted text-sm">No withdrawals yet.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {withdrawals.map(w => (
              <Card key={w._id} className="!p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-white">{formatCurrency(w.amount)}</p>
                    <p className="text-xs text-text-muted mt-0.5">{formatDate(w.createdAt)} &middot; {w.reference}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    STATUS_COLORS[w.status] || STATUS_COLORS.pending
                  }`}>
                    {w.status}
                  </span>
                </div>
                {w.rejectionReason && (
                  <p className="text-xs text-error mt-2">Reason: {w.rejectionReason}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
