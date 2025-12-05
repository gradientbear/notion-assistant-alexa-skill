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

      // Check for active license
      let hasActiveLicense = false;
      if (user.license_key) {
        const { data: license, error: licenseError } = await supabase
          .from('licenses')
          .select('status')
          .eq('stripe_payment_intent_id', user.license_key)
          .maybeSingle();

        if (!licenseError && license && license.status === 'active') {
          hasActiveLicense = true;
        }
      }

      if (!hasActiveToken || !hasActiveLicense) {
        console.warn('[OAuth Authorize] License check failed:', {
          hasActiveToken,
          hasActiveLicense,
          user_id: user.id,
        });
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
