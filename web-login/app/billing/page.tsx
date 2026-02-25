'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/app/components/Header';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';

interface User {
  id: string;
  email: string;
  has_jwt_token?: boolean;
  license_key?: string;
}

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [checkingLicense, setCheckingLicense] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }
    
    // Check if user already has a license
    await checkExistingLicense();
  };

  const checkExistingLicense = async () => {
    try {
      setCheckingLicense(true);
      
      // Get website JWT token or Supabase session token
      const websiteAccessToken = localStorage.getItem('website_access_token');
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = websiteAccessToken || session?.access_token;

      if (!authToken) {
        setError('Not authenticated');
        setCheckingLicense(false);
        return;
      }

      // Fetch user data to check for existing license
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData: User = await response.json();
      setUser(userData);

      // If user already has a license, redirect to dashboard
      if (userData.has_jwt_token) {
        router.push('/dashboard?message=You already have an active license');
        return;
      }
    } catch (err: any) {
      console.error('Error checking license:', err);
      setError(err.message || 'Failed to check license status');
    } finally {
      setCheckingLicense(false);
    }
  };

  const handleBuyLicense = async () => {
    setLoading(true);
    setError('');

    try {
      // Get website JWT token or Supabase session token
      const websiteAccessToken = localStorage.getItem('website_access_token');
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = websiteAccessToken || session?.access_token;

      if (!authToken) {
        throw new Error('Not authenticated');
      }

      // Get Stripe price ID from environment
      // Note: NEXT_PUBLIC_* variables are available at build time in Next.js
      const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
      if (!priceId) {
        throw new Error('Stripe price ID not configured. Please contact support or check your environment configuration.');
      }
      
      // Validate price ID format (should start with 'price_')
      if (!priceId.startsWith('price_')) {
        throw new Error(`Invalid Stripe price ID format. Expected format: 'price_...', got: '${priceId.substring(0, 10)}...'`);
      }

      // Create Stripe checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          priceId,
          // Stripe automatically appends ?session_id={CHECKOUT_SESSION_ID} to the success URL
          successUrl: `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/billing`,
        }),
      });

      console.log('[Response]', response);

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle "already_purchased" error specifically
        if (errorData.error === 'already_purchased') {
          // Refresh user data to update UI
          await checkExistingLicense();
          throw new Error(errorData.error_description || 'You already have an active license');
        }
        
        throw new Error(errorData.error_description || errorData.error || 'Failed to create checkout session');
      }

      const result = await response.json();
      
      // Redirect to Stripe checkout
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Buy License</h1>
            <p className="text-gray-600">
              Purchase a lifetime license to activate your Voice Planner account
            </p>
          </div>

          {checkingLicense ? (
            <div className="text-center py-8">
              <div className="text-gray-600">Checking license status...</div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {user?.has_jwt_token ? (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium mb-2">✓ You already have an active license</p>
                  <p className="text-sm text-green-700">
                    Your lifetime license is active and ready to use. You don't need to purchase another one.
                  </p>
                  <Button
                    onClick={() => router.push('/dashboard')}
                    className="w-full mt-4"
                    size="lg"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Lifetime License Includes:</h3>
                      <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                        <li>Unlimited task management</li>
                        <li>Voice commands via Alexa</li>
                        <li>Notion workspace integration</li>
                        <li>Priority support</li>
                        <li>All future updates</li>
                      </ul>
                    </div>
                  </div>

                  <Button
                    onClick={handleBuyLicense}
                    className="w-full"
                    size="lg"
                    isLoading={loading}
                  >
                    Buy Lifetime License
                  </Button>
                </>
              )}
            </>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

