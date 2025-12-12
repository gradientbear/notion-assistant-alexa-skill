'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/app/components/Header';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';

export default function NotionConnectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    try {
      // Get auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || !authUser.email) {
        throw new Error('User not authenticated');
      }

      // Get user from database to get auth_user_id
      const session = await supabase.auth.getSession();
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${(await session).data.session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Failed to fetch user data:', response.status, errorText);
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();
      console.log('User data fetched:', { hasLicenseKey: !!userData.license_key });

      // Call Notion OAuth initiation endpoint
      const initiateResponse = await fetch('/api/oauth/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: authUser.email,
          auth_user_id: authUser.id,
          licenseKey: userData.license_key || '',
          // Don't pass amazon_account_id for web-initiated OAuth flows
          // This ensures web users get redirected properly instead of JSON response
          amazon_account_id: null,
        }),
      });

      if (!initiateResponse.ok) {
        const errorData = await initiateResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('OAuth initiation failed:', initiateResponse.status, errorData);
        throw new Error(errorData.error || 'Failed to initiate Notion connection');
      }

      const { authUrl } = await initiateResponse.json();
      console.log('Redirecting to Notion OAuth:', authUrl);

      // Redirect to Notion OAuth
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('Error in handleConnect:', err);
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Notion</h1>
            <p className="text-gray-600">
              Link your Notion workspace to create and manage tasks with Alexa
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-600">
              When you connect Notion, we will:
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li>Create a "Voice Planner" page in your workspace</li>
              <li>Set up task management databases</li>
              <li>Enable voice commands for task management</li>
            </ul>
          </div>

          <Button
            onClick={handleConnect}
            type="button"
            className="w-full"
            isLoading={loading}
          >
            Connect Notion
          </Button>

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

