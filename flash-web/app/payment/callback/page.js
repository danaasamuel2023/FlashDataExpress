'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Check, X, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying | success | failed
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  useEffect(() => {
    if (reference) {
      verifyPayment(reference);
    } else {
      setStatus('failed');
    }
  }, [reference]);

  const verifyPayment = async (ref) => {
    try {
      await api.post('/wallet/verify-payment', { reference: ref });
      setStatus('success');
      refreshUser();
    } catch {
      setStatus('failed');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white">Verifying payment...</h1>
          <p className="text-text-muted text-sm mt-2">Please wait while we confirm your deposit.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-bold text-white">Payment Successful!</h1>
          <p className="text-text-muted text-sm mt-2 mb-6">Your wallet has been credited.</p>
          <Button onClick={() => router.push('/wallet')}>Go to Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <X className="w-8 h-8 text-error" />
        </div>
        <h1 className="text-xl font-bold text-white">Payment Failed</h1>
        <p className="text-text-muted text-sm mt-2 mb-6">We couldn&apos;t verify your payment. If you were charged, please contact support.</p>
        <Button onClick={() => router.push('/wallet')}>Back to Wallet</Button>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}
