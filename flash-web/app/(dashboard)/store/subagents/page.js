'use client';
import { useState, useEffect } from 'react';
import { Users, UserPlus, Loader2, Trash2, Copy, Check, Percent, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

export default function SubAgentsPage() {
  const [subAgents, setSubAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [store, setStore] = useState(null);
  const [form, setForm] = useState({ identifier: '', commissionPercent: 30 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [storeRes, subRes] = await Promise.all([
        api.get('/store/my-store'),
        api.get('/subagent/list'),
      ]);
      setStore(storeRes.data.data);
      setSubAgents(subRes.data.data);
    } catch {
      toast.error('Failed to load subagents');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim()) return toast.error('Enter a phone number or email');
    setInviting(true);
    try {
      const res = await api.post('/subagent/invite', form);
      setSubAgents(prev => [res.data.data, ...prev]);
      setForm({ identifier: '', commissionPercent: 30 });
      setShowInvite(false);
      toast.success('Subagent added!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add subagent');
    } finally {
      setInviting(false);
    }
  };

  const handleToggle = async (id, isActive) => {
    try {
      const res = await api.put(`/subagent/${id}`, { isActive: !isActive });
      setSubAgents(prev => prev.map(s => s._id === id ? res.data.data : s));
      toast.success(isActive ? 'Subagent deactivated' : 'Subagent activated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this subagent? This cannot be undone.')) return;
    try {
      await api.delete(`/subagent/${id}`);
      setSubAgents(prev => prev.filter(s => s._id !== id));
      toast.success('Subagent removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleCopyLink = (referralCode) => {
    const link = `${window.location.origin}/shop/${store.storeSlug}?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopiedId(referralCode);
    toast.success('Referral link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted">You need to create a store first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Subagents</h1>
          <p className="text-text-muted text-sm mt-1">Manage people who sell for you.</p>
        </div>
        <Button size="sm" onClick={() => setShowInvite(!showInvite)}>
          <UserPlus className="w-4 h-4" /> Add Subagent
        </Button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <Card>
          <form onSubmit={handleInvite} className="space-y-4">
            <h3 className="font-bold text-white">Add a Subagent</h3>
            <p className="text-xs text-text-muted">Enter their phone number or email. They must have a FlashData account.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone or Email"
                placeholder="0241234567 or user@email.com"
                value={form.identifier}
                onChange={e => setForm({ ...form, identifier: e.target.value })}
              />
              <Input
                label="Commission %"
                type="number"
                min={1}
                max={90}
                placeholder="30"
                value={form.commissionPercent}
                onChange={e => setForm({ ...form, commissionPercent: Number(e.target.value) })}
              />
            </div>
            <p className="text-xs text-text-muted">
              Commission is the % of your profit that goes to the subagent per sale.
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={inviting}>
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {inviting ? 'Adding...' : 'Add Subagent'}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{subAgents.length}</p>
              <p className="text-xs text-text-muted">Total Subagents</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{subAgents.filter(s => s.isActive).length}</p>
              <p className="text-xs text-text-muted">Active</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Percent className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">
                {formatCurrency(subAgents.reduce((sum, s) => sum + (s.totalEarnings || 0), 0))}
              </p>
              <p className="text-xs text-text-muted">Total Paid Out</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Subagent list */}
      {subAgents.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-text-muted" />
            </div>
            <p className="text-text-muted text-sm">No subagents yet. Add someone to start earning together.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {subAgents.map(sub => (
            <Card key={sub._id}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-sm">
                    {sub.userId?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-white">{sub.userId?.name || 'Unknown'}</p>
                    <p className="text-xs text-text-muted">{sub.userId?.phoneNumber || sub.userId?.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="bg-white/5 px-2.5 py-1 rounded-lg text-text-muted text-xs">
                    {sub.commissionPercent}% commission
                  </span>
                  <span className="bg-white/5 px-2.5 py-1 rounded-lg text-text-muted text-xs">
                    {sub.totalSales || 0} sales
                  </span>
                  <span className="bg-white/5 px-2.5 py-1 rounded-lg text-text-muted text-xs">
                    {formatCurrency(sub.totalEarnings || 0)} earned
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${sub.isActive ? 'bg-success/10 text-success' : 'bg-white/5 text-text-muted'}`}>
                    {sub.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(sub.referralCode)}
                    className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-primary transition-colors"
                    title="Copy referral link"
                  >
                    {copiedId === sub.referralCode ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleToggle(sub._id, sub.isActive)}
                    className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-primary transition-colors"
                    title={sub.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {sub.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(sub._id)}
                    className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-error transition-colors"
                    title="Remove subagent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
