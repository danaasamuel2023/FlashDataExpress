'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Store, Type, FileText, Phone, Palette, CreditCard, Loader2, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';

const THEME_COLORS = [
  '#FF6B00', '#E60000', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#F59E0B', '#1A1A2E',
];

const ACTIVATION_FEE = 50;

export default function StoreSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null); // null | 'success' | 'failed'
  const [form, setForm] = useState({
    storeName: '',
    description: '',
    contactPhone: '',
    primaryColor: '#FF6B00',
    momoNumber: '',
    momoNetwork: 'MTN',
    momoName: '',
  });

  // Handle payment callback — verify and create store
  useEffect(() => {
    const reference = searchParams.get('reference');
    if (reference && !verifying && !verifyStatus) {
      setVerifying(true);
      api.get(`/store/verify-activation?reference=${reference}`)
        .then(() => {
          setVerifyStatus('success');
          toast.success('Store activated!');
          // Clean URL and redirect after brief delay
          window.history.replaceState({}, '', '/store/setup');
          setTimeout(() => router.push('/store/dashboard'), 1500);
        })
        .catch(() => {
          setVerifyStatus('failed');
          window.history.replaceState({}, '', '/store/setup');
        });
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.storeName.trim()) {
      toast.error('Store name is required');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/store/initialize-payment', {
        storeName: form.storeName,
        description: form.description,
        contactPhone: form.contactPhone,
        theme: { primaryColor: form.primaryColor },
        momoDetails: {
          number: form.momoNumber,
          network: form.momoNetwork,
          name: form.momoName,
        },
      });
      // Redirect to Paystack payment page
      window.location.href = res.data.data.authorization_url;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initialize payment');
      setLoading(false);
    }
  };

  // Show verifying state
  if (verifying && !verifyStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold text-white">Verifying payment...</h2>
        <p className="text-text-muted text-sm mt-2">Please wait while we activate your store.</p>
      </div>
    );
  }

  // Show success state
  if (verifyStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-xl font-bold text-white">Store Activated!</h2>
        <p className="text-text-muted text-sm mt-2">Redirecting to your store dashboard...</p>
      </div>
    );
  }

  // Show failed state
  if (verifyStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-xl font-bold text-white">Payment Failed</h2>
        <p className="text-text-muted text-sm mt-2 mb-6">We couldn&apos;t verify your payment. Please try again.</p>
        <Button onClick={() => setVerifyStatus(null)}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Create your store</h1>
        <p className="text-text-muted text-sm mt-1">Set up your data selling business in minutes.</p>
      </div>

      {/* Activation fee notice */}
      <Card className="!border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-white">One-time activation fee: GH₵{ACTIVATION_FEE}</p>
            <p className="text-text-muted text-xs mt-1">
              Pay once to activate your store. After payment, you can start selling data and earning profit immediately.
            </p>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h2 className="font-bold text-white mb-4">Store Details</h2>
          <div className="space-y-4">
            <Input
              label="Store name"
              icon={Store}
              placeholder="e.g. Kofi's Data Hub"
              value={form.storeName}
              onChange={(e) => setForm(prev => ({ ...prev, storeName: e.target.value }))}
            />
            <Input
              label="Description (optional)"
              icon={FileText}
              placeholder="Short description of your store"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            />
            <Input
              label="Contact phone"
              icon={Phone}
              type="tel"
              placeholder="024 XXX XXXX"
              value={form.contactPhone}
              onChange={(e) => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-white mb-4">Store Theme</h2>
          <p className="text-text-muted text-xs mb-3">Pick a primary color for your store page.</p>
          <div className="flex gap-3 flex-wrap">
            {THEME_COLORS.map(color => (
              <button
                key={color}
                type="button"
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
          <h2 className="font-bold text-white mb-4">MoMo Withdrawal Details</h2>
          <p className="text-text-muted text-xs mb-4">Where should we send your earnings?</p>
          <div className="space-y-4">
            <Input
              label="MoMo number"
              icon={Phone}
              type="tel"
              placeholder="024 XXX XXXX"
              value={form.momoNumber}
              onChange={(e) => setForm(prev => ({ ...prev, momoNumber: e.target.value }))}
            />
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Network</label>
              <div className="flex gap-2">
                {['MTN', 'Telecel', 'AirtelTigo'].map(net => (
                  <button
                    key={net}
                    type="button"
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
              placeholder="Name on MoMo account"
              value={form.momoName}
              onChange={(e) => setForm(prev => ({ ...prev, momoName: e.target.value }))}
            />
          </div>
        </Card>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          <CreditCard className="w-4 h-4" /> Pay GH₵{ACTIVATION_FEE} & Create Store
        </Button>
      </form>
    </div>
  );
}
