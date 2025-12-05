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
  // License status is determined by has_jwt_token from API (checks opaque tokens)
  const [licenseActive, setLicenseActive] = useState(skipLicenseCheck); // Default to true if skipping
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
      console.log('[Dashboard] Stored website access token');
    }
    
    if (refreshToken) {
      // Refresh token is also stored in HTTP-only cookie by auth callback
      // But we can also store it in localStorage as backup (less secure but works)
      localStorage.setItem('website_refresh_token', refreshToken);
      console.log('[Dashboard] Stored website refresh token');
    }
    
    if (notionConnected || tokenGenerated || accessToken) {
      console.log('[Dashboard] 🔄 Detected state change, refreshing user data...', {
        notionConnected,
        tokenGenerated,
        hasAccessToken: !!accessToken,
        timestamp: new Date().toISOString(),
      });
      // Remove the query parameters first
      window.history.replaceState({}, '', '/dashboard');
      
      // Refresh user data to show updated status
      // Increased delays to handle Supabase replication lag
      // For Notion connection: OAuth callback already waited 2 seconds, so wait 3 more seconds here (total 5 seconds)
      // For token generation: wait 4 seconds total
      const delay = notionConnected ? 3000 : (tokenGenerated ? 4000 : 500);
      console.log('[Dashboard] ⏳ Waiting', delay, 'ms before refreshing user data (handling replication lag)...');
      
      setTimeout(() => {
        console.log('[Dashboard] 🔄 First refresh attempt...');
        fetchUserData();
        // Also refresh again after another delay to ensure data is updated
        if (notionConnected || tokenGenerated) {
          setTimeout(() => {
            console.log('[Dashboard] 🔄 Second refresh attempt...');
            fetchUserData();
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
        return;
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
        notion_token_length: (userData as any).notion_token?.length || 0,
        notion_token_preview: (userData as any).notion_token ? (userData as any).notion_token.substring(0, 10) + '...' : 'NULL',
        has_jwt_token: (userData as any).has_jwt_token,
        license_key: userData.license_key,
        amazon_account_id: userData.amazon_account_id,
      });
      
      // Log the full response to see what's actually being returned
      console.log('[Dashboard] Full API response:', JSON.stringify(userData, null, 2));
      
      // Validate critical fields
      const hasValidNotion = userData.notion_setup_complete && !!(userData as any).notion_token;
      const hasValidLicense = !!(userData as any).has_jwt_token;
      
      console.log('[Dashboard] Validation check:', {
        hasValidNotion,
        hasValidLicense,
        notion_setup_complete: userData.notion_setup_complete,
        notion_token_exists: !!(userData as any).notion_token,
        has_jwt_token: (userData as any).has_jwt_token,
      });
      
      // Warn if user says Notion is connected but API shows it's not
      // This indicates duplicate user records issue
      if (!hasValidNotion && userData.notion_setup_complete === false && !!(userData as any).notion_token === false) {
        console.warn('[Dashboard] ⚠️ Notion appears disconnected, but user may have connected it to a different user record.');
        console.warn('[Dashboard] ⚠️ Solution: Reconnect Notion to update the correct user record.');
      }
      
      setUser(userData);
      setLoading(false); // User data loaded successfully, stop loading

      // License status is determined by has_jwt_token (which checks for opaque tokens in oauth_access_tokens table)
      // This is set by /api/users/me endpoint which checks for active opaque tokens
      const shouldSkipLicense = process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true' || 
                                 process.env.NODE_ENV === 'development';
      
      // Set license active based on has_jwt_token (opaque token exists) or test mode
      const isLicenseActive = !!(userData as any).has_jwt_token || shouldSkipLicense;
      setLicenseActive(isLicenseActive);
      
      console.log('[Dashboard] License status:', {
        has_jwt_token: !!(userData as any).has_jwt_token,
        shouldSkipLicense,
        isLicenseActive,
        note: 'has_jwt_token checks for active opaque tokens in oauth_access_tokens table',
      });
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
              status={(user.notion_setup_complete && !!(user as any).notion_token) ? 'complete' : 'current'}
            >
              {(user.notion_setup_complete && !!(user as any).notion_token) ? (
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
              description="Connect your Alexa device to start using voice commands"
              status={
                user.amazon_account_id
                  ? 'complete'
                  : ((user.notion_setup_complete && !!(user as any).notion_token) && user.has_jwt_token) || skipLicenseCheck
                  ? 'current'
                  : 'pending'
              }
            >
              {(() => {
                const skipLicenseCheck = process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true' || 
                                         process.env.NODE_ENV === 'development';
                // Check if Notion is connected - require BOTH notion_setup_complete AND notion_token
                // This ensures Notion is actually connected, not just marked as complete
                const hasNotionConnection = user.notion_setup_complete && !!(user as any).notion_token;
                const hasJwtToken = user.has_jwt_token || skipLicenseCheck;
                const canLink = hasNotionConnection && hasJwtToken && !user.amazon_account_id;
                
                console.log('[Dashboard] Alexa link button check:', {
                  hasNotionToken: !!user.notion_token,
                  notionTokenValue: user.notion_token ? 'EXISTS' : 'NULL',
                  notionSetupComplete: user.notion_setup_complete,
                  hasNotionConnection,
                  hasJwtToken,
                  userHasJwtToken: user.has_jwt_token,
                  skipLicenseCheck,
                  canLink,
                  hasAmazonAccount: !!user.amazon_account_id,
                  userObject: {
                    id: user.id,
                    email: user.email,
                    notion_setup_complete: user.notion_setup_complete,
                    has_jwt_token: user.has_jwt_token,
                    amazon_account_id: user.amazon_account_id,
                  }
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
                        Complete license purchase to enable Alexa linking
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
