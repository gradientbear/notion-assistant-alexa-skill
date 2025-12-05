import crypto from 'crypto';
import { createServerClient } from './supabase';
import { signAccessToken } from './jwt';

const AUTH_CODE_EXPIRES_IN = 600; // 10 minutes
const REFRESH_TOKEN_ENABLED = process.env.REFRESH_TOKEN_ENABLED === 'true';

export interface AuthorizationCode {
  code: string;
  user_id: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge?: string;
  code_challenge_method?: string;
  expires_at: Date;
}

/**
 * Generate a secure random authorization code
 */
export function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Store authorization code in database
 */
export async function storeAuthCode(
  code: string,
  userId: string,
  clientId: string,
  redirectUri: string,
  scope: string = 'alexa',
  codeChallenge?: string,
  codeChallengeMethod?: string
): Promise<void> {
  const supabase = createServerClient();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRES_IN * 1000);

  // Verify user exists before inserting (prevent foreign key constraint violations)
  const { data: userCheck, error: userCheckError } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (userCheckError || !userCheck) {
    console.error('[OAuth] User does not exist when storing auth code:', {
      user_id: userId,
      error: userCheckError,
      user_found: !!userCheck,
    });
    throw new Error(`User ${userId} does not exist in database`);
  }

  const { error } = await supabase.from('oauth_authorization_codes').insert({
    code,
    user_id: userId,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('[OAuth] Error storing auth code:', {
      error_code: error.code,
      error_message: error.message,
      error_details: error.details,
      error_hint: error.hint,
      user_id: userId,
      user_exists: !!userCheck,
    });
    throw new Error(`Failed to store authorization code: ${error.message}`);
  }
}

/**
 * Validate and consume authorization code
 */
export async function validateAuthCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{
  userId: string;
  scope: string;
} | null> {
  const supabase = createServerClient();

  try {
    // Fetch the code
    const { data: authCode, error: fetchError } = await supabase
      .from('oauth_authorization_codes')
      .select('*')
      .eq('code', code)
      .eq('client_id', clientId)
      .eq('redirect_uri', redirectUri)
      .single();

    if (fetchError || !authCode) {
      console.warn('[OAuth] Invalid authorization code:', {
        code_preview: code ? code.substring(0, 10) + '...' : 'missing',
        client_id: clientId,
        redirect_uri: redirectUri,
        error: fetchError,
        error_code: fetchError?.code,
        error_message: fetchError?.message,
      });
      return null;
    }

    // Check expiration
    const expiresAt = new Date(authCode.expires_at);
    if (expiresAt < new Date()) {
      console.warn('[OAuth] Authorization code expired:', {
        expires_at: authCode.expires_at,
        now: new Date().toISOString(),
      });
      return null;
    }

    // Check if already used
    if (authCode.used) {
      console.warn('[OAuth] Authorization code already used:', {
        code_preview: code.substring(0, 10) + '...',
        used_at: authCode.used_at,
      });
      return null;
    }

    // Validate PKCE if present
    if (authCode.code_challenge && codeVerifier) {
      const hash = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      if (hash !== authCode.code_challenge) {
        console.warn('[OAuth] PKCE code verifier mismatch');
        return null;
      }
    }

    // Mark as used
    const { error: updateError } = await supabase
      .from('oauth_authorization_codes')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('code', code);

    if (updateError) {
      console.error('[OAuth] Failed to mark authorization code as used:', {
        error: updateError,
        error_code: updateError.code,
        error_message: updateError.message,
      });
      // Don't fail - code is still valid, just couldn't mark as used
    }

    return {
      userId: authCode.user_id,
      scope: authCode.scope,
    };
  } catch (error: any) {
    console.error('[OAuth] Error validating authorization code:', {
      error: error,
      error_message: error?.message,
      error_stack: error?.stack,
    });
    return null;
  }
}

/**
 * Issue access token and store it
 */
export async function issueAccessToken(
  userId: string,
  clientId: string,
  scope: string,
  notionDbId?: string,
  amazonAccountId?: string
): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const supabase = createServerClient();

  // Get user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  // Generate opaque token (random string) instead of JWT
  const accessToken = crypto.randomBytes(32).toString('base64url');

  const expiresIn = parseInt(process.env.ALEXA_TOKEN_EXPIRES_IN || '86400', 10); // 24 hours default
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Store opaque token in database
  const { error: tokenError } = await supabase
    .from('oauth_access_tokens')
    .insert({
      token: accessToken,
      user_id: userId,
      client_id: clientId,
      scope,
      expires_at: expiresAt.toISOString(),
      revoked: false,
    });

  if (tokenError) {
    console.error('[OAuth] Error storing access token:', tokenError);
    throw new Error('Failed to store access token');
  }

  console.log('[OAuth] Issued opaque access token for user:', userId, 'expires:', expiresAt.toISOString());

  // Generate refresh token if enabled
  let refreshToken: string | undefined;
  if (REFRESH_TOKEN_ENABLED) {
    refreshToken = crypto.randomBytes(32).toString('base64url');
    const { error: refreshError } = await supabase
      .from('oauth_refresh_tokens')
      .insert({
        token: refreshToken,
        user_id: userId,
        client_id: clientId,
        revoked: false,
      });

    if (refreshError) {
      console.warn('[OAuth] Failed to store refresh token, continuing without it');
      refreshToken = undefined;
    }
  }

  return {
    access_token: accessToken,
    expires_in: expiresIn,
    refresh_token: refreshToken,
  };
}

/**
 * Store access token (for migration purposes)
 */
export async function storeAccessToken(
  token: string,
  userId: string,
  clientId: string,
  scope: string,
  expiresAt: Date
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from('oauth_access_tokens').insert({
    token,
    user_id: userId,
    client_id: clientId,
    scope,
    expires_at: expiresAt.toISOString(),
    revoked: false,
  });

  if (error) {
    console.error('[OAuth] Error storing access token:', error);
    throw new Error('Failed to store access token');
  }
}

/**
 * Revoke access token
 */
export async function revokeToken(token: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('oauth_access_tokens')
    .update({ revoked: true, revoked_at: new Date().toISOString() })
    .eq('token', token);

  if (error) {
    console.error('[OAuth] Error revoking token:', error);
    throw new Error('Failed to revoke token');
  }
}

/**
 * Revoke all tokens for a user
 */
export async function revokeUserTokens(userId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('oauth_access_tokens')
    .update({ revoked: true, revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('revoked', false);

  if (error) {
    console.error('[OAuth] Error revoking user tokens:', error);
    throw new Error('Failed to revoke user tokens');
  }

  // Also revoke refresh tokens if enabled
  if (REFRESH_TOKEN_ENABLED) {
    await supabase
      .from('oauth_refresh_tokens')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('revoked', false);
  }
}

/**
 * Check if token is revoked
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('oauth_access_tokens')
    .select('revoked')
    .eq('token', token)
    .single();

  if (error || !data) {
    return true; // If not found, consider it revoked
  }

  return data.revoked === true;
}

/**
 * Validate redirect URI against whitelist
 */
export function validateRedirectUri(redirectUri: string): boolean {
  const allowedUris = (process.env.ALEXA_REDIRECT_URIS || '').split(',').map((uri) => uri.trim());
  return allowedUris.some((uri) => redirectUri.startsWith(uri));
}

