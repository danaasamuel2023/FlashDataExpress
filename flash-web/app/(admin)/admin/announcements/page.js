'use client';
import { useState, useEffect } from 'react';
import { Megaphone, Loader2, RefreshCw, Plus, Trash2, Pin, Eye, EyeOff, X, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import api from '@/lib/api';

const AUDIENCE_LABELS = {
  all: 'Agents & Sub-agents',
  agents: 'Agents only',
  subagents: 'Sub-agents only',
};

const emptyForm = { title: '', message: '', audience: 'all', pinned: false, isActive: true };

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/admin/announcements');
      setItems(res.data.data || []);
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title || '',
      message: item.message || '',
      audience: item.audience || 'all',
      pinned: !!item.pinned,
      isActive: item.isActive !== false,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/admin/announcements/${editingId}`, form);
        toast.success('Announcement updated');
      } else {
        await api.post('/admin/announcements', form);
        toast.success('Announcement posted');
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    try {
      await api.put(`/admin/announcements/${item._id}`, { isActive: !item.isActive });
      fetchItems();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/announcements/${item._id}`);
      toast.success('Announcement deleted');
      fetchItems();
    } catch {
      toast.error('Failed to delete');
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Announcements</h1>
          <p className="text-text-muted text-sm mt-1">
            Post updates that agents &amp; sub-agents can copy and forward to their customers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchItems}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4" /> New
          </Button>
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Megaphone className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted text-sm">No announcements yet. Post your first update.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item._id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                    <p className="font-bold text-white">{item.title}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-text-muted">
                      {AUDIENCE_LABELS[item.audience] || item.audience}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                    }`}>
                      {item.isActive ? 'Live' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-sm text-text mt-2 whitespace-pre-wrap">{item.message}</p>
                  <p className="text-[10px] text-text-muted mt-2">
                    {new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(item)}
                    title={item.isActive ? 'Hide' : 'Show'}
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-white transition-colors"
                  >
                    {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    title="Edit"
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-white transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    title="Delete"
                    className="p-2 rounded-lg bg-error/10 hover:bg-error/20 text-error transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-card border border-white/[0.06] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="font-extrabold text-white">{editingId ? 'Edit announcement' : 'New announcement'}</h3>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. New MTN prices effective today"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  Message <span className="text-text-muted/70 normal-case font-normal">(what agents will copy &amp; paste)</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={6}
                  placeholder="Write the exact message agents should forward to their customers…"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary/50 resize-y"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Audience</label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 [color-scheme:dark]"
                >
                  <option value="all">Agents &amp; Sub-agents</option>
                  <option value="agents">Agents only</option>
                  <option value="subagents">Sub-agents only</option>
                </select>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-white flex items-center gap-1"><Pin className="w-3.5 h-3.5" /> Pin to top</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-white">Live now</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.06]">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                {editingId ? 'Save changes' : 'Post announcement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
