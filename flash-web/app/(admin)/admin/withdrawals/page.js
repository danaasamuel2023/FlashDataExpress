'use client';
import { useState, useEffect } from 'react';
import { Wallet, Loader2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const res = await api.get('/admin/withdrawals');
      setWithdrawals(res.data.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (id, status, rejectionReason) => {
    setProcessing(id);
    try {
      await api.put(`/admin/withdrawals/${id}`, { status, rejectionReason });
      toast.success(`Withdrawal ${status}`);
      fetchWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const pending = withdrawals.filter(w => w.status === 'pending');
  const processed = withdrawals.filter(w => w.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Withdrawals</h1>
        <p className="text-text-muted text-sm mt-1">{pending.length} pending requests</p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="font-bold text-sm text-text-muted mb-3">Pending Requests</h2>
          <div className="space-y-3">
            {pending.map(w => (
              <Card key={w._id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-white">{w.userId?.name || 'Unknown'}</p>
                    <p className="text-sm text-text-muted mt-0.5">
                      {formatCurrency(w.amount)} &middot; {w.momoDetails?.network} {w.momoDetails?.number}
                    </p>
                    <p className="text-xs text-text-muted mt-1">{w.momoDetails?.name} &middot; {formatDate(w.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={processing === w._id}
                      onClick={() => handleProcess(w._id, 'completed')}
                    >
                      <Check className="w-4 h-4" /> Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={processing === w._id}
                      onClick={() => {
                        const reason = prompt('Rejection reason:');
                        if (reason) handleProcess(w._id, 'rejected', reason);
                      }}
                    >
                      <X className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Processed */}
      {processed.length > 0 && (
        <div>
          <h2 className="font-bold text-sm text-text-muted mb-3">Processed</h2>
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">User</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Amount</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">MoMo</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map(w => (
                    <tr key={w._id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-3 font-semibold text-sm text-white">{w.userId?.name || 'Unknown'}</td>
                      <td className="px-5 py-3 font-bold text-sm text-white">{formatCurrency(w.amount)}</td>
                      <td className="px-5 py-3 text-xs text-text-muted">{w.momoDetails?.number}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          w.status === 'completed' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted">{formatDate(w.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {withdrawals.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="font-bold text-white">No withdrawals yet</p>
          </div>
        </Card>
      )}
    </div>
  );
}
