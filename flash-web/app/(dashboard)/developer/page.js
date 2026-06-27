'use client';
import { useState, useEffect } from 'react';
import { Code2, Loader2, Plus, Trash2, Copy, Check, KeyRound, ShieldCheck, Clock, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://flashdataexpress.onrender.com/api';
const V1 = `${API_BASE}/v1`;

const STATUS_META = {
  pending: { label: 'Pending approval', cls: 'bg-accent/10 text-accent', icon: Clock },
  active: { label: 'Active', cls: 'bg-success/10 text-success', icon: ShieldCheck },
  revoked: { label: 'Revoked', cls: 'bg-error/10 text-error', icon: X },
};

function CopyBtn({ text, small }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success('Copied'); setTimeout(() => setCopied(false), 1500); }}
      className={`inline-flex items-center gap-1 rounded-md text-primary hover:text-primary/80 ${small ? 'text-[11px]' : 'text-xs'}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Endpoint({ method, path, desc }) {
  const color = method === 'GET' ? 'text-success' : 'text-accent';
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <span className={`text-[11px] font-extrabold ${color} w-12 flex-shrink-0`}>{method}</span>
      <div className="min-w-0">
        <code className="text-xs text-white break-all">{path}</code>
        <p className="text-[11px] text-text-muted mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function DeveloperPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState(null); // full key shown once

  useEffect(() => { fetchKeys(); }, []);

  const fetchKeys = async () => {
    try {
      const res = await api.get('/api-keys');
      setKeys(res.data.data || []);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.post('/api-keys', { name: newName.trim() || 'API key' });
      setNewKey(res.data.data.key);
      setShowCreate(false);
      setNewName('');
      fetchKeys();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (k) => {
    if (!confirm(`Revoke "${k.name}" (${k.keyPrefix}…)? Apps using it will stop working.`)) return;
    try {
      await api.delete(`/api-keys/${k.id}`);
      toast.success('Key revoked');
      fetchKeys();
    } catch {
      toast.error('Failed to revoke');
    }
  };

  const curl = `curl -X POST ${V1}/buy \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"network":"MTN","capacity":2,"phoneNumber":"0551234567"}'`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Developer API</h1>
          <p className="text-text-muted text-sm mt-1">Generate an API key and buy data programmatically from your wallet balance.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Generate key
        </Button>
      </div>

      {/* Approval notice */}
      <Card className="!border-accent/20 bg-accent/[0.04]">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted">
            New keys start as <span className="font-bold text-accent">Pending</span> and only work once an admin approves them.
            Purchases are charged to your wallet balance, so keep it topped up.
          </p>
        </div>
      </Card>

      {/* Keys list */}
      <div>
        <h2 className="font-bold text-white mb-3 flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /> Your API keys</h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
        ) : keys.length === 0 ? (
          <Card><p className="text-text-muted text-sm text-center py-8">No API keys yet. Generate one to get started.</p></Card>
        ) : (
          <div className="space-y-2">
            {keys.map(k => {
              const meta = STATUS_META[k.status] || STATUS_META.pending;
              const Icon = meta.icon;
              return (
                <Card key={k.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-sm truncate">{k.name}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </span>
                      </div>
                      <code className="text-xs text-text-muted">{k.keyPrefix}••••••••</code>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Created {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ' · never used'}
                      </p>
                    </div>
                    {k.status !== 'revoked' && (
                      <button
                        onClick={() => handleRevoke(k)}
                        title="Revoke"
                        className="p-2 rounded-lg bg-error/10 hover:bg-error/20 text-error transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Documentation */}
      <Card>
        <h2 className="font-bold text-white mb-1 flex items-center gap-2"><Code2 className="w-4 h-4 text-primary" /> API reference</h2>
        <p className="text-xs text-text-muted mb-4">Send your key in the <code className="text-white">x-api-key</code> header on every request.</p>

        <div className="mb-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Base URL</p>
          <div className="flex items-center justify-between gap-2 bg-black/30 rounded-lg px-3 py-2">
            <code className="text-xs text-white break-all">{V1}</code>
            <CopyBtn text={V1} />
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Endpoints</p>
          <div className="bg-white/[0.02] rounded-lg px-3 py-1">
            <Endpoint method="GET" path="/v1/packages" desc="List networks, capacities and prices. Optional ?network=MTN" />
            <Endpoint method="GET" path="/v1/balance" desc="Your current wallet balance." />
            <Endpoint method="POST" path="/v1/buy" desc="Buy a bundle: { network, capacity, phoneNumber }. Charged to your balance." />
            <Endpoint method="GET" path="/v1/orders/:reference" desc="Check the status of an order by its reference." />
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Network codes</p>
          <p className="text-xs text-text-muted">
            Use <code className="text-white">MTN</code>, <code className="text-white">TELECEL</code> or <code className="text-white">AT</code> (AirtelTigo). Capacity is in GB.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Example — buy data</p>
            <CopyBtn text={curl} small />
          </div>
          <pre className="bg-black/40 rounded-lg p-3 text-[11px] text-success/90 overflow-x-auto whitespace-pre">{curl}</pre>
        </div>
      </Card>

      {/* Generate modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-white/[0.06] rounded-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="font-extrabold text-white">Generate API key</h3>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider">Key name (optional)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. My bot"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary/50"
              />
              <p className="text-[11px] text-text-muted">The key is shown once. It will be pending until an admin approves it.</p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06]">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Generate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Show-once new key modal */}
      {newKey && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-success/20 rounded-2xl max-w-md w-full">
            <div className="p-5 border-b border-white/[0.06]">
              <h3 className="font-extrabold text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-success" /> Your new API key</h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-2 bg-accent/[0.06] border border-accent/20 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-text-muted">Copy it now — for your security it won&apos;t be shown again. It works after admin approval.</p>
              </div>
              <div className="flex items-center justify-between gap-2 bg-black/40 rounded-lg px-3 py-2.5">
                <code className="text-xs text-success break-all">{newKey}</code>
                <CopyBtn text={newKey} />
              </div>
            </div>
            <div className="flex items-center justify-end p-5 border-t border-white/[0.06]">
              <Button size="sm" onClick={() => setNewKey(null)}>
                <Check className="w-4 h-4" /> I&apos;ve saved it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
