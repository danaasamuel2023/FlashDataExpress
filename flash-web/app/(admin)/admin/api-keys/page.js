'use client';
import { useState, useEffect } from 'react';
import { KeyRound, Loader2, RefreshCw, ShieldCheck, Clock, X, Check, Ban, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-accent/10 text-accent', icon: Clock },
  active: { label: 'Active', cls: 'bg-success/10 text-success', icon: ShieldCheck },
  revoked: { label: 'Revoked', cls: 'bg-error/10 text-error', icon: X },
};

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | pending | active | revoked

  useEffect(() => { fetchKeys(); }, []);

  const fetchKeys = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/admin/api-keys');
      setKeys(res.data.data || []);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setStatus = async (k, status) => {
    setBusyId(k.id);
    try {
      await api.put(`/admin/api-keys/${k.id}`, { status });
      toast.success(status === 'active' ? 'Key approved' : status === 'revoked' ? 'Key revoked' : 'Key updated');
      fetchKeys();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  }

  const pendingCount = keys.filter(k => k.status === 'pending').length;
  const activeCount = keys.filter(k => k.status === 'active').length;

  const q = query.trim().toLowerCase();
  const filtered = keys.filter(k => {
    if (filter !== 'all' && k.status !== filter) return false;
    if (!q) return true;
    return (
      (k.name || '').toLowerCase().includes(q) ||
      (k.keyPrefix || '').toLowerCase().includes(q) ||
      (k.user?.name || '').toLowerCase().includes(q) ||
      (k.user?.email || '').toLowerCase().includes(q) ||
      (k.user?.phoneNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">API Keys</h1>
          <p className="text-text-muted text-sm mt-1">Approve developer API access. Approved keys can buy data from the user&apos;s wallet.</p>
        </div>
        <button onClick={fetchKeys} disabled={refreshing} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"><KeyRound className="w-5 h-5 text-primary" /></div><div><p className="text-xl font-extrabold text-white">{keys.length}</p><p className="text-xs text-text-muted">Total keys</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center"><Clock className="w-5 h-5 text-accent" /></div><div><p className="text-xl font-extrabold text-white">{pendingCount}</p><p className="text-xs text-text-muted">Pending</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-success" /></div><div><p className="text-xl font-extrabold text-white">{activeCount}</p><p className="text-xs text-text-muted">Active</p></div></div></Card>
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-1">
          {['all', 'pending', 'active', 'revoked'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by user name, email, phone or key…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"><X className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card><p className="text-text-muted text-sm text-center py-10">No API keys{filter !== 'all' ? ` with status "${filter}"` : ''}.</p></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(k => {
            const meta = STATUS_META[k.status] || STATUS_META.pending;
            const Icon = meta.icon;
            return (
              <Card key={k.id}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-sm truncate">{k.name}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </div>
                    <code className="text-xs text-text-muted">{k.keyPrefix}••••••••</code>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {k.user?.name || '—'} · {k.user?.email || ''} {k.user?.phoneNumber ? `· ${k.user.phoneNumber}` : ''}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Wallet {formatCurrency(k.user?.walletBalance || 0)} · created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {k.status !== 'active' && (
                      <button
                        onClick={() => setStatus(k, 'active')}
                        disabled={busyId === k.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                      >
                        {busyId === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                      </button>
                    )}
                    {k.status !== 'revoked' && (
                      <button
                        onClick={() => setStatus(k, 'revoked')}
                        disabled={busyId === k.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" /> Revoke
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
