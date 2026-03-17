'use client';
import { useState } from 'react';
import { UserCircle, Mail, Phone, Lock, Save, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/user/profile', form);
      toast.success('Profile updated');
      refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/user/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/sign-in');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Profile</h1>
        <p className="text-text-muted text-sm mt-1">Manage your account details.</p>
      </div>

      {/* Avatar */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <span className="text-2xl font-extrabold text-primary">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-bold text-lg text-white">{user?.name}</p>
            <p className="text-sm text-text-muted">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Personal info */}
      <Card>
        <h2 className="font-bold text-white mb-4">Personal Information</h2>
        <div className="space-y-4">
          <Input
            label="Full name"
            icon={UserCircle}
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            icon={Mail}
            value={form.email}
            onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
          />
          <Input
            label="Phone number"
            type="tel"
            icon={Phone}
            value={form.phoneNumber}
            onChange={(e) => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
          />
          <Button loading={saving} onClick={handleSave}>
            <Save className="w-4 h-4" /> Save changes
          </Button>
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <h2 className="font-bold text-white mb-4">Change Password</h2>
        <div className="space-y-4">
          <Input
            label="Current password"
            type="password"
            icon={Lock}
            placeholder="Enter current password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
          />
          <Input
            label="New password"
            type="password"
            icon={Lock}
            placeholder="Min. 6 characters"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
          />
          <Input
            label="Confirm new password"
            type="password"
            icon={Lock}
            placeholder="Confirm new password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
          />
          <Button variant="outline" loading={changingPassword} onClick={handleChangePassword}>
            <Lock className="w-4 h-4" /> Change password
          </Button>
        </div>
      </Card>

      {/* Logout */}
      <Card>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-error/60 hover:text-error transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-semibold text-sm">Log out of your account</span>
        </button>
      </Card>
    </div>
  );
}
