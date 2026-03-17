'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, KeyRound, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState('email'); // email | otp | done
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('Reset code sent to your email/phone');
      setStep('otp');
    } catch {
      toast.error('Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      toast.success('Password reset successfully!');
      setStep('done');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="glass-card rounded-2xl p-6 sm:p-8 text-center">
        <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7 text-success" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Password reset!</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 mb-6">You can now log in with your new password.</p>
        <Link href="/sign-in">
          <Button fullWidth size="lg">Go to login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-500 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to login
      </Link>

      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Reset password</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 mb-8">
        {step === 'email' ? "Enter your email and we'll send a reset code." : 'Enter the code and your new password.'}
      </p>

      {step === 'email' ? (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <Input
            label="Email"
            type="email"
            icon={Mail}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>Send reset code</Button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="Reset code"
            icon={KeyRound}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
          />
          <Input
            label="New password"
            type="password"
            icon={Lock}
            placeholder="Min. 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>Reset password</Button>
        </form>
      )}
    </div>
  );
}
