'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Users, Clock, Wallet, Settings, BarChart3,
  Menu, X, ChevronRight, LogOut, Zap, Gift, DollarSign, ExternalLink, Store
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { href: '/admin', label: 'Overview', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/stores', label: 'Stores', icon: Store },
  { href: '/admin/transactions', label: 'Transactions', icon: Clock },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Wallet },
  { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/admin/referrals', label: 'Referrals', icon: Gift },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Force dark mode for admin panel
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/sign-in');
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/sign-in');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-white/[0.04] flex-shrink-0">
        <div className="p-5 border-b border-white/[0.04]">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-surface-light rounded-xl flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-primary fill-primary" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white">FlashData</span>
              <span className="text-[10px] text-orange-500 font-bold ml-1.5 bg-orange-500/10 px-1.5 py-0.5 rounded">ADMIN</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 mt-4 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.04] space-y-0.5">
          <Link
            href="/"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:text-primary hover:bg-primary/5 transition-all"
          >
            <ExternalLink className="w-[18px] h-[18px]" />
            View Site
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:text-error hover:bg-error/5 transition-all"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-white/[0.04] z-30 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-1.5">
          <Menu className="w-5 h-5 text-white" />
        </button>
        <span className="font-extrabold text-sm text-white">Admin Panel</span>
        <div className="w-8" />
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-72 bg-card z-50 flex flex-col shadow-2xl">
            <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
              <span className="font-extrabold text-white">Admin Panel</span>
              <button onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex-1 px-3 mt-4 space-y-0.5 overflow-y-auto">
              {navItems.map(item => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all
                      ${active ? 'bg-primary/10 text-primary' : 'text-text-muted'}`}
                  >
                    <Icon className="w-5 h-5" /> {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/[0.04] space-y-0.5">
              <Link href="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-text-muted hover:text-primary">
                <ExternalLink className="w-5 h-5" /> View Site
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-error/60 hover:text-error">
                <LogOut className="w-5 h-5" /> Log out
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden h-14" />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
