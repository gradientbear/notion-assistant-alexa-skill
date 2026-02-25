import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateAuthorizationCode, storeAuthCode, validateRedirectUri } from '@/lib/oauth';
import { verifyWebsiteToken } from '@/lib/jwt';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * OAuth2 Authorization Endpoint
 * GET /api/oauth/authorize
 * 
 * Query parameters:
 * - response_type: must be "code"
 * - client_id: Alexa OAuth client ID
 * - redirect_uri: Alexa redirect URI
 * - scope: requested scope (default: "alexa")
 * - state: optional state parameter
 * - code_challenge: optional PKCE code challenge
 * - code_challenge_method: optional PKCE method (default: "S256")
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    console.log('[OAuth Authorize] Request received:', {
      url: request.url,
      method: request.method,
      searchParams: Object.fromEntries(searchParams.entries()),
    });
    
    // Validate required parameters
    const responseType = searchParams.get('response_type');
    const clientId = searchParams.get('client_id')?.trim();
    const redirectUri = searchParams.get('redirect_uri');
    const scope = searchParams.get('scope') || 'alexa';
    const state = searchParams.get('state');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256';

    if (responseType !== 'code') {
      return NextResponse.json(
        { error: 'unsupported_response_type', error_description: 'Only "code" response type is supported' },
        { status: 400 }
      );
    }

    const expectedClientId = process.env.ALEXA_OAUTH_CLIENT_ID?.trim();
    if (!clientId || !expectedClientId || clientId !== expectedClientId) {
      console.error('[OAuth Authorize] Invalid client_id');
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client_id' },
        { status: 400 }
      );
    }

    if (!redirectUri || !validateRedirectUri(redirectUri)) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Invalid or not allowed redirect_uri' },
        { status: 400 }
      );
    }

    // ============================================================================
    // STEP 1: Authenticate user via Supabase session token ONLY
    // ============================================================================
    console.log('[OAuth Authorize] Step 1: Authenticating user...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[OAuth Authorize] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get session token from query parameter (from login page redirect) or Authorization header
    const sessionTokenFromQuery = searchParams.get('_session_token');
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') || sessionTokenFromQuery;

    if (!sessionToken) {
      console.log('[OAuth Authorize] No session token found, redirecting to login');
      const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Try website JWT first, then fall back to Supabase session token
    let authUserId: string | null = null;
    let userEmail: string | null = null;

    const websiteTokenPayload = verifyWebsiteToken(sessionToken);
    if (websiteTokenPayload) {
      authUserId = websiteTokenPayload.sub;
      userEmail = websiteTokenPayload.email;
      console.log('[OAuth Authorize] Authenticated via website JWT:', { auth_user_id: authUserId });
    } else {
      // Use Supabase Auth to verify session token
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(sessionToken);
      
      if (authError || !authUser) {
        console.log('[OAuth Authorize] Invalid session token, redirecting to login:', authError?.message);
        const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
        return NextResponse.redirect(loginUrl);
      }

      authUserId = authUser.id;
      userEmail = authUser.email || null;
      console.log('[OAuth Authorize] Authenticated via Supabase session token:', { auth_user_id: authUserId });
    }

    if (!authUserId) {
      console.log('[OAuth Authorize] No auth_user_id found, redirecting to login');
      const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
      return NextResponse.redirect(loginUrl);
    }

    // ============================================================================
    // STEP 2: Get user from database and VALIDATE it exists
    // ============================================================================
    console.log('[OAuth Authorize] Step 2: Looking up user in database...');
    
    const supabase = createServerClient();
    
    // Query users table by id (which matches Supabase Auth user id)
    const { data: user, error: userQueryError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .single();

    if (userQueryError || !user) {
      console.error('[OAuth Authorize] User not found in database:', {
        id: authUserId,
        email: userEmail,
        error: userQueryError,
      });
      return NextResponse.json(
        { 
          error: 'user_not_found', 
          error_description: 'User account does not exist. Please sign in again.' 
        },
        { status: 400 }
      );
    }

    console.log('[OAuth Authorize] User found:', { user_id: user.id });
    console.log('[OAuth Authorize] User validated successfully:', {
      user_id: user.id,
      email: user.email,
      has_notion_token: !!user.notion_token,
      notion_setup_complete: user.notion_setup_complete,
    });

    // ============================================================================
    // STEP 4: Check license status
    // ============================================================================
    console.log('[OAuth Authorize] Step 4: Checking license status...');
    
    const skipLicenseCheck = process.env.SKIP_LICENSE_CHECK === 'true' || 
                             process.env.NEXT_PUBLIC_SKIP_LICENSE_CHECK === 'true' ||
                             process.env.NODE_ENV === 'development';
    
    if (!skipLicenseCheck) {
      // Check for active license
      // Note: We only check for active license, not opaque token, because:
      // 1. Opaque tokens are created by Stripe webhook (non-critical, may fail)
      // 2. Opaque tokens will be created during OAuth token exchange anyway
      // 3. The license is the source of truth for payment verification
      let hasActiveLicense = false;
      
      console.log('[OAuth Authorize] Checking license:', {
        user_id: user.id,
        license_key: user.license_key,
        has_license_key: !!user.license_key,
      });
      
      if (user.license_key) {
        // Normalize license_key (trim whitespace, handle null/empty)
        const normalizedLicenseKey = (user.license_key || '').trim();
        
        if (!normalizedLicenseKey) {
          console.warn('[OAuth Authorize] User license_key is empty or whitespace');
        } else {
          // Retry logic with exponential backoff for license lookup
          let license: any = null;
          let licenseError: any = null;
          const maxRetries = 3;
          const baseDelay = 100; // 100ms
          
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            const { data: licenseData, error: errorData } = await supabase
              .from('licenses')
              .select('status, stripe_payment_intent_id')
              .eq('stripe_payment_intent_id', normalizedLicenseKey)
              .maybeSingle();

            if (!errorData) {
              license = licenseData;
              licenseError = null;
              break; // Success, exit retry loop
            }

            // Don't retry on certain errors (not found, validation errors)
            if (errorData?.code === 'PGRST116' || errorData?.code === '23505') {
              licenseError = errorData;
              break; // Don't retry on these errors
            }

            // Don't retry on last attempt
            if (attempt === maxRetries - 1) {
              licenseError = errorData;
              break;
            }

            // Exponential backoff: 100ms, 200ms, 400ms
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`[OAuth Authorize] License lookup attempt ${attempt + 1} failed, retrying in ${delay}ms:`, {
              error: errorData?.message || errorData,
              attempt: attempt + 1,
              maxRetries,
            });
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          console.log('[OAuth Authorize] License query result:', {
            found: !!license,
            license_status: license?.status,
            license_payment_intent_id: license?.stripe_payment_intent_id,
            query_payment_intent_id: normalizedLicenseKey,
            original_license_key: user.license_key,
            error: licenseError?.code,
            error_message: licenseError?.message,
          });

          if (licenseError) {
            console.error('[OAuth Authorize] Error checking license:', {
              code: licenseError.code,
              message: licenseError.message,
              details: licenseError.details,
              hint: licenseError.hint,
            });
          } else if (license) {
            if (license.status === 'active') {
              hasActiveLicense = true;
              console.log('[OAuth Authorize] ✅ Active license found');
            } else {
              console.warn('[OAuth Authorize] License found but not active:', {
                status: license.status,
                payment_intent_id: license.stripe_payment_intent_id,
              });
            }
          } else {
            console.warn('[OAuth Authorize] No license found for payment intent:', {
              payment_intent_id: normalizedLicenseKey,
              user_id: user.id,
            });
          }
        }
      } else {
        console.warn('[OAuth Authorize] User has no license_key set - trying to find license...', {
          user_id: user.id,
          user_updated_at: user.updated_at,
          user_created_at: user.created_at,
        });
        
        // Fallback: If license_key is empty but user has a license, try to find it
        // This handles the case where Stripe webhook created the license but failed to update user.license_key
        
        // Strategy 1: Try to find active licenses created within a time window of user's last update
        const userUpdatedAt = new Date(user.updated_at);
        const oneDayAgo = new Date(userUpdatedAt.getTime() - 24 * 60 * 60 * 1000); // 24 hours window
        const oneDayLater = new Date(userUpdatedAt.getTime() + 24 * 60 * 60 * 1000);
        
        console.log('[OAuth Authorize] Searching for licenses in time window:', {
          from: oneDayAgo.toISOString(),
          to: oneDayLater.toISOString(),
          user_updated_at: user.updated_at,
        });
        
        let matchingLicenses: any[] = [];
        let matchingLicensesError: any = null;
        
        const { data: timeWindowLicenses, error: timeWindowError } = await supabase
          .from('licenses')
          .select('stripe_payment_intent_id, status, created_at, updated_at')
          .eq('status', 'active')
          .gte('created_at', oneDayAgo.toISOString())
          .lte('created_at', oneDayLater.toISOString())
          .order('created_at', { ascending: false });
        
        if (timeWindowError) {
          console.error('[OAuth Authorize] Error searching licenses by time window:', timeWindowError);
          matchingLicensesError = timeWindowError;
        } else {
          matchingLicenses = timeWindowLicenses || [];
          console.log('[OAuth Authorize] Found licenses in time window:', {
            count: matchingLicenses.length,
            licenses: matchingLicenses.map(l => ({
              payment_intent_id: l.stripe_payment_intent_id,
              created_at: l.created_at,
            })),
          });
        }
        
        // Strategy 2: Try to find license by matching Stripe customer_id with user's email
        // This is safer than checking "all recent licenses" which could assign wrong license
        if (matchingLicenses.length === 0 && !matchingLicensesError && user.email) {
          console.log('[OAuth Authorize] No licenses in time window, trying to find by Stripe customer...');
          
          // Note: We can't directly match by customer email since licenses table doesn't store it
          // Instead, we'll only use the time window approach to avoid assigning wrong licenses
          // If no license found in time window, the user needs to contact support
          console.warn('[OAuth Authorize] No license found in time window - user may need to contact support or retry webhook processing');
        }
        
        if (matchingLicenses.length > 0) {
          // If there's exactly one license, use it
          // If multiple, pick the one closest to user's update time
          let bestMatch = matchingLicenses[0];
          if (matchingLicenses.length > 1) {
            // Find license with timestamp closest to user's update
            let minTimeDiff = Infinity;
            for (const license of matchingLicenses) {
              const licenseTime = new Date(license.created_at);
              const timeDiff = Math.abs(userUpdatedAt.getTime() - licenseTime.getTime());
              if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                bestMatch = license;
              }
            }
            console.log('[OAuth Authorize] Multiple licenses found, selected closest match:', {
              selected: bestMatch.stripe_payment_intent_id,
              time_diff_minutes: Math.round(minTimeDiff / 60000),
            });
          }
          
          console.log('[OAuth Authorize] Attempting to link license to user:', {
            payment_intent_id: bestMatch.stripe_payment_intent_id,
            user_id: user.id,
            license_created_at: bestMatch.created_at,
            user_updated_at: user.updated_at,
            time_diff_minutes: Math.round(Math.abs(userUpdatedAt.getTime() - new Date(bestMatch.created_at).getTime()) / 60000),
          });
          
          // Update user's license_key to match this license
          const { error: updateError } = await supabase
            .from('users')
            .update({ license_key: bestMatch.stripe_payment_intent_id })
            .eq('id', user.id);
          
          if (!updateError) {
            console.log('[OAuth Authorize] ✅ Updated user license_key and found active license');
            hasActiveLicense = true;
            // Update local user object for consistency
            user.license_key = bestMatch.stripe_payment_intent_id;
          } else {
            console.error('[OAuth Authorize] Failed to update user license_key:', {
              error: updateError,
              code: updateError.code,
              message: updateError.message,
            });
          }
        } else {
          console.warn('[OAuth Authorize] No matching licenses found for user', {
            user_id: user.id,
            searched_time_window: '24 hours',
            also_checked_recent: true,
          });
        }
      }

      if (!hasActiveLicense) {
        console.warn('[OAuth Authorize] License check failed:', {
          hasActiveLicense,
          user_id: user.id,
          license_key: user.license_key,
          email: user.email,
        });
        
        // Provide more specific error message based on the situation
        let errorMessage = 'Please purchase a license to link your Alexa account.';
        if (user.license_key) {
          errorMessage = 'Your license could not be validated. Please contact support or try purchasing again.';
        } else {
          errorMessage = 'No active license found. Please purchase a license to link your Alexa account.';
        }
        
        const errorUrl = new URL('/error', request.url);
        errorUrl.searchParams.set('message', errorMessage);
        errorUrl.searchParams.set('action', 'purchase');
        errorUrl.searchParams.set('user_id', user.id);
        errorUrl.searchParams.set('has_license_key', user.license_key ? 'true' : 'false');
        return NextResponse.redirect(errorUrl);
      }

      console.log('[OAuth Authorize] License validation passed:', {
        hasActiveLicense,
        user_id: user.id,
        license_key: user.license_key,
      });
    } else {
      console.log('[OAuth Authorize] License check skipped (development/test mode)');
    }

    // ============================================================================
    // STEP 5: Validate Notion is connected
    // ============================================================================
    console.log('[OAuth Authorize] Step 5: Checking Notion connection...');
    
    if (!user.notion_setup_complete || !user.notion_token) {
      console.warn('[OAuth Authorize] Notion not connected:', {
        notion_setup_complete: user.notion_setup_complete,
        has_notion_token: !!user.notion_token,
        user_id: user.id,
      });
      const errorUrl = new URL('/error', request.url);
      errorUrl.searchParams.set('message', 'Please connect your Notion account first. Go to onboarding and complete the Notion connection step.');
      errorUrl.searchParams.set('action', 'notion');
      return NextResponse.redirect(errorUrl);
    }

    console.log('[OAuth Authorize] Notion connection validated');

    // ============================================================================
    // STEP 6: Generate and store authorization code
    // ============================================================================
    console.log('[OAuth Authorize] Step 6: Generating authorization code...');
    
    const authCode = generateAuthorizationCode();

    try {
      await storeAuthCode(
        authCode,
        user.id,
        clientId,
        redirectUri,
        scope,
        codeChallenge || undefined,
        codeChallengeMethod !== 'S256' ? undefined : codeChallengeMethod
      );
      console.log('[OAuth Authorize] Authorization code stored successfully');
    } catch (error: any) {
      console.error('[OAuth Authorize] Failed to store authorization code:', {
        error: error.message,
        user_id: user.id,
      });
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to generate authorization code' },
        { status: 500 }
      );
    }

    // ============================================================================
    // STEP 7: Redirect back to Alexa with authorization code
    // ============================================================================
    console.log('[OAuth Authorize] Step 7: Redirecting to Alexa...');
    
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    console.log('[OAuth Authorize] Account linking successful:', {
      user_id: user.id,
      email: user.email,
      redirect_uri: redirectUri,
    });

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error('[OAuth Authorize] Unexpected error:', {
      error: error,
      error_message: error?.message,
      error_stack: error?.stack,
    });
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
