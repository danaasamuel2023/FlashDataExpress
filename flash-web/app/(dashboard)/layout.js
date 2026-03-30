'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, ShoppingBag, Clock, Wallet, Gift, UserCircle, Store,
  Menu, X, ChevronRight, LogOut, Zap
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/constants';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/buy', label: 'Buy Data', icon: ShoppingBag },
  { href: '/transactions', label: 'Transactions', icon: Clock },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/store/dashboard', label: 'My Store', icon: Store },
  { href: '/referrals', label: 'Referrals', icon: Gift },
  { href: '/profile', label: 'Profile', icon: UserCircle },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Force dark mode for dashboard
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [user, loading, router]);

  if (loading || !user) {
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

  const bottomNavItems = navItems.slice(0, 5);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-white/[0.04] flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-white/[0.04]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-sm shadow-primary/20">
              <Zap className="w-4.5 h-4.5 text-white fill-white" />
            </div>
            <span className="font-extrabold text-lg">
              <span className="text-white">Flash</span><span className="text-primary">Data</span>
            </span>
          </Link>
        </div>

        {/* Balance card */}
        <div className="mx-4 mt-4 p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/10">
          <p className="text-text-muted text-xs font-medium">Wallet Balance</p>
          <p className="text-white text-xl font-extrabold mt-0.5">{formatCurrency(user.walletBalance)}</p>
          <Link href="/wallet" className="inline-flex items-center gap-1 text-primary text-xs font-semibold mt-2 hover:underline">
            Top up <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-4 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = item.href === '/store/dashboard'
              ? pathname.startsWith('/store')
              : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-text hover:bg-white/[0.03]'
                  }
                `}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/[0.04]">
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
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface/95 backdrop-blur-xl border-b border-white/[0.04] z-30 flex items-center justify-between px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-white/5">
          <Menu className="w-5 h-5 text-text" />
        </button>
        <span className="font-extrabold text-sm">
          <span className="text-white">Flash</span><span className="text-primary">Data</span>
        </span>
        <Link href="/wallet" className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
          {formatCurrency(user.walletBalance)}
        </Link>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && isMobile && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-72 bg-surface z-50 flex flex-col shadow-2xl border-r border-white/[0.04]">
            <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                  <Zap className="w-4.5 h-4.5 text-white fill-white" />
                </div>
                <span className="font-extrabold text-lg">
                  <span className="text-white">Flash</span><span className="text-primary">Data</span>
                </span>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex-1 px-3 mt-4 space-y-0.5 overflow-y-auto">
              {navItems.map(item => {
                const Icon = item.icon;
                const active = item.href === '/store/dashboard'
                  ? pathname.startsWith('/store')
                  : pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all
                      ${active ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text'}`}
                  >
                    <Icon className="w-5 h-5" /> {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/[0.04]">
              <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-text-muted hover:text-error hover:bg-error/5">
                <LogOut className="w-5 h-5" /> Log out
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden h-14" />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-white/[0.04] z-20">
          <div className="grid grid-cols-5 p-1.5">
            {bottomNavItems.map(item => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center py-2 rounded-lg text-[10px] font-medium transition-colors
                    ${active ? 'text-primary bg-primary/5' : 'text-text-muted'}`}
                >
                  <Icon className="w-4.5 h-4.5 mb-0.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
