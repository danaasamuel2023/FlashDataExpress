'use client';
import { useState, useEffect } from 'react';
import { Wallet, Loader2, Check, X, Zap, Hand, RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [checking, setChecking] = useState(null);
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

  const handleCheckStatus = async (id) => {
    setChecking(id);
    try {
      const res = await api.post(`/admin/withdrawals/${id}/check-status`);
      const ps = res.data.paystack || {};
      const w = res.data.data;
      if (w.status === 'completed') {
        toast.success('Transfer confirmed successful');
      } else if (w.status === 'rejected') {
        toast.error(`Transfer failed: ${w.rejectionReason || ps.failureMessage || 'unknown'}`);
      } else {
        toast(`Still ${ps.status || w.status} — check again in a moment`, { icon: '⏳' });
      }
      fetchWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status check failed');
    } finally {
      setChecking(null);
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
  const processingList = withdrawals.filter(w => w.status === 'processing');
  const processed = withdrawals.filter(w => w.status === 'completed' || w.status === 'rejected');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Withdrawals</h1>
          <p className="text-text-muted text-sm mt-1">
            {pending.length} pending &middot; {processingList.length} processing
          </p>
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

      {/* Processing — transfers in flight */}
      {processingList.length > 0 && (
        <div>
          <h2 className="font-bold text-sm text-text-muted mb-3 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing ({processingList.length})
          </h2>
          <div className="space-y-3">
            {processingList.map(w => (
              <Card key={w._id} className="!border-blue-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white">{w.userId?.name || 'Unknown'}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                        {w.paystackTransferStatus || 'pending'}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted mt-0.5">
                      {formatCurrency(w.netAmount)} &middot; {w.momoDetails?.network} {w.momoDetails?.number}
                    </p>
                    {w.paystackTransferCode && (
                      <p className="text-[10px] font-mono text-text-muted mt-1">
                        Paystack: {w.paystackTransferCode}
                      </p>
                    )}
                    {w.rejectionReason && (
                      <div className="mt-2 flex items-start gap-2 bg-accent/5 border border-accent/20 rounded-lg p-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-text">{w.rejectionReason}</p>
                      </div>
                    )}
                    <p className="text-xs text-text-muted mt-1">
                      Approved {w.processedAt ? formatDate(w.processedAt) : formatDate(w.updatedAt)} &middot; {w.reference}
                    </p>
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={checking === w._id}
                      onClick={() => handleCheckStatus(w._id)}
                    >
                      <RefreshCw className={`w-4 h-4 ${checking === w._id ? 'animate-spin' : ''}`} /> Check status
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
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Notes</th>
                    <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Date</th>
                    <th className="text-right text-xs font-semibold text-text-muted px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map(w => (
                    <tr key={w._id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-sm text-white">{w.userId?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-text-muted font-mono">{w.reference}</p>
                      </td>
                      <td className="px-5 py-3 font-bold text-sm text-white">{formatCurrency(w.amount)}</td>
                      <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">
                        {w.momoDetails?.network} {w.momoDetails?.number}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          w.status === 'completed' ? 'bg-success/10 text-success' :
                          'bg-error/10 text-error'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted">
                        {w.paystackTransferCode ? (
                          <span className="font-mono">{w.paystackTransferStatus || 'initiated'}</span>
                        ) : <span className="text-text-muted/50">manual</span>}
                      </td>
                      <td className="px-5 py-3 text-xs max-w-xs">
                        {w.rejectionReason ? (
                          <span className="text-error">{w.rejectionReason}</span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">{formatDate(w.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        {w.paystackTransferCode && (
                          <button
                            onClick={() => handleCheckStatus(w._id)}
                            disabled={checking === w._id}
                            className="text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50"
                            title="Re-check Paystack"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${checking === w._id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </td>
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
