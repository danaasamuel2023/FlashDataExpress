'use client';
import { useState, useEffect } from 'react';
import { Wallet, Loader2, Check, X, Zap, Hand } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [transferKeyConfigured, setTransferKeyConfigured] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
    fetchSettings();
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

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setTransferKeyConfigured(!!res.data.data?.paystack?.transferKeyConfigured);
    } catch {
      // silently fail
    }
  };

  const handleProcess = async (id, status, { rejectionReason, mode } = {}) => {
    setProcessing(id);
    try {
      const res = await api.put(`/admin/withdrawals/${id}`, { status, rejectionReason, mode });
      const label = status === 'rejected'
        ? 'Withdrawal rejected'
        : res.data.mode === 'auto'
          ? `Paystack transfer initiated (${res.data.paystack?.transferStatus || 'pending'})`
          : 'Marked completed (manual)';
      toast.success(label);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Withdrawals</h1>
          <p className="text-text-muted text-sm mt-1">{pending.length} pending requests</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
          transferKeyConfigured ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
        }`}>
          {transferKeyConfigured ? <Zap className="w-3.5 h-3.5" /> : <Hand className="w-3.5 h-3.5" />}
          {transferKeyConfigured ? 'Auto-payout ON' : 'Manual mode (set transfer key in Settings)'}
        </span>
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
                      Requested: <span className="font-semibold text-white">{formatCurrency(w.amount)}</span>
                      {w.fee > 0 && <> · fee {formatCurrency(w.fee)}</>}
                      {' · '}
                      <span className="text-success">pays {formatCurrency(w.netAmount)}</span>
                    </p>
                    <p className="text-sm text-text-muted mt-0.5">
                      {w.momoDetails?.network} {w.momoDetails?.number} ({w.momoDetails?.name})
                    </p>
                    <p className="text-xs text-text-muted mt-1">{formatDate(w.createdAt)} &middot; {w.reference}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {transferKeyConfigured ? (
                      <>
                        <Button
                          size="sm"
                          loading={processing === w._id}
                          onClick={() => handleProcess(w._id, 'completed', { mode: 'auto' })}
                        >
                          <Zap className="w-4 h-4" /> Approve &amp; Pay
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={processing === w._id}
                          onClick={() => handleProcess(w._id, 'completed', { mode: 'manual' })}
                        >
                          <Hand className="w-4 h-4" /> Mark paid manually
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        loading={processing === w._id}
                        onClick={() => handleProcess(w._id, 'completed', { mode: 'manual' })}
                      >
                        <Check className="w-4 h-4" /> Approve (manual)
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      loading={processing === w._id}
                      onClick={() => {
                        const reason = prompt('Rejection reason:');
                        if (reason) handleProcess(w._id, 'rejected', { rejectionReason: reason });
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
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Paystack</th>
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
                          w.status === 'completed' ? 'bg-success/10 text-success' :
                          w.status === 'processing' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-error/10 text-error'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted">
                        {w.paystackTransferCode ? (
                          <span className="font-mono">{w.paystackTransferStatus || 'initiated'}</span>
                        ) : '—'}
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
