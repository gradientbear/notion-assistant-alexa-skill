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
  // Only skip if explicitly set to 'true' - don't auto-skip in development
  const skipLicenseCheck = process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true';
  // License status is determined by has_jwt_token from API (checks opaque tokens)
  const [licenseActive, setLicenseActive] = useState(false); // Default to false - require actual payment
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Check if coming back from auth callback with website JWT tokens
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    const notionConnected = urlParams.get('notion_connected') === 'true';
    const tokenGenerated = urlParams.get('token_generated') === 'true';
    
    // Store website JWT tokens if present (from auth callback)
    if (accessToken) {
      localStorage.setItem('website_access_token', accessToken);
    }
    
    if (refreshToken) {
      // Refresh token is also stored in HTTP-only cookie by auth callback
      // But we can also store it in localStorage as backup (less secure but works)
      localStorage.setItem('website_refresh_token', refreshToken);
    }
    
    if (notionConnected || tokenGenerated || accessToken) {
      // Remove the query parameters first
      window.history.replaceState({}, '', '/dashboard');
      
      // Refresh user data to show updated status
      // Increased delays to handle Supabase replication lag
      // For Notion connection: OAuth callback already waited 2 seconds, so wait 3 more seconds here (total 5 seconds)
      // For token generation: wait 4 seconds total
      const delay = notionConnected ? 3000 : (tokenGenerated ? 4000 : 500);
      
      setTimeout(() => {
        fetchUserData().then((res) => { console.log('[Timeout1 Result]', res)});
        // Also refresh again after another delay to ensure data is updated
        if (notionConnected || tokenGenerated) {
          setTimeout(() => {
            fetchUserData().then((res) => { console.log('[Timeout2 Result]', res)});
          }, 3000); // Increased from 2000ms to 3000ms
        }
      }, delay);
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
            auth_user_id: authUser.id, // Parameter name is auth_user_id but API uses it as id
            email: authUser.email,
            provider: authUser.app_metadata?.provider || 'email',
          }),
        });
        
        if (!syncResponse.ok) {
          // User sync failed, will rely on /api/users/me fallback
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
        return null; // Add return value
      }

      // Try to get website JWT token first, fall back to Supabase session
      const websiteAccessToken = localStorage.getItem('website_access_token');
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = websiteAccessToken || session?.access_token;

      if (!authToken) {
        console.error('[Dashboard] No session or website token available');
        if (retryCount < 2) {
          // Wait and retry (session might be establishing)
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchUserData(retryCount + 1);
        }
        router.push('/');
        return null; // Add return value
      }

      // Get user from database with retry logic
      let response: Response | null = null;
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Add cache-busting timestamp and disable all caching
          const timestamp = Date.now();
          response = await fetch(`/api/users/me?_t=${timestamp}`, {
            cache: 'no-store', // Disable Next.js fetch caching
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          });

          if (response.ok) {
            break; // Success, exit retry loop
          }

          // If 404 and we haven't exhausted retries, wait and retry
          if (response.status === 404 && attempt < 2) {
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
      
      // Validate critical fields
      const hasValidNotion = userData.notion_setup_complete && !!(userData as any).notion_token;
      const hasValidLicense = !!(userData as any).has_jwt_token;
      
      setUser(userData);
      setLoading(false); // User data loaded successfully, stop loading

      // License status is determined by has_jwt_token (which checks for opaque tokens in oauth_access_tokens table)
      // This is set by /api/users/me endpoint which checks for active opaque tokens
      const shouldSkipLicense = process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true';
      
      // Set license active based on has_jwt_token (opaque token exists) or explicit test mode
      const isLicenseActive = !!(userData as any).has_jwt_token || shouldSkipLicense;
      setLicenseActive(isLicenseActive);
      
      // Return the user data so it can be used in .then() callbacks
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      // If it's a 404 and we're coming from OAuth, show a helpful message and retry
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
        if (retryCount < 2) {
          setError('Setting up your account...');
          // Don't set loading to false, let it retry
          setTimeout(() => {
            fetchUserData(retryCount + 1);
          }, 2000);
          return null; // Add return value
        } else {
          setError('Account setup is taking longer than expected. Please refresh the page.');
          setLoading(false); // Give up retrying
          return null; // Add return value
        }
      } else {
        setError('Failed to load your account. Please try refreshing the page.');
        setLoading(false); // Stop loading on error
        return null; // Add return value
      }
    }
  };

  // Note: License status is now determined by has_jwt_token from /api/users/me
  // which checks for active opaque tokens in oauth_access_tokens table
  // This function is no longer needed - license status comes from API response

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
              status={(user.notion_setup_complete && !!(user as any).notion_token && (user as any).notion_token !== '' && (user as any).notion_token !== null) ? 'complete' : 'current'}
            >
              {(user.notion_setup_complete && !!(user as any).notion_token && (user as any).notion_token !== '' && (user as any).notion_token !== null) ? (
                <div className="space-y-2">
                  <p className="text-sm text-green-600 font-medium">✓ Notion connected</p>
                  <Button 
                    onClick={handleConnectNotion}
                    variant="outline"
                    className="text-sm"
                  >
                    Reconnect Notion
                  </Button>
                </div>
              ) : (
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
                user.has_jwt_token
                  ? 'complete'
                  : 'current'
              }
            >
              {(() => {
                // Show "Buy License" button ONLY if JWT token doesn't exist
                // JWT token is created when license is purchased, so its existence = purchase completed
                if (!user.has_jwt_token) {
                  return (
                    <Button onClick={handleBuyLicense}>
                      Buy License
                    </Button>
                  );
                }
                
                // JWT token exists = license purchased
                return (
                  <p className="text-sm text-green-600 font-medium">✓ License activated</p>
                );
              })()}
            </Step>

            {/* Step 4 - Link Alexa */}
            <Step
              number={4}
              title="Link Alexa"
              description="Connect your Alexa device to start using voice commands (requires payment verification)"
              status={
                user.amazon_account_id
                  ? 'complete'
                  : ((user.notion_setup_complete && !!(user as any).notion_token && (user as any).notion_token !== '' && (user as any).notion_token !== null) && user.has_jwt_token) || skipLicenseCheck
                  ? 'current'
                  : 'pending'
              }
            >
              {(() => {
                const skipLicenseCheck = process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true';
                // Check if Notion is connected - require BOTH notion_setup_complete AND notion_token
                // Also verify notion_token is not empty string (could be set to empty string)
                const hasNotionConnection = user.notion_setup_complete && 
                                           !!(user as any).notion_token && 
                                           (user as any).notion_token !== '' &&
                                           (user as any).notion_token !== null;
                const hasJwtToken = user.has_jwt_token || skipLicenseCheck;
                const canLink = hasNotionConnection && hasJwtToken && !user.amazon_account_id;
                
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
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">
                        Connect Notion first to enable Alexa linking
                      </p>
                      <Button 
                        onClick={handleConnectNotion}
                        variant="outline"
                        className="text-sm"
                      >
                        Connect Notion
                      </Button>
                    </div>
                  );
                }
                
                if (!hasJwtToken && !skipLicenseCheck) {
                  return (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">
                        Payment verification required. Complete license purchase to enable Alexa linking.
                      </p>
                      <Button 
                        onClick={handleBuyLicense}
                        variant="outline"
                        className="text-sm"
                      >
                        Buy License
                      </Button>
                    </div>
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
