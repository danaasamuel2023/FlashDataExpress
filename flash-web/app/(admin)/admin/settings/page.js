'use client';
import { useState, useEffect } from 'react';
import { Settings, Key, Globe, CreditCard, Save, Loader2, CheckCircle, XCircle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    datamartApiUrl: '',
    datamartApiKey: '',
    paystackSecretKey: '',
    paystackPublicKey: '',
    smsApiKey: '',
    smsSenderId: '',
    withdrawalMinimum: '',
    withdrawalFeePercent: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      const s = res.data.data;
      setSettings(s);
      setForm({
        datamartApiUrl: s?.datamart?.apiUrl || '',
        datamartApiKey: s?.datamart?.apiKey || '',
        paystackSecretKey: s?.paystack?.secretKey || '',
        paystackPublicKey: s?.paystack?.publicKey || '',
        smsApiKey: s?.sms?.apiKey || '',
        smsSenderId: s?.sms?.senderId || '',
        withdrawalMinimum: s?.withdrawal?.minimumAmount || '',
        withdrawalFeePercent: s?.withdrawal?.feePercent || '',
      });
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        datamart: { apiUrl: form.datamartApiUrl, apiKey: form.datamartApiKey },
        paystack: { secretKey: form.paystackSecretKey, publicKey: form.paystackPublicKey },
        sms: { apiKey: form.smsApiKey, senderId: form.smsSenderId },
        withdrawal: {
          minimumAmount: parseFloat(form.withdrawalMinimum) || 10,
          feePercent: parseFloat(form.withdrawalFeePercent) || 0,
        },
      });
      toast.success('Settings saved!');
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await api.post('/admin/settings/test-datamart');
      if (res.data.data?.connected) {
        toast.success('DataMart API connected successfully!');
      } else {
        toast.error('Connection failed: ' + (res.data.data?.error || 'Unknown error'));
      }
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection test failed');
    } finally {
      setTesting(false);
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
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Settings</h1>
          <p className="text-text-muted text-sm mt-1">Configure platform integrations.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>
          <Save className="w-4 h-4" /> Save All
        </Button>
      </div>

      {/* DataMart API */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-white">DataMart API</h2>
              <p className="text-xs text-text-muted">Data fulfillment provider</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {settings?.datamart?.isConnected ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle className="w-4 h-4" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-error">
                <XCircle className="w-4 h-4" /> Not connected
              </span>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <Input
            label="API URL"
            icon={Globe}
            placeholder="https://api.datamartgh.shop"
            value={form.datamartApiUrl}
            onChange={(e) => setForm(prev => ({ ...prev, datamartApiUrl: e.target.value }))}
          />
          <Input
            label="API Key"
            icon={Key}
            type="password"
            placeholder="Enter your DataMart API key"
            value={form.datamartApiKey}
            onChange={(e) => setForm(prev => ({ ...prev, datamartApiKey: e.target.value }))}
          />
          <Button variant="outline" size="sm" loading={testing} onClick={handleTestConnection}>
            Test Connection
          </Button>
        </div>
      </Card>

      {/* Paystack */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="font-bold text-white">Paystack</h2>
            <p className="text-xs text-text-muted">Payment gateway for MoMo and card payments</p>
          </div>
        </div>
        <div className="space-y-4">
          <Input
            label="Secret Key"
            icon={Key}
            type="password"
            placeholder="sk_live_..."
            value={form.paystackSecretKey}
            onChange={(e) => setForm(prev => ({ ...prev, paystackSecretKey: e.target.value }))}
          />
          <Input
            label="Public Key"
            icon={Key}
            placeholder="pk_live_..."
            value={form.paystackPublicKey}
            onChange={(e) => setForm(prev => ({ ...prev, paystackPublicKey: e.target.value }))}
          />
        </div>
      </Card>

      {/* SMS */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-success" />
          </div>
          <div>
            <h2 className="font-bold text-white">SMS (mNotify)</h2>
            <p className="text-xs text-text-muted">For OTP and notifications</p>
          </div>
        </div>
        <div className="space-y-4">
          <Input
            label="API Key"
            icon={Key}
            type="password"
            placeholder="mNotify API key"
            value={form.smsApiKey}
            onChange={(e) => setForm(prev => ({ ...prev, smsApiKey: e.target.value }))}
          />
          <Input
            label="Sender ID"
            placeholder="Flash Data Express"
            value={form.smsSenderId}
            onChange={(e) => setForm(prev => ({ ...prev, smsSenderId: e.target.value }))}
          />
        </div>
      </Card>

      {/* Withdrawal settings */}
      <Card>
        <h2 className="font-bold text-white mb-4">Withdrawal Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Minimum amount (GH₵)"
            type="number"
            placeholder="10"
            value={form.withdrawalMinimum}
            onChange={(e) => setForm(prev => ({ ...prev, withdrawalMinimum: e.target.value }))}
          />
          <Input
            label="Fee (%)"
            type="number"
            placeholder="0"
            value={form.withdrawalFeePercent}
            onChange={(e) => setForm(prev => ({ ...prev, withdrawalFeePercent: e.target.value }))}
          />
        </div>
      </Card>
    </div>
  );
}
