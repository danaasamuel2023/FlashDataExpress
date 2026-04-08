'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Sub-agent login is now unified with the main portal sign-in.
// Successful sub-agent credentials will be routed to /subagent/dashboard
// automatically by the main login flow.
export default function SubAgentLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sign-in');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Redirecting to login...</p>
      </div>
    </div>
  );
}
