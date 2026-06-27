'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap, Check } from 'lucide-react';

const STEPS = [
  {
    img: '/illustrations/welcome.svg',
    title: 'Welcome to your data store',
    body: 'Sell MTN, Telecel & AirtelTigo data bundles to your customers and earn on every sale — all from one simple dashboard.',
  },
  {
    img: '/illustrations/create-store.svg',
    title: '1. Create your store',
    body: 'Activate your branded store once. You get your own link to share anywhere — customers buy from you directly.',
  },
  {
    img: '/illustrations/set-prices.svg',
    title: '2. Set your prices',
    body: 'Choose your selling price for each bundle. The gap between your price and the base price is your profit on every order.',
  },
  {
    img: '/illustrations/share-link.svg',
    title: '3. Share your link',
    body: 'Send your store link on WhatsApp, status or social media. Customers buy directly — no app or sign-up needed.',
  },
  {
    img: '/illustrations/customers-buy.svg',
    title: '4. Customers buy data',
    body: 'Orders are delivered automatically and lightning-fast. Watch live delivery status right on your dashboard.',
  },
  {
    img: '/illustrations/earn.svg',
    title: '5. You earn instantly',
    body: 'Your profit lands in your balance on every completed sale. Track today’s sales, revenue and profit at a glance.',
  },
  {
    img: '/illustrations/withdraw.svg',
    title: '6. Cash out anytime',
    body: 'Withdraw your earnings straight to Mobile Money whenever you like from the Withdrawals page.',
  },
];

export default function StoreTutorial() {
  const [step, setStep] = useState(0);
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-primary/[0.07] to-transparent p-5 sm:p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-white text-sm">How the Agent Store works</h2>
          <p className="text-[11px] text-text-muted">A quick guided tour — {step + 1} of {STEPS.length}</p>
        </div>
      </div>

      {/* Animated step — re-mounts on step change to replay the entrance */}
      <div key={step} className="tut-step flex flex-col items-center text-center">
        <div className="tut-art w-full max-w-[240px] aspect-square mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.img} alt={current.title} className="w-full h-full object-contain" />
        </div>
        <h3 className="text-lg font-extrabold text-white">{current.title}</h3>
        <p className="text-sm text-text-muted mt-2 max-w-md">{current.body}</p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-white/15 hover:bg-white/30'}`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={back}
          disabled={isFirst}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-bold text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {isLast ? (
          <button
            onClick={() => setStep(0)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            <Check className="w-4 h-4" /> Got it — restart
          </button>
        ) : (
          <button
            onClick={next}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <style jsx>{`
        .tut-step {
          animation: tutFade 0.45s ease both;
        }
        .tut-art {
          animation: tutFloat 4s ease-in-out infinite;
        }
        @keyframes tutFade {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tutFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tut-step, .tut-art { animation: none; }
        }
      `}</style>
    </div>
  );
}
