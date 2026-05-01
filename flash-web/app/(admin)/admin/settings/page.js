'use client';
import { useState, useEffect } from 'react';
import { Settings, Key, Globe, CreditCard, Save, Loader2, CheckCircle, XCircle, Zap, Phone, MessageCircle, Banknote, AlertTriangle } from 'lucide-react';
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
  const [testingTransfer, setTestingTransfer] = useState(false);
  const [form, setForm] = useState({
    datamartApiUrl: '',
    datamartApiKey: '',
    paystackSecretKey: '',
    paystackPublicKey: '',
    paystackTransferKey: '',
    smsApiKey: '',
    smsSenderId: '',
    withdrawalMinimum: '',
    withdrawalFeePercent: '',
    agentSupportPhone: '',
    agentSupportWhatsapp: '',
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
        datamartApiKey: '', // secrets never prefilled — masked preview shown instead
        paystackSecretKey: '',
        paystackPublicKey: s?.paystack?.publicKey || '',
        paystackTransferKey: '',
        smsApiKey: '',
        smsSenderId: s?.sms?.senderId || '',
        withdrawalMinimum: s?.withdrawal?.minimumAmount || '',
        withdrawalFeePercent: s?.withdrawal?.feePercent || '',
        agentSupportPhone: s?.agentSupport?.phone || '',
        agentSupportWhatsapp: s?.agentSupport?.whatsapp || '',
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
      // Secrets follow "leave blank to keep existing" semantics — only include
      // them in the payload when the admin actually typed a new value.
      const paystackPayload = { publicKey: form.paystackPublicKey };
      if (form.paystackSecretKey.trim()) paystackPayload.secretKey = form.paystackSecretKey.trim();
      if (form.paystackTransferKey.trim()) paystackPayload.transferKey = form.paystackTransferKey.trim();

      const datamartPayload = { apiUrl: form.datamartApiUrl };
      if (form.datamartApiKey.trim()) datamartPayload.apiKey = form.datamartApiKey.trim();

      const smsPayload = { senderId: form.smsSenderId };
      if (form.smsApiKey.trim()) smsPayload.apiKey = form.smsApiKey.trim();

      await api.put('/admin/settings', {
        datamart: datamartPayload,
        paystack: paystackPayload,
        sms: smsPayload,
        withdrawal: {
          minimumAmount: parseFloat(form.withdrawalMinimum) || 10,
          feePercent: parseFloat(form.withdrawalFeePercent) || 0,
        },
        agentSupport: {
          phone: form.agentSupportPhone.trim(),
          whatsapp: form.agentSupportWhatsapp.trim(),
        },
      });
      toast.success('Settings saved!');
      setForm(prev => ({
        ...prev,
        paystackSecretKey: '',
        paystackTransferKey: '',
        datamartApiKey: '',
        smsApiKey: '',
      }));
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClearTransferKey = async () => {
    if (!confirm('Remove the saved Paystack transfer key? Auto-payouts will stop working until you add a new one.')) return;
    setSaving(true);
    try {
      await api.put('/admin/settings', { paystack: { transferKey: null } });
      toast.success('Transfer key cleared');
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTransferKey = async () => {
    setTestingTransfer(true);
    try {
      const res = await api.post('/admin/settings/test-transfer-key');
      if (res.data.data?.connected) {
        toast.success(`Transfer key works — ${res.data.data.banksFound} MoMo networks available`);
      } else {
        toast.error('Transfer key test failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test failed');
    } finally {
      setTestingTransfer(false);
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
          {settings?.datamart?.apiKeyConfigured && (
            <div className="flex items-center justify-between bg-surface-light rounded-lg px-3 py-2">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Current key</p>
                <p className="text-sm font-mono text-white">{settings.datamart.apiKeyMasked || '••••••••'}</p>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle className="w-4 h-4" /> Configured
              </span>
            </div>
          )}
          <Input
            label={settings?.datamart?.apiKeyConfigured ? 'Replace API key' : 'API key'}
            icon={Key}
            type="password"
            placeholder={settings?.datamart?.apiKeyConfigured ? 'Leave blank to keep existing' : 'Enter your DataMart API key'}
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-bold text-white">Paystack</h2>
              <p className="text-xs text-text-muted">Payment gateway for MoMo and card payments</p>
            </div>
          </div>
          {settings?.paystack?.secretKeyConfigured ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-success">
              <CheckCircle className="w-4 h-4" /> Configured
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-text-muted">
              <XCircle className="w-4 h-4" /> Not set
            </span>
          )}
        </div>
        <div className="space-y-4">
          {settings?.paystack?.secretKeyConfigured && (
            <div className="flex items-center justify-between bg-surface-light rounded-lg px-3 py-2">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Current secret key</p>
                <p className="text-sm font-mono text-white">{settings.paystack.secretKeyMasked || '••••••••'}</p>
              </div>
            </div>
          )}
          <Input
            label={settings?.paystack?.secretKeyConfigured ? 'Replace secret key' : 'Secret Key'}
            icon={Key}
            type="password"
            placeholder={settings?.paystack?.secretKeyConfigured ? 'Leave blank to keep existing' : 'sk_live_...'}
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

      {/* Paystack Transfer / Withdrawal key */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Banknote className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="font-bold text-white">Paystack Transfer Key</h2>
              <p className="text-xs text-text-muted">Used to auto-pay agent withdrawals via Paystack. Stored encrypted; never shown in full.</p>
            </div>
          </div>
          {settings?.paystack?.transferKeyConfigured ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-success">
              <CheckCircle className="w-4 h-4" /> Configured
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-text-muted">
              <XCircle className="w-4 h-4" /> Not set
            </span>
          )}
        </div>
        <div className="space-y-3">
          {settings?.paystack?.transferKeyConfigured && (
            <div className="flex items-center justify-between bg-surface-light rounded-lg px-3 py-2">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Current key</p>
                <p className="text-sm font-mono text-white">{settings.paystack.transferKeyMasked || '••••••••'}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" loading={testingTransfer} onClick={handleTestTransferKey}>
                  Test
                </Button>
                <Button variant="danger" size="sm" onClick={handleClearTransferKey}>Clear</Button>
              </div>
            </div>
          )}
          <Input
            label={settings?.paystack?.transferKeyConfigured ? 'Replace transfer key' : 'Transfer key'}
            icon={Key}
            type="password"
            placeholder="sk_live_... (leave blank to keep existing)"
            value={form.paystackTransferKey}
            onChange={(e) => setForm(prev => ({ ...prev, paystackTransferKey: e.target.value }))}
          />
          <div className="flex items-start gap-2 text-xs text-text-muted bg-accent/5 border border-accent/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-text">How this works</p>
              <p className="mt-1">
                When an agent requests a withdrawal, clicking <span className="font-bold">Approve &amp; Pay</span> in the Withdrawals page will use this key to create a Paystack transfer to their MoMo number automatically. If the key is not set, approvals stay manual.
              </p>
            </div>
          </div>
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
          {settings?.sms?.apiKeyConfigured && (
            <div className="flex items-center justify-between bg-surface-light rounded-lg px-3 py-2">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Current API key</p>
                <p className="text-sm font-mono text-white">{settings.sms.apiKeyMasked || '••••••••'}</p>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCircle className="w-4 h-4" /> Configured
              </span>
            </div>
          )}
          <Input
            label={settings?.sms?.apiKeyConfigured ? 'Replace API key' : 'API key'}
            icon={Key}
            type="password"
            placeholder={settings?.sms?.apiKeyConfigured ? 'Leave blank to keep existing' : 'mNotify API key'}
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

      {/* Agent support contact */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h2 className="font-bold text-white">Agent Support Contact</h2>
            <p className="text-xs text-text-muted">Shown to agents on their dashboard for help</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Support phone"
            icon={Phone}
            placeholder="024 XXX XXXX"
            value={form.agentSupportPhone}
            onChange={(e) => setForm(prev => ({ ...prev, agentSupportPhone: e.target.value }))}
          />
          <Input
            label="Support WhatsApp"
            icon={MessageCircle}
            placeholder="024 XXX XXXX"
            value={form.agentSupportWhatsapp}
            onChange={(e) => setForm(prev => ({ ...prev, agentSupportWhatsapp: e.target.value }))}
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
