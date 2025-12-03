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
  notion_token?: string | null;
  has_jwt_token?: boolean;
}

interface License {
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  // Check if license check should be skipped (for testing)
  const skipLicenseCheck = process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true' || 
                           process.env.NODE_ENV === 'development';
  const [licenseActive, setLicenseActive] = useState(skipLicenseCheck); // Default to true if skipping
  const [checkingLicense, setCheckingLicense] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Check if coming back from Notion OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notion_connected') === 'true') {
      console.log('[Dashboard] Detected Notion connection, refreshing user data...');
      // Refresh user data to show updated status (don't wait for user to be set)
      fetchUserData();
      // Remove the query parameter
      window.history.replaceState({}, '', '/dashboard');
    }
    // Check if coming back from token generation
    if (urlParams.get('token_generated') === 'true') {
      console.log('[Dashboard] Token generated, refreshing user data...');
      fetchUserData();
      // Remove the query parameter
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []); // Run once on mount, not dependent on user

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }
    
    // Ensure user exists in database before fetching user data
    // This handles the case where Supabase OAuth sets cookies client-side
    // but the server-side callback couldn't create the user
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        // Call sync-user API to ensure user exists in database
        const syncResponse = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            auth_user_id: authUser.id,
            email: authUser.email,
            provider: authUser.app_metadata?.provider || 'email',
          }),
        });
        
        if (syncResponse.ok) {
          console.log('[Dashboard] User synced to database');
        } else {
          console.warn('[Dashboard] User sync failed, will rely on /api/users/me fallback');
        }
      }
    } catch (syncError) {
      console.error('[Dashboard] Error syncing user:', syncError);
      // Continue anyway - /api/users/me has fallback
    }
    
    await fetchUserData();
  };

  const fetchUserData = async (retryCount = 0) => {
    try {
      setLoading(true);
      
      // Get auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/');
        return;
      }

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[Dashboard] No session token available');
        if (retryCount < 2) {
          // Wait and retry (session might be establishing)
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchUserData(retryCount + 1);
        }
        router.push('/');
        return;
      }

      // Get user from database with retry logic
      let response: Response | null = null;
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch('/api/users/me', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            break; // Success, exit retry loop
          }

          // If 404 and we haven't exhausted retries, wait and retry
          if (response.status === 404 && attempt < 2) {
            console.log(`[Dashboard] User not found, retrying... (attempt ${attempt + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Exponential backoff
            continue;
          }

          // For other errors or final attempt, throw
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        } catch (err: any) {
          lastError = err;
          if (attempt < 2 && response?.status === 404) {
            // Continue retry loop
            continue;
          }
          throw err;
        }
      }

      if (!response || !response.ok) {
        throw lastError || new Error('Failed to fetch user data after retries');
      }

      const userData: User = await response.json();
      console.log('[Dashboard] User data loaded:', {
        id: userData.id,
        email: userData.email,
        notion_setup_complete: userData.notion_setup_complete,
        has_notion_token: !!(userData as any).notion_token,
      });
      setUser(userData);
      setLoading(false); // User data loaded successfully, stop loading

      // Check if license check should be skipped (re-evaluate in case env var changed)
      const shouldSkipLicense = process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true' || 
                                 process.env.NODE_ENV === 'development';
      
      console.log('[Dashboard] License check status:', {
        shouldSkipLicense,
        hasEnvVar: !!process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK,
        envVarValue: process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK,
        nodeEnv: process.env.NODE_ENV,
        hasLicenseKey: !!userData.license_key,
      });

      // Check license status if license_key exists and we're not skipping the check
      if (!shouldSkipLicense && userData.license_key) {
        await checkLicenseStatus(userData.license_key);
      } else if (shouldSkipLicense) {
        // If skipping license check, set it to active
        setLicenseActive(true);
        console.log('[Dashboard] License check skipped (development/test mode) - licenseActive set to true');
      } else if (!userData.license_key) {
        // No license key and not skipping - keep licenseActive as false
        console.log('[Dashboard] No license key and not skipping check - licenseActive remains false');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // If it's a 404 and we're coming from OAuth, show a helpful message and retry
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
        if (retryCount < 2) {
          console.log('[Dashboard] User not found - might be a race condition, will retry...');
          setError('Setting up your account...');
          // Don't set loading to false, let it retry
          setTimeout(() => {
            fetchUserData(retryCount + 1);
          }, 2000);
          return;
        } else {
          setError('Account setup is taking longer than expected. Please refresh the page.');
          setLoading(false); // Give up retrying
        }
      } else {
        setError('Failed to load your account. Please try refreshing the page.');
        setLoading(false); // Stop loading on error
      }
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
    // Redirect to instructions page
    // Users can follow the instructions to link their Alexa account
    router.push('/alexa/link');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-gray-600 mb-2">
              {error ? error : 'Loading...'}
            </div>
            {error && (
              <button
                onClick={() => {
                  setError(null);
                  fetchUserData(0);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              {error || 'Failed to load your account'}
            </div>
            <Button onClick={() => fetchUserData(0)}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Voice Planner</h1>
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
                licenseActive && (user.has_jwt_token || !skipLicenseCheck)
                  ? 'complete'
                  : user.license_key && !licenseActive
                  ? 'current'
                  : !user.license_key || (skipLicenseCheck && !user.has_jwt_token)
                  ? 'current'
                  : 'pending'
              }
            >
              {(() => {
                // Show button if:
                // 1. License is not active, OR
                // 2. In test mode and JWT token doesn't exist yet
                const shouldShowButton = !licenseActive || (skipLicenseCheck && !user.has_jwt_token);
                
                if (shouldShowButton) {
                  return (
                    <Button onClick={handleBuyLicense}>
                      Buy License
                    </Button>
                  );
                }
                
                if (licenseActive && user.has_jwt_token) {
                  return (
                    <p className="text-sm text-green-600 font-medium">✓ License activated</p>
                  );
                }
                
                return null;
              })()}
            </Step>

            {/* Step 4 - Link Alexa */}
            <Step
              number={4}
              title="Link Alexa"
              description="Connect your Alexa device to start using voice commands"
              status={
                user.amazon_account_id
                  ? 'complete'
                  : (!!user.notion_token || skipLicenseCheck) && (licenseActive || skipLicenseCheck)
                  ? 'current'
                  : 'pending'
              }
            >
              {(() => {
                const skipLicenseCheck = process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true' || 
                                         process.env.NODE_ENV === 'development';
                // Enable if Notion is connected AND JWT token exists (or in test mode)
                const hasNotionConnection = !!user.notion_token;
                const hasJwtToken = user.has_jwt_token || skipLicenseCheck;
                const canLink = hasNotionConnection && hasJwtToken && !user.amazon_account_id;
                
                console.log('[Dashboard] Alexa link button check:', {
                  hasNotionConnection,
                  hasJwtToken,
                  notionSetupComplete: user.notion_setup_complete,
                  licenseActive,
                  skipLicenseCheck,
                  canLink,
                  hasAmazonAccount: !!user.amazon_account_id,
                });
                
                if (canLink) {
                  return (
                    <Button onClick={handleLinkAlexa}>
                      Link Alexa
                    </Button>
                  );
                }
                
                if (user.amazon_account_id) {
                  return (
                    <p className="text-sm text-green-600 font-medium">✓ Alexa account linked</p>
                  );
                }
                
                if (!hasNotionConnection) {
                  return (
                    <p className="text-sm text-gray-500">
                      Connect Notion first to enable Alexa linking
                    </p>
                  );
                }
                
                if (!hasJwtToken && !skipLicenseCheck) {
                  return (
                    <p className="text-sm text-gray-500">
                      Complete license purchase to enable Alexa linking
                    </p>
                  );
                }
                
                return null;
              })()}
            </Step>
          </div>
        </Card>
      </main>
    </div>
  );
}
