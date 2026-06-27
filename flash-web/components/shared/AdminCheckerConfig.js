'use client';
import { useState, useEffect } from 'react';
import { GraduationCap, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

// Admin pricing/availability control for WAEC & BECE result checkers.
export default function AdminCheckerConfig() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/admin/checker-config');
      setCfg(res.data.data);
    } catch {
      // leave null — section just won't render
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/checker-config', {
        enabled: cfg.enabled,
        cost: Number(cfg.cost),
        waecPrice: Number(cfg.waecPrice),
        becePrice: Number(cfg.becePrice),
      });
      toast.success('Result checker pricing saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !cfg) return null;

  const stockFor = (type) => (cfg.stock || []).find(s => s.checkerType === type);
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const Field = ({ label, value, onChange, hint }) => (
    <div>
      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">GH₵</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-11 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
        />
      </div>
      {hint && <p className="text-[10px] text-text-muted mt-1">{hint}</p>}
    </div>
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Result Checker Pricing</h2>
            <p className="text-[11px] text-text-muted">WAEC &amp; BECE — sourced from DataMart (cost {formatCurrency(num(cfg.cost))} each).</p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="w-4 h-4 accent-primary" />
          <span className="text-xs font-bold text-white">{cfg.enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="DataMart cost" value={cfg.cost} onChange={(v) => setCfg({ ...cfg, cost: v })} hint="What DataMart charges you" />
        <Field label="WAEC price" value={cfg.waecPrice} onChange={(v) => setCfg({ ...cfg, waecPrice: v })} hint={`Profit ${formatCurrency(num(cfg.waecPrice) - num(cfg.cost))}${stockFor('WAEC') ? ` · ${stockFor('WAEC').inStock ? (stockFor('WAEC').stockCount ?? 'in stock') : 'out of stock'}` : ''}`} />
        <Field label="BECE price" value={cfg.becePrice} onChange={(v) => setCfg({ ...cfg, becePrice: v })} hint={`Profit ${formatCurrency(num(cfg.becePrice) - num(cfg.cost))}${stockFor('BECE') ? ` · ${stockFor('BECE').inStock ? (stockFor('BECE').stockCount ?? 'in stock') : 'out of stock'}` : ''}`} />
      </div>

      <div className="flex justify-end mt-4">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save checker pricing
        </Button>
      </div>
    </Card>
  );
}
