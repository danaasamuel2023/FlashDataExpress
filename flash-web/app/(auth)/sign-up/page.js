'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, Phone, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    referralCode: searchParams.get('ref') || ''
  });
  const [errors, setErrors] = useState({});

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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      const { token, user } = res.data.data;
      login(token, user);
      toast.success('Welcome to Flash Data Express!');
      router.push('/dashboard');
    } catch (err) {
      if (!err.response) {
        toast.error('Network error. Check your internet connection and try again.');
      } else {
        const msg = err.response.data?.message || 'Something went wrong. Please try again.';
        toast.error(msg);

        // Set field-level errors for duplicate account messages
        if (msg.includes('email')) {
          setErrors(prev => ({ ...prev, email: msg }));
        } else if (msg.includes('phone number')) {
          setErrors(prev => ({ ...prev, phoneNumber: msg }));
        } else if (msg.includes('referral code') || msg.includes('Referral') || msg.includes('Invalid referral')) {
          setErrors(prev => ({ ...prev, referralCode: msg }));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Create your account</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 mb-8">Start buying data in under a minute.</p>

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
          label="Referral code (optional)"
          name="referralCode"
          icon={Gift}
          placeholder="e.g. KOF1AB"
          value={form.referralCode}
          onChange={handleChange}
          error={errors.referralCode}
        />

        <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-amber-600 dark:text-amber-400 font-semibold hover:underline">Log in</Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
