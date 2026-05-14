'use client';
import { useState, useEffect, useMemo } from 'react';
import { Layers, Loader2, Wallet, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

// Map user-friendly network labels to backend codes.
const NETWORK_ALIASES = {
  YELLO: 'YELLO', MTN: 'YELLO',
  TELECEL: 'TELECEL', VODAFONE: 'TELECEL',
  AT_PREMIUM: 'AT_PREMIUM', AT: 'AT_PREMIUM', AIRTELTIGO: 'AT_PREMIUM', AIRTEL: 'AT_PREMIUM', TIGO: 'AT_PREMIUM',
};

const NETWORK_LABEL = { YELLO: 'MTN', TELECEL: 'Telecel', AT_PREMIUM: 'AirtelTigo' };

function normalizePhone(raw) {
  let num = String(raw || '').replace(/\D/g, '');
  if (num.startsWith('233') && num.length === 12) num = '0' + num.slice(3);
  if (num.length === 9 && !num.startsWith('0')) num = '0' + num;
  return num;
}

function parseRow(line, index) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/[\s,;\t]+/).filter(Boolean);
  if (parts.length < 3) {
    return { lineNo: index + 1, raw: trimmed, error: 'Need: phone, capacity, network' };
  }

  // Find which token is the phone, which is capacity, which is network.
  let phone = null, capacity = null, network = null;
  for (const tok of parts) {
    const upper = tok.toUpperCase().replace(/GB$/i, '');
    if (!phone && /^\+?\d[\d\s]{6,}$/.test(tok)) {
      phone = normalizePhone(tok);
    } else if (!network && NETWORK_ALIASES[upper]) {
      network = NETWORK_ALIASES[upper];
    } else if (!capacity && /^\d+(\.\d+)?$/.test(upper)) {
      capacity = parseFloat(upper);
    }
  }

  if (!phone) return { lineNo: index + 1, raw: trimmed, error: 'Phone number missing' };
  if (phone.length !== 10 || !phone.startsWith('0')) {
    return { lineNo: index + 1, raw: trimmed, error: 'Invalid phone number' };
  }
  if (!network) return { lineNo: index + 1, raw: trimmed, error: 'Network missing (use MTN / Telecel / AT)' };
  if (!capacity || capacity <= 0) return { lineNo: index + 1, raw: trimmed, error: 'Capacity missing' };

  return { lineNo: index + 1, raw: trimmed, phoneNumber: phone, network, capacity };
}

