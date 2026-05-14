'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Zap, Store as StoreIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';

export default function SubAgentStoreLoginPage({ params }) {
  const { storeSlug } = use(params);
  const router = useRouter();
  const [storeInfo, setStoreInfo] = useState(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [storeError, setStoreError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  // If already logged in as a sub-agent, skip straight to the dashboard.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('ds_token');
    const isSub = localStorage.getItem('ds_is_subagent') === 'true';
    if (token && isSub) {
      router.replace('/subagent/dashboard');
    }
  }, [router]);

  useEffect(() => {
    api.get(`/shop/${storeSlug}`)
      .then(res => setStoreInfo(res.data.data))
      .catch(err => setStoreError(err.response?.data?.message || 'Store not found'))
      .finally(() => setLoadingStore(false));
  }, [storeSlug]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setErrors({
        ...(!form.email && { email: 'Email is required' }),
        ...(!form.password && { password: 'Password is required' }),
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/subagent/login', { ...form, parentStoreSlug: storeSlug });
      const { token, user, subAgent } = res.data.data;

      localStorage.setItem('ds_token', token);
      localStorage.setItem('ds_subagent', JSON.stringify(subAgent));
      localStorage.setItem('ds_is_subagent', 'true');
      localStorage.setItem('ds_user', JSON.stringify({ ...user, role: 'subagent' }));
      if (subAgent.parentStoreSlug) {
        localStorage.setItem('ds_subagent_parent_slug', subAgent.parentStoreSlug);
      }

      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      router.push('/subagent/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Check your credentials.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loadingStore) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Login Link</h1>
          <p className="text-gray-400 text-sm">
            This sub-agent login link is not valid. Please ask your parent agent for the correct link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="p-4 sm:p-6">
        <div className="inline-flex items-center gap-2 select-none">
          <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <div className="flex items-baseline gap-0.5 text-lg font-extrabold tracking-tight">
            <span className="text-white">Flash</span>
            <span className="text-amber-500">Data</span>
            <span className="ml-1 text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider leading-none self-center">
              Sub-Agent
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px]">
          {/* Parent store banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                <StoreIcon className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-400/80 text-xs">Logging in to</p>
                <p className="text-white font-bold text-base">{storeInfo?.storeName}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Sub-agent log in</h1>
            <p className="text-gray-400 text-sm mt-1.5 mb-8">
              Only sub-agents registered under <span className="text-amber-400 font-semibold">{storeInfo?.storeName}</span> can log in here.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                name="email"
                type="email"
                icon={Mail}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
              />
              <Input
                label="Password"
                name="password"
                type="password"
                icon={Lock}
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="current-password"
              />

              <Button type="submit" fullWidth size="lg" loading={loading}>
                Log in
              </Button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-6">
              Don&apos;t have a sub-agent account? Ask {storeInfo?.storeName} to send you an invite link.
            </p>
          </div>
        </div>
      </div>

      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
    </div>
  );
}
