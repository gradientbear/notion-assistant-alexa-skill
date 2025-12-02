import { NextRequest, NextResponse } from 'next/server';
import { validateAuthCode, issueAccessToken } from '@/lib/oauth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * OAuth2 Token Endpoint
 * POST /api/oauth/token
 * 
 * Form data or JSON:
 * - grant_type: "authorization_code" or "refresh_token"
 * - code: authorization code (for authorization_code grant)
 * - redirect_uri: must match the one used in authorize
 * - client_id: Alexa OAuth client ID
 * - client_secret: Alexa OAuth client secret
 * - code_verifier: PKCE code verifier (if used)
 * - refresh_token: refresh token (for refresh_token grant)
 */
export async function POST(request: NextRequest) {
  try {
    // Log the full request for debugging
    console.log('[OAuth Token] Full request:', {
      url: request.url,
      method: request.method,
      contentType: request.headers.get('content-type'),
      headers: Object.fromEntries(request.headers.entries()),
    });
    
    // Parse request body (form-encoded or JSON)
    let body: any;
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
      console.log('[OAuth Token] Parsed form data:', Object.keys(body));
    } else {
      body = await request.json();
      console.log('[OAuth Token] Parsed JSON body:', Object.keys(body));
    }

    const grantType = body.grant_type;
    const clientId = body.client_id?.trim(); // Trim whitespace
    const clientSecret = body.client_secret?.trim(); // Trim whitespace

    // Validate client credentials
    const expectedClientId = process.env.ALEXA_OAUTH_CLIENT_ID?.trim(); // Trim whitespace
    const expectedClientSecret = process.env.ALEXA_OAUTH_CLIENT_SECRET?.trim(); // Trim whitespace

    // Log for debugging (don't log actual secrets in production)
    console.log('[OAuth Token] Client validation:', {
      clientIdReceived: clientId ? `${clientId.substring(0, 8)}...` : 'missing',
      clientIdExpected: expectedClientId ? `${expectedClientId.substring(0, 8)}...` : 'missing',
      clientSecretReceived: clientSecret ? '***' : 'missing',
      clientSecretExpected: expectedClientSecret ? '***' : 'missing',
      clientIdMatch: clientId === expectedClientId,
      hasClientIdEnv: !!expectedClientId,
      hasClientSecretEnv: !!expectedClientSecret
    });

    if (!clientId) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Missing client_id parameter' },
        { status: 401 }
      );
    }

    if (!expectedClientId) {
      console.error('[OAuth Token] ALEXA_OAUTH_CLIENT_ID environment variable is not set');
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (clientId !== expectedClientId) {
      console.error('[OAuth Token] Client ID mismatch');
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client_id' },
        { status: 401 }
      );
    }

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Missing client_secret parameter' },
        { status: 401 }
      );
    }

    if (!expectedClientSecret) {
      console.error('[OAuth Token] ALEXA_OAUTH_CLIENT_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (clientSecret !== expectedClientSecret) {
      console.error('[OAuth Token] Client secret mismatch');
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client_secret' },
        { status: 401 }
      );
    }

    if (grantType === 'authorization_code') {
      // Authorization Code Grant
      const code = body.code;
      const redirectUri = body.redirect_uri;
      const codeVerifier = body.code_verifier;

      if (!code || !redirectUri) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing code or redirect_uri' },
          { status: 400 }
        );
      }

      // Validate and consume authorization code
      const validationResult = await validateAuthCode(code, clientId, redirectUri, codeVerifier);

      if (!validationResult) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
          { status: 400 }
        );
      }

      // Get user info
      const supabase = createServerClient();
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', validationResult.userId)
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { error: 'server_error', error_description: 'User not found' },
          { status: 500 }
        );
      }

      // Issue access token
      const tokenResult = await issueAccessToken(
        user.id,
        clientId,
        validationResult.scope,
        user.tasks_db_id || undefined,
        user.amazon_account_id || undefined
      );

      console.log('[OAuth Token] Issued token for user:', user.id);

      return NextResponse.json({
        access_token: tokenResult.access_token,
        token_type: 'Bearer',
        expires_in: tokenResult.expires_in,
        refresh_token: tokenResult.refresh_token,
        scope: validationResult.scope,
      });
    } else if (grantType === 'refresh_token') {
      // Refresh Token Grant (if enabled)
      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing refresh_token' },
          { status: 400 }
        );
      }

      // TODO: Implement refresh token logic
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Refresh token grant not yet implemented' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: `Grant type "${grantType}" is not supported` },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[OAuth Token] Error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

