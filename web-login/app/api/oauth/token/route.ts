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
    
    console.log('[OAuth Token] ✅ Reached body parsing section');
    
    // Parse request body (form-encoded or JSON)
    let body: any;
    const contentType = request.headers.get('content-type');
    
    console.log('[OAuth Token] Attempting to parse body, content-type:', contentType);
    
    try {
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        console.log('[OAuth Token] Parsing as form-urlencoded...');
        
        // Try formData first (preferred method)
        try {
          const formData = await request.formData();
          body = Object.fromEntries(formData.entries());
          console.log('[OAuth Token] Parsed form data via formData():', Object.keys(body));
        } catch (formDataError: any) {
          console.warn('[OAuth Token] formData() failed, trying text() method:', {
            error: formDataError.message,
            error_name: formDataError.name,
          });
          
          // Fallback: parse manually from text
          const text = await request.text();
          console.log('[OAuth Token] Raw body text length:', text.length);
          
          body = {};
          const params = new URLSearchParams(text);
          for (const [key, value] of params.entries()) {
            body[key] = value;
          }
          console.log('[OAuth Token] Parsed form data via text():', Object.keys(body));
        }
        
        console.log('[OAuth Token] Form data values:', {
          grant_type: body.grant_type,
          has_code: !!body.code,
          has_redirect_uri: !!body.redirect_uri,
          has_client_id: !!body.client_id,
          has_client_secret: !!body.client_secret,
          code_preview: body.code ? body.code.substring(0, 10) + '...' : 'missing',
        });
      } else {
        console.log('[OAuth Token] Parsing as JSON...');
        body = await request.json();
        console.log('[OAuth Token] Parsed JSON body:', Object.keys(body));
      }
    } catch (parseError: any) {
      console.error('[OAuth Token] Error parsing request body:', {
        error: parseError.message,
        error_name: parseError.name,
        contentType,
        error_stack: parseError.stack,
      });
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Failed to parse request body' },
        { status: 400 }
      );
    }
    
    if (!body || Object.keys(body).length === 0) {
      console.error('[OAuth Token] Body is empty or invalid:', { body });
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Empty request body' },
        { status: 400 }
      );
    }

    const grantType = body.grant_type;
    
    // OAuth2 allows client credentials in body OR Basic Auth header
    // Check Basic Auth header first (Amazon sends it this way)
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Basic ')) {
      console.log('[OAuth Token] Found Basic Auth header, extracting credentials...');
      try {
        const base64Credentials = authHeader.substring(6);
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [id, secret] = credentials.split(':');
        clientId = id?.trim();
        clientSecret = secret?.trim();
        console.log('[OAuth Token] Extracted from Basic Auth:', {
          client_id_preview: clientId ? `${clientId.substring(0, 8)}...` : 'missing',
          has_client_secret: !!clientSecret,
        });
      } catch (basicAuthError: any) {
        console.error('[OAuth Token] Error parsing Basic Auth:', {
          error: basicAuthError.message,
        });
      }
    }
    
    // Fallback to body parameters if not in header
    if (!clientId) {
      clientId = body.client_id?.trim();
    }
    if (!clientSecret) {
      clientSecret = body.client_secret?.trim();
    }

    console.log('[OAuth Token] Request body parsed:', {
      grant_type: grantType,
      has_code: !!body.code,
      has_redirect_uri: !!body.redirect_uri,
      has_client_id: !!clientId,
      has_client_secret: !!clientSecret,
      client_id_source: authHeader?.startsWith('Basic ') ? 'Basic Auth header' : 'request body',
      code_preview: body.code ? body.code.substring(0, 10) + '...' : 'missing',
    });

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
      console.log('[OAuth Token] Validating authorization code:', {
        code_preview: code ? code.substring(0, 10) + '...' : 'missing',
        client_id: clientId ? clientId.substring(0, 8) + '...' : 'missing',
        redirect_uri: redirectUri,
        has_code_verifier: !!codeVerifier,
      });

      let validationResult;
      try {
        validationResult = await validateAuthCode(code, clientId, redirectUri, codeVerifier);
      } catch (validationError: any) {
        console.error('[OAuth Token] Authorization code validation error:', {
          error: validationError,
          error_message: validationError?.message,
          error_stack: validationError?.stack,
        });
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
          { status: 400 }
        );
      }

      if (!validationResult) {
        console.error('[OAuth Token] Authorization code validation failed - no result returned');
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
          { status: 400 }
        );
      }

      console.log('[OAuth Token] Authorization code validated successfully:', {
        user_id: validationResult.userId,
        scope: validationResult.scope,
      });

      // Get user info
      const supabase = createServerClient();
      let { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', validationResult.userId)
        .single();

      // If user doesn't exist, create them (user exists in Supabase Auth but not in users table)
      if (userError || !user) {
        console.warn('[OAuth Token] User not found in database, attempting to create:', {
          user_id: validationResult.userId,
          error_code: userError?.code,
          error_message: userError?.message,
        });
        
        // Try to get email from Supabase Auth
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const { createClient } = await import('@supabase/supabase-js');
        const authClient = createClient(supabaseUrl, supabaseAnonKey);
        
        let userEmail = '';
        try {
          // Get user from Supabase Auth (admin API would be better, but we use anon key)
          // Since we can't directly query auth.users, we'll create with empty email
          // The user should have been created via /auth/callback, but if not, create minimal record
          userEmail = ''; // Will be updated later if needed
        } catch (authError: any) {
          console.warn('[OAuth Token] Could not get email from Auth:', authError?.message);
        }
        
        // Create minimal user record
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: validationResult.userId,
            email: userEmail || `user-${validationResult.userId.substring(0, 8)}@placeholder.com`,
            provider: 'email',
            email_verified: false,
            license_key: '',
            notion_setup_complete: false,
            onboarding_complete: false,
          })
          .select()
          .single();
        
        if (createError) {
          // If creation fails (e.g., duplicate), try to fetch again
          if (createError.code === '23505') {
            console.log('[OAuth Token] User already exists (race condition), fetching...');
            const { data: fetchedUser } = await supabase
              .from('users')
              .select('*')
              .eq('id', validationResult.userId)
              .single();
            user = fetchedUser;
          } else {
            console.error('[OAuth Token] Failed to create user:', {
              error_code: createError.code,
              error_message: createError.message,
              user_id: validationResult.userId,
            });
            return NextResponse.json(
              { error: 'server_error', error_description: 'User not found and could not be created' },
              { status: 500 }
            );
          }
        } else {
          user = newUser;
          console.log('[OAuth Token] Created user record:', {
            user_id: user.id,
            email: user.email,
          });
        }
      }
      
      if (!user) {
        console.error('[OAuth Token] User still not found after creation attempt:', {
          user_id: validationResult.userId,
        });
        return NextResponse.json(
          { error: 'server_error', error_description: 'User not found' },
          { status: 500 }
        );
      }

      // Issue access token
      let tokenResult;
      try {
        tokenResult = await issueAccessToken(
          user.id,
          clientId,
          validationResult.scope,
          user.tasks_db_id || undefined,
          user.amazon_account_id || undefined
        );
      } catch (tokenError: any) {
        console.error('[OAuth Token] Token issuance error:', {
          error: tokenError,
          error_message: tokenError?.message,
          error_stack: tokenError?.stack,
          user_id: user.id,
        });
        return NextResponse.json(
          { error: 'server_error', error_description: 'Failed to issue access token' },
          { status: 500 }
        );
      }

      console.log('[OAuth Token] Issued token for user:', {
        user_id: user.id,
        email: user.email,
        has_amazon_account_id: !!user.amazon_account_id,
        token_preview: tokenResult.access_token.substring(0, 20) + '...',
        expires_in: tokenResult.expires_in,
      });

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
    console.error('[OAuth Token] Unexpected error:', {
      error: error,
      error_message: error?.message,
      error_stack: error?.stack,
      error_name: error?.name,
    });
    return NextResponse.json(
      { 
        error: 'server_error', 
        error_description: error?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

