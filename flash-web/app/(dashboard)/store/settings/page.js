'use client';
import { useState, useEffect } from 'react';
import { Store, Type, FileText, Phone, Palette, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';

const THEME_COLORS = [
  '#FF6B00', '#E60000', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#F59E0B', '#1A1A2E',
];

export default function StoreSettingsPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    storeName: '',
    description: '',
    contactPhone: '',
    primaryColor: '#FF6B00',
    isActive: true,
    momoNumber: '',
    momoNetwork: 'MTN',
    momoName: '',
  });

  useEffect(() => {
    fetchStore();
  }, []);

  const fetchStore = async () => {
    try {
      const res = await api.get('/store/my-store');
      const s = res.data.data;
      setStore(s);
      setForm({
        storeName: s.storeName || '',
        description: s.description || '',
        contactPhone: s.contactPhone || '',
        primaryColor: s.theme?.primaryColor || '#FF6B00',
        isActive: s.isActive !== false,
        momoNumber: s.momoDetails?.number || '',
        momoNetwork: s.momoDetails?.network || 'MTN',
        momoName: s.momoDetails?.name || '',
      });
    } catch {
      toast.error('Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/store/update', {
        storeName: form.storeName,
        description: form.description,
        contactPhone: form.contactPhone,
        theme: { primaryColor: form.primaryColor },
        isActive: form.isActive,
        momoDetails: {
          number: form.momoNumber,
          network: form.momoNetwork,
          name: form.momoName,
        },
      });
      toast.success('Settings saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Store Settings</h1>
          <p className="text-text-muted text-sm mt-1">Update your store configuration.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>
          <Save className="w-4 h-4" /> Save
        </Button>
      </div>

      <Card>
        <h2 className="font-bold text-white mb-4">Store Details</h2>
        <div className="space-y-4">
          <Input
            label="Store name"
            icon={Store}
            value={form.storeName}
            onChange={(e) => setForm(prev => ({ ...prev, storeName: e.target.value }))}
          />
          <Input
            label="Description"
            icon={FileText}
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
          <Input
            label="Contact phone"
            icon={Phone}
            type="tel"
            value={form.contactPhone}
            onChange={(e) => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">Store status</label>
            <button
              onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              {form.isActive ? (
                <>
                  <ToggleRight className="w-8 h-8 text-success" />
                  <span className="text-success">Active</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-8 h-8 text-text-muted" />
                  <span className="text-text-muted">Inactive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-white mb-4">Theme</h2>
        <div className="flex gap-3 flex-wrap">
          {THEME_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setForm(prev => ({ ...prev, primaryColor: color }))}
              className={`w-10 h-10 rounded-xl transition-all ${
                form.primaryColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-white mb-4">MoMo Details</h2>
        <div className="space-y-4">
          <Input
            label="MoMo number"
            icon={Phone}
            type="tel"
            value={form.momoNumber}
            onChange={(e) => setForm(prev => ({ ...prev, momoNumber: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Network</label>
            <div className="flex gap-2">
              {['MTN', 'Telecel', 'AirtelTigo'].map(net => (
                <button
                  key={net}
                  onClick={() => setForm(prev => ({ ...prev, momoNetwork: net }))}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    form.momoNetwork === net
                      ? 'bg-primary text-white'
                      : 'bg-surface-light text-text-muted hover:bg-white/5'
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Account name"
            icon={Type}
            value={form.momoName}
            onChange={(e) => setForm(prev => ({ ...prev, momoName: e.target.value }))}
          />
        </div>
      </Card>
    </div>
  );
}
