'use client';
import { useState, useEffect } from 'react';
import { GraduationCap, Loader2, Copy, Check, ShieldCheck, X, AlertTriangle, Clock } from 'lucide-react';
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
  const [result, setResult] = useState(null); // last purchase to show

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

  const handleBuy = async (checkerType) => {
    if (!phone.trim()) { toast.error('Enter a phone number first'); return; }
    if (!confirm(`Buy a ${checkerType} result checker?`)) return;
    setBuying(checkerType);
    try {
      const res = await api.post('/checker/buy', { checkerType, phoneNumber: phone.trim() });
      setResult(res.data.data);
      toast.success('Result checker purchased!');
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
                <Button
                  className="w-full mt-4"
                  disabled={!p.inStock || buying === p.checkerType}
                  onClick={() => handleBuy(p.checkerType)}
                >
                  {buying === p.checkerType ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                  Buy {p.checkerType}
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
          <div className="bg-card border border-success/20 rounded-2xl max-w-md w-full">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="font-extrabold text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-success" /> {result.checkerType} Checker ready</h3>
              <button onClick={() => setResult(null)} className="text-text-muted hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-2 bg-accent/[0.06] border border-accent/20 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-text-muted">Keep these safe — they&apos;re also saved in your history below.</p>
              </div>
              <Copyable label="Serial Number" value={result.serialNumber} />
              <Copyable label="PIN" value={result.pin} />
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
