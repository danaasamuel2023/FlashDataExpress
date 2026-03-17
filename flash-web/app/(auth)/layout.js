'use client';
import Link from 'next/link';
import Logo from '@/components/shared/Logo';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal header */}
      <div className="p-4 sm:p-6">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      {/* Auth content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </div>

      {/* Subtle decoration */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
    </div>
  );
}
