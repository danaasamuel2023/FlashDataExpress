'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';

export default function SubAgentLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post('/subagent/login', form);
      const { token, user, subAgent } = res.data.data;

      localStorage.setItem('ds_token', token);
      localStorage.setItem('ds_user', JSON.stringify(user));
      localStorage.setItem('ds_subagent', JSON.stringify(subAgent));

      toast.success('Welcome back!');
      router.push('/subagent/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="p-4 sm:p-6">
        <Link href="/" className="text-xl font-extrabold text-white">
          Flash<span className="text-amber-500">Data</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px]">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Sub-Agent Login</h1>
            <p className="text-gray-400 text-sm mt-1.5 mb-8">Sign in to manage your store.</p>

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
              />

              <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
                Log in
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Don&apos;t have an account? Ask your parent agent for an invite link.
            </p>
          </div>
        </div>
      </div>

      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
    </div>
  );
}
