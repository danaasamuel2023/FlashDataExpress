'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, Phone, Store, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';

export default function SubAgentRegisterPage({ params }) {
  const { inviteCode } = use(params);
  const router = useRouter();
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    storeName: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchInviteInfo();
  }, [inviteCode]);

  const fetchInviteInfo = async () => {
    try {
      const res = await api.get(`/subagent/invite-info/${inviteCode}`);
      setInviteInfo(res.data.data);
    } catch (err) {
      setInviteError(err.response?.data?.message || 'Invalid or expired invite link');
    } finally {
      setLoadingInvite(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.phoneNumber.trim()) e.phoneNumber = 'Phone number is required';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    if (!form.storeName.trim()) e.storeName = 'Store name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post('/subagent/register', {
        ...form,
        inviteCode,
      });
      const { token, user, subAgent } = res.data.data;

      // Store sub-agent token and info
      localStorage.setItem('ds_token', token);
      localStorage.setItem('ds_subagent', JSON.stringify(subAgent));
      localStorage.setItem('ds_user', JSON.stringify(user));
      localStorage.setItem('ds_is_subagent', 'true');

      toast.success('Registration successful! Welcome aboard!');
      router.push('/subagent/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);

      if (msg.includes('email')) setErrors(prev => ({ ...prev, email: msg }));
      else if (msg.includes('phone')) setErrors(prev => ({ ...prev, phoneNumber: msg }));
      else if (msg.includes('store name')) setErrors(prev => ({ ...prev, storeName: msg }));
    } finally {
      setLoading(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Verifying invite link...</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Invite Link</h1>
          <p className="text-gray-400 text-sm mb-6">{inviteError}</p>
          <p className="text-gray-500 text-xs">
            Already registered?{' '}
            <Link href="/subagent/login" className="text-amber-400 hover:underline">Log in here</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[460px]">
          {/* Parent Agent banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-bold text-base">
                  {inviteInfo?.parentAgentName}
                </p>
                <p className="text-amber-400 font-semibold text-sm">
                  {inviteInfo?.storeName}
                </p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Has invited you to join as an agent and start selling data bundles
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Create your Agent Store</h1>
            <p className="text-gray-400 text-sm mt-1.5 mb-6">Set up your Agent Store under <span className="text-amber-400 font-semibold">{inviteInfo?.parentAgentName}</span> and start selling instantly.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full name"
                name="name"
                icon={User}
                placeholder="Kofi Mensah"
                value={form.name}
                onChange={handleChange}
                error={errors.name}
              />
              <Input
                label="Email"
                name="email"
                type="email"
                icon={Mail}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
              />
              <Input
                label="Phone number"
                name="phoneNumber"
                type="tel"
                icon={Phone}
                placeholder="024 XXX XXXX"
                value={form.phoneNumber}
                onChange={handleChange}
                error={errors.phoneNumber}
              />
              <Input
                label="Password"
                name="password"
                type="password"
                icon={Lock}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
              />
              <Input
                label="Your Agent Store name"
                name="storeName"
                icon={Store}
                placeholder="e.g. Kofi Agent Store"
                value={form.storeName}
                onChange={handleChange}
                error={errors.storeName}
              />
              <p className="text-xs text-gray-500">
                This will be the name customers see on your Agent Store page.
              </p>

              <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
                Create account & store
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have a sub-agent account?{' '}
              <Link href="/subagent/login" className="text-amber-400 font-semibold hover:underline">Log in</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
    </div>
  );
}
