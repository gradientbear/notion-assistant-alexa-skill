'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/app/components/Header';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';

function BillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activating, setActivating] = useState(false);
  const [activationStatus, setActivationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Try to activate license if we have a session_id
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // Add a small delay to allow webhook to process first (webhook is usually faster)
      // But don't wait too long - manual activation is a fallback if webhook fails
      const timer = setTimeout(() => {
        activateLicense(sessionId);
      }, 1000); // Wait 1 second for webhook to potentially complete
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }
  };

  const activateLicense = async (sessionId: string) => {
    setActivating(true);
    setActivationStatus('idle');
    setErrorMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/activate-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to activate license');
      }

      setActivationStatus('success');
      
      // Wait a moment then redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('[Billing Success] Error activating license:', error);
      setActivationStatus('error');
      setErrorMessage(error.message || 'Failed to activate license. Please contact support.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful</h1>
            {activating && (
              <p className="text-gray-600 mb-4">
                Activating your license...
              </p>
            )}
            {activationStatus === 'success' && (
              <p className="text-green-600 mb-4">
                ✓ License activated successfully!
              </p>
            )}
            {activationStatus === 'error' && (
              <div className="mb-4">
                <p className="text-red-600 mb-2">
                  ⚠ {errorMessage}
                </p>
                <p className="text-sm text-gray-500">
                  Your payment was successful. If activation failed, please contact support with your payment receipt.
                </p>
              </div>
            )}
            {!activating && activationStatus === 'idle' && !searchParams.get('session_id') && (
              <p className="text-gray-600">
                Your payment was successful. If your license hasn't been activated automatically, please contact support.
              </p>
            )}
            {!activating && activationStatus === 'idle' && searchParams.get('session_id') && (
              <p className="text-gray-600">
                Processing your license activation...
              </p>
            )}
          </div>

          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full"
            size="lg"
            disabled={activating}
          >
            {activating ? 'Activating...' : 'Go to Dashboard'}
          </Button>
        </Card>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful</h1>
              <p className="text-gray-600">Loading...</p>
            </div>
          </Card>
        </div>
      </div>
    }>
      <BillingSuccessContent />
    </Suspense>
  );
}