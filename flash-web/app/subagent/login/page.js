'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, AlertCircle, ArrowRight } from 'lucide-react';

// Generic /subagent/login is no longer a working login form.
// Sub-agents must use the store-scoped URL /subagent/login/[parentStoreSlug]
// shared by their parent agent. If we recognise a returning sub-agent by
// the slug saved in localStorage, auto-redirect them there.
export default function SubAgentLoginRedirectPage() {
  const router = useRouter();
  const [knownSlug, setKnownSlug] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already authenticated → straight to dashboard.
    const token = localStorage.getItem('ds_token');
    const isSub = localStorage.getItem('ds_is_subagent') === 'true';
    if (token && isSub) {
      router.replace('/subagent/dashboard');
      return;
    }

    // Returning sub-agent: we may have stored their parent's slug from a
    // previous session — try that first.
    const slug = localStorage.getItem('ds_subagent_parent_slug');
    if (slug) {
      router.replace(`/subagent/login/${slug}`);
      return;
    }

    // Legacy session: maybe the older sub-agent payload has it embedded.
    try {
      const raw = localStorage.getItem('ds_subagent');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.parentStoreSlug) {
          setKnownSlug(parsed.parentStoreSlug);
          router.replace(`/subagent/login/${parsed.parentStoreSlug}`);
          return;
        }
      }
    } catch {
      // ignore
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="p-4 sm:p-6">
        <div className="inline-flex items-center gap-2 select-none">
          <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <div className="flex items-baseline gap-0.5 text-lg font-extrabold tracking-tight">
            <span className="text-white">Flash</span>
            <span className="text-amber-500">Data</span>
            <span className="ml-1 text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider leading-none self-center">
              Sub-Agent
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[460px] text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-3">
            Use your parent agent&apos;s login link
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            For your security, sub-agents can only log in through the specific
            login link shared by the parent agent who created their account.
            <br className="hidden sm:block" />
            Please ask your parent agent to send you their sub-agent login link.
          </p>

          {knownSlug && (
            <a
              href={`/subagent/login/${knownSlug}`}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-5 rounded-xl transition-colors"
            >
              Continue to your agent&apos;s portal <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
    </div>
  );
}