export default function BulkBuyPage() {
  const { user, refreshUser } = useAuth();
  const [text, setText] = useState('');
  const [prices, setPrices] = useState({}); // { network: { capacity: price } }
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/purchase/packages?network=YELLO'),
      api.get('/purchase/packages?network=TELECEL'),
      api.get('/purchase/packages?network=AT_PREMIUM'),
    ])
      .then(([y, t, a]) => {
        const map = { YELLO: {}, TELECEL: {}, AT_PREMIUM: {} };
        (y.data.data || []).forEach(p => { map.YELLO[p.capacity] = { price: p.price, outOfStock: p.outOfStock }; });
        (t.data.data || []).forEach(p => { map.TELECEL[p.capacity] = { price: p.price, outOfStock: p.outOfStock }; });
        (a.data.data || []).forEach(p => { map.AT_PREMIUM[p.capacity] = { price: p.price, outOfStock: p.outOfStock }; });
        setPrices(map);
      })
      .catch(() => toast.error('Failed to load price list'))
      .finally(() => setLoadingPrices(false));
  }, []);

  const rows = useMemo(() => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const parsed = parseRow(line, i);
      if (!parsed) return null;
      if (parsed.error) return parsed;
      const pkg = prices[parsed.network]?.[parsed.capacity];
      if (!pkg) {
        return { ...parsed, error: `${parsed.capacity}GB ${NETWORK_LABEL[parsed.network]} not available` };
      }
      if (pkg.outOfStock) {
        return { ...parsed, error: `${NETWORK_LABEL[parsed.network]} is out of stock` };
      }
      return { ...parsed, price: pkg.price };
    }).filter(Boolean);
  }, [text, prices]);

  const validRows = rows.filter(r => !r.error);
  const errorRows = rows.filter(r => r.error);
  const total = validRows.reduce((s, r) => s + (r.price || 0), 0);
  const balance = user?.walletBalance || 0;
  const insufficient = total > balance;

  const handleSubmit = async () => {
    if (!validRows.length) {
      toast.error('Add at least one valid order');
      return;
    }
    if (errorRows.length) {
      toast.error('Fix invalid rows before continuing');
      return;
    }
    if (insufficient) {
      toast.error('Insufficient wallet balance');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.post('/purchase/bulk-buy', {
        items: validRows.map(r => ({ network: r.network, capacity: r.capacity, phoneNumber: r.phoneNumber })),
      });
      setResult(res.data.data);
      refreshUser();
      toast.success(res.data.message || 'Bulk purchase submitted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk purchase failed');
    } finally {
      setSubmitting(false);
    }
  };

  const startNewBatch = () => {
    setText('');
    setResult(null);
  };

  if (result) {
    const ok = result.results.filter(r => r.status !== 'failed');
    const failed = result.results.filter(r => r.status === 'failed');
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Bulk Purchase Result</h1>
          <p className="text-text-muted text-sm mt-1">Batch reference: <span className="font-mono text-accent">{result.batchRef}</span></p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <p className="text-xs text-text-muted">Total debited</p>
            <p className="text-xl font-extrabold text-white">{formatCurrency(result.total)}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Submitted</p>
            <p className="text-xl font-extrabold text-success">{ok.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Failed</p>
            <p className={`text-xl font-extrabold ${failed.length ? 'text-error' : 'text-white'}`}>{failed.length}</p>
          </Card>
        </div>

        {failed.length > 0 && (
          <Card>
            <p className="font-bold text-white text-sm mb-2">Failed orders</p>
            <p className="text-xs text-text-muted mb-3">
              These orders did not go through. Admin will review and refund where appropriate — auto-refund is disabled.
            </p>
            <div className="space-y-2">
              {failed.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white">{r.phoneNumber} — {r.capacity}GB {NETWORK_LABEL[r.network] || r.network} ({formatCurrency(r.price)})</p>
                    <p className="text-xs text-error">{r.error}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <p className="font-bold text-white text-sm mb-2">Submitted orders</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {ok.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <p className="text-white">
                  {r.phoneNumber} — {r.capacity}GB {NETWORK_LABEL[r.network] || r.network}
                </p>
                <span className="text-xs text-text-muted ml-auto font-mono">{r.reference}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button onClick={startNewBatch}>Start another batch</Button>
          <a href="/transactions" className="px-5 py-2.5 border border-white/10 text-text-muted hover:text-white font-bold rounded-xl text-sm transition-colors inline-flex items-center">
            View history
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Bulk Purchase</h1>
        <p className="text-text-muted text-sm mt-1">
          Paste one order per line: <span className="font-mono text-accent">phone</span> <span className="font-mono text-accent">capacity</span> <span className="font-mono text-accent">network</span>
        </p>
      </div>

      {/* Balance */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-primary" />
          <div>
            <p className="text-text-muted text-xs">Your balance</p>
            <p className="text-xl font-extrabold text-white">{formatCurrency(balance)}</p>
          </div>
        </div>
        <a href="/wallet" className="px-4 py-2 bg-primary hover:bg-primary-dark text-black font-bold text-sm rounded-xl transition-colors">
          Top up
        </a>
      </div>

      {/* Format help */}
      <Card>
        <p className="font-bold text-white text-sm mb-2">Format examples</p>
        <pre className="text-xs text-text-muted bg-surface-light rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
{`0241234567 5 MTN
0247654321 10 TELECEL
0202223333 2 MTN
0244445555 5 AT`}
        </pre>
        <p className="text-[11px] text-text-muted mt-2">
          Networks accepted: MTN / YELLO, Telecel / VODAFONE, AT / AirtelTigo / AT_PREMIUM. Separator can be space, comma, semicolon or tab.
        </p>
      </Card>

      {/* Input */}
      <Card>
        <label className="font-bold text-white text-sm">Orders</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder="0241234567 5 MTN&#10;0247654321 10 TELECEL"
          className="w-full mt-2 px-3 py-2.5 rounded-xl bg-surface-light text-white placeholder-text-muted border border-white/[0.04] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none font-mono text-sm"
        />
        {loadingPrices && (
          <p className="text-xs text-text-muted mt-2 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading price list...
          </p>
        )}
      </Card>

      {/* Preview */}
      {rows.length > 0 && !loadingPrices && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-white text-sm">Preview ({rows.length} rows)</p>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-success">{validRows.length} valid</span>
              {errorRows.length > 0 && <span className="text-error">{errorRows.length} invalid</span>}
            </div>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg ${r.error ? 'bg-error/5' : 'bg-success/5'}`}>
                <span className="text-[10px] font-mono text-text-muted w-6">{r.lineNo}</span>
                {r.error ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-error flex-shrink-0" />
                    <span className="text-text-muted truncate flex-1">{r.raw}</span>
                    <span className="text-xs text-error">{r.error}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                    <span className="text-white flex-1">{r.phoneNumber} — {r.capacity}GB {NETWORK_LABEL[r.network]}</span>
                    <span className="text-xs font-bold text-white">{formatCurrency(r.price)}</span>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="text-white font-bold">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">After this purchase</span>
              <span className={`font-bold ${insufficient ? 'text-error' : 'text-white'}`}>{formatCurrency(balance - total)}</span>
            </div>
          </div>

          {insufficient && (
            <div className="mt-3 bg-error/10 border border-error/20 rounded-lg p-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-error" />
              <p className="text-xs text-error">Insufficient balance. <a href="/wallet" className="font-bold underline">Top up</a> to proceed.</p>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            fullWidth
            size="lg"
            loading={submitting}
            disabled={!validRows.length || errorRows.length > 0 || insufficient}
            className="mt-4"
          >
            <Layers className="w-4 h-4 mr-2" />
            Pay {formatCurrency(total)} & send {validRows.length} order{validRows.length === 1 ? '' : 's'}
          </Button>
          {errorRows.length > 0 && (
            <p className="text-xs text-text-muted text-center mt-2">
              Fix the {errorRows.length} invalid row{errorRows.length === 1 ? '' : 's'} before continuing.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
