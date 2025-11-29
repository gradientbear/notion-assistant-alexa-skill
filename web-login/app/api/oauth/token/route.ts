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
    // Parse request body (form-encoded or JSON)
    let body: any;
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      body = await request.json();
    }

    const grantType = body.grant_type;
    const clientId = body.client_id;
    const clientSecret = body.client_secret;

    // Validate client credentials
    if (clientId !== process.env.ALEXA_OAUTH_CLIENT_ID) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client_id' },
        { status: 401 }
      );
    }

    if (clientSecret !== process.env.ALEXA_OAUTH_CLIENT_SECRET) {
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

