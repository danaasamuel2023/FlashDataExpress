'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, ShoppingBag, Clock, Wallet, Gift, UserCircle, Store,
  Menu, X, ChevronRight, LogOut, Zap, Package, MessageCircle,
  TrendingUp, DollarSign, Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/constants';
import api from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/buy', label: 'Buy Data', icon: ShoppingBag },
  { href: '/orders', label: 'My Orders', icon: Package },
  { href: '/transactions', label: 'Transactions', icon: Clock },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/store/dashboard', label: 'Agent Store', icon: Store },
  { href: '/referrals', label: 'Referrals', icon: Gift },
  { href: '/profile', label: 'Profile', icon: UserCircle },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [whatsappPopup, setWhatsappPopup] = useState(false);
  const [hasStore, setHasStore] = useState(null); // null=unknown, true/false once checked
  const [showStoreModal, setShowStoreModal] = useState(false);

  // Force dark mode for dashboard
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Fetch admin support WhatsApp
  useEffect(() => {
    api.get('/auth/agent-support')
      .then(res => setSupportWhatsapp(res.data.data?.whatsapp || ''))
      .catch(() => {});
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
    if (!loading && !user) {
      router.push('/sign-in');
      return;
    }
    if (!loading && user && typeof window !== 'undefined') {
      const isSubAgent = localStorage.getItem('ds_is_subagent') === 'true';
      if (isSubAgent) router.replace('/subagent/dashboard');
    }
  }, [user, loading, router]);

  // Check whether user already has a store (so we don't nag store owners)
  useEffect(() => {
    if (loading || !user) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('ds_is_subagent') === 'true') return;
    api.get('/store/my-store')
      .then(() => setHasStore(true))
      .catch(err => {
        if (err.response?.status === 404) setHasStore(false);
      });
  }, [loading, user]);

  // Show "Create Your Store" modal hourly until the user opens a store
  useEffect(() => {
    if (hasStore !== false) return;
    if (typeof window === 'undefined') return;

    const ONE_HOUR = 60 * 60 * 1000;
    const onStorePage = pathname.startsWith('/store');

    const check = () => {
      if (pathname.startsWith('/store')) return;
      const last = parseInt(localStorage.getItem('ds_store_modal_last_shown') || '0', 10);
      if (Date.now() - last >= ONE_HOUR) setShowStoreModal(true);
    };

    if (!onStorePage) check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [hasStore, pathname]);

  const dismissStoreModal = () => {
    setShowStoreModal(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ds_store_modal_last_shown', String(Date.now()));
    }
  };

  const goToStoreSetup = () => {
    dismissStoreModal();
    router.push('/store/setup');
  };

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

      {/* WhatsApp popup */}
      {whatsappPopup && (
        <div className={`fixed z-40 left-4 ${isMobile ? 'bottom-[5.5rem]' : 'bottom-20'} bg-surface border border-white/10 rounded-2xl shadow-2xl p-3 w-64`}>
          <p className="text-white font-bold text-sm mb-2">WhatsApp</p>
          {supportWhatsapp && (
            <a
              href={`https://wa.me/${supportWhatsapp.replace(/\D/g, '').replace(/^0/, '233')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              onClick={() => setWhatsappPopup(false)}
            >
              <div className="w-9 h-9 bg-[#25D366]/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Contact Admin</p>
                <p className="text-text-muted text-[10px]">Chat with support</p>
              </div>
            </a>
          )}
          <a
            href="https://whatsapp.com/channel/0029VbByiD37DAWv3LzCXM42"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
            onClick={() => setWhatsappPopup(false)}
          >
            <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Join Channel</p>
              <p className="text-text-muted text-[10px]">Updates &amp; announcements</p>
            </div>
          </a>
        </div>
      )}

      {/* Floating WhatsApp button */}
      <button
        onClick={() => setWhatsappPopup(!whatsappPopup)}
        className={`fixed z-30 left-4 w-12 h-12 bg-[#25D366] hover:bg-[#1ebe57] rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/30 transition-all hover:scale-110 ${isMobile ? 'bottom-20' : 'bottom-6'}`}
        title="WhatsApp"
      >
        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>

      {/* Click outside to close popup */}
      {whatsappPopup && <div className="fixed inset-0 z-35" onClick={() => setWhatsappPopup(false)} />}

      {/* Hourly "Create Your Store" modal */}
      {showStoreModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={dismissStoreModal}
          />
          <div className="relative w-full max-w-md bg-surface border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            <button
              onClick={dismissStoreModal}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="bg-gradient-to-br from-primary/30 via-primary/10 to-transparent p-6 pb-4">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
                <Store className="w-7 h-7 text-white" />
              </div>
              <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Sparkles className="w-3 h-3" /> EARN WITH FLASHDATA
              </div>
              <h2 className="text-2xl font-extrabold text-white leading-tight">
                Open your own data shop &amp; make money
              </h2>
              <p className="text-text-muted text-sm mt-2">
                Sell data with your own brand, set your own prices, and keep the profit on every sale.
              </p>
            </div>

            <div className="px-6 pb-2 space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Set your own prices</p>
                  <p className="text-text-muted text-xs">Mark up bundles and pocket the difference on every order.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Your branded storefront</p>
                  <p className="text-text-muted text-xs">Get a shareable shop link customers can buy from directly.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Withdraw to MoMo</p>
                  <p className="text-text-muted text-xs">Cash out your earnings straight to mobile money.</p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 space-y-2">
              <div className="text-center mb-1">
                <span className="text-text-muted text-xs">One-time activation: </span>
                <span className="text-primary font-extrabold text-sm">GH₵50</span>
              </div>
              <button
                onClick={goToStoreSetup}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4" /> Create My Store
              </button>
              <button
                onClick={dismissStoreModal}
                className="w-full text-text-muted hover:text-white text-sm font-medium py-2 transition-colors"
              >
                Remind me later
              </button>
            </div>
          </div>
        </div>
      )}

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
