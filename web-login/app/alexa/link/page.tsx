'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/app/components/Header';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';

function AlexaLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if this is an Alexa-initiated linking (has OAuth params)
  const hasAlexaParams = searchParams.get('response_type') === 'code' && 
                         searchParams.get('client_id') && 
                         searchParams.get('redirect_uri');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (err) {
      console.error('Error checking auth:', err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleAuthorize = async () => {
    if (!hasAlexaParams) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Build the authorize URL with all query parameters
      const params = new URLSearchParams();
      searchParams.forEach((value, key) => {
        params.append(key, value);
      });

      const authorizeUrl = `/api/oauth/authorize?${params.toString()}`;
      
      // Redirect to authorize endpoint
      window.location.href = authorizeUrl;
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Case A: Alexa-initiated linking
  if (hasAlexaParams) {
    if (!isAuthenticated) {
      // Show login form and preserve state
      const currentUrl = window.location.href;
      
      return (
        <div className="min-h-screen bg-gray-50">
          <Header showAuth={false} />
          
          <div className="flex items-center justify-center px-4 py-12">
            <Card className="w-full max-w-md">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign In Required</h1>
                <p className="text-gray-600">
                  Please sign in to link your Alexa account
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Button
                  onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`)}
                  className="w-full"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => router.push(`/auth/signup?redirect=${encodeURIComponent(currentUrl)}`)}
                  variant="outline"
                  className="w-full"
                >
                  Create Account
                </Button>
              </div>
            </Card>
          </div>
        </div>
      );
    }

    // User is authenticated, proceed with authorization
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <div className="flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Linking Your Account</h1>
              <p className="text-gray-600">
                Please wait while we connect your Alexa device...
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleAuthorize}
              className="w-full"
              isLoading={loading}
            >
              Continue Linking
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Case B: Normal visitor (no Alexa params)
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Link Alexa Device</h1>
            <p className="text-gray-600">
              To link your Alexa device, you must start the process from the Alexa App
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">How to Link:</h3>
              <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                <li>Open the Alexa App on your phone</li>
                <li>Go to Skills & Games</li>
                <li>Find "Notion Data" skill</li>
                <li>Tap "Enable" or "Link Account"</li>
                <li>Follow the on-screen instructions</li>
              </ol>
            </div>
          </div>

          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full"
          >
            Back to Dashboard
          </Button>
        </Card>
      </div>
    </div>
  );
}

export default function AlexaLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    }>
      <AlexaLinkContent />
    </Suspense>
  );
}

