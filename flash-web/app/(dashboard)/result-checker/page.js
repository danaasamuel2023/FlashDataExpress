'use client';
import { useState, useEffect } from 'react';
import { GraduationCap, Loader2, Copy, Check, ShieldCheck, X, AlertTriangle, Clock, Minus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

function Copyable({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 bg-black/30 rounded-lg px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-white font-mono break-all">{value}</p>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); toast.success(`${label} copied`); setTimeout(() => setCopied(false), 1500); }}
        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex-shrink-0"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

const STATUS_CLS = {
  completed: 'bg-success/10 text-success',
  refunded: 'bg-accent/10 text-accent',
  failed: 'bg-error/10 text-error',
  pending: 'bg-white/10 text-text-muted',
};

export default function ResultCheckerPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [buying, setBuying] = useState(null); // checkerType being bought
  const [qty, setQty] = useState({}); // { WAEC: n, BECE: n }
  const [result, setResult] = useState(null); // last purchase to show

  const MAX_QTY = 50;
  const getQty = (type) => Math.min(MAX_QTY, Math.max(1, qty[type] || 1));
  const setQtyFor = (type, n) => setQty(prev => ({ ...prev, [type]: Math.min(MAX_QTY, Math.max(1, n || 1)) }));

  useEffect(() => {
    if (user?.phoneNumber) setPhone(user.phoneNumber);
  }, [user]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [p, h] = await Promise.all([
        api.get('/checker/products'),
        api.get('/checker/history'),
      ]);
      setData(p.data.data);
      setHistory(h.data.data || []);
    } catch {
      toast.error('Failed to load result checkers');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (checkerType, price) => {
    if (!phone.trim()) { toast.error('Enter a phone number first'); return; }
    const quantity = getQty(checkerType);
    const total = (price || 0) * quantity;
    const label = quantity > 1 ? `${quantity} ${checkerType} result checkers` : `a ${checkerType} result checker`;
    if (!confirm(`Buy ${label} for ${formatCurrency(total)}?`)) return;
    setBuying(checkerType);
    try {
      // Each unit is fulfilled by a separate provider call, so give bulk orders
      // more time than the default 30s. Delivered checkers are always saved to
      // history even if this request times out.
      const res = await api.post(
        '/checker/buy',
        { checkerType, phoneNumber: phone.trim(), quantity },
        { timeout: Math.max(30000, quantity * 6000) }
      );
      setResult(res.data.data);
      if (res.data.data.failedCount > 0) {
        toast.success(`${res.data.data.deliveredCount} of ${quantity} delivered — the rest were refunded.`);
      } else {
        toast.success(quantity > 1 ? `${quantity} result checkers purchased!` : 'Result checker purchased!');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Purchase failed');
    } finally {
      setBuying(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }

  const enabled = data?.enabled !== false;
  const products = data?.products || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" /> Result Checker
        </h1>
        <p className="text-text-muted text-sm mt-1">Buy WAEC &amp; BECE result checkers instantly. Your Serial &amp; PIN show here and stay in your history.</p>
      </div>

      {!enabled ? (
        <Card><p className="text-text-muted text-sm text-center py-8">Result checkers are currently unavailable. Please check back later.</p></Card>
      ) : (
        <>
          {/* Phone */}
          <Card>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Phone number (for your records)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="024 XXX XXXX"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary/50"
            />
          </Card>

          {/* Products */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map(p => (
              <Card key={p.checkerType}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{p.name}</p>
                      <p className="text-lg font-extrabold text-primary">{formatCurrency(p.price)}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.inStock ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                    {p.inStock ? (p.stockCount != null ? `${p.stockCount} in stock` : 'In stock') : 'Out of stock'}
                  </span>
                </div>
                {/* Quantity */}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQtyFor(p.checkerType, getQty(p.checkerType) - 1)}
                      disabled={getQty(p.checkerType) <= 1}
                      className="w-8 h-8 rounded-lg bg-white/[0.06] text-white flex items-center justify-center disabled:opacity-40 hover:bg-white/[0.1]"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={MAX_QTY}
                      value={getQty(p.checkerType)}
                      onChange={(e) => setQtyFor(p.checkerType, parseInt(e.target.value, 10))}
                      className="w-14 text-center bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 text-sm font-bold text-white focus:outline-none focus:border-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setQtyFor(p.checkerType, getQty(p.checkerType) + 1)}
                      disabled={getQty(p.checkerType) >= MAX_QTY}
                      className="w-8 h-8 rounded-lg bg-white/[0.06] text-white flex items-center justify-center disabled:opacity-40 hover:bg-white/[0.1]"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full mt-3"
                  disabled={!p.inStock || buying === p.checkerType}
                  onClick={() => handleBuy(p.checkerType, p.price)}
                >
                  {buying === p.checkerType ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                  Buy {getQty(p.checkerType) > 1 ? `${getQty(p.checkerType)}× ` : ''}{p.checkerType} · {formatCurrency(p.price * getQty(p.checkerType))}
                </Button>
              </Card>
            ))}
          </div>

          {/* History */}
          <div>
            <h2 className="font-bold text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Your checkers</h2>
            {history.length === 0 ? (
              <Card><p className="text-text-muted text-sm text-center py-8">No purchases yet.</p></Card>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <Card key={h._id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-sm">{h.checkerType} Checker</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[h.status] || STATUS_CLS.pending}`}>{h.status}</span>
                      </div>
                      <p className="text-[10px] text-text-muted">{new Date(h.createdAt).toLocaleString()}</p>
                    </div>
                    {h.status === 'completed' && h.serialNumber ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Copyable label="Serial Number" value={h.serialNumber} />
                        <Copyable label="PIN" value={h.pin} />
                      </div>
                    ) : h.status === 'refunded' ? (
                      <p className="text-xs text-accent">Failed and refunded{h.failureReason ? ` — ${h.failureReason}` : ''}.</p>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Result modal */}
      {result && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-success/20 rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-success" />
                {(result.deliveredCount ?? 1) > 1 ? `${result.deliveredCount} ${result.checkerType} Checkers ready` : `${result.checkerType} Checker ready`}
              </h3>
              <button onClick={() => setResult(null)} className="text-text-muted hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="flex items-start gap-2 bg-accent/[0.06] border border-accent/20 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-text-muted">Keep these safe — they&apos;re also saved in your history below.</p>
              </div>
              {result.failedCount > 0 && (
                <p className="text-[11px] text-accent">
                  {result.failedCount} of {result.quantity} couldn&apos;t be delivered and {result.failedCount > 1 ? 'were' : 'was'} refunded.
                </p>
              )}
              {(result.checkers || (result.serialNumber ? [{ serialNumber: result.serialNumber, pin: result.pin }] : [])).map((c, i) => (
                <div key={c.reference || i} className="space-y-2 rounded-lg border border-white/[0.06] p-3">
                  {(result.checkers?.length ?? 0) > 1 && (
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Checker {i + 1}</p>
                  )}
                  <Copyable label="Serial Number" value={c.serialNumber} />
                  <Copyable label="PIN" value={c.pin} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end p-5 border-t border-white/[0.06]">
              <Button size="sm" onClick={() => setResult(null)}><Check className="w-4 h-4" /> Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
