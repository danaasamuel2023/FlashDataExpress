'use client';
import { useState, useEffect } from 'react';
import { Gift, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

export default function AdminReferralsPage() {
  const [config, setConfig] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: true,
    commissionPercent: '',
    bonusDataMilestones: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [configRes, referralsRes] = await Promise.all([
        api.get('/admin/referrals/config'),
        api.get('/admin/referrals'),
      ]);
      const c = configRes.data.data;
      setConfig(c);
      setForm({
        enabled: c?.enabled !== false,
        commissionPercent: c?.commissionPercent || '',
        bonusDataMilestones: JSON.stringify(c?.bonusDataMilestones || []),
      });
      setReferrals(referralsRes.data.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    let milestones;
    try {
      milestones = JSON.parse(form.bonusDataMilestones);
    } catch {
      toast.error('Invalid milestones JSON');
      return;
    }

    setSaving(true);
    try {
      await api.put('/admin/referrals/config', {
        enabled: form.enabled,
        commissionPercent: parseFloat(form.commissionPercent) || 0,
        bonusDataMilestones: milestones,
      });
      toast.success('Referral config saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Referral Program</h1>
          <p className="text-text-muted text-sm mt-1">Configure referral rewards.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>
          <Save className="w-4 h-4" /> Save
        </Button>
      </div>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">Referral Program</label>
            <button
              onClick={() => setForm(prev => ({ ...prev, enabled: !prev.enabled }))}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              {form.enabled ? (
                <>
                  <ToggleRight className="w-8 h-8 text-success" />
                  <span className="text-success">Enabled</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-8 h-8 text-text-muted" />
                  <span className="text-text-muted">Disabled</span>
                </>
              )}
            </button>
          </div>

          <Input
            label="Commission (%)"
            type="number"
            placeholder="5"
            value={form.commissionPercent}
            onChange={(e) => setForm(prev => ({ ...prev, commissionPercent: e.target.value }))}
          />

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Bonus Data Milestones (JSON)
            </label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-white/10 text-sm font-medium text-text focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none bg-surface-light"
              rows={4}
              placeholder='[{"referralCount": 5, "bonusGB": 1}, {"referralCount": 10, "bonusGB": 3}]'
              value={form.bonusDataMilestones}
              onChange={(e) => setForm(prev => ({ ...prev, bonusDataMilestones: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      {/* Referral list */}
      {referrals.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <h2 className="font-bold text-white">Recent Referrals</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Referrer</th>
                  <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Referred</th>
                  <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-text-muted px-5 py-3">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map(r => (
                  <tr key={r._id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3 font-semibold text-sm text-white">{r.referrerId?.name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-text-muted">{r.referredUserId?.name || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.status === 'active' ? 'bg-success/10 text-success' : 'bg-white/[0.06] text-text-muted'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-sm text-white">{formatCurrency(r.totalEarnings || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
