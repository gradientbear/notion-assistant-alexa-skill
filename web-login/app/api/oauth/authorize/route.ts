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
    const responseType = searchParams.get('response_type');
    const clientId = searchParams.get('client_id');
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

    if (!clientId || clientId !== process.env.ALEXA_OAUTH_CLIENT_ID) {
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
    const supabase = createServerClient();
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') || 
                        request.cookies.get('sb-access-token')?.value;

    if (!sessionToken) {
      // Redirect to login page with return URL
      const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Get user from Supabase Auth
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(sessionToken);
    
    if (authError || !authUser) {
      const loginUrl = new URL('/?redirect=' + encodeURIComponent(request.url), request.url);
      return NextResponse.redirect(loginUrl);
    }

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

