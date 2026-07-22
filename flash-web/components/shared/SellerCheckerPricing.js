'use client';
import { useState, useEffect } from 'react';
import { GraduationCap, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

// Lets an agent or sub-agent enable WAEC/BECE result checkers on their shop and
// set their own customer price. Cost floor comes from the API (agent cost for an
// agent; the parent agent's price for a sub-agent). Reused on both portals, so
// it switches between the dark dashboard theme and the light sub-agent theme.
export default function SellerCheckerPricing({ getUrl, putUrl, theme = 'dark' }) {
  const [data, setData] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [waec, setWaec] = useState('');
  const [bece, setBece] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dark = theme === 'dark';
  const cls = {
    card: dark ? 'bg-card border border-white/[0.06]' : 'bg-white border border-gray-200 shadow-sm',
    title: dark ? 'text-white' : 'text-gray-900',
    muted: dark ? 'text-text-muted' : 'text-gray-500',
    input: dark
      ? 'bg-surface-light border border-white/10 text-white focus:border-primary'
      : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-amber-500',
    iconWrap: dark ? 'bg-primary/10' : 'bg-amber-100',
    icon: dark ? 'text-primary' : 'text-amber-600',
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const load = async () => {
    try {
      const res = await api.get(getUrl);
      const d = res.data.data;
      setData(d);
      setEnabled(!!d.pricing?.enabled);
      setWaec(d.pricing?.waecPrice ? String(d.pricing.waecPrice) : '');
      setBece(d.pricing?.becePrice ? String(d.pricing.becePrice) : '');
    } catch {
      // leave null — section hides itself
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const w = Number(waec);
    const b = Number(bece);
    if (enabled) {
      if (data.cost?.waec && w > 0 && w < data.cost.waec) return toast.error(`WAEC price can't be below your cost of ${formatCurrency(data.cost.waec)}`);
      if (data.cost?.bece && b > 0 && b < data.cost.bece) return toast.error(`BECE price can't be below your cost of ${formatCurrency(data.cost.bece)}`);
      if ((!w || w <= 0) && (!b || b <= 0)) return toast.error('Set a price for at least one checker');
    }
    setSaving(true);
    try {
      const res = await api.put(putUrl, { enabled, waecPrice: w || 0, becePrice: b || 0 });
      const p = res.data.data?.pricing;
      if (p) {
        setEnabled(!!p.enabled);
        setWaec(p.waecPrice ? String(p.waecPrice) : '');
        setBece(p.becePrice ? String(p.becePrice) : '');
      }
      toast.success('Result checker pricing saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) return null;

  // Admin turned checkers off platform-wide.
  if (!data.platformEnabled) return null;

  // Sub-agent whose parent agent hasn't enabled checkers can't resell them.
  if (data.parentSellsCheckers === false) {
    return (
      <div className={`${cls.card} rounded-2xl p-4`}>
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-8 h-8 ${cls.iconWrap} rounded-lg flex items-center justify-center`}>
            <GraduationCap className={`w-4 h-4 ${cls.icon}`} />
          </div>
          <p className={`font-bold text-sm ${cls.title}`}>Result Checkers</p>
        </div>
        <p className={`text-xs ${cls.muted}`}>
          Your agent hasn&apos;t enabled result checkers yet. Once they do, you&apos;ll be able to sell WAEC &amp; BECE checkers here.
        </p>
      </div>
    );
  }

  const profitW = waec ? Number(waec) - (data.cost?.waec || 0) : 0;
  const profitB = bece ? Number(bece) - (data.cost?.bece || 0) : 0;

  return (
    <div className={`${cls.card} rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 ${cls.iconWrap} rounded-xl flex items-center justify-center`}>
            <GraduationCap className={`w-5 h-5 ${cls.icon}`} />
          </div>
          <div>
            <h2 className={`font-bold text-sm ${cls.title}`}>Result Checkers</h2>
            <p className={`text-[11px] ${cls.muted}`}>Sell WAEC &amp; BECE checkers on your shop. You keep the markup above your cost.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-amber-500" />
          <span className={`text-xs font-bold ${cls.title}`}>{enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${cls.muted}`}>WAEC price</label>
          <input type="number" step="0.01" min="0" value={waec} onChange={(e) => setWaec(e.target.value)} placeholder="0.00"
            className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${cls.input}`} />
          <p className={`text-[10px] mt-1 ${cls.muted}`}>Your cost {formatCurrency(data.cost?.waec || 0)} · profit {formatCurrency(profitW > 0 ? profitW : 0)}</p>
        </div>
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${cls.muted}`}>BECE price</label>
          <input type="number" step="0.01" min="0" value={bece} onChange={(e) => setBece(e.target.value)} placeholder="0.00"
            className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${cls.input}`} />
          <p className={`text-[10px] mt-1 ${cls.muted}`}>Your cost {formatCurrency(data.cost?.bece || 0)} · profit {formatCurrency(profitB > 0 ? profitB : 0)}</p>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save checker pricing
        </button>
      </div>
    </div>
  );
}
