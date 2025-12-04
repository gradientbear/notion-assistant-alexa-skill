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
    
    // Log the full request for debugging
    console.log('[OAuth Authorize] Full request:', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      searchParams: Object.fromEntries(searchParams.entries()),
    });
    
    // ADD THIS - Log immediately after to ensure we get here
    console.log('[OAuth Authorize] Processing request, checking parameters...');
    
    const responseType = searchParams.get('response_type');
    const clientId = searchParams.get('client_id')?.trim(); // Trim whitespace
    const redirectUri = searchParams.get('redirect_uri');
    const scope = searchParams.get('scope') || 'alexa';
    const state = searchParams.get('state');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256';

    // Validate required parameters
    if (responseType !== 'code') {
      return NextResponse.json(
        { error: 'unsupported_response_type', error_description: 'Only "code" response type is supported' },
        { status: 400 }
      );
    }

    // Log for debugging (don't log actual secrets in production)
    const expectedClientId = process.env.ALEXA_OAUTH_CLIENT_ID?.trim(); // Trim whitespace
    console.log('[OAuth Authorize] Client ID validation:', {
      received: clientId ? `${clientId.substring(0, 8)}...` : 'missing',
      receivedLength: clientId?.length || 0,
      expected: expectedClientId ? `${expectedClientId.substring(0, 8)}...` : 'missing',
      expectedLength: expectedClientId?.length || 0,
      match: clientId === expectedClientId,
      hasEnvVar: !!expectedClientId,
      // Log first and last chars to detect encoding issues
      receivedFirstChar: clientId?.[0],
      receivedLastChar: clientId?.[clientId.length - 1],
      expectedFirstChar: expectedClientId?.[0],
      expectedLastChar: expectedClientId?.[expectedClientId.length - 1],
    });

    if (!clientId) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Missing client_id parameter' },
        { status: 400 }
      );
    }

    if (!expectedClientId) {
      console.error('[OAuth Authorize] ALEXA_OAUTH_CLIENT_ID environment variable is not set');
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (clientId !== expectedClientId) {
      console.error('[OAuth Authorize] Client ID mismatch:', {
        received: clientId,
        expected: expectedClientId
      });
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

    // Check for authenticated session
    // Try website JWT first, then fall back to Supabase session token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'default'
    const cookieName = `sb-${projectRef}-auth-token`
    
    const authHeader = request.headers.get('authorization');
    // Also check for session token in query parameter (from login page redirect)
    const sessionTokenFromQuery = searchParams.get('_session_token');
    let sessionToken = authHeader?.replace('Bearer ', '') || 
                     sessionTokenFromQuery ||
                     request.cookies.get('sb-access-token')?.value ||
                     request.cookies.get(cookieName)?.value;

    // Log all cookies for debugging
    const allCookies = request.cookies.getAll();
    console.log('[OAuth Authorize] Session check:', {
      hasAuthHeader: !!authHeader,
      hasSessionTokenFromQuery: !!sessionTokenFromQuery,
      hasAccessTokenCookie: !!request.cookies.get('sb-access-token')?.value,
      hasProjectCookie: !!request.cookies.get(cookieName)?.value,
      cookieName,
      hasSessionToken: !!sessionToken,
      tokenSource: sessionTokenFromQuery ? 'query_param' : (authHeader ? 'header' : (request.cookies.get('sb-access-token')?.value ? 'cookie_sb-access-token' : (request.cookies.get(cookieName)?.value ? `cookie_${cookieName}` : 'none'))),
      allCookieNames: allCookies.map(c => c.name),
      cookieCount: allCookies.length,
      // Try to find any Supabase-related cookies
      supabaseCookies: allCookies.filter(c => c.name.includes('sb-') || c.name.includes('supabase')).map(c => c.name),
    });

    if (!sessionToken) {
      // Redirect to login page with return URL
      console.log('[OAuth Authorize] No session token found, redirecting to login');
      console.log('[OAuth Authorize] Redirect URL will be:', request.url);
      const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
      console.log('[OAuth Authorize] Login URL:', loginUrl.toString());
      return NextResponse.redirect(loginUrl);
    }

    // Try to verify as website JWT first (new approach)
    const websiteTokenPayload = verifyWebsiteToken(sessionToken);
    let authUserId: string | null = null;
    let userEmail: string | null = null;

    if (websiteTokenPayload) {
      // Website JWT token - extract user ID from payload
      authUserId = websiteTokenPayload.sub;
      userEmail = websiteTokenPayload.email;
      console.log('[OAuth Authorize] Authenticated via website JWT:', authUserId);
    } else {
      // Fall back to Supabase session token (backward compatibility)
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseAnonKey || !supabaseUrl) {
        console.error('[OAuth Authorize] Missing Supabase environment variables');
        return NextResponse.json(
          { error: 'server_error', error_description: 'Server configuration error' },
          { status: 500 }
        );
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

      // Get user from Supabase Auth
      const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(sessionToken);
      
      if (authError || !authUser) {
        console.log('[OAuth Authorize] Invalid session token, redirecting to login:', authError?.message);
        const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
        return NextResponse.redirect(loginUrl);
      }

      authUserId = authUser.id;
      userEmail = authUser.email || null;
      console.log('[OAuth Authorize] Authenticated via Supabase session token:', authUserId);
    }

    if (!authUserId) {
      console.log('[OAuth Authorize] No auth user ID found, redirecting to login');
      const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
      return NextResponse.redirect(loginUrl);
    }
    
    // Now use service role for database operations
    const supabase = createServerClient();

    // Get user record from custom users table
    // Use .select() instead of .single() to handle duplicate auth_user_id cases
    let { data: usersByAuthId, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId);
    
    let user: any = null;
    
    // Handle multiple users with same auth_user_id (same logic as /api/users/me)
    if (usersByAuthId && usersByAuthId.length > 0) {
      // If multiple users found, prefer:
      // 1. User with Notion token (most complete)
      // 2. Most recently updated
      const userWithToken = usersByAuthId.find(u => !!(u as any).notion_token);
      if (userWithToken) {
        user = userWithToken;
        console.log('[OAuth Authorize] Selected user with Notion token:', user.id);
      } else {
        user = usersByAuthId.sort((a, b) => 
          new Date(b.updated_at || b.created_at).getTime() - 
          new Date(a.updated_at || a.created_at).getTime()
        )[0];
        console.log('[OAuth Authorize] Selected most recently updated user:', user.id);
      }
      
      if (usersByAuthId.length > 1) {
        console.warn('[OAuth Authorize] ⚠️ Multiple users found with same auth_user_id!', {
          total_users: usersByAuthId.length,
          selected_user_id: user.id,
        });
      }
      
      userError = null; // Clear error since we found users
    }

    if (userError || !user) {
      console.error('[OAuth Authorize] User not found:', {
        auth_user_id: authUserId,
        error: userError,
        usersFound: usersByAuthId?.length || 0,
      });
      return NextResponse.json(
        { error: 'server_error', error_description: 'User not found' },
        { status: 500 }
      );
    }

    // Skip license check in development/test mode
    const skipLicenseCheck = process.env.SKIP_LICENSE_CHECK === 'true' || 
                             process.env.NODE_ENV === 'development';
    
    if (skipLicenseCheck) {
      console.log('[OAuth Authorize] License check skipped (development/test mode)');
    } else {
      // Check for active opaque token (from Stripe payment webhook)
      const { data: activeToken, error: tokenError } = await supabase
        .from('oauth_access_tokens')
        .select('token, expires_at, revoked')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (tokenError) {
        console.error('[OAuth Authorize] Error checking for opaque token:', tokenError);
      }

      const hasActiveToken = !!activeToken;

      // Check for active license using stripe_payment_intent_id (stored in user.license_key)
      let hasActiveLicense = false;
      if (user.license_key) {
        // license_key now contains stripe_payment_intent_id
        const { data: license, error: licenseError } = await supabase
          .from('licenses')
          .select('status')
          .eq('stripe_payment_intent_id', user.license_key)
          .maybeSingle();

        if (!licenseError && license && license.status === 'active') {
          hasActiveLicense = true;
        }
      }

      // Require both active opaque token AND active license
      if (!hasActiveToken || !hasActiveLicense) {
        const errorUrl = new URL('/error', request.url);
        if (!hasActiveLicense) {
          errorUrl.searchParams.set('message', 'Please purchase a license to link your Alexa account.');
          errorUrl.searchParams.set('action', 'purchase');
        } else {
          errorUrl.searchParams.set('message', 'Please complete your license purchase to link your Alexa account.');
          errorUrl.searchParams.set('action', 'purchase');
        }
        return NextResponse.redirect(errorUrl);
      }

      console.log('[OAuth Authorize] License validation passed:', {
        hasActiveToken,
        hasActiveLicense,
      });
    }

    // Validate Notion is connected
    if (!user.notion_setup_complete || !user.notion_token) {
      const errorUrl = new URL('/error', request.url);
      errorUrl.searchParams.set('message', 'Please connect your Notion account first. Go to onboarding and complete the Notion connection step.');
      errorUrl.searchParams.set('action', 'notion');
      return NextResponse.redirect(errorUrl);
    }

    // Generate authorization code
    const authCode = generateAuthorizationCode();

    // Store authorization code
    await storeAuthCode(
      authCode,
      user.id,
      clientId,
      redirectUri,
      scope,
      codeChallenge || undefined,
      codeChallengeMethod !== 'S256' ? undefined : codeChallengeMethod
    );

    // Build redirect URL with code
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', authCode);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    // Note: _session_token is not included in the redirect to Alexa (it was only for internal use)

    console.log('[OAuth Authorize] Issued code for user:', user.id, 'redirect:', redirectUri);

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error('[OAuth Authorize] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

