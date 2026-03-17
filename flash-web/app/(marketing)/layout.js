'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, Phone, Mail, MapPin, Clock, ChevronRight, Shield } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export default function MarketingLayout({ children }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Restore dark class on unmount so admin/dashboard pages work
  useEffect(() => {
    return () => {
      document.documentElement.classList.add('dark');
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/#pricing" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</Link>
              <Link href="/#how-it-works" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">How it Works</Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  {user.role === 'admin' && (
                    <Link href="/admin">
                      <Button variant="ghost" size="sm"><Shield className="w-3.5 h-3.5 mr-1.5" />Admin Panel</Button>
                    </Link>
                  )}
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm">Dashboard</Button>
                  </Link>
                  <Link href="/quick-buy">
                    <Button size="sm">Buy Data</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/sign-in">
                    <Button variant="ghost" size="sm">Log in</Button>
                  </Link>
                  <Link href="/quick-buy">
                    <Button size="sm">Buy Data</Button>
                  </Link>
                </>
              )}
            </div>

            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="md:hidden w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 active:scale-95 transition-all"
            >
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-4 space-y-2">
            <Link href="/#pricing" className="block py-2.5 text-sm text-gray-600 dark:text-gray-400" onClick={() => setMobileMenu(false)}>Pricing</Link>
            <Link href="/#how-it-works" className="block py-2.5 text-sm text-gray-600 dark:text-gray-400" onClick={() => setMobileMenu(false)}>How it Works</Link>
            {user && user.role === 'admin' && (
              <Link href="/admin" className="block py-2.5 text-sm text-orange-600 dark:text-orange-400 font-semibold" onClick={() => setMobileMenu(false)}>Admin Panel</Link>
            )}
            {user && (
              <Link href="/dashboard" className="block py-2.5 text-sm text-gray-600 dark:text-gray-400" onClick={() => setMobileMenu(false)}>Dashboard</Link>
            )}
            <div className="pt-3 flex gap-3 border-t border-gray-200 dark:border-gray-800">
              {user ? (
                <Link href="/quick-buy" className="flex-1"><Button fullWidth size="sm">Buy Data</Button></Link>
              ) : (
                <>
                  <Link href="/sign-in" className="flex-1"><Button variant="outline" fullWidth size="sm">Log in</Button></Link>
                  <Link href="/quick-buy" className="flex-1"><Button fullWidth size="sm">Buy Data</Button></Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="pt-16">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Brand Section */}
            <div className="lg:col-span-1">
              <div className="mb-4">
                <Logo />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ghana's fastest data bundle delivery service. Affordable prices, instant delivery, and secure payments.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-orange-600 dark:text-orange-400">
                Quick Links
              </h3>
              <ul className="space-y-3">
                {[
                  { name: 'Home', path: '/' },
                  { name: 'Buy Data', path: '/quick-buy' },
                  { name: 'Create Account', path: '/sign-up' },
                ].map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.path}
                      className="flex items-center group text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <ChevronRight size={14} className="mr-1 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-orange-600 dark:text-orange-400" />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Data Bundles */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-orange-600 dark:text-orange-400">
                Data Bundles
              </h3>
              <ul className="space-y-3">
                {[
                  { name: 'MTN Data', path: '/quick-buy' },
                  { name: 'AirtelTigo Data', path: '/quick-buy' },
                  { name: 'Telecel Data', path: '/quick-buy', isNew: true },
                ].map((bundle) => (
                  <li key={bundle.name}>
                    <Link
                      href={bundle.path}
                      className="flex items-center group text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <ChevronRight size={14} className="mr-1 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-orange-600 dark:text-orange-400" />
                      {bundle.name}
                      {bundle.isNew && (
                        <span className="ml-2 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
                          NEW
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-orange-600 dark:text-orange-400">
                Contact Us
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Phone size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Phone</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">0596922026</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Mail size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Email</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">support@flashdataexpress.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <MapPin size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Location</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Accra, Ghana</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Clock size={16} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Hours</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Mon - Sun: 24/7</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                &copy; {new Date().getFullYear()} Flash Data Express Ghana. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  Terms
                </Link>
                <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  Privacy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
