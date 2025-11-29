'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/app/components/Header';
import { Step } from '@/app/components/Step';
import { Button } from '@/app/components/Button';
import { Card } from '@/app/components/Card';

interface User {
  id: string;
  email: string;
  notion_setup_complete: boolean;
  license_key: string | null;
  amazon_account_id: string | null;
}

interface License {
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [licenseActive, setLicenseActive] = useState(false);
  const [checkingLicense, setCheckingLicense] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Check if coming back from Notion OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notion_connected') === 'true' && user) {
      // Refresh user data to show updated status
      fetchUserData();
      // Remove the query parameter
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [user]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/login');
      return;
    }
    await fetchUserData();
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Get auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/auth/login');
        return;
      }

      // Get user from database
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData: User = await response.json();
      setUser(userData);

      // Check license status if license_key exists
      if (userData.license_key) {
        await checkLicenseStatus(userData.license_key);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkLicenseStatus = async (licenseKey: string) => {
    try {
      setCheckingLicense(true);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return;
      }

      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, supabaseAnonKey);
      
      const { data: license } = await client
        .from('licenses')
        .select('status')
        .eq('license_key', licenseKey)
        .single();

      setLicenseActive(license?.status === 'active');
    } catch (error) {
      console.error('Error checking license:', error);
    } finally {
      setCheckingLicense(false);
    }
  };

  const handleConnectNotion = () => {
    router.push('/notion/connect');
  };

  const handleBuyLicense = () => {
    router.push('/billing');
  };

  const handleLinkAlexa = () => {
    router.push('/alexa/link');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Notion Data</h1>
          <p className="text-gray-600">Complete the steps below to get started</p>
        </div>

        <Card className="p-8">
          <div className="space-y-8">
            {/* Step 1 - Account Created */}
            <Step
              number={1}
              title="Account Created"
              description="Your account has been successfully created"
              status="complete"
            />

            {/* Step 2 - Connect Notion */}
            <Step
              number={2}
              title="Connect Notion"
              description="Link your Notion workspace to create and manage tasks"
              status={user.notion_setup_complete ? 'complete' : 'current'}
            >
              {!user.notion_setup_complete && (
                <Button onClick={handleConnectNotion}>
                  Connect Notion
                </Button>
              )}
            </Step>

            {/* Step 3 - Buy License */}
            <Step
              number={3}
              title="Buy License"
              description="Purchase a lifetime license to activate your account"
              status={
                licenseActive
                  ? 'complete'
                  : user.license_key && !licenseActive
                  ? 'current'
                  : !user.license_key
                  ? 'current'
                  : 'pending'
              }
            >
              {!licenseActive && (
                <Button onClick={handleBuyLicense}>
                  Buy License
                </Button>
              )}
            </Step>

            {/* Step 4 - Link Alexa */}
            <Step
              number={4}
              title="Link Alexa"
              description="Connect your Alexa device to start using voice commands"
              status={
                user.amazon_account_id
                  ? 'complete'
                  : user.notion_setup_complete && licenseActive
                  ? 'current'
                  : 'pending'
              }
            >
              {user.notion_setup_complete && licenseActive && !user.amazon_account_id && (
                <Button onClick={handleLinkAlexa}>
                  Link Alexa
                </Button>
              )}
              {user.amazon_account_id && (
                <p className="text-sm text-green-600 font-medium">✓ Alexa account linked</p>
              )}
              {(!user.notion_setup_complete || !licenseActive) && (
                <p className="text-sm text-gray-500">
                  Complete previous steps to enable Alexa linking
                </p>
              )}
            </Step>
          </div>
        </Card>
      </main>
    </div>
  );
}
