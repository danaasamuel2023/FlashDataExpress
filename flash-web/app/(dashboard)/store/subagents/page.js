'use client';
import { useState, useEffect } from 'react';
import { Users, Link2, Loader2, Trash2, Copy, Check, ExternalLink, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/constants';
import api from '@/lib/api';

export default function SubAgentsPage() {
  const [subAgents, setSubAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [store, setStore] = useState(null);

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

  const handleGenerateInvite = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/subagent/generate-invite');
      const { inviteLink, inviteCode } = res.data.data;
      navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link generated and copied!');
      // Refresh list to show the new pending invite
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invite');
    } finally {
      setGenerating(false);
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

  const handleCopyInviteLink = (inviteCode) => {
    const link = `${window.location.origin}/subagent/register/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedId(inviteCode);
    toast.success('Invite link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyStoreLink = (storeSlug) => {
    const link = `${window.location.origin}/subshop/${storeSlug}`;
    navigator.clipboard.writeText(link);
    setCopiedId(storeSlug);
    toast.success('Store link copied!');
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

  const registeredSubAgents = subAgents.filter(s => s.status === 'registered');
  const pendingInvites = subAgents.filter(s => s.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Subagents</h1>
          <p className="text-text-muted text-sm mt-1">Generate invite links for people to sell for you.</p>
        </div>
        <Button size="sm" onClick={handleGenerateInvite} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Generate Invite Link
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{registeredSubAgents.length}</p>
              <p className="text-xs text-text-muted">Registered</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{pendingInvites.length}</p>
              <p className="text-xs text-text-muted">Pending Invites</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">{registeredSubAgents.filter(s => s.isActive).length}</p>
              <p className="text-xs text-text-muted">Active</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-white">
                {formatCurrency(registeredSubAgents.reduce((sum, s) => sum + (s.totalEarnings || 0), 0))}
              </p>
              <p className="text-xs text-text-muted">Total Earned</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-text-muted mb-3 uppercase tracking-wider">Pending Invites</h2>
          <div className="space-y-2">
            {pendingInvites.map(invite => (
              <Card key={invite._id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Invite: {invite.inviteCode}</p>
                      <p className="text-xs text-text-muted">Created {formatDate(invite.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyInviteLink(invite.inviteCode)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-colors"
                    >
                      {copiedId === invite.inviteCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Copy Link
                    </button>
                    <button
                      onClick={() => handleDelete(invite._id)}
                      className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-error transition-colors"
                      title="Remove invite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Registered subagents */}
      <div>
        <h2 className="text-sm font-bold text-text-muted mb-3 uppercase tracking-wider">Registered Subagents</h2>
        {registeredSubAgents.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-text-muted" />
              </div>
              <p className="text-text-muted text-sm">No registered subagents yet. Generate an invite link and share it!</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {registeredSubAgents.map(sub => (
              <Card key={sub._id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-sm">
                      {sub.userId?.name?.charAt(0)?.toUpperCase() || sub.storeName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-bold text-white">{sub.userId?.name || sub.storeName || 'Unknown'}</p>
                      <p className="text-xs text-text-muted">
                        {sub.storeName && <span className="text-amber-400">{sub.storeName}</span>}
                        {sub.userId?.phoneNumber && <span> &bull; {sub.userId.phoneNumber}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
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
                    {sub.storeSlug && (
                      <button
                        onClick={() => handleCopyStoreLink(sub.storeSlug)}
                        className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-primary transition-colors"
                        title="Copy store link"
                      >
                        {copiedId === sub.storeSlug ? <Check className="w-4 h-4 text-success" /> : <ExternalLink className="w-4 h-4" />}
                      </button>
                    )}
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
    </div>
  );
}
