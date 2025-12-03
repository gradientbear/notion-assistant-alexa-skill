import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateAuthorizationCode, storeAuthCode, validateRedirectUri } from '@/lib/oauth';

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
    // Try to get session token from cookies (Supabase sets cookies with pattern: sb-<project-ref>-auth-token)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'default'
    const cookieName = `sb-${projectRef}-auth-token`
    
    const authHeader = request.headers.get('authorization');
    let sessionToken = authHeader?.replace('Bearer ', '');
    
    // Try to get from various cookie formats
    if (!sessionToken) {
      sessionToken = request.cookies.get('sb-access-token')?.value ||
                    request.cookies.get(cookieName)?.value ||
                    request.cookies.get(`sb-${projectRef}-auth-token`)?.value;
    }

    console.log('[OAuth Authorize] Session check:', {
      hasAuthHeader: !!authHeader,
      hasAccessTokenCookie: !!request.cookies.get('sb-access-token')?.value,
      hasProjectCookie: !!request.cookies.get(cookieName)?.value,
      cookieName,
      hasSessionToken: !!sessionToken,
    });

    if (!sessionToken) {
      // Redirect to login page with return URL
      console.log('[OAuth Authorize] No session token found, redirecting to login');
      const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Use anon key to validate user session (not service role)
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey || !supabaseUrl) {
      console.error('[OAuth Authorize] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

    // Get user from Supabase Auth
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(sessionToken);
    
    if (authError || !authUser) {
      console.log('[OAuth Authorize] Invalid session token, redirecting to login:', authError?.message);
      const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
      return NextResponse.redirect(loginUrl);
    }

    console.log('[OAuth Authorize] User authenticated:', authUser.id, authUser.email);
    
    // Now use service role for database operations
    const supabase = createServerClient();

    // Get user record from custom users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();

    if (userError || !user) {
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
      // Validate license is active
      if (user.license_key) {
        const { data: license, error: licenseError } = await supabase
          .from('licenses')
          .select('status')
          .eq('license_key', user.license_key)
          .single();

        if (licenseError || !license || license.status !== 'active') {
          // Show friendly error page
          const errorUrl = new URL('/error', request.url);
          errorUrl.searchParams.set('message', 'Your license is not active. Please purchase or activate a license to link your Alexa account.');
          errorUrl.searchParams.set('action', 'purchase');
          return NextResponse.redirect(errorUrl);
        }
      } else {
        // No license key - show purchase page
        const errorUrl = new URL('/error', request.url);
        errorUrl.searchParams.set('message', 'Please purchase a license to link your Alexa account.');
        errorUrl.searchParams.set('action', 'purchase');
        return NextResponse.redirect(errorUrl);
      }
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

